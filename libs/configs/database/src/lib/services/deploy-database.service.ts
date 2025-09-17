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
 * Injectable service providing database configuration for the Deploy service.
 *
 * This service encapsulates all database configuration logic for the deployment
 * service, including considerations for deployment logs, build artifacts,
 * and high-volume read/write operations during deployments.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     DatabaseModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (deployDbService: DeployDatabaseService) =>
 *         deployDbService.getModuleOptions(),
 *       inject: [DeployDatabaseService],
 *     }),
 *   ],
 *   providers: [DeployDatabaseService],
 * })
 * export class DeployModule {}
 * ```
 */
@Injectable()
export class DeployDatabaseService {
  private readonly logger = new Logger(DeployDatabaseService.name);
  private readonly serviceConfig: ServiceDatabaseConfig;

  constructor(
    private readonly configService: ConfigService<DatabaseEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Deploy database configuration initialized');
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
    return createDatabaseConfigFactory(DatabaseServiceType.DEPLOY, environment);
  }

  /**
   * Gets the connection string for direct database connections.
   *
   * @returns PostgreSQL connection string
   */
  getConnectionString(): string {
    const { host, port, database, username, password, ssl } =
      this.serviceConfig;
    const baseUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    return ssl ? `${baseUrl}?ssl=require` : baseUrl;
  }

  /**
   * Gets database health check configuration.
   *
   * @returns Health check configuration object
   */
  getHealthCheckConfig() {
    return {
      service: DatabaseServiceType.DEPLOY,
      connection: {
        host: this.serviceConfig.host,
        port: this.serviceConfig.port,
        database: this.serviceConfig.database,
      },
      timeout: this.serviceConfig.connectionTimeout,
      isTimescaleDB: false,
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
      locations: ['filesystem:db/migration/deploy'],
      validateOnMigrate: true,
      outOfOrder: false,
      ignoreMissingMigrations: false,
    };
  }

  /**
   * Gets configuration for handling deployment logs and build artifacts.
   *
   * Deployment operations generate large amounts of log data that need
   * to be stored efficiently.
   *
   * @returns Log storage configuration
   */
  getLogStorageConfig() {
    return {
      maxLogSize: 10485760, // 10MB per deployment log
      compressionEnabled: true,
      retentionPeriod: 2592000, // 30 days
      archiveToS3: this.serviceConfig.environment === 'production',
      batchInsertSize: 1000,
      flushInterval: 5000, // 5 seconds
    };
  }

  /**
   * Gets configuration for deployment analytics and metrics.
   *
   * @returns Analytics configuration
   */
  getAnalyticsConfig() {
    return {
      aggregationInterval: 300, // 5 minutes
      metricsRetention: 7776000, // 90 days
      enableRealTimeMetrics: true,
      batchSize: 500,
      partitionByDate: true,
    };
  }

  /**
   * Gets configuration for managing deployment queues and concurrency.
   *
   * @returns Queue management configuration
   */
  getQueueConfig() {
    return {
      maxConcurrentDeployments: 10,
      queueTimeout: 3600, // 1 hour
      priorityLevels: 3,
      enableQueueMetrics: true,
      deadLetterQueue: true,
      retryAttempts: 3,
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
        DatabaseServiceType.DEPLOY,
        this.configService,
      );
      this.logger.log('Deploy database environment validation successful');
    } catch (error) {
      this.logger.error('Deploy database environment validation failed', error);
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
      DatabaseServiceType.DEPLOY,
      this.configService,
      environment,
    );
  }

  /**
   * Gets optimized pool settings for the deployment service workload.
   *
   * @returns Optimized pool configuration
   */
  getOptimizedPoolSettings() {
    const baseConfig = this.getModuleOptions();

    // Deploy service typically has:
    // - High write traffic during deployments
    // - Large log data inserts
    // - Analytics and reporting queries
    // - Concurrent deployment processing
    return {
      ...baseConfig,
      maximumPoolSize: 20, // Higher pool for concurrent deployments
      minimumPoolSize: 4, // Keep connections warm for active deployments
      connectionTimeout: 15000, // Allow time for large operations
      statementTimeout: 60000, // Longer timeout for log processing
      idleTimeout: 45000, // Medium idle for deployment bursts
    };
  }

  /**
   * Gets connection pool settings optimized for log processing.
   *
   * @returns Log processing pool configuration
   */
  getLogProcessingPoolSettings() {
    return {
      ...this.getOptimizedPoolSettings(),
      maximumPoolSize: 8, // Dedicated pool for log processing
      minimumPoolSize: 2,
      connectionTimeout: 30000, // Longer timeout for log operations
      statementTimeout: 120000, // 2 minutes for large log inserts
      idleTimeout: 30000, // Shorter idle for log processing
    };
  }

  /**
   * Gets connection pool settings optimized for analytics queries.
   *
   * @returns Analytics pool configuration
   */
  getAnalyticsPoolSettings() {
    return {
      ...this.getOptimizedPoolSettings(),
      maximumPoolSize: 6, // Smaller pool for analytics
      minimumPoolSize: 1,
      connectionTimeout: 30000, // Allow time for complex queries
      statementTimeout: 300000, // 5 minutes for analytics queries
      idleTimeout: 180000, // 3 minutes idle for analytics
    };
  }
}
