import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { ServiceName } from '@usecapsule/parameters';
import { TimeoutOperation } from '@usecapsule/parameters';
import CircuitBreaker from 'opossum';
import { CircuitBreakerConfigService } from './circuit-breaker.config';
import type {
  CircuitBreakerHealth,
  CircuitBreakerMetrics,
  CircuitBreakerResult,
  RecoveryStrategy,
  ServiceCircuitBreakerOptions,
} from './circuit-breaker.types';
import { CircuitBreakerState } from './circuit-breaker.types';

/**
 * Circuit breaker service that provides fault tolerance for RabbitMQ operations.
 *
 * This service integrates with the existing timeout system and provides:
 * - Automatic failure detection and isolation
 * - Configurable recovery strategies
 * - Comprehensive monitoring and metrics
 * - Health status reporting
 * - Integration with @golevelup/nestjs-rabbitmq
 */
@Injectable()
export class CircuitBreakerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();
  private readonly circuitBreakerConfigs = new Map<
    string,
    Record<string, unknown>
  >();
  private readonly metricsMap = new Map<string, CircuitBreakerMetrics>();
  private readonly recoveryTimers = new Map<string, NodeJS.Timeout>();
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(private readonly configService: CircuitBreakerConfigService) {}

  async onModuleInit() {
    const monitoringConfig = this.configService.getMonitoringConfig();

    if (monitoringConfig.enabled) {
      this.startMetricsCollection(monitoringConfig.metricsInterval);
      this.startHealthChecks(monitoringConfig.healthCheckInterval);
    }

    this.logger.log('CircuitBreakerService initialized', {
      enabled: this.configService.isEnabled(),
      monitoring: monitoringConfig.enabled,
    });
  }

  async onModuleDestroy() {
    // Cleanup intervals
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Cleanup recovery timers
    for (const timer of this.recoveryTimers.values()) {
      clearTimeout(timer);
    }

    this.logger.log('CircuitBreakerService destroyed');
  }

  /**
   * Execute a function with circuit breaker protection.
   *
   * @param fn - Function to execute
   * @param options - Circuit breaker options
   * @returns Promise resolving to circuit breaker result
   */
  async execute<T = unknown>(
    fn: (...args: unknown[]) => Promise<T>,
    options: ServiceCircuitBreakerOptions,
    ...args: unknown[]
  ): Promise<CircuitBreakerResult<T>> {
    const circuitBreakerKey = this.getCircuitBreakerKey(
      options.serviceName,
      options.operation,
    );

    if (!this.configService.isEnabled(options.serviceName)) {
      // Circuit breaker disabled, execute directly
      const startTime = Date.now();
      try {
        const data = await fn(...args);
        return {
          data,
          success: true,
          executionTime: Date.now() - startTime,
          circuitState: CircuitBreakerState.CLOSED,
          fromFallback: false,
        };
      } catch (error) {
        return {
          data: undefined as T,
          success: false,
          executionTime: Date.now() - startTime,
          circuitState: CircuitBreakerState.CLOSED,
          fromFallback: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    const circuitBreaker = this.getOrCreateCircuitBreaker(options);
    const startTime = Date.now();

    try {
      const data = await circuitBreaker.fire(...args);
      const executionTime = Date.now() - startTime;

      this.updateMetrics(circuitBreakerKey, {
        success: true,
        executionTime,
        fromFallback: false,
      });

      return {
        data: data as T,
        success: true,
        executionTime,
        circuitState: this.mapOssumStateToOurState(
          circuitBreaker.toJSON().state,
        ),
        fromFallback: false,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const fromFallback =
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'OPOSSUM_FALLBACK_TRIGGERED';

      this.updateMetrics(circuitBreakerKey, {
        success: false,
        executionTime,
        fromFallback: Boolean(fromFallback),
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (fromFallback) {
        return {
          data: (error && typeof error === 'object' && 'fallbackValue' in error
            ? error.fallbackValue
            : undefined) as T,
          success: true, // Fallback is considered a success
          executionTime,
          circuitState: this.mapOssumStateToOurState(
            circuitBreaker.toJSON().state,
          ),
          fromFallback: true,
        };
      }

      return {
        data: undefined as T,
        success: false,
        executionTime,
        circuitState: this.mapOssumStateToOurState(
          circuitBreaker.toJSON().state,
        ),
        fromFallback: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get circuit breaker metrics for a service.
   */
  getMetrics(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ): CircuitBreakerMetrics | null {
    const key = this.getCircuitBreakerKey(serviceName, operation);
    return this.metricsMap.get(key) || null;
  }

  /**
   * Get health status for a service's circuit breaker.
   */
  getHealth(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ): CircuitBreakerHealth | null {
    const key = this.getCircuitBreakerKey(serviceName, operation);
    const metrics = this.metricsMap.get(key);
    const circuitBreaker = this.circuitBreakers.get(key);

    if (!metrics || !circuitBreaker) {
      return null;
    }

    const status = this.determineHealthStatus(metrics);

    return {
      service: String(serviceName),
      state: metrics.state,
      status,
      metrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get health status for all circuit breakers.
   */
  getAllHealth(): Record<string, CircuitBreakerHealth> {
    const health: Record<string, CircuitBreakerHealth> = {};

    for (const [key, metrics] of this.metricsMap.entries()) {
      const serviceName = this.extractServiceNameFromKey(key);
      const status = this.determineHealthStatus(metrics);

      health[key] = {
        service: serviceName,
        state: metrics.state,
        status,
        metrics,
        timestamp: new Date().toISOString(),
      };
    }

    return health;
  }

  /**
   * Manually reset a circuit breaker.
   */
  resetCircuitBreaker(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ): boolean {
    const key = this.getCircuitBreakerKey(serviceName, operation);
    const circuitBreaker = this.circuitBreakers.get(key);

    if (circuitBreaker) {
      circuitBreaker.close();
      this.logger.log(`Circuit breaker manually reset`, {
        service: serviceName,
        operation,
      });
      return true;
    }

    return false;
  }

  /**
   * Get debug information about all circuit breakers.
   */
  getDebugInfo(): Record<string, unknown> {
    const circuitBreakers: Record<string, unknown> = {};

    for (const [key, breaker] of this.circuitBreakers.entries()) {
      circuitBreakers[key] = {
        state: breaker.toJSON().state,
        stats: breaker.stats,
        options: this.circuitBreakerConfigs.get(key) || {},
      };
    }

    return {
      globalConfig: this.configService.getDebugInfo(),
      activeCircuitBreakers: Object.keys(circuitBreakers),
      circuitBreakers,
      metricsKeys: Array.from(this.metricsMap.keys()),
    };
  }

  /**
   * Get or create a circuit breaker for the given options.
   */
  private getOrCreateCircuitBreaker(
    options: ServiceCircuitBreakerOptions,
  ): CircuitBreaker {
    const key = this.getCircuitBreakerKey(
      options.serviceName,
      options.operation,
    );

    if (this.circuitBreakers.has(key)) {
      return this.circuitBreakers.get(key) as CircuitBreaker;
    }

    const config = this.configService.getServiceConfig(
      options.serviceName,
      options.operation,
    );
    const mergedConfig = { ...config, ...options.config };

    const circuitBreaker = new CircuitBreaker(this.createAsyncFunction(), {
      timeout: mergedConfig.timeout,
      errorThresholdPercentage: mergedConfig.errorThresholdPercentage,
      resetTimeout: mergedConfig.resetTimeout,
      volumeThreshold: mergedConfig.volumeThreshold,
      rollingCountTimeout: mergedConfig.rollingCountTimeout,
      rollingCountBuckets: mergedConfig.rollingCountBuckets,
      errorFilter: mergedConfig.errorFilter,
    });

    // Configure fallback if provided
    if (mergedConfig.fallback) {
      circuitBreaker.fallback(mergedConfig.fallback);
    }

    this.setupCircuitBreakerListeners(circuitBreaker, key, options);
    this.circuitBreakers.set(key, circuitBreaker);
    this.circuitBreakerConfigs.set(key, mergedConfig);
    this.initializeMetrics(key);

    this.logger.log(`Created circuit breaker`, {
      key,
      service: options.serviceName,
      operation: options.operation,
      config: {
        timeout: mergedConfig.timeout,
        errorThreshold: mergedConfig.errorThresholdPercentage,
        resetTimeout: mergedConfig.resetTimeout,
      },
    });

    return circuitBreaker;
  }

  /**
   * Create the async function wrapper for circuit breaker.
   */
  private createAsyncFunction() {
    return async (
      originalFn: (...args: unknown[]) => Promise<unknown>,
      ...args: unknown[]
    ) => {
      return originalFn(...args);
    };
  }

  /**
   * Setup event listeners for circuit breaker monitoring.
   */
  private setupCircuitBreakerListeners(
    circuitBreaker: CircuitBreaker,
    key: string,
    options: ServiceCircuitBreakerOptions,
  ): void {
    circuitBreaker.on('open', () => {
      this.logger.warn(`Circuit breaker opened`, {
        service: options.serviceName,
        operation: options.operation,
      });
      this.updateCircuitBreakerState(key, CircuitBreakerState.OPEN);
      this.scheduleRecovery(key, options);
    });

    circuitBreaker.on('halfOpen', () => {
      this.logger.log(`Circuit breaker half-open`, {
        service: options.serviceName,
        operation: options.operation,
      });
      this.updateCircuitBreakerState(key, CircuitBreakerState.HALF_OPEN);
    });

    circuitBreaker.on('close', () => {
      this.logger.log(`Circuit breaker closed`, {
        service: options.serviceName,
        operation: options.operation,
      });
      this.updateCircuitBreakerState(key, CircuitBreakerState.CLOSED);
      this.clearRecoveryTimer(key);
    });

    circuitBreaker.on('reject', () => {
      this.updateMetrics(key, {
        success: false,
        rejected: true,
        executionTime: 0,
        fromFallback: false,
      });
    });
  }

  /**
   * Schedule recovery attempts based on recovery strategy.
   */
  private scheduleRecovery(
    key: string,
    options: ServiceCircuitBreakerOptions,
  ): void {
    const strategy = this.configService.getRecoveryStrategy(
      options.serviceName,
    );

    if (strategy.type === 'immediate') {
      return; // Let circuit breaker handle immediate recovery
    }

    let attempt = 0;
    const scheduleNext = () => {
      if (attempt >= strategy.maxAttempts) {
        this.logger.warn(`Max recovery attempts reached`, {
          service: options.serviceName,
          attempts: attempt,
        });
        return;
      }

      const delay = this.calculateRecoveryDelay(strategy, attempt);

      const timer = setTimeout(async () => {
        attempt++;

        if (strategy.type === 'custom' && strategy.customRecovery) {
          try {
            const recovered = await strategy.customRecovery();
            if (recovered) {
              this.resetCircuitBreaker(options.serviceName, options.operation);
              return;
            }
          } catch (error) {
            this.logger.warn(`Custom recovery failed`, {
              service: options.serviceName,
              attempt,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        // Schedule next attempt if circuit breaker is still open
        const circuitBreaker = this.circuitBreakers.get(key);
        if (circuitBreaker && circuitBreaker.toJSON().state.open) {
          scheduleNext();
        }
      }, delay);

      this.recoveryTimers.set(`${key}-${attempt}`, timer);
    };

    scheduleNext();
  }

  /**
   * Calculate recovery delay based on strategy.
   */
  private calculateRecoveryDelay(
    strategy: RecoveryStrategy,
    attempt: number,
  ): number {
    switch (strategy.type) {
      case 'exponential_backoff':
        return Math.min(
          strategy.baseDelay * Math.pow(strategy.multiplier, attempt),
          strategy.maxDelay,
        );
      case 'linear_backoff':
        return Math.min(
          strategy.baseDelay + strategy.baseDelay * attempt,
          strategy.maxDelay,
        );
      case 'immediate':
        return 0;
      default:
        return strategy.baseDelay;
    }
  }

  /**
   * Clear recovery timer for a circuit breaker.
   */
  private clearRecoveryTimer(key: string): void {
    for (const [timerKey, timer] of this.recoveryTimers.entries()) {
      if (timerKey.startsWith(key)) {
        clearTimeout(timer);
        this.recoveryTimers.delete(timerKey);
      }
    }
  }

  /**
   * Generate circuit breaker key.
   */
  private getCircuitBreakerKey(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ): string {
    const service = String(serviceName);
    return operation ? `${service}:${operation}` : service;
  }

  /**
   * Extract service name from circuit breaker key.
   */
  private extractServiceNameFromKey(key: string): string {
    return key.split(':')[0];
  }

  /**
   * Map Opossum state to our circuit breaker state.
   */
  private mapOssumStateToOurState(
    opossumState: string | { open?: boolean; halfOpen?: boolean },
  ): CircuitBreakerState {
    // Handle both old string format and new State object format
    if (typeof opossumState === 'object') {
      if (opossumState.open) {
        return CircuitBreakerState.OPEN;
      }
      if (opossumState.halfOpen) {
        return CircuitBreakerState.HALF_OPEN;
      }
      return CircuitBreakerState.CLOSED;
    }

    // Legacy string format
    switch (opossumState) {
      case 'open':
        return CircuitBreakerState.OPEN;
      case 'halfOpen':
        return CircuitBreakerState.HALF_OPEN;
      case 'closed':
      default:
        return CircuitBreakerState.CLOSED;
    }
  }

  /**
   * Initialize metrics for a circuit breaker.
   */
  private initializeMetrics(key: string): void {
    this.metricsMap.set(key, {
      state: CircuitBreakerState.CLOSED,
      requestCount: 0,
      successCount: 0,
      failureCount: 0,
      rejectionCount: 0,
      errorPercentage: 0,
      averageResponseTime: 0,
      lastStateChange: Date.now(),
    });
  }

  /**
   * Update circuit breaker metrics.
   */
  private updateMetrics(
    key: string,
    update: {
      success: boolean;
      executionTime: number;
      fromFallback: boolean;
      rejected?: boolean;
      error?: string;
    },
  ): void {
    const metrics = this.metricsMap.get(key);
    if (!metrics) return;

    metrics.requestCount++;

    if (update.rejected) {
      metrics.rejectionCount++;
    } else if (update.success) {
      metrics.successCount++;
    } else {
      metrics.failureCount++;
      if (update.error) {
        metrics.lastError = update.error;
      }
    }

    // Update average response time
    const totalTime =
      metrics.averageResponseTime * (metrics.requestCount - 1) +
      update.executionTime;
    metrics.averageResponseTime = totalTime / metrics.requestCount;

    // Calculate error percentage
    const totalAttempts = metrics.successCount + metrics.failureCount;
    metrics.errorPercentage =
      totalAttempts > 0 ? (metrics.failureCount / totalAttempts) * 100 : 0;
  }

  /**
   * Update circuit breaker state.
   */
  private updateCircuitBreakerState(
    key: string,
    state: CircuitBreakerState,
  ): void {
    const metrics = this.metricsMap.get(key);
    if (metrics) {
      metrics.state = state;
      metrics.lastStateChange = Date.now();
    }
  }

  /**
   * Determine health status based on metrics.
   */
  private determineHealthStatus(
    metrics: CircuitBreakerMetrics,
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const alertThreshold =
      this.configService.getMonitoringConfig().alertThreshold;

    if (metrics.state === CircuitBreakerState.OPEN) {
      return 'unhealthy';
    }

    if (metrics.state === CircuitBreakerState.HALF_OPEN) {
      return 'degraded';
    }

    if (metrics.errorPercentage > alertThreshold) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Start metrics collection interval.
   */
  private startMetricsCollection(interval: number): void {
    this.metricsInterval = setInterval(() => {
      for (const [key, circuitBreaker] of this.circuitBreakers.entries()) {
        const metrics = this.metricsMap.get(key);
        if (metrics) {
          // Update state from circuit breaker
          metrics.state = this.mapOssumStateToOurState(
            circuitBreaker.toJSON().state,
          );

          // Calculate time to reset for open circuit breakers
          if (metrics.state === CircuitBreakerState.OPEN) {
            const timeSinceStateChange = Date.now() - metrics.lastStateChange;
            const resetTimeout = 60000; // Default reset timeout
            metrics.timeToReset = Math.max(
              0,
              resetTimeout - timeSinceStateChange,
            );
          } else {
            delete metrics.timeToReset;
          }
        }
      }
    }, interval);
  }

  /**
   * Start health check interval.
   */
  private startHealthChecks(interval: number): void {
    this.healthCheckInterval = setInterval(() => {
      const allHealth = this.getAllHealth();
      const unhealthyServices = Object.entries(allHealth)
        .filter(([, health]) => health.status === 'unhealthy')
        .map(([key]) => key);

      if (unhealthyServices.length > 0) {
        this.logger.warn(`Unhealthy circuit breakers detected`, {
          services: unhealthyServices,
          count: unhealthyServices.length,
        });
      }
    }, interval);
  }
}
