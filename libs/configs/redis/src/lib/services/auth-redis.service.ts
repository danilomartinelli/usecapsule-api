import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type {
  RedisModuleOptions,
  RedisSessionOptions,
  RedisCacheOptions,
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
 * Injectable service providing Redis configuration for the Auth service.
 *
 * This service encapsulates all Redis configuration logic for the authentication
 * service, including session storage, user caching, and environment variable management.
 *
 * The auth service uses Redis for:
 * - User session storage with automatic expiration
 * - User profile caching for fast lookups
 * - Password reset token storage
 * - OAuth state management
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     RedisModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (authRedisService: AuthRedisService) =>
 *         authRedisService.getModuleOptions(),
 *       inject: [AuthRedisService],
 *     }),
 *   ],
 *   providers: [AuthRedisService],
 * })
 * export class AuthModule {}
 * ```
 */
@Injectable()
export class AuthRedisService {
  private readonly logger = new Logger(AuthRedisService.name);
  private readonly serviceConfig: ServiceRedisConfig;

  constructor(
    private readonly configService: ConfigService<RedisEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Auth Redis configuration initialized');
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
    return createRedisConfigFactory(RedisServiceType.AUTH, environment);
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
      service: RedisServiceType.AUTH,
      connection: {
        host: this.serviceConfig.host,
        port: this.serviceConfig.port,
        database: this.serviceConfig.database,
      },
      timeout: this.serviceConfig.connectTimeout,
      commands: ['ping', 'info'] as const,
      thresholds: {
        memoryUsagePercent: 80,
        responseTimeMs: 100,
        connectionCount: 100,
      },
    };
  }

  /**
   * Gets session storage configuration optimized for auth service.
   *
   * @returns Session configuration
   */
  getSessionConfig(): RedisSessionOptions {
    const isDevelopment = this.serviceConfig.environment === 'development';

    return {
      ttl: 24 * 60 * 60, // 24 hours
      keyPrefix: `${this.serviceConfig.keyPrefix}session:`,
      rolling: true, // Extend session on activity
      cookie: {
        secure: !isDevelopment, // HTTPS only in production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
        sameSite: 'strict',
      },
    };
  }

  /**
   * Gets cache configuration optimized for user data.
   *
   * @returns Cache configuration
   */
  getCacheConfig(): RedisCacheOptions {
    return {
      defaultTTL: 15 * 60, // 15 minutes for user data
      maxSize: 100 * 1024 * 1024, // 100MB cache limit
      keySerializer: (key: unknown) =>
        `${this.serviceConfig.keyPrefix}cache:${String(key)}`,
      valueSerializer: {
        serialize: (value: unknown) => JSON.stringify(value),
        deserialize: (value: string) => JSON.parse(value),
      },
      compression: {
        enabled: true,
        algorithm: 'gzip',
        threshold: 1024, // Compress values larger than 1KB
      },
    };
  }

  /**
   * Gets optimized Redis settings for auth workload.
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
      // Auth-specific optimizations
      connectTimeout: 5_000, // Fast connection for auth operations
      maxRetriesPerRequest: 2, // Quick failure for auth operations
      maxmemoryPolicy: 'volatile-lru', // Preserve sessions, evict cached data
    };
  }

  /**
   * Gets configuration for password reset tokens.
   *
   * @returns Password reset token configuration
   */
  getPasswordResetConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}reset:`,
      ttl: 15 * 60, // 15 minutes
      maxAttempts: 3,
      blockDuration: 60 * 60, // 1 hour block after max attempts
    };
  }

  /**
   * Gets configuration for OAuth state management.
   *
   * @returns OAuth state configuration
   */
  getOAuthStateConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}oauth:`,
      ttl: 10 * 60, // 10 minutes
      stateLength: 32,
      encoding: 'base64url' as const,
    };
  }

  /**
   * Gets configuration for user profile caching.
   *
   * @returns User profile cache configuration
   */
  getUserProfileCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}user:`,
      ttl: 30 * 60, // 30 minutes
      maxProfileSize: 50 * 1024, // 50KB per profile
      includeFields: [
        'id',
        'email',
        'username',
        'roles',
        'permissions',
        'preferences',
        'lastLoginAt',
      ],
      excludeFields: [
        'password',
        'passwordSalt',
        'passwordResetToken',
        'emailVerificationToken',
      ],
    };
  }

  /**
   * Gets configuration for rate limiting auth operations.
   *
   * @returns Rate limiting configuration
   */
  getRateLimitConfig() {
    return {
      login: {
        windowSize: 15 * 60, // 15 minutes
        maxRequests: 5, // 5 login attempts
        blockDuration: 15 * 60, // 15 minutes block
        keyGenerator: (context: { ip: string; email?: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:login:${context.email || context.ip}`,
      },
      registration: {
        windowSize: 60 * 60, // 1 hour
        maxRequests: 3, // 3 registrations per hour
        blockDuration: 60 * 60, // 1 hour block
        keyGenerator: (context: { ip: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:register:${context.ip}`,
      },
      passwordReset: {
        windowSize: 60 * 60, // 1 hour
        maxRequests: 3, // 3 reset attempts per hour
        blockDuration: 60 * 60, // 1 hour block
        keyGenerator: (context: { email: string }) =>
          `${this.serviceConfig.keyPrefix}ratelimit:reset:${context.email}`,
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
        RedisServiceType.AUTH,
        this.configService,
      );
      this.logger.log('Auth Redis environment validation successful');
    } catch (error) {
      this.logger.error('Auth Redis environment validation failed', error);
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
      RedisServiceType.AUTH,
      this.configService,
      environment,
    );
  }
}
