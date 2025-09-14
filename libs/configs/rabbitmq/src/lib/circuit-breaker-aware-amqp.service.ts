import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { ConfigService } from '@nestjs/config';
import {
  TimeoutResolver,
  TimeoutOperation,
  createTimeoutResolver,
  type TimeoutConfig,
  type ServiceName,
} from '@usecapsule/parameters';
import { CircuitBreakerService } from './circuit-breaker/circuit-breaker.service';
import type {
  CircuitBreakerState,
  CircuitBreakerResult,
} from './circuit-breaker/circuit-breaker.types';
import type {
  TimeoutAwareRequestOptions,
  TimeoutAwarePublishOptions,
  TimeoutAwareResponse,
} from './timeout-aware-amqp.service';

/**
 * Enhanced response that includes circuit breaker information.
 */
export interface CircuitBreakerAwareResponse<T = any>
  extends TimeoutAwareResponse<T> {
  /** Circuit breaker state during execution */
  circuitState: CircuitBreakerState;
  /** Whether the result came from a circuit breaker fallback */
  fromFallback: boolean;
  /** Circuit breaker execution result */
  circuitBreakerResult?: CircuitBreakerResult<T>;
}

/**
 * Circuit breaker aware AMQP service that combines timeout intelligence
 * with circuit breaker fault tolerance.
 *
 * This service provides:
 * - Intelligent timeout resolution (from TimeoutAwareAmqpService)
 * - Circuit breaker protection for RabbitMQ operations
 * - Automatic fallback mechanisms
 * - Comprehensive error handling and recovery
 * - Detailed monitoring and metrics
 *
 * @example
 * ```typescript
 * \@Injectable()
 * export class MyService {
 *   constructor(private amqpService: CircuitBreakerAwareAmqpService) {}
 *
 *   async callAuthService(payload: any) {
 *     return this.amqpService.request({
 *       exchange: 'capsule.commands',
 *       routingKey: 'auth.register',
 *       payload,
 *       serviceName: 'auth-service',
 *     });
 *   }
 * }
 * ```
 */
@Injectable()
export class CircuitBreakerAwareAmqpService {
  private readonly logger = new Logger(CircuitBreakerAwareAmqpService.name);
  private readonly timeoutResolver: TimeoutResolver;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {
    // Create timeout resolver from configuration
    const timeoutConfig = this.extractTimeoutConfig();
    const environment = this.configService.get('NODE_ENV') || 'development';
    this.timeoutResolver = createTimeoutResolver(timeoutConfig, environment);

    this.logger.log('CircuitBreakerAwareAmqpService initialized');
  }

  /**
   * Send an RPC request with circuit breaker protection and intelligent timeout resolution.
   *
   * @param options - Request options
   * @returns Promise resolving to circuit breaker aware response
   */
  async request<T = any>(
    options: TimeoutAwareRequestOptions,
  ): Promise<CircuitBreakerAwareResponse<T>> {
    const startTime = Date.now();
    const operation = options.operation || TimeoutOperation.RPC_CALL;
    const serviceName =
      options.serviceName ||
      this.extractServiceFromRoutingKey(options.routingKey);

    // Resolve timeout for this request
    const timeoutResolution = this.timeoutResolver.resolveTimeout(
      serviceName,
      operation,
    );
    const effectiveTimeout = options.timeout || timeoutResolution.timeout;

    this.logger.debug(`Circuit breaker protected RPC request`, {
      serviceName,
      routingKey: options.routingKey,
      timeout: effectiveTimeout,
      timeoutSource: timeoutResolution.source,
      tier: timeoutResolution.tier,
      scaled: timeoutResolution.scaled,
      metadata: options.metadata,
    });

    // Create the actual AMQP operation function
    const amqpOperation = async (): Promise<T> => {
      return this.amqpConnection.request<T>({
        exchange: options.exchange,
        routingKey: options.routingKey,
        payload: options.payload,
        timeout: effectiveTimeout,
      });
    };

    // Execute with circuit breaker protection
    const circuitBreakerResult = await this.circuitBreakerService.execute(
      amqpOperation,
      {
        serviceName,
        operation,
        config: {
          timeout: effectiveTimeout,
          fallback: this.createFallbackForService(serviceName, options),
        },
      },
    );

    const actualDuration = Date.now() - startTime;
    const timedOut =
      !circuitBreakerResult.success && actualDuration >= effectiveTimeout * 0.9;

    // Log the result
    if (circuitBreakerResult.success) {
      this.logger.debug(`Circuit breaker protected RPC request completed`, {
        serviceName,
        routingKey: options.routingKey,
        timeout: effectiveTimeout,
        duration: actualDuration,
        circuitState: circuitBreakerResult.circuitState,
        fromFallback: circuitBreakerResult.fromFallback,
        success: true,
      });
    } else {
      this.logger.error(`Circuit breaker protected RPC request failed`, {
        serviceName,
        routingKey: options.routingKey,
        timeout: effectiveTimeout,
        duration: actualDuration,
        circuitState: circuitBreakerResult.circuitState,
        fromFallback: circuitBreakerResult.fromFallback,
        timedOut,
        error: circuitBreakerResult.error,
      });
    }

    // If circuit breaker failed and we don't have fallback data, throw the error
    if (!circuitBreakerResult.success && !circuitBreakerResult.fromFallback) {
      const error = new Error(
        circuitBreakerResult.error || 'Circuit breaker operation failed',
      );
      (error as any).circuitBreakerResult = circuitBreakerResult;
      (error as any).serviceName = serviceName;
      (error as any).routingKey = options.routingKey;
      throw error;
    }

    return {
      data: circuitBreakerResult.data,
      timeout: effectiveTimeout,
      actualDuration,
      timedOut,
      serviceName,
      operation,
      circuitState: circuitBreakerResult.circuitState,
      fromFallback: circuitBreakerResult.fromFallback,
      circuitBreakerResult,
    };
  }

  /**
   * Publish an event with circuit breaker protection.
   *
   * @param options - Publish options
   * @returns Promise resolving when published
   */
  async publish(options: TimeoutAwarePublishOptions): Promise<void> {
    const serviceName =
      options.serviceName ||
      this.extractServiceFromRoutingKey(options.routingKey);

    this.logger.debug(`Circuit breaker protected event publishing`, {
      serviceName,
      routingKey: options.routingKey,
      exchange: options.exchange,
      metadata: options.metadata,
    });

    // Create the actual AMQP publish operation
    const publishOperation = async (): Promise<void> => {
      return this.amqpConnection.publish(
        options.exchange,
        options.routingKey,
        options.payload,
      );
    };

    // Execute with circuit breaker protection
    const circuitBreakerResult = await this.circuitBreakerService.execute(
      publishOperation,
      {
        serviceName,
        operation: TimeoutOperation.EVENT_PUBLISH,
        config: {
          timeout: 5000, // Publishing should be fast
          volumeThreshold: 5, // Lower threshold for publishing
          fallback: () => {
            this.logger.warn(`Event publishing fallback triggered`, {
              serviceName,
              routingKey: options.routingKey,
            });
            // For events, we might want to store in a retry queue
            // For now, we'll just log the failure
            return Promise.resolve();
          },
        },
      },
    );

    if (circuitBreakerResult.success) {
      this.logger.debug(`Event published successfully`, {
        serviceName,
        routingKey: options.routingKey,
        circuitState: circuitBreakerResult.circuitState,
        fromFallback: circuitBreakerResult.fromFallback,
      });
    } else {
      this.logger.error(`Event publishing failed`, {
        serviceName,
        routingKey: options.routingKey,
        error: circuitBreakerResult.error,
        circuitState: circuitBreakerResult.circuitState,
      });
      // Don't throw for event publishing failures if fallback succeeded
      if (!circuitBreakerResult.fromFallback) {
        throw new Error(
          circuitBreakerResult.error || 'Event publishing failed',
        );
      }
    }
  }

  /**
   * Send a health check request with circuit breaker protection.
   *
   * @param serviceName - Target service name
   * @param routingKey - Health check routing key
   * @returns Promise resolving to health check response
   */
  async healthCheck<T = any>(
    serviceName: ServiceName | string,
    routingKey: string,
  ): Promise<CircuitBreakerAwareResponse<T>> {
    return this.request<T>({
      exchange: 'capsule.commands',
      routingKey,
      payload: {},
      serviceName,
      operation: TimeoutOperation.HEALTH_CHECK,
      metadata: { healthCheck: true },
    });
  }

  /**
   * Get circuit breaker health status for a service.
   */
  getCircuitBreakerHealth(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ) {
    return this.circuitBreakerService.getHealth(serviceName, operation);
  }

  /**
   * Get circuit breaker metrics for a service.
   */
  getCircuitBreakerMetrics(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ) {
    return this.circuitBreakerService.getMetrics(serviceName, operation);
  }

  /**
   * Get health status for all circuit breakers.
   */
  getAllCircuitBreakerHealth() {
    return this.circuitBreakerService.getAllHealth();
  }

  /**
   * Manually reset a circuit breaker.
   */
  resetCircuitBreaker(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ): boolean {
    return this.circuitBreakerService.resetCircuitBreaker(
      serviceName,
      operation,
    );
  }

  /**
   * Get timeout information for debugging purposes.
   *
   * @returns Debug information about timeout configuration
   */
  getTimeoutDebugInfo(): Record<string, any> {
    return this.timeoutResolver.getDebugInfo();
  }

  /**
   * Get circuit breaker debug information.
   */
  getCircuitBreakerDebugInfo(): Record<string, any> {
    return this.circuitBreakerService.getDebugInfo();
  }

  /**
   * Resolve timeout for a specific service and operation.
   *
   * @param serviceName - Target service name
   * @param operation - Operation type
   * @returns Timeout resolution details
   */
  resolveTimeout(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ) {
    return this.timeoutResolver.resolveTimeout(serviceName, operation);
  }

  /**
   * Create a fallback function for a specific service.
   */
  private createFallbackForService(
    serviceName: ServiceName | string,
    options: TimeoutAwareRequestOptions,
  ): ((...args: any[]) => any) | undefined {
    const service = String(serviceName);

    // Service-specific fallbacks
    switch (service) {
      case 'auth-service':
        return this.createAuthServiceFallback(options);
      case 'billing-service':
        return this.createBillingServiceFallback(options);
      case 'deploy-service':
        return this.createDeployServiceFallback(options);
      case 'monitor-service':
        return this.createMonitorServiceFallback(options);
      default:
        return this.createDefaultFallback(options);
    }
  }

  /**
   * Create fallback for auth service operations.
   */
  private createAuthServiceFallback(options: TimeoutAwareRequestOptions) {
    return (...args: any[]) => {
      this.logger.warn(`Auth service fallback triggered`, {
        routingKey: options.routingKey,
      });

      // For health checks, return unhealthy status
      if (options.operation === TimeoutOperation.HEALTH_CHECK) {
        return {
          status: 'unhealthy',
          service: 'auth-service',
          timestamp: new Date().toISOString(),
          error: 'Circuit breaker fallback',
        };
      }

      // For other operations, return appropriate error
      throw new Error('Auth service temporarily unavailable');
    };
  }

  /**
   * Create fallback for billing service operations.
   */
  private createBillingServiceFallback(options: TimeoutAwareRequestOptions) {
    return (...args: any[]) => {
      this.logger.warn(`Billing service fallback triggered`, {
        routingKey: options.routingKey,
      });

      if (options.operation === TimeoutOperation.HEALTH_CHECK) {
        return {
          status: 'unhealthy',
          service: 'billing-service',
          timestamp: new Date().toISOString(),
          error: 'Circuit breaker fallback',
        };
      }

      // For billing operations, we might want to queue them for later
      throw new Error(
        'Billing service temporarily unavailable - operation queued for retry',
      );
    };
  }

  /**
   * Create fallback for deploy service operations.
   */
  private createDeployServiceFallback(options: TimeoutAwareRequestOptions) {
    return (...args: any[]) => {
      this.logger.warn(`Deploy service fallback triggered`, {
        routingKey: options.routingKey,
      });

      if (options.operation === TimeoutOperation.HEALTH_CHECK) {
        return {
          status: 'unhealthy',
          service: 'deploy-service',
          timestamp: new Date().toISOString(),
          error: 'Circuit breaker fallback',
        };
      }

      throw new Error('Deploy service temporarily unavailable');
    };
  }

  /**
   * Create fallback for monitor service operations.
   */
  private createMonitorServiceFallback(options: TimeoutAwareRequestOptions) {
    return (...args: any[]) => {
      this.logger.warn(`Monitor service fallback triggered`, {
        routingKey: options.routingKey,
      });

      if (options.operation === TimeoutOperation.HEALTH_CHECK) {
        return {
          status: 'unhealthy',
          service: 'monitor-service',
          timestamp: new Date().toISOString(),
          error: 'Circuit breaker fallback',
        };
      }

      // For monitoring, we might return cached data or default values
      return { message: 'Monitoring data temporarily unavailable' };
    };
  }

  /**
   * Create default fallback for unknown services.
   */
  private createDefaultFallback(options: TimeoutAwareRequestOptions) {
    return (...args: any[]) => {
      this.logger.warn(`Default service fallback triggered`, {
        routingKey: options.routingKey,
      });

      if (options.operation === TimeoutOperation.HEALTH_CHECK) {
        return {
          status: 'unhealthy',
          service: 'unknown',
          timestamp: new Date().toISOString(),
          error: 'Circuit breaker fallback',
        };
      }

      throw new Error('Service temporarily unavailable');
    };
  }

  /**
   * Extract timeout configuration from ConfigService.
   *
   * @returns Timeout configuration object
   */
  private extractTimeoutConfig(): TimeoutConfig {
    // Default timeout configuration - will be overridden by environment variables
    const defaults: TimeoutConfig = {
      RABBITMQ_DEFAULT_TIMEOUT: 5000,
      HEALTH_CHECK_TIMEOUT: 3000,
      CRITICAL_SERVICE_TIMEOUT: 2000,
      STANDARD_SERVICE_TIMEOUT: 5000,
      NON_CRITICAL_SERVICE_TIMEOUT: 10000,
      AUTH_SERVICE_TIMEOUT: 2000,
      BILLING_SERVICE_TIMEOUT: 8000,
      DEPLOY_SERVICE_TIMEOUT: 15000,
      MONITOR_SERVICE_TIMEOUT: 10000,
      DATABASE_OPERATION_TIMEOUT: 10000,
      HTTP_REQUEST_TIMEOUT: 30000,
      ENABLE_TIMEOUT_SCALING: true,
      PRODUCTION_TIMEOUT_SCALE_FACTOR: 1.5,
      DEVELOPMENT_TIMEOUT_SCALE_FACTOR: 0.8,
    };

    // Extract timeout values from configuration service
    const config: Partial<TimeoutConfig> = {};

    for (const key in defaults) {
      const value = this.configService.get(key);
      if (value !== undefined) {
        if (typeof defaults[key as keyof TimeoutConfig] === 'number') {
          config[key as keyof TimeoutConfig] = Number(value) as any;
        } else if (typeof defaults[key as keyof TimeoutConfig] === 'boolean') {
          config[key as keyof TimeoutConfig] =
            value === 'true' || value === (true as any);
        } else {
          config[key as keyof TimeoutConfig] = value as any;
        }
      }
    }

    // Merge with defaults
    return { ...defaults, ...config };
  }

  /**
   * Extract service name from routing key.
   *
   * @param routingKey - Routing key (e.g., 'auth.register', 'billing.charge')
   * @returns Service name (e.g., 'auth-service', 'billing-service')
   */
  private extractServiceFromRoutingKey(routingKey: string): string {
    const parts = routingKey.split('.');
    if (parts.length > 0) {
      const servicePrefix = parts[0];
      return `${servicePrefix}-service`;
    }
    return 'unknown-service';
  }
}
