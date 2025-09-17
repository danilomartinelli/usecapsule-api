import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type {
  RedisModuleOptions,
  RedisCacheOptions,
  RedisJobQueueOptions,
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
 * Injectable service providing Redis configuration for the Deploy service.
 *
 * This service encapsulates all Redis configuration logic for the deployment
 * service, including deployment status caching, job queue management, and
 * container orchestration coordination.
 *
 * The deploy service uses Redis for:
 * - Deployment status caching and tracking
 * - Job queue for async deployment tasks
 * - Container status monitoring
 * - Resource allocation tracking
 * - Build artifact caching
 * - Deployment rollback state management
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     RedisModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (deployRedisService: DeployRedisService) =>
 *         deployRedisService.getModuleOptions(),
 *       inject: [DeployRedisService],
 *     }),
 *   ],
 *   providers: [DeployRedisService],
 * })
 * export class DeployModule {}
 * ```
 */
@Injectable()
export class DeployRedisService {
  private readonly logger = new Logger(DeployRedisService.name);
  private readonly serviceConfig: ServiceRedisConfig;

  constructor(
    private readonly configService: ConfigService<RedisEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Deploy Redis configuration initialized');
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
    return createRedisConfigFactory(RedisServiceType.DEPLOY, environment);
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
      service: RedisServiceType.DEPLOY,
      connection: {
        host: this.serviceConfig.host,
        port: this.serviceConfig.port,
        database: this.serviceConfig.database,
      },
      timeout: this.serviceConfig.connectTimeout,
      commands: ['ping', 'info', 'memory'] as const,
      thresholds: {
        memoryUsagePercent: 85,
        responseTimeMs: 200,
        connectionCount: 75,
      },
    };
  }

  /**
   * Gets cache configuration optimized for deployment data.
   *
   * @returns Cache configuration
   */
  getCacheConfig(): RedisCacheOptions {
    return {
      defaultTTL: 60 * 60, // 1 hour for deployment data
      maxSize: 500 * 1024 * 1024, // 500MB cache limit for artifacts
      keySerializer: (key: unknown) =>
        `${this.serviceConfig.keyPrefix}cache:${String(key)}`,
      valueSerializer: {
        serialize: (value: unknown) => JSON.stringify(value),
        deserialize: (value: string) => JSON.parse(value),
      },
      compression: {
        enabled: true,
        algorithm: 'gzip',
        threshold: 4096, // Compress values larger than 4KB
      },
    };
  }

  /**
   * Gets optimized Redis settings for deploy workload.
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
      // Deploy-specific optimizations
      connectTimeout: 20_000, // Long timeout for deploy operations
      maxRetriesPerRequest: 5, // Retry job operations
      maxmemoryPolicy: 'noeviction', // Don't lose job data
      enableOfflineQueue: true, // Queue operations when disconnected
    };
  }

  /**
   * Gets configuration for deployment status caching.
   *
   * @returns Deployment status cache configuration
   */
  getDeploymentStatusCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}deployment:`,
      ttl: 2 * 60 * 60, // 2 hours for deployment status
      realTimeUpdates: true,
      statusFields: [
        'id',
        'status',
        'stage',
        'progress',
        'startedAt',
        'completedAt',
        'environment',
        'version',
        'containersStatus',
        'healthChecks',
      ],
      excludeFields: ['buildLogs', 'environmentVariables', 'secrets'],
    };
  }

  /**
   * Gets configuration for container status monitoring.
   *
   * @returns Container status configuration
   */
  getContainerStatusConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}container:`,
      ttl: 5 * 60, // 5 minutes for container status
      refreshInterval: 30, // 30 seconds
      includeMetrics: true,
      metricsFields: [
        'cpuUsage',
        'memoryUsage',
        'networkIO',
        'diskIO',
        'restartCount',
        'uptime',
      ],
    };
  }

  /**
   * Gets configuration for job queue management.
   *
   * @returns Job queue configuration
   */
  getJobQueueConfig(): Record<string, RedisJobQueueOptions> {
    const baseConfig: Omit<RedisJobQueueOptions, 'name'> = {
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
      concurrency: 5,
    };

    return {
      deployment: {
        ...baseConfig,
        name: `${this.serviceConfig.keyPrefix}queue:deployment`,
        concurrency: 3, // Limit concurrent deployments
        defaultJobOptions: {
          ...baseConfig.defaultJobOptions,
          attempts: 2, // Fewer retries for deployments
        },
      },
      build: {
        ...baseConfig,
        name: `${this.serviceConfig.keyPrefix}queue:build`,
        concurrency: 2, // Limit concurrent builds
        limiter: {
          max: 10,
          duration: 60000, // 1 minute
        },
      },
      scaling: {
        ...baseConfig,
        name: `${this.serviceConfig.keyPrefix}queue:scaling`,
        concurrency: 10, // Allow multiple scaling operations
        defaultJobOptions: {
          ...baseConfig.defaultJobOptions,
          attempts: 5, // More retries for scaling
          delay: 5000, // 5 second delay
        },
      },
      healthCheck: {
        ...baseConfig,
        name: `${this.serviceConfig.keyPrefix}queue:health`,
        concurrency: 20, // Many concurrent health checks
        defaultJobOptions: {
          ...baseConfig.defaultJobOptions,
          attempts: 1, // Single attempt for health checks
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      },
    };
  }

  /**
   * Gets configuration for build artifact caching.
   *
   * @returns Build artifact cache configuration
   */
  getBuildArtifactCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}artifact:`,
      ttl: 24 * 60 * 60, // 24 hours for build artifacts
      maxArtifactSize: 10 * 1024 * 1024, // 10MB per artifact
      compressionEnabled: true,
      includeMetadata: true,
      metadataFields: [
        'buildId',
        'commitSha',
        'branch',
        'buildTime',
        'artifactType',
        'size',
        'checksum',
      ],
    };
  }

  /**
   * Gets configuration for resource allocation tracking.
   *
   * @returns Resource allocation configuration
   */
  getResourceAllocationConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}resource:`,
      ttl: 60 * 60, // 1 hour for resource allocation
      trackingFields: [
        'cpu',
        'memory',
        'storage',
        'network',
        'containers',
        'ports',
      ],
      limits: {
        maxCpuPerDeployment: 4000, // 4 CPU cores in millicores
        maxMemoryPerDeployment: 8192, // 8GB in MB
        maxStoragePerDeployment: 100, // 100GB
        maxContainersPerDeployment: 20,
      },
    };
  }

  /**
   * Gets configuration for deployment rollback state.
   *
   * @returns Rollback configuration
   */
  getRollbackConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}rollback:`,
      ttl: 7 * 24 * 60 * 60, // 7 days for rollback data
      maxRollbackVersions: 5,
      includeData: [
        'previousVersion',
        'configSnapshot',
        'environmentSnapshot',
        'rollbackReason',
        'rollbackBy',
        'rollbackAt',
      ],
      excludeData: ['secrets', 'sensitiveEnvVars', 'buildLogs'],
    };
  }

  /**
   * Gets configuration for environment management.
   *
   * @returns Environment configuration
   */
  getEnvironmentConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}env:`,
      ttl: 30 * 60, // 30 minutes for environment status
      environments: ['development', 'staging', 'production'],
      statusFields: [
        'name',
        'status',
        'activeDeployments',
        'resourceUsage',
        'healthStatus',
        'lastDeployment',
      ],
      autoRefresh: true,
      refreshInterval: 60, // 1 minute
    };
  }

  /**
   * Gets configuration for deployment locks.
   *
   * @returns Lock configuration
   */
  getLockConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}lock:`,
      defaultTTL: 30 * 60, // 30 minutes default lock
      maxTTL: 2 * 60 * 60, // 2 hours maximum lock
      lockTypes: {
        deployment: {
          ttl: 45 * 60, // 45 minutes for deployment
          renewable: true,
          autoRelease: true,
        },
        scaling: {
          ttl: 10 * 60, // 10 minutes for scaling
          renewable: false,
          autoRelease: true,
        },
        maintenance: {
          ttl: 2 * 60 * 60, // 2 hours for maintenance
          renewable: true,
          autoRelease: false,
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
        RedisServiceType.DEPLOY,
        this.configService,
      );
      this.logger.log('Deploy Redis environment validation successful');
    } catch (error) {
      this.logger.error('Deploy Redis environment validation failed', error);
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
      RedisServiceType.DEPLOY,
      this.configService,
      environment,
    );
  }
}
