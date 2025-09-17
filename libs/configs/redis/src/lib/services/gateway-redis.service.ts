import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type {
  RedisModuleOptions,
  RedisCacheOptions,
  RedisRateLimitOptions,
  RedisSessionOptions,
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
 * Injectable service providing Redis configuration for the API Gateway service.
 *
 * This service encapsulates all Redis configuration logic for the API gateway,
 * including rate limiting, response caching, session management, and request
 * coordination across microservices.
 *
 * The gateway service uses Redis for:
 * - API rate limiting per client/endpoint
 * - Response caching for frequently accessed data
 * - Session management for authenticated requests
 * - Request tracking and analytics
 * - Circuit breaker state management
 * - API key validation caching
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     RedisModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (gatewayRedisService: GatewayRedisService) =>
 *         gatewayRedisService.getModuleOptions(),
 *       inject: [GatewayRedisService],
 *     }),
 *   ],
 *   providers: [GatewayRedisService],
 * })
 * export class GatewayModule {}
 * ```
 */
@Injectable()
export class GatewayRedisService {
  private readonly logger = new Logger(GatewayRedisService.name);
  private readonly serviceConfig: ServiceRedisConfig;

  constructor(
    private readonly configService: ConfigService<RedisEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Gateway Redis configuration initialized');
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
    return createRedisConfigFactory(RedisServiceType.GATEWAY, environment);
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
      service: RedisServiceType.GATEWAY,
      connection: {
        host: this.serviceConfig.host,
        port: this.serviceConfig.port,
        database: this.serviceConfig.database,
      },
      timeout: this.serviceConfig.connectTimeout,
      commands: ['ping', 'info'] as const,
      thresholds: {
        memoryUsagePercent: 70,
        responseTimeMs: 50, // Very fast for gateway operations
        connectionCount: 500, // High connection count for gateway
      },
    };
  }

  /**
   * Gets cache configuration optimized for API responses.
   *
   * @returns Cache configuration
   */
  getCacheConfig(): RedisCacheOptions {
    return {
      defaultTTL: 5 * 60, // 5 minutes for API responses
      maxSize: 300 * 1024 * 1024, // 300MB cache limit
      keySerializer: (key: unknown) =>
        `${this.serviceConfig.keyPrefix}cache:${String(key)}`,
      valueSerializer: {
        serialize: (value: unknown) => JSON.stringify(value),
        deserialize: (value: string) => JSON.parse(value),
      },
      compression: {
        enabled: true,
        algorithm: 'gzip',
        threshold: 512, // Compress values larger than 512 bytes
      },
    };
  }

  /**
   * Gets optimized Redis settings for gateway workload.
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
      // Gateway-specific optimizations
      connectTimeout: 5_000, // Quick connection
      maxRetriesPerRequest: 2, // Fast failure for rate limiting
      maxmemoryPolicy: 'allkeys-lru', // General purpose caching
    };
  }

  /**
   * Gets session storage configuration for gateway.
   *
   * @returns Session configuration
   */
  getSessionConfig(): RedisSessionOptions {
    const isDevelopment = this.serviceConfig.environment === 'development';

    return {
      ttl: 8 * 60 * 60, // 8 hours for gateway sessions
      keyPrefix: `${this.serviceConfig.keyPrefix}session:`,
      rolling: true, // Extend session on activity
      cookie: {
        secure: !isDevelopment, // HTTPS only in production
        httpOnly: true,
        maxAge: 8 * 60 * 60 * 1000, // 8 hours in milliseconds
        sameSite: 'lax', // More permissive for gateway
      },
    };
  }

  /**
   * Gets comprehensive rate limiting configuration for different scenarios.
   *
   * @returns Rate limiting configurations
   */
  getRateLimitConfig() {
    return {
      global: {
        windowSize: 60, // 1 minute
        maxRequests: 1000, // 1000 requests per minute globally
        blockDuration: 60, // 1 minute block
        keyGenerator: (context: { ip: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:global:${context.ip}`,
      } as RedisRateLimitOptions,

      perUser: {
        windowSize: 60, // 1 minute
        maxRequests: 100, // 100 requests per minute per user
        blockDuration: 5 * 60, // 5 minutes block
        keyGenerator: (context: { userId: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:user:${context.userId}`,
      } as RedisRateLimitOptions,

      perApiKey: {
        windowSize: 60, // 1 minute
        maxRequests: 500, // 500 requests per minute per API key
        blockDuration: 10 * 60, // 10 minutes block
        keyGenerator: (context: { apiKey: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:apikey:${context.apiKey}`,
      } as RedisRateLimitOptions,

      perEndpoint: {
        windowSize: 60, // 1 minute
        maxRequests: 200, // 200 requests per minute per endpoint
        blockDuration: 2 * 60, // 2 minutes block
        keyGenerator: (context: { endpoint: string; ip: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:endpoint:${context.endpoint}:${context.ip}`,
      } as RedisRateLimitOptions,

      auth: {
        windowSize: 15 * 60, // 15 minutes
        maxRequests: 10, // 10 auth attempts per 15 minutes
        blockDuration: 30 * 60, // 30 minutes block
        keyGenerator: (context: { ip: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:auth:${context.ip}`,
      } as RedisRateLimitOptions,

      registration: {
        windowSize: 60 * 60, // 1 hour
        maxRequests: 5, // 5 registrations per hour
        blockDuration: 2 * 60 * 60, // 2 hours block
        keyGenerator: (context: { ip: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:register:${context.ip}`,
      } as RedisRateLimitOptions,
    };
  }

  /**
   * Gets configuration for API key validation caching.
   *
   * @returns API key cache configuration
   */
  getApiKeyCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}apikey:`,
      ttl: 15 * 60, // 15 minutes for API key validation
      includeFields: [
        'id',
        'name',
        'permissions',
        'rateLimit',
        'isActive',
        'expiresAt',
        'scopes',
      ],
      excludeFields: ['secret', 'hashedKey', 'internalNotes'],
      invalidateOnUpdate: true,
    };
  }

  /**
   * Gets configuration for circuit breaker state management.
   *
   * @returns Circuit breaker configuration
   */
  getCircuitBreakerConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}circuit:`,
      stateTTL: 60 * 60, // 1 hour for circuit state
      services: {
        'auth-service': {
          failureThreshold: 5,
          resetTimeout: 60 * 1000, // 1 minute
          monitoringWindow: 10 * 60 * 1000, // 10 minutes
        },
        'billing-service': {
          failureThreshold: 3,
          resetTimeout: 2 * 60 * 1000, // 2 minutes
          monitoringWindow: 5 * 60 * 1000, // 5 minutes
        },
        'deploy-service': {
          failureThreshold: 10,
          resetTimeout: 5 * 60 * 1000, // 5 minutes
          monitoringWindow: 15 * 60 * 1000, // 15 minutes
        },
        'monitor-service': {
          failureThreshold: 8,
          resetTimeout: 30 * 1000, // 30 seconds
          monitoringWindow: 2 * 60 * 1000, // 2 minutes
        },
      },
    };
  }

  /**
   * Gets configuration for request tracking and analytics.
   *
   * @returns Request tracking configuration
   */
  getRequestTrackingConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}request:`,
      ttl: 24 * 60 * 60, // 24 hours for request analytics
      trackingFields: [
        'method',
        'path',
        'statusCode',
        'responseTime',
        'userAgent',
        'ip',
        'userId',
        'apiKey',
        'timestamp',
      ],
      excludeFields: [
        'requestBody',
        'responseBody',
        'headers.authorization',
        'headers.cookie',
      ],
      sampling: {
        enabled: true,
        rate: 0.1, // Sample 10% of requests
        alwaysInclude: ['POST', 'PUT', 'DELETE'],
      },
      aggregation: {
        intervals: [60, 300, 3600], // 1min, 5min, 1hour
        metrics: ['count', 'avg_response_time', 'error_rate'],
      },
    };
  }

  /**
   * Gets configuration for response caching.
   *
   * @returns Response cache configuration
   */
  getResponseCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}response:`,
      defaultTTL: 2 * 60, // 2 minutes default cache
      cacheableStatusCodes: [200, 201, 204, 300, 301, 404, 410],
      cacheableMethods: ['GET', 'HEAD', 'OPTIONS'],
      varyHeaders: ['accept', 'accept-encoding', 'authorization'],
      endpointConfigs: {
        '/health': { ttl: 30, enabled: true },
        '/api/users': { ttl: 5 * 60, enabled: true },
        '/api/billing/plans': { ttl: 30 * 60, enabled: true },
        '/api/auth/me': { ttl: 60, enabled: false }, // User-specific data
      },
      compression: true,
      etag: true,
    };
  }

  /**
   * Gets configuration for CORS origin caching.
   *
   * @returns CORS cache configuration
   */
  getCorsOriginCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}cors:`,
      ttl: 60 * 60, // 1 hour for CORS origins
      allowedOrigins: {
        development: ['http://localhost:3000', 'http://localhost:3001'],
        staging: ['https://staging.usecapsule.com'],
        production: ['https://usecapsule.com', 'https://app.usecapsule.com'],
      },
      defaultHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
      ],
      maxAge: 24 * 60 * 60, // 24 hours
    };
  }

  /**
   * Gets configuration for JWT token blacklist.
   *
   * @returns JWT blacklist configuration
   */
  getJwtBlacklistConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}jwt:blacklist:`,
      // TTL should match JWT expiration time
      getTTL: (payload: { exp: number }) =>
        Math.max(0, payload.exp - Math.floor(Date.now() / 1000)),
      checkOnEveryRequest: true,
      pruneExpired: true,
      pruneInterval: 60 * 60, // 1 hour
    };
  }

  /**
   * Gets configuration for load balancing state.
   *
   * @returns Load balancing configuration
   */
  getLoadBalancingConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}loadbalance:`,
      healthCheckInterval: 30, // 30 seconds
      healthCheckTTL: 60, // 1 minute
      strategies: {
        'round-robin': {
          enabled: true,
          weight: 1,
        },
        'least-connections': {
          enabled: false,
          weight: 2,
        },
        'response-time': {
          enabled: true,
          weight: 3,
          threshold: 100, // 100ms
        },
      },
      services: {
        'auth-service': {
          instances: ['auth-1', 'auth-2'],
          strategy: 'round-robin',
        },
        'billing-service': {
          instances: ['billing-1'],
          strategy: 'response-time',
        },
        'deploy-service': {
          instances: ['deploy-1'],
          strategy: 'round-robin',
        },
        'monitor-service': {
          instances: ['monitor-1', 'monitor-2'],
          strategy: 'least-connections',
        },
      },
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
        RedisServiceType.GATEWAY,
        this.configService,
      );
      this.logger.log('Gateway Redis environment validation successful');
    } catch (error) {
      this.logger.error('Gateway Redis environment validation failed', error);
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
      RedisServiceType.GATEWAY,
      this.configService,
      environment,
    );
  }
}
