import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type {
  DatabaseEnvironmentVariables,
  ServiceDatabaseConfig,
} from '../database.types';
import { DatabaseServiceType } from '../database.types';
import type { DatabaseModuleOptions } from '../interfaces';
import {
  createDatabaseConfigFactory,
  createServiceDatabaseConfig,
  validateServiceDatabaseEnvironment,
} from '../service-database.factory';

/**
 * Injectable service providing database configuration for the Monitor service.
 *
 * This service encapsulates all database configuration logic for the monitoring
 * service, including TimescaleDB-specific configurations for time-series data,
 * metrics storage, and high-volume analytics operations.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     DatabaseModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (monitorDbService: MonitorDatabaseService) =>
 *         monitorDbService.getModuleOptions(),
 *       inject: [MonitorDatabaseService],
 *     }),
 *   ],
 *   providers: [MonitorDatabaseService],
 * })
 * export class MonitorModule {}
 * ```
 */
@Injectable()
export class MonitorDatabaseService {
  private readonly logger = new Logger(MonitorDatabaseService.name);
  private readonly serviceConfig: ServiceDatabaseConfig;

  constructor(
    private readonly configService: ConfigService<DatabaseEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Monitor database configuration initialized (TimescaleDB)');
  }

  /**
   * Gets the service-specific database configuration.
   *
   * @returns Complete service database configuration
   */
  getServiceConfig(): ServiceDatabaseConfig {
    return this.serviceConfig;
  }

  /**
   * Gets the database configuration in DatabaseModuleOptions format.
   *
   * @returns Configuration compatible with DatabaseModule.forRoot()
   */
  getModuleOptions(): DatabaseModuleOptions {
    return {
      host: this.serviceConfig.host,
      port: this.serviceConfig.port,
      database: this.serviceConfig.database,
      username: this.serviceConfig.username,
      password: this.serviceConfig.password,
      ssl: this.serviceConfig.ssl,
      maximumPoolSize: this.serviceConfig.maximumPoolSize,
      minimumPoolSize: this.serviceConfig.minimumPoolSize,
      connectionTimeout: this.serviceConfig.connectionTimeout,
      idleTimeout: this.serviceConfig.idleTimeout,
      statementTimeout: this.serviceConfig.statementTimeout,
      environment: this.serviceConfig.environment,
    };
  }

  /**
   * Creates a factory function for async module configuration.
   *
   * @param environment - Target environment
   * @returns Factory function for DatabaseModule.forRootAsync()
   */
  static createConfigFactory(
    environment: 'development' | 'production' | 'test' = 'development',
  ) {
    return createDatabaseConfigFactory(
      DatabaseServiceType.MONITOR,
      environment,
    );
  }

  /**
   * Gets the connection string for direct database connections.
   *
   * @returns PostgreSQL/TimescaleDB connection string
   */
  getConnectionString(): string {
    const { host, port, database, username, password, ssl } =
      this.serviceConfig;
    const baseUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    return ssl ? `${baseUrl}?ssl=require` : baseUrl;
  }

  /**
   * Gets database health check configuration specific to TimescaleDB.
   *
   * @returns Health check configuration object
   */
  getHealthCheckConfig() {
    return {
      service: DatabaseServiceType.MONITOR,
      connection: {
        host: this.serviceConfig.host,
        port: this.serviceConfig.port,
        database: this.serviceConfig.database,
      },
      timeout: this.serviceConfig.connectionTimeout,
      isTimescaleDB: true,
      timescaleChecks: {
        extensionVersion: true,
        hypertables: true,
        compressionStatus: true,
        backgroundJobs: true,
      },
    };
  }

  /**
   * Gets migration configuration for Flyway or other migration tools.
   *
   * @returns Migration configuration
   */
  getMigrationConfig() {
    return {
      url: this.getConnectionString(),
      user: this.serviceConfig.username,
      password: this.serviceConfig.password,
      schemas: ['public'],
      table: 'flyway_schema_history',
      locations: ['filesystem:db/migration/monitor'],
      validateOnMigrate: true,
      outOfOrder: false,
      ignoreMissingMigrations: false,
      // TimescaleDB specific settings
      initSql: 'CREATE EXTENSION IF NOT EXISTS timescaledb;',
    };
  }

  /**
   * Gets TimescaleDB-specific configuration for time-series data.
   *
   * @returns TimescaleDB configuration
   */
  getTimescaleConfig() {
    return {
      chunkTimeInterval: '7 days',
      compressionPolicy: {
        enabled: true,
        afterDays: 30,
        segmentBy: 'service',
        orderBy: 'timestamp DESC',
      },
      retentionPolicy: {
        enabled: true,
        dropAfterDays: 365, // 1 year retention
      },
      continuousAggregates: {
        enabled: true,
        refreshPolicy: 'real_time',
        intervals: ['1 hour', '1 day', '1 week'],
      },
      backgroundJobs: {
        maxRuntime: '1 hour',
        maxRetries: 3,
        retryPeriod: '5 minutes',
      },
    };
  }

  /**
   * Gets configuration for metrics ingestion and processing.
   *
   * @returns Metrics processing configuration
   */
  getMetricsConfig() {
    return {
      batchSize: 1000,
      flushInterval: 10000, // 10 seconds
      maxBufferSize: 10000,
      enableCompression: true,
      partitionBy: 'time',
      indexing: {
        serviceIndex: true,
        metricNameIndex: true,
        tagsIndex: true,
        timestampIndex: false, // TimescaleDB handles this
      },
      aggregation: {
        realTime: true,
        intervals: [60, 300, 3600, 86400], // 1m, 5m, 1h, 1d
        functions: ['avg', 'min', 'max', 'sum', 'count'],
      },
    };
  }

  /**
   * Gets configuration for alerting and notification processing.
   *
   * @returns Alerting configuration
   */
  getAlertingConfig() {
    return {
      evaluationInterval: 60, // 1 minute
      lookbackWindow: 300, // 5 minutes
      maxConcurrentEvaluations: 50,
      alertHistory: {
        retentionDays: 90,
        enableCompression: true,
      },
      notifications: {
        batchSize: 10,
        retryAttempts: 3,
        timeout: 30000,
      },
    };
  }

  /**
   * Gets configuration for performance monitoring and optimization.
   *
   * @returns Performance monitoring configuration
   */
  getPerformanceConfig() {
    return {
      queryTimeout: 30000,
      slowQueryThreshold: 5000,
      enableQueryLogging: this.serviceConfig.environment === 'development',
      autoVacuum: {
        enabled: true,
        naptime: 60, // seconds
        maxWorkers: 3,
      },
      compression: {
        enabled: true,
        algorithm: 'timescaledb',
        chunkTimeInterval: '7 days',
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
      validateServiceDatabaseEnvironment(
        DatabaseServiceType.MONITOR,
        this.configService,
      );
      this.logger.log('Monitor database environment validation successful');
    } catch (error) {
      this.logger.error(
        'Monitor database environment validation failed',
        error,
      );
      throw error;
    }
  }

  /**
   * Creates the service-specific database configuration.
   *
   * @returns Service database configuration
   */
  private createServiceConfig(): ServiceDatabaseConfig {
    const environment = this.configService.get('NODE_ENV', 'development') as
      | 'development'
      | 'production'
      | 'test';

    return createServiceDatabaseConfig(
      DatabaseServiceType.MONITOR,
      this.configService,
      environment,
    );
  }

  /**
   * Gets optimized pool settings for the monitoring service workload.
   *
   * @returns Optimized pool configuration
   */
  getOptimizedPoolSettings() {
    const baseConfig = this.getModuleOptions();

    // Monitor service typically has:
    // - Very high write traffic for metrics ingestion
    // - Complex analytical queries
    // - Time-series specific operations
    // - Background compression and aggregation jobs
    return {
      ...baseConfig,
      maximumPoolSize: 25, // High pool for metrics ingestion
      minimumPoolSize: 8, // Keep many connections warm
      connectionTimeout: 10000, // Allow time for complex queries
      statementTimeout: 120000, // 2 minutes for analytical queries
      idleTimeout: 60000, // 1 minute idle for high throughput
    };
  }

  /**
   * Gets connection pool settings optimized for metrics ingestion.
   *
   * @returns Metrics ingestion pool configuration
   */
  getIngestionPoolSettings() {
    return {
      ...this.getOptimizedPoolSettings(),
      maximumPoolSize: 15, // Dedicated pool for ingestion
      minimumPoolSize: 5,
      connectionTimeout: 5000, // Quick timeout for ingestion
      statementTimeout: 30000, // Shorter timeout for inserts
      idleTimeout: 30000, // Quick cycling for high volume
    };
  }

  /**
   * Gets connection pool settings optimized for analytical queries.
   *
   * @returns Analytics pool configuration
   */
  getAnalyticsPoolSettings() {
    return {
      ...this.getOptimizedPoolSettings(),
      maximumPoolSize: 8, // Smaller pool for heavy queries
      minimumPoolSize: 2,
      connectionTimeout: 30000, // Longer timeout for complex queries
      statementTimeout: 600000, // 10 minutes for complex analytics
      idleTimeout: 300000, // 5 minutes idle for long-running queries
    };
  }

  /**
   * Gets connection pool settings optimized for real-time dashboards.
   *
   * @returns Dashboard pool configuration
   */
  getDashboardPoolSettings() {
    return {
      ...this.getOptimizedPoolSettings(),
      maximumPoolSize: 10, // Medium pool for dashboards
      minimumPoolSize: 3,
      connectionTimeout: 5000, // Quick timeout for dashboards
      statementTimeout: 15000, // Quick queries for real-time data
      idleTimeout: 60000, // Medium idle for dashboard refreshes
    };
  }
}
