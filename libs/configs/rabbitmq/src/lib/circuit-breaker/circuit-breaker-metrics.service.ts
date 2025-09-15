import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerConfigService } from './circuit-breaker.config';
import { CircuitBreakerState } from './circuit-breaker.types';
import type {
  CircuitBreakerMetrics,
  CircuitBreakerHealth,
} from './circuit-breaker.types';

/**
 * Circuit breaker metrics snapshot.
 */
export interface CircuitBreakerMetricsSnapshot {
  timestamp: string;
  totalCircuitBreakers: number;
  stateDistribution: Record<CircuitBreakerState, number>;
  healthDistribution: Record<'healthy' | 'degraded' | 'unhealthy', number>;
  services: Record<
    string,
    {
      metrics: CircuitBreakerMetrics;
      health: CircuitBreakerHealth;
    }
  >;
  aggregated: {
    totalRequests: number;
    totalSuccesses: number;
    totalFailures: number;
    totalRejections: number;
    overallErrorPercentage: number;
    averageResponseTime: number;
  };
}

/**
 * Circuit breaker alert configuration.
 */
export interface CircuitBreakerAlert {
  id: string;
  type: 'state_change' | 'high_error_rate' | 'high_response_time' | 'recovery';
  severity: 'info' | 'warning' | 'error';
  service: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

/**
 * Metrics aggregation options.
 */
export interface MetricsAggregationOptions {
  timeWindow: number; // milliseconds
  bucketSize: number; // milliseconds
  includeClosed?: boolean;
  includeOpen?: boolean;
  includeHalfOpen?: boolean;
}

/**
 * Circuit breaker metrics and monitoring service.
 *
 * This service provides comprehensive monitoring, alerting, and metrics
 * collection for all circuit breakers in the system.
 */
@Injectable()
export class CircuitBreakerMetricsService {
  private readonly logger = new Logger(CircuitBreakerMetricsService.name);
  private readonly metricsHistory: CircuitBreakerMetricsSnapshot[] = [];
  private readonly maxHistorySize = 1000; // Keep last 1000 snapshots
  private readonly alerts: CircuitBreakerAlert[] = [];
  private readonly maxAlertsSize = 500; // Keep last 500 alerts

  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly configService: CircuitBreakerConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.startMetricsCollection();
  }

  /**
   * Get current metrics snapshot.
   */
  getCurrentSnapshot(): CircuitBreakerMetricsSnapshot {
    return this.createMetricsSnapshot();
  }

  /**
   * Get metrics history for a specified time range.
   */
  getMetricsHistory(
    startTime?: Date,
    endTime?: Date,
  ): CircuitBreakerMetricsSnapshot[] {
    let history = this.metricsHistory;

    if (startTime) {
      history = history.filter(
        (snapshot) => new Date(snapshot.timestamp) >= startTime,
      );
    }

    if (endTime) {
      history = history.filter(
        (snapshot) => new Date(snapshot.timestamp) <= endTime,
      );
    }

    return history;
  }

  /**
   * Get aggregated metrics for a specific service over time.
   */
  getServiceMetricsOverTime(
    serviceName: string,
    options: MetricsAggregationOptions,
  ): Array<{
    timestamp: string;
    metrics: CircuitBreakerMetrics;
    bucketStart: Date;
    bucketEnd: Date;
  }> {
    const now = Date.now();
    const startTime = now - options.timeWindow;
    const buckets: Array<{
      timestamp: string;
      metrics: CircuitBreakerMetrics;
      bucketStart: Date;
      bucketEnd: Date;
    }> = [];

    // Create time buckets
    for (let time = startTime; time < now; time += options.bucketSize) {
      const bucketStart = new Date(time);
      const bucketEnd = new Date(time + options.bucketSize);

      // Find snapshots in this bucket
      const bucketSnapshots = this.metricsHistory.filter((snapshot) => {
        const snapshotTime = new Date(snapshot.timestamp);
        return snapshotTime >= bucketStart && snapshotTime < bucketEnd;
      });

      if (bucketSnapshots.length === 0) continue;

      // Find service metrics in these snapshots
      const serviceMetrics = bucketSnapshots
        .map((snapshot) => snapshot.services[serviceName]?.metrics)
        .filter((metrics) => metrics !== undefined);

      if (serviceMetrics.length === 0) continue;

      // Average the metrics in this bucket
      const avgMetrics = this.averageMetrics(serviceMetrics);

      buckets.push({
        timestamp: bucketEnd.toISOString(),
        metrics: avgMetrics,
        bucketStart,
        bucketEnd,
      });
    }

    return buckets;
  }

  /**
   * Get recent alerts.
   */
  getAlerts(
    limit = 50,
    severity?: 'info' | 'warning' | 'error',
    service?: string,
  ): CircuitBreakerAlert[] {
    let alerts = [...this.alerts].reverse(); // Most recent first

    if (severity) {
      alerts = alerts.filter((alert) => alert.severity === severity);
    }

    if (service) {
      alerts = alerts.filter((alert) => alert.service === service);
    }

    return alerts.slice(0, limit);
  }

  /**
   * Get error rate trends for all services.
   */
  getErrorRateTrends(timeWindow = 300000): Record<
    string,
    {
      current: number;
      trend: 'increasing' | 'decreasing' | 'stable';
      change: number;
      history: Array<{ timestamp: string; errorRate: number }>;
    }
  > {
    const trends: Record<
      string,
      {
        current: number;
        trend: 'increasing' | 'decreasing' | 'stable';
        change: number;
        history: Array<{ timestamp: string; errorRate: number }>;
      }
    > = {};
    const now = Date.now();
    const startTime = now - timeWindow;

    // Get recent snapshots
    const recentSnapshots = this.metricsHistory.filter(
      (snapshot) => new Date(snapshot.timestamp).getTime() >= startTime,
    );

    if (recentSnapshots.length < 2) {
      return trends; // Need at least 2 data points for trends
    }

    // Extract unique service names
    const serviceNames = new Set<string>();
    recentSnapshots.forEach((snapshot) => {
      Object.keys(snapshot.services).forEach((service) =>
        serviceNames.add(service),
      );
    });

    // Calculate trends for each service
    for (const serviceName of serviceNames) {
      const serviceHistory = recentSnapshots
        .map((snapshot) => ({
          timestamp: snapshot.timestamp,
          errorRate:
            snapshot.services[serviceName]?.metrics?.errorPercentage || 0,
        }))
        .filter((point) => point.errorRate !== undefined);

      if (serviceHistory.length < 2) continue;

      const current = serviceHistory[serviceHistory.length - 1].errorRate;
      const previous = serviceHistory[serviceHistory.length - 2].errorRate;
      const change = current - previous;

      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (Math.abs(change) > 5) {
        // 5% threshold for trend detection
        trend = change > 0 ? 'increasing' : 'decreasing';
      }

      trends[serviceName] = {
        current,
        trend,
        change,
        history: serviceHistory,
      };
    }

    return trends;
  }

  /**
   * Get response time percentiles for a service.
   */
  getResponseTimePercentiles(
    serviceName: string,
    timeWindow = 300000,
  ): {
    p50: number;
    p95: number;
    p99: number;
    average: number;
    count: number;
  } | null {
    const now = Date.now();
    const startTime = now - timeWindow;

    const recentSnapshots = this.metricsHistory.filter(
      (snapshot) => new Date(snapshot.timestamp).getTime() >= startTime,
    );

    const responseTimes = recentSnapshots
      .map(
        (snapshot) =>
          snapshot.services[serviceName]?.metrics?.averageResponseTime,
      )
      .filter((time) => time !== undefined && time > 0);

    if (responseTimes.length === 0) return null;

    responseTimes.sort((a, b) => a - b);

    const count = responseTimes.length;
    const p50Index = Math.floor(count * 0.5);
    const p95Index = Math.floor(count * 0.95);
    const p99Index = Math.floor(count * 0.99);

    const sum = responseTimes.reduce((acc, time) => acc + time, 0);
    const average = sum / count;

    return {
      p50: responseTimes[p50Index],
      p95: responseTimes[p95Index],
      p99: responseTimes[p99Index],
      average,
      count,
    };
  }

  /**
   * Generate metrics summary report.
   */
  generateSummaryReport(): {
    overview: {
      totalServices: number;
      healthyServices: number;
      degradedServices: number;
      unhealthyServices: number;
      openCircuitBreakers: number;
    };
    topIssues: Array<{
      service: string;
      issue: string;
      severity: 'high' | 'medium' | 'low';
      recommendation: string;
    }>;
    recentAlerts: CircuitBreakerAlert[];
    trends: Record<string, { trend: string; change: number }>;
  } {
    const currentSnapshot = this.getCurrentSnapshot();
    const errorTrends = this.getErrorRateTrends();
    const recentAlerts = this.getAlerts(10);

    // Identify top issues
    const topIssues: Array<{
      service: string;
      issue: string;
      severity: 'high' | 'medium' | 'low';
      recommendation: string;
    }> = [];

    for (const [serviceName, serviceData] of Object.entries(
      currentSnapshot.services,
    )) {
      const { metrics, health } = serviceData;

      // High error rate
      if (metrics.errorPercentage > 50) {
        topIssues.push({
          service: serviceName,
          issue: `High error rate: ${metrics.errorPercentage.toFixed(1)}%`,
          severity: 'high',
          recommendation:
            'Check service logs and dependencies. Consider circuit breaker reset if service is recovered.',
        });
      }

      // High response times
      if (metrics.averageResponseTime > 10000) {
        topIssues.push({
          service: serviceName,
          issue: `High response time: ${Math.round(metrics.averageResponseTime)}ms`,
          severity: 'medium',
          recommendation:
            'Investigate performance issues. Consider timeout adjustments.',
        });
      }

      // Circuit breaker open
      if (health.state === CircuitBreakerState.OPEN) {
        topIssues.push({
          service: serviceName,
          issue: 'Circuit breaker is OPEN',
          severity: 'high',
          recommendation:
            'Service is failing fast. Investigate and fix underlying issues before resetting.',
        });
      }
    }

    // Sort by severity
    const severityOrder = { high: 3, medium: 2, low: 1 };
    topIssues.sort(
      (a, b) => severityOrder[b.severity] - severityOrder[a.severity],
    );

    return {
      overview: {
        totalServices: currentSnapshot.totalCircuitBreakers,
        healthyServices: currentSnapshot.healthDistribution.healthy || 0,
        degradedServices: currentSnapshot.healthDistribution.degraded || 0,
        unhealthyServices: currentSnapshot.healthDistribution.unhealthy || 0,
        openCircuitBreakers:
          currentSnapshot.stateDistribution[CircuitBreakerState.OPEN] || 0,
      },
      topIssues: topIssues.slice(0, 10),
      recentAlerts,
      trends: Object.fromEntries(
        Object.entries(errorTrends).map(([service, trend]) => [
          service,
          { trend: trend.trend, change: trend.change },
        ]),
      ),
    };
  }

  /**
   * Start periodic metrics collection.
   */
  private startMetricsCollection(): void {
    const monitoringConfig = this.configService.getMonitoringConfig();

    if (!monitoringConfig.enabled) {
      this.logger.log('Circuit breaker metrics collection disabled');
      return;
    }

    // Collect metrics periodically
    setInterval(() => {
      try {
        const snapshot = this.createMetricsSnapshot();
        this.addMetricsSnapshot(snapshot);
        this.checkForAlerts(snapshot);
      } catch (error) {
        this.logger.error('Error collecting circuit breaker metrics', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, monitoringConfig.metricsInterval);

    this.logger.log('Circuit breaker metrics collection started', {
      interval: monitoringConfig.metricsInterval,
    });
  }

  /**
   * Create a metrics snapshot.
   */
  private createMetricsSnapshot(): CircuitBreakerMetricsSnapshot {
    const allHealth = this.circuitBreakerService.getAllHealth();

    // State distribution
    const stateDistribution: Record<CircuitBreakerState, number> = {
      [CircuitBreakerState.CLOSED]: 0,
      [CircuitBreakerState.OPEN]: 0,
      [CircuitBreakerState.HALF_OPEN]: 0,
    };

    // Health distribution
    const healthDistribution: Record<
      'healthy' | 'degraded' | 'unhealthy',
      number
    > = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
    };

    // Services data
    const services: Record<
      string,
      { metrics: CircuitBreakerMetrics; health: CircuitBreakerHealth }
    > = {};

    // Aggregated metrics
    let totalRequests = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;
    let totalRejections = 0;
    let totalResponseTime = 0;
    let servicesWithResponseTime = 0;

    for (const [key, health] of Object.entries(allHealth)) {
      stateDistribution[health.state]++;
      healthDistribution[health.status]++;

      services[key] = {
        metrics: health.metrics,
        health,
      };

      // Aggregate metrics
      totalRequests += health.metrics.requestCount;
      totalSuccesses += health.metrics.successCount;
      totalFailures += health.metrics.failureCount;
      totalRejections += health.metrics.rejectionCount;

      if (health.metrics.averageResponseTime > 0) {
        totalResponseTime += health.metrics.averageResponseTime;
        servicesWithResponseTime++;
      }
    }

    const overallErrorPercentage =
      totalRequests > 0
        ? (totalFailures / (totalSuccesses + totalFailures)) * 100
        : 0;
    const averageResponseTime =
      servicesWithResponseTime > 0
        ? totalResponseTime / servicesWithResponseTime
        : 0;

    return {
      timestamp: new Date().toISOString(),
      totalCircuitBreakers: Object.keys(allHealth).length,
      stateDistribution,
      healthDistribution,
      services,
      aggregated: {
        totalRequests,
        totalSuccesses,
        totalFailures,
        totalRejections,
        overallErrorPercentage,
        averageResponseTime,
      },
    };
  }

  /**
   * Add metrics snapshot to history.
   */
  private addMetricsSnapshot(snapshot: CircuitBreakerMetricsSnapshot): void {
    this.metricsHistory.push(snapshot);

    // Maintain history size limit
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.splice(
        0,
        this.metricsHistory.length - this.maxHistorySize,
      );
    }
  }

  /**
   * Check for alert conditions and generate alerts.
   */
  private checkForAlerts(snapshot: CircuitBreakerMetricsSnapshot): void {
    const alertThreshold =
      this.configService.getMonitoringConfig().alertThreshold;

    for (const [serviceName, serviceData] of Object.entries(
      snapshot.services,
    )) {
      const { metrics, health } = serviceData;

      // State change alerts
      this.checkStateChangeAlerts(serviceName, health);

      // High error rate alerts
      if (metrics.errorPercentage > alertThreshold) {
        this.addAlert({
          id: `${serviceName}-high-error-rate-${Date.now()}`,
          type: 'high_error_rate',
          severity: metrics.errorPercentage > 80 ? 'error' : 'warning',
          service: serviceName,
          message: `High error rate: ${metrics.errorPercentage.toFixed(1)}%`,
          metadata: {
            errorPercentage: metrics.errorPercentage,
            threshold: alertThreshold,
            requestCount: metrics.requestCount,
          },
          timestamp: new Date().toISOString(),
        });
      }

      // High response time alerts
      if (metrics.averageResponseTime > 10000) {
        this.addAlert({
          id: `${serviceName}-high-response-time-${Date.now()}`,
          type: 'high_response_time',
          severity: metrics.averageResponseTime > 30000 ? 'error' : 'warning',
          service: serviceName,
          message: `High response time: ${Math.round(metrics.averageResponseTime)}ms`,
          metadata: {
            averageResponseTime: metrics.averageResponseTime,
            requestCount: metrics.requestCount,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * Check for state change alerts by comparing with previous snapshot.
   */
  private checkStateChangeAlerts(
    serviceName: string,
    currentHealth: CircuitBreakerHealth,
  ): void {
    if (this.metricsHistory.length === 0) return;

    const previousSnapshot =
      this.metricsHistory[this.metricsHistory.length - 1];
    const previousHealth = previousSnapshot.services[serviceName]?.health;

    if (!previousHealth || previousHealth.state === currentHealth.state) return;

    // Circuit breaker state changed
    let severity: 'info' | 'warning' | 'error' = 'info';
    if (currentHealth.state === CircuitBreakerState.OPEN) {
      severity = 'error';
    } else if (currentHealth.state === CircuitBreakerState.HALF_OPEN) {
      severity = 'warning';
    }

    this.addAlert({
      id: `${serviceName}-state-change-${Date.now()}`,
      type: 'state_change',
      severity,
      service: serviceName,
      message: `Circuit breaker state changed from ${previousHealth.state} to ${currentHealth.state}`,
      metadata: {
        previousState: previousHealth.state,
        currentState: currentHealth.state,
        errorPercentage: currentHealth.metrics.errorPercentage,
      },
      timestamp: new Date().toISOString(),
    });

    // Emit event for other services to react
    this.eventEmitter.emit('circuit-breaker.state-changed', {
      serviceName,
      previousState: previousHealth.state,
      currentState: currentHealth.state,
      health: currentHealth,
    });
  }

  /**
   * Add alert to the alerts list.
   */
  private addAlert(alert: CircuitBreakerAlert): void {
    this.alerts.push(alert);

    // Maintain alerts size limit
    if (this.alerts.length > this.maxAlertsSize) {
      this.alerts.splice(0, this.alerts.length - this.maxAlertsSize);
    }

    // Log the alert
    const logLevel =
      alert.severity === 'error'
        ? 'error'
        : alert.severity === 'warning'
          ? 'warn'
          : 'log';
    this.logger[logLevel](`Circuit breaker alert: ${alert.message}`, {
      service: alert.service,
      type: alert.type,
      metadata: alert.metadata,
    });

    // Emit event for external handling
    this.eventEmitter.emit('circuit-breaker.alert', alert);
  }

  /**
   * Average multiple metrics objects.
   */
  private averageMetrics(
    metricsArray: CircuitBreakerMetrics[],
  ): CircuitBreakerMetrics {
    const count = metricsArray.length;

    const averaged: CircuitBreakerMetrics = {
      state: metricsArray[count - 1].state, // Use latest state
      requestCount: Math.round(
        metricsArray.reduce((sum, m) => sum + m.requestCount, 0) / count,
      ),
      successCount: Math.round(
        metricsArray.reduce((sum, m) => sum + m.successCount, 0) / count,
      ),
      failureCount: Math.round(
        metricsArray.reduce((sum, m) => sum + m.failureCount, 0) / count,
      ),
      rejectionCount: Math.round(
        metricsArray.reduce((sum, m) => sum + m.rejectionCount, 0) / count,
      ),
      errorPercentage:
        metricsArray.reduce((sum, m) => sum + m.errorPercentage, 0) / count,
      averageResponseTime:
        metricsArray.reduce((sum, m) => sum + m.averageResponseTime, 0) / count,
      lastStateChange: Math.max(...metricsArray.map((m) => m.lastStateChange)),
    };

    // Include last error from most recent metrics
    const lastError = metricsArray[count - 1].lastError;
    if (lastError) {
      averaged.lastError = lastError;
    }

    return averaged;
  }
}
