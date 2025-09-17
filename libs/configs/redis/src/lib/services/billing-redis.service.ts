import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type {
  RedisModuleOptions,
  RedisCacheOptions,
  RedisRateLimitOptions,
} from '../interfaces';
import type {
  RedisEnvironmentVariables,
  ServiceRedisConfig,
} from '../redis.types';
import { RedisServiceType } from '../redis.types';
import {
  createRedisConfigFactory,
  createServiceRedisConfig,
  validateServiceRedisEnvironment,
  getOptimizedRedisSettings,
} from '../service-redis.factory';

/**
 * Injectable service providing Redis configuration for the Billing service.
 *
 * This service encapsulates all Redis configuration logic for the billing
 * service, including payment caching, rate limiting, and subscription management.
 *
 * The billing service uses Redis for:
 * - Payment transaction caching
 * - Customer profile caching
 * - Subscription status caching
 * - Rate limiting for payment operations
 * - Idempotency key management
 * - Payment retry mechanism
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     RedisModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (billingRedisService: BillingRedisService) =>
 *         billingRedisService.getModuleOptions(),
 *       inject: [BillingRedisService],
 *     }),
 *   ],
 *   providers: [BillingRedisService],
 * })
 * export class BillingModule {}
 * ```
 */
@Injectable()
export class BillingRedisService {
  private readonly logger = new Logger(BillingRedisService.name);
  private readonly serviceConfig: ServiceRedisConfig;

  constructor(
    private readonly configService: ConfigService<RedisEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Billing Redis configuration initialized');
  }

  /**
   * Gets the service-specific Redis configuration.
   *
   * @returns Complete service Redis configuration
   */
  getServiceConfig(): ServiceRedisConfig {
    return this.serviceConfig;
  }

  /**
   * Gets the Redis configuration in RedisModuleOptions format.
   *
   * @returns Configuration compatible with RedisModule.forRoot()
   */
  getModuleOptions(): RedisModuleOptions {
    return {
      host: this.serviceConfig.host,
      port: this.serviceConfig.port,
      database: this.serviceConfig.database,
      password: this.serviceConfig.password,
      username: this.serviceConfig.username,
      connectTimeout: this.serviceConfig.connectTimeout,
      lazyConnect: this.serviceConfig.lazyConnect,
      keepAlive: this.serviceConfig.keepAlive,
      keyPrefix: this.serviceConfig.keyPrefix,
      enableOfflineQueue: this.serviceConfig.enableOfflineQueue,
      maxRetriesPerRequest: this.serviceConfig.maxRetriesPerRequest,
      retryDelayOnFailover: this.serviceConfig.retryDelayOnFailover,
      maxmemoryPolicy: this.serviceConfig.maxmemoryPolicy,
      environment: this.serviceConfig.environment,
      useCases: this.serviceConfig.useCases,
      cluster: this.serviceConfig.cluster,
      sentinel: this.serviceConfig.sentinel,
    };
  }

  /**
   * Creates a factory function for async module configuration.
   *
   * @param environment - Target environment
   * @returns Factory function for RedisModule.forRootAsync()
   */
  static createConfigFactory(
    environment: 'development' | 'production' | 'test' = 'development',
  ) {
    return createRedisConfigFactory(RedisServiceType.BILLING, environment);
  }

  /**
   * Gets the Redis connection URL for direct connections.
   *
   * @returns Redis connection URL
   */
  getConnectionUrl(): string {
    const { host, port, database, password, username } = this.serviceConfig;
    const auth =
      username && password
        ? `${username}:${password}@`
        : password
          ? `:${password}@`
          : '';
    return `redis://${auth}${host}:${port}/${database}`;
  }

  /**
   * Gets Redis health check configuration.
   *
   * @returns Health check configuration object
   */
  getHealthCheckConfig() {
    return {
      service: RedisServiceType.BILLING,
      connection: {
        host: this.serviceConfig.host,
        port: this.serviceConfig.port,
        database: this.serviceConfig.database,
      },
      timeout: this.serviceConfig.connectTimeout,
      commands: ['ping', 'info', 'memory'] as const,
      thresholds: {
        memoryUsagePercent: 75,
        responseTimeMs: 150,
        connectionCount: 50,
      },
    };
  }

  /**
   * Gets cache configuration optimized for billing data.
   *
   * @returns Cache configuration
   */
  getCacheConfig(): RedisCacheOptions {
    return {
      defaultTTL: 30 * 60, // 30 minutes for billing data
      maxSize: 200 * 1024 * 1024, // 200MB cache limit
      keySerializer: (key: unknown) =>
        `${this.serviceConfig.keyPrefix}cache:${String(key)}`,
      valueSerializer: {
        serialize: (value: unknown) => JSON.stringify(value),
        deserialize: (value: string) => JSON.parse(value),
      },
      compression: {
        enabled: true,
        algorithm: 'gzip',
        threshold: 2048, // Compress values larger than 2KB
      },
    };
  }

  /**
   * Gets optimized Redis settings for billing workload.
   *
   * @returns Optimized Redis configuration
   */
  getOptimizedSettings(): RedisModuleOptions {
    const baseConfig = this.getModuleOptions();
    const optimizations = getOptimizedRedisSettings(
      this.serviceConfig.useCases || [],
      this.serviceConfig,
    );

    return {
      ...baseConfig,
      ...optimizations,
      // Billing-specific optimizations
      connectTimeout: 15_000, // Longer timeout for reliability
      maxRetriesPerRequest: 5, // More retries for financial operations
      maxmemoryPolicy: 'allkeys-lru', // General purpose caching
    };
  }

  /**
   * Gets configuration for payment transaction caching.
   *
   * @returns Payment cache configuration
   */
  getPaymentCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}payment:`,
      ttl: 60 * 60, // 1 hour for payment transactions
      maxTransactionSize: 100 * 1024, // 100KB per transaction
      includeFields: [
        'id',
        'amount',
        'currency',
        'status',
        'customerId',
        'paymentMethodId',
        'createdAt',
        'metadata',
      ],
      excludeFields: [
        'paymentMethodDetails',
        'processorResponse',
        'internalNotes',
      ],
    };
  }

  /**
   * Gets configuration for customer profile caching.
   *
   * @returns Customer cache configuration
   */
  getCustomerCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}customer:`,
      ttl: 2 * 60 * 60, // 2 hours for customer data
      maxProfileSize: 75 * 1024, // 75KB per customer profile
      includeFields: [
        'id',
        'email',
        'billingAddress',
        'subscriptions',
        'paymentMethods',
        'totalSpent',
        'currency',
        'taxExempt',
      ],
      excludeFields: [
        'paymentMethodTokens',
        'processorCustomerId',
        'internalNotes',
      ],
    };
  }

  /**
   * Gets configuration for subscription status caching.
   *
   * @returns Subscription cache configuration
   */
  getSubscriptionCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}subscription:`,
      ttl: 30 * 60, // 30 minutes for subscription status
      includeFields: [
        'id',
        'customerId',
        'status',
        'currentPeriodStart',
        'currentPeriodEnd',
        'planId',
        'quantity',
        'trialEnd',
        'cancelAtPeriodEnd',
      ],
    };
  }

  /**
   * Gets configuration for idempotency key management.
   *
   * @returns Idempotency configuration
   */
  getIdempotencyConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}idempotency:`,
      ttl: 24 * 60 * 60, // 24 hours
      maxKeyLength: 255,
      algorithm: 'sha256',
      includeMethods: ['POST', 'PUT', 'PATCH'],
      excludePaths: ['/health', '/metrics'],
    };
  }

  /**
   * Gets configuration for payment retry mechanism.
   *
   * @returns Payment retry configuration
   */
  getPaymentRetryConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}retry:`,
      maxRetries: 3,
      backoffStrategy: 'exponential' as const,
      baseDelay: 1000, // 1 second
      maxDelay: 300_000, // 5 minutes
      jitter: true,
      retryableErrors: [
        'network_error',
        'timeout',
        'rate_limit',
        'temporary_failure',
      ],
      nonRetryableErrors: [
        'insufficient_funds',
        'invalid_card',
        'card_declined',
        'fraud_detected',
      ],
    };
  }

  /**
   * Gets configuration for rate limiting billing operations.
   *
   * @returns Rate limiting configuration
   */
  getRateLimitConfig() {
    return {
      payment: {
        windowSize: 60, // 1 minute
        maxRequests: 10, // 10 payment attempts per minute
        blockDuration: 5 * 60, // 5 minutes block
        keyGenerator: (context: { customerId: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:payment:${context.customerId}`,
      } as RedisRateLimitOptions,
      refund: {
        windowSize: 60 * 60, // 1 hour
        maxRequests: 5, // 5 refunds per hour
        blockDuration: 60 * 60, // 1 hour block
        keyGenerator: (context: { customerId: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:refund:${context.customerId}`,
      } as RedisRateLimitOptions,
      subscription: {
        windowSize: 60, // 1 minute
        maxRequests: 3, // 3 subscription changes per minute
        blockDuration: 60, // 1 minute block
        keyGenerator: (context: { customerId: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:subscription:${context.customerId}`,
      } as RedisRateLimitOptions,
      webhook: {
        windowSize: 60, // 1 minute
        maxRequests: 100, // 100 webhook calls per minute
        blockDuration: 60, // 1 minute block
        keyGenerator: (context: { source: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:webhook:${context.source}`,
      } as RedisRateLimitOptions,
    };
  }

  /**
   * Gets configuration for invoice caching.
   *
   * @returns Invoice cache configuration
   */
  getInvoiceCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}invoice:`,
      ttl: 6 * 60 * 60, // 6 hours
      maxInvoiceSize: 150 * 1024, // 150KB per invoice
      generatePDF: true,
      pdfTTL: 24 * 60 * 60, // 24 hours for PDF cache
    };
  }

  /**
   * Gets configuration for pricing plan caching.
   *
   * @returns Pricing plan cache configuration
   */
  getPricingPlanCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}plan:`,
      ttl: 12 * 60 * 60, // 12 hours for pricing plans
      invalidateOnUpdate: true,
      globalKey: `${this.serviceConfig.keyPrefix}plans:all`,
    };
  }

  /**
   * Validates that all required environment variables are present.
   *
   * @throws Error if validation fails
   */
  private validateEnvironment(): void {
    try {
      validateServiceRedisEnvironment(
        RedisServiceType.BILLING,
        this.configService,
      );
      this.logger.log('Billing Redis environment validation successful');
    } catch (error) {
      this.logger.error('Billing Redis environment validation failed', error);
      throw error;
    }
  }

  /**
   * Creates the service-specific Redis configuration.
   *
   * @returns Service Redis configuration
   */
  private createServiceConfig(): ServiceRedisConfig {
    const environment = this.configService.get('NODE_ENV', 'development') as
      | 'development'
      | 'production'
      | 'test';

    return createServiceRedisConfig(
      RedisServiceType.BILLING,
      this.configService,
      environment,
    );
  }
}
