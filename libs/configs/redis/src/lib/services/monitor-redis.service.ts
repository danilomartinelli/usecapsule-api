import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type {
  RedisModuleOptions,
  RedisCacheOptions,
  RedisMetricsOptions,
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
 * Injectable service providing Redis configuration for the Monitor service.
 *
 * This service encapsulates all Redis configuration logic for the monitoring
 * service, including real-time metrics storage, time-series caching, and
 * observability data management.
 *
 * The monitor service uses Redis for:
 * - Real-time metrics collection and storage
 * - Time-series data aggregation
 * - Alert state management
 * - Performance metrics caching
 * - System health monitoring
 * - Dashboard data caching
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     RedisModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (monitorRedisService: MonitorRedisService) =>
 *         monitorRedisService.getModuleOptions(),
 *       inject: [MonitorRedisService],
 *     }),
 *   ],
 *   providers: [MonitorRedisService],
 * })
 * export class MonitorModule {}
 * ```
 */
@Injectable()
export class MonitorRedisService {
  private readonly logger = new Logger(MonitorRedisService.name);
  private readonly serviceConfig: ServiceRedisConfig;

  constructor(
    private readonly configService: ConfigService<RedisEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Monitor Redis configuration initialized');
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
    return createRedisConfigFactory(RedisServiceType.MONITOR, environment);
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
      service: RedisServiceType.MONITOR,
      connection: {
        host: this.serviceConfig.host,
        port: this.serviceConfig.port,
        database: this.serviceConfig.database,
      },
      timeout: this.serviceConfig.connectTimeout,
      commands: ['ping', 'info', 'memory'] as const,
      thresholds: {
        memoryUsagePercent: 90, // Higher threshold for metrics storage
        responseTimeMs: 100,
        connectionCount: 200, // High connection count for monitoring
      },
    };
  }

  /**
   * Gets cache configuration optimized for monitoring data.
   *
   * @returns Cache configuration
   */
  getCacheConfig(): RedisCacheOptions {
    return {
      defaultTTL: 5 * 60, // 5 minutes for monitoring data
      maxSize: 1024 * 1024 * 1024, // 1GB cache limit for metrics
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
   * Gets optimized Redis settings for monitor workload.
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
      // Monitor-specific optimizations
      connectTimeout: 8_000, // Moderate timeout
      maxRetriesPerRequest: 1, // Fast failure for metrics
      maxmemoryPolicy: 'volatile-ttl', // Time-based eviction for metrics
    };
  }

  /**
   * Gets configuration for metrics storage.
   *
   * @returns Metrics configuration
   */
  getMetricsConfig(): RedisMetricsOptions {
    return {
      retention: {
        raw: 60 * 60, // 1 hour for raw metrics
        aggregated: 30 * 24 * 60 * 60, // 30 days for aggregated metrics
      },
      aggregation: {
        intervals: [60, 300, 900, 3600], // 1min, 5min, 15min, 1hour
        functions: ['avg', 'sum', 'min', 'max', 'count'],
      },
      compaction: {
        enabled: true,
        schedule: '0 2 * * *', // Daily at 2 AM
      },
    };
  }

  /**
   * Gets configuration for real-time metrics collection.
   *
   * @returns Real-time metrics configuration
   */
  getRealTimeMetricsConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}metrics:realtime:`,
      ttl: 5 * 60, // 5 minutes for real-time data
      batchSize: 1000,
      flushInterval: 10, // 10 seconds
      metrics: {
        system: {
          fields: ['cpu', 'memory', 'disk', 'network'],
          interval: 15, // 15 seconds
        },
        application: {
          fields: ['requests', 'errors', 'latency', 'throughput'],
          interval: 10, // 10 seconds
        },
        business: {
          fields: ['activeUsers', 'revenue', 'conversions'],
          interval: 60, // 1 minute
        },
      },
    };
  }

  /**
   * Gets configuration for time-series data storage.
   *
   * @returns Time-series configuration
   */
  getTimeSeriesConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}timeseries:`,
      defaultRetention: 7 * 24 * 60 * 60, // 7 days
      resolutions: {
        high: {
          interval: 10, // 10 seconds
          retention: 60 * 60, // 1 hour
        },
        medium: {
          interval: 60, // 1 minute
          retention: 24 * 60 * 60, // 24 hours
        },
        low: {
          interval: 300, // 5 minutes
          retention: 30 * 24 * 60 * 60, // 30 days
        },
      },
      aggregationFunctions: ['avg', 'min', 'max', 'sum', 'count'],
    };
  }

  /**
   * Gets configuration for alert state management.
   *
   * @returns Alert configuration
   */
  getAlertConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}alert:`,
      stateTTL: 24 * 60 * 60, // 24 hours for alert state
      historyTTL: 30 * 24 * 60 * 60, // 30 days for alert history
      severityLevels: ['info', 'warning', 'error', 'critical'],
      cooldownPeriods: {
        info: 5 * 60, // 5 minutes
        warning: 10 * 60, // 10 minutes
        error: 15 * 60, // 15 minutes
        critical: 30 * 60, // 30 minutes
      },
      maxAlertsPerRule: 100,
    };
  }

  /**
   * Gets configuration for dashboard data caching.
   *
   * @returns Dashboard cache configuration
   */
  getDashboardCacheConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}dashboard:`,
      defaultTTL: 2 * 60, // 2 minutes for dashboard data
      widgets: {
        realtime: {
          ttl: 10, // 10 seconds for real-time widgets
          autoRefresh: true,
        },
        hourly: {
          ttl: 5 * 60, // 5 minutes for hourly data
          autoRefresh: false,
        },
        daily: {
          ttl: 30 * 60, // 30 minutes for daily data
          autoRefresh: false,
        },
      },
      precomputeData: true,
      backgroundRefresh: true,
    };
  }

  /**
   * Gets configuration for performance metrics.
   *
   * @returns Performance metrics configuration
   */
  getPerformanceMetricsConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}performance:`,
      ttl: 60 * 60, // 1 hour for performance data
      metrics: {
        response_time: {
          buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
          unit: 'ms',
        },
        throughput: {
          buckets: [1, 5, 10, 25, 50, 100, 250, 500],
          unit: 'rps',
        },
        error_rate: {
          buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
          unit: 'percent',
        },
      },
      aggregation: {
        window: 60, // 1 minute aggregation window
        functions: ['p50', 'p90', 'p95', 'p99', 'avg', 'max'],
      },
    };
  }

  /**
   * Gets configuration for system health monitoring.
   *
   * @returns Health monitoring configuration
   */
  getHealthMonitoringConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}health:`,
      checkInterval: 30, // 30 seconds
      ttl: 5 * 60, // 5 minutes for health data
      services: [
        'api-gateway',
        'auth-service',
        'billing-service',
        'deploy-service',
      ],
      checks: {
        database: {
          timeout: 5000,
          critical: true,
        },
        redis: {
          timeout: 3000,
          critical: true,
        },
        rabbitmq: {
          timeout: 5000,
          critical: true,
        },
        external_apis: {
          timeout: 10000,
          critical: false,
        },
      },
      thresholds: {
        response_time: 1000, // 1 second
        error_rate: 0.05, // 5%
        availability: 0.99, // 99%
      },
    };
  }

  /**
   * Gets configuration for log aggregation.
   *
   * @returns Log aggregation configuration
   */
  getLogAggregationConfig() {
    return {
      keyPrefix: `${this.serviceConfig.keyPrefix}logs:`,
      bufferSize: 10000,
      flushInterval: 30, // 30 seconds
      retention: {
        error: 7 * 24 * 60 * 60, // 7 days for error logs
        warn: 3 * 24 * 60 * 60, // 3 days for warning logs
        info: 24 * 60 * 60, // 1 day for info logs
        debug: 60 * 60, // 1 hour for debug logs
      },
      compression: true,
      indexing: {
        enabled: true,
        fields: ['timestamp', 'level', 'service', 'trace_id'],
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
        RedisServiceType.MONITOR,
        this.configService,
      );
      this.logger.log('Monitor Redis environment validation successful');
    } catch (error) {
      this.logger.error('Monitor Redis environment validation failed', error);
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
      RedisServiceType.MONITOR,
      this.configService,
      environment,
    );
  }
}
