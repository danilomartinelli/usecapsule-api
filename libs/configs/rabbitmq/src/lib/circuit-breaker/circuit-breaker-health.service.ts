import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicator } from '@nestjs/terminus';
import type { TimeoutOperation } from '@usecapsule/parameters';

import type { CircuitBreakerConfigService } from './circuit-breaker.config';
import type { CircuitBreakerService } from './circuit-breaker.service';
import type { CircuitBreakerHealth } from './circuit-breaker.types';
import { CircuitBreakerState } from './circuit-breaker.types';

/**
 * Enhanced health indicator result that includes circuit breaker information.
 */
export interface CircuitBreakerHealthResult {
  [key: string]: {
    status: 'up' | 'down';
    message?: string;
    error?: string;
    'circuit-breakers'?: Record<
      string,
      {
        status: string;
        state: CircuitBreakerState;
        metrics: {
          errorPercentage: number;
          requestCount: number;
          averageResponseTime: number;
          timeToReset?: number;
        };
      }
    >;
    summary?: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
  };
}

/**
 * Aggregated health status for all circuit breakers.
 */
export interface AggregatedCircuitBreakerHealth {
  status: 'up' | 'down';
  summary: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
  services: Record<string, CircuitBreakerHealth>;
  timestamp: string;
}

/**
 * Health indicator service for circuit breakers.
 *
 * This service provides comprehensive health checking for all circuit breakers
 * in the system, integrating with NestJS Terminus health checks.
 */
@Injectable()
export class CircuitBreakerHealthService extends HealthIndicator {
  private readonly logger = new Logger(CircuitBreakerHealthService.name);

  constructor(
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly configService: CircuitBreakerConfigService,
  ) {
    super();
  }

  /**
   * Perform health check for all circuit breakers.
   *
   * @param key - Health check key
   * @returns Health indicator result
   */
  async checkCircuitBreakers(
    key = 'circuitBreakers',
  ): Promise<CircuitBreakerHealthResult> {
    if (!this.configService.isEnabled()) {
      return {
        [key]: {
          status: 'up' as const,
          message: 'Circuit breakers are disabled',
          'circuit-breakers': {},
        },
      };
    }

    try {
      const allHealth = this.circuitBreakerService.getAllHealth();
      const healthSummary = this.summarizeHealth(allHealth);

      const isHealthy = healthSummary.summary.unhealthy === 0;

      const circuitBreakersInfo: Record<
        string,
        {
          status: string;
          state: CircuitBreakerState;
          metrics: {
            errorPercentage: number;
            requestCount: number;
            averageResponseTime: number;
            timeToReset?: number;
          };
        }
      > = {};
      for (const [serviceKey, health] of Object.entries(allHealth)) {
        circuitBreakersInfo[serviceKey] = {
          status: health.status,
          state: health.state,
          metrics: {
            errorPercentage:
              Math.round(health.metrics.errorPercentage * 100) / 100,
            requestCount: health.metrics.requestCount,
            averageResponseTime: Math.round(health.metrics.averageResponseTime),
            ...(health.metrics.timeToReset && {
              timeToReset: health.metrics.timeToReset,
            }),
          },
        };
      }

      return {
        [key]: {
          status: isHealthy ? ('up' as const) : ('down' as const),
          summary: healthSummary.summary,
          'circuit-breakers': circuitBreakersInfo,
          message: isHealthy
            ? 'All circuit breakers are healthy'
            : `${healthSummary.summary.unhealthy} circuit breaker(s) are unhealthy`,
        },
      };
    } catch (error) {
      this.logger.error('Error checking circuit breaker health', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        [key]: {
          status: 'down' as const,
          message: 'Error checking circuit breaker health',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  }

  /**
   * Get aggregated health status for all circuit breakers.
   */
  getAggregatedHealth(): AggregatedCircuitBreakerHealth {
    const allHealth = this.circuitBreakerService.getAllHealth();
    const summary = this.summarizeHealth(allHealth);

    return {
      status: summary.summary.unhealthy === 0 ? 'up' : 'down',
      summary: summary.summary,
      services: allHealth,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check health of a specific circuit breaker.
   *
   * @param serviceName - Service name
   * @param operation - Optional operation type
   * @returns Circuit breaker health or null if not found
   */
  getServiceHealth(
    serviceName: string,
    operation?: TimeoutOperation,
  ): CircuitBreakerHealth | null {
    return this.circuitBreakerService.getHealth(serviceName, operation);
  }

  /**
   * Check if a specific service's circuit breaker is healthy.
   *
   * @param serviceName - Service name
   * @param operation - Optional operation type
   * @returns True if healthy, false otherwise
   */
  isServiceHealthy(serviceName: string, operation?: TimeoutOperation): boolean {
    const health = this.getServiceHealth(serviceName, operation);
    return health ? health.status === 'healthy' : false;
  }

  /**
   * Get circuit breakers that are currently in open state.
   */
  getOpenCircuitBreakers(): Record<string, CircuitBreakerHealth> {
    const allHealth = this.circuitBreakerService.getAllHealth();
    const openBreakers: Record<string, CircuitBreakerHealth> = {};

    for (const [key, health] of Object.entries(allHealth)) {
      if (health.state === CircuitBreakerState.OPEN) {
        openBreakers[key] = health;
      }
    }

    return openBreakers;
  }

  /**
   * Get circuit breakers that are currently in degraded state.
   */
  getDegradedCircuitBreakers(): Record<string, CircuitBreakerHealth> {
    const allHealth = this.circuitBreakerService.getAllHealth();
    const degradedBreakers: Record<string, CircuitBreakerHealth> = {};

    for (const [key, health] of Object.entries(allHealth)) {
      if (health.status === 'degraded') {
        degradedBreakers[key] = health;
      }
    }

    return degradedBreakers;
  }

  /**
   * Reset all circuit breakers for a service.
   *
   * @param serviceName - Service name
   * @returns Number of circuit breakers reset
   */
  resetServiceCircuitBreakers(serviceName: string): number {
    let resetCount = 0;

    // Try to reset the main circuit breaker
    if (this.circuitBreakerService.resetCircuitBreaker(serviceName)) {
      resetCount++;
    }

    // Try to reset operation-specific circuit breakers
    const commonOperations = ['RPC_CALL', 'HEALTH_CHECK', 'DATABASE_QUERY'];
    for (const operation of commonOperations) {
      if (
        this.circuitBreakerService.resetCircuitBreaker(
          serviceName,
          operation as TimeoutOperation,
        )
      ) {
        resetCount++;
      }
    }

    this.logger.log(`Reset ${resetCount} circuit breaker(s) for service`, {
      serviceName,
      resetCount,
    });

    return resetCount;
  }

  /**
   * Get health check recommendations based on current circuit breaker state.
   */
  getHealthRecommendations(): Array<{
    type: 'warning' | 'error' | 'info';
    service: string;
    message: string;
    action?: string;
  }> {
    const recommendations: Array<{
      type: 'warning' | 'error' | 'info';
      service: string;
      message: string;
      action?: string;
    }> = [];

    const allHealth = this.circuitBreakerService.getAllHealth();

    for (const [, health] of Object.entries(allHealth)) {
      const serviceName = health.service;

      switch (health.state) {
        case CircuitBreakerState.OPEN:
          recommendations.push({
            type: 'error',
            service: serviceName,
            message: `Circuit breaker is OPEN - service is failing fast`,
            action: `Check service logs and health. Consider manual reset if service is recovered.`,
          });
          break;

        case CircuitBreakerState.HALF_OPEN:
          recommendations.push({
            type: 'warning',
            service: serviceName,
            message: `Circuit breaker is HALF_OPEN - service is being tested for recovery`,
            action: `Monitor closely. Service is attempting recovery.`,
          });
          break;

        case CircuitBreakerState.CLOSED:
          if (health.status === 'degraded') {
            recommendations.push({
              type: 'warning',
              service: serviceName,
              message: `Circuit breaker is CLOSED but service is degraded (${health.metrics.errorPercentage.toFixed(1)}% error rate)`,
              action: `Monitor error rates. Service may trip to OPEN soon.`,
            });
          } else if (health.metrics.averageResponseTime > 5000) {
            recommendations.push({
              type: 'info',
              service: serviceName,
              message: `Service has high response times (${Math.round(health.metrics.averageResponseTime)}ms average)`,
              action: `Consider performance optimization or timeout adjustments.`,
            });
          }
          break;
      }
    }

    // Add general recommendations
    const openCount = Object.values(allHealth).filter(
      (h) => h.state === CircuitBreakerState.OPEN,
    ).length;
    if (openCount > 1) {
      recommendations.push({
        type: 'error',
        service: 'system',
        message: `Multiple services (${openCount}) have circuit breakers in OPEN state`,
        action: `This may indicate a systemic issue. Check infrastructure, network, and dependencies.`,
      });
    }

    return recommendations;
  }

  /**
   * Summarize health status across all circuit breakers.
   */
  private summarizeHealth(allHealth: Record<string, CircuitBreakerHealth>) {
    const summary = {
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
    };

    for (const health of Object.values(allHealth)) {
      summary.total++;
      switch (health.status) {
        case 'healthy':
          summary.healthy++;
          break;
        case 'degraded':
          summary.degraded++;
          break;
        case 'unhealthy':
          summary.unhealthy++;
          break;
      }
    }

    return { summary };
  }
}
