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

/**
 * Request options for RabbitMQ operations with timeout support.
 */
export interface TimeoutAwareRequestOptions {
  exchange: string;
  routingKey: string;
  payload?: any;
  timeout?: number;
  serviceName?: ServiceName | string;
  operation?: TimeoutOperation;
  metadata?: Record<string, any>;
}

/**
 * Publish options for RabbitMQ operations.
 */
export interface TimeoutAwarePublishOptions {
  exchange: string;
  routingKey: string;
  payload: any;
  serviceName?: ServiceName | string;
  metadata?: Record<string, any>;
}

/**
 * Response from timeout-aware operations with metadata.
 */
export interface TimeoutAwareResponse<T = any> {
  data: T;
  timeout: number;
  actualDuration?: number;
  timedOut: boolean;
  serviceName?: string;
  operation: TimeoutOperation;
}

/**
 * Timeout-aware AMQP service that wraps AmqpConnection with configurable timeouts.
 *
 * This service provides intelligent timeout resolution based on:
 * - Target service type and criticality
 * - Operation type (RPC, health check, etc.)
 * - Environment-specific scaling
 * - Fallback mechanisms for unknown services
 *
 * @example
 * ```typescript
 * \@Injectable()
 * export class MyService {
 *   constructor(private amqpService: TimeoutAwareAmqpService) {}
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
export class TimeoutAwareAmqpService {
  private readonly logger = new Logger(TimeoutAwareAmqpService.name);
  private readonly timeoutResolver: TimeoutResolver;

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly configService: ConfigService,
  ) {
    // Create timeout resolver from configuration
    const timeoutConfig = this.extractTimeoutConfig();
    const environment = this.configService.get('NODE_ENV') || 'development';
    this.timeoutResolver = createTimeoutResolver(timeoutConfig, environment);

    this.logger.log(
      'TimeoutAwareAmqpService initialized with timeout configuration',
    );
  }

  /**
   * Send an RPC request with intelligent timeout resolution.
   *
   * @param options - Request options
   * @returns Promise resolving to timeout-aware response
   */
  async request<T = any>(
    options: TimeoutAwareRequestOptions,
  ): Promise<TimeoutAwareResponse<T>> {
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

    this.logger.debug(`RPC request to ${serviceName}`, {
      routingKey: options.routingKey,
      timeout: effectiveTimeout,
      timeoutSource: timeoutResolution.source,
      tier: timeoutResolution.tier,
      scaled: timeoutResolution.scaled,
      metadata: options.metadata,
    });

    let timedOut = false;
    let data: T;

    try {
      data = await this.amqpConnection.request<T>({
        exchange: options.exchange,
        routingKey: options.routingKey,
        payload: options.payload,
        timeout: effectiveTimeout,
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      timedOut = duration >= effectiveTimeout * 0.9; // Consider timeout if 90% of time elapsed

      this.logger.error(`RPC request failed`, {
        serviceName,
        routingKey: options.routingKey,
        timeout: effectiveTimeout,
        duration,
        timedOut,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }

    const actualDuration = Date.now() - startTime;

    this.logger.debug(`RPC request completed`, {
      serviceName,
      routingKey: options.routingKey,
      timeout: effectiveTimeout,
      duration: actualDuration,
      success: true,
    });

    return {
      data,
      timeout: effectiveTimeout,
      actualDuration,
      timedOut,
      serviceName,
      operation,
    };
  }

  /**
   * Publish an event with metadata logging.
   *
   * @param options - Publish options
   * @returns Promise resolving when published
   */
  async publish(options: TimeoutAwarePublishOptions): Promise<void> {
    const serviceName =
      options.serviceName ||
      this.extractServiceFromRoutingKey(options.routingKey);

    this.logger.debug(`Publishing event`, {
      serviceName,
      routingKey: options.routingKey,
      exchange: options.exchange,
      metadata: options.metadata,
    });

    try {
      await this.amqpConnection.publish(
        options.exchange,
        options.routingKey,
        options.payload,
      );

      this.logger.debug(`Event published successfully`, {
        serviceName,
        routingKey: options.routingKey,
      });
    } catch (error) {
      this.logger.error(`Event publishing failed`, {
        serviceName,
        routingKey: options.routingKey,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Send a health check request with appropriate timeout.
   *
   * @param serviceName - Target service name
   * @param routingKey - Health check routing key
   * @returns Promise resolving to health check response
   */
  async healthCheck<T = any>(
    serviceName: ServiceName | string,
    routingKey: string,
  ): Promise<TimeoutAwareResponse<T>> {
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
   * Get timeout information for debugging purposes.
   *
   * @returns Debug information about timeout configuration
   */
  getTimeoutDebugInfo(): Record<string, any> {
    return this.timeoutResolver.getDebugInfo();
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
