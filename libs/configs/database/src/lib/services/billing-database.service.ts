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
 * Injectable service providing database configuration for the Billing service.
 *
 * This service encapsulates all database configuration logic for the billing
 * service, including Stripe integration considerations, financial data requirements,
 * and transaction handling configurations.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     DatabaseModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (billingDbService: BillingDatabaseService) =>
 *         billingDbService.getModuleOptions(),
 *       inject: [BillingDatabaseService],
 *     }),
 *   ],
 *   providers: [BillingDatabaseService],
 * })
 * export class BillingModule {}
 * ```
 */
@Injectable()
export class BillingDatabaseService {
  private readonly logger = new Logger(BillingDatabaseService.name);
  private readonly serviceConfig: ServiceDatabaseConfig;

  constructor(
    private readonly configService: ConfigService<DatabaseEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Billing database configuration initialized');
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
      DatabaseServiceType.BILLING,
      environment,
    );
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
      service: DatabaseServiceType.BILLING,
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
      locations: ['filesystem:db/migration/billing'],
      validateOnMigrate: true,
      outOfOrder: false,
      ignoreMissingMigrations: false,
    };
  }

  /**
   * Gets optimized configuration for financial transactions.
   *
   * Financial data requires higher durability and consistency guarantees.
   *
   * @returns Financial transaction configuration
   */
  getFinancialTransactionConfig() {
    return {
      isolationLevel: 'SERIALIZABLE',
      retryLimit: 5,
      retryDelay: 1000,
      enableWAL: true,
      fsync: true,
      synchronousCommit: 'on',
      checksums: true,
    };
  }

  /**
   * Gets configuration for Stripe webhook processing.
   *
   * @returns Webhook processing configuration
   */
  getWebhookProcessingConfig() {
    return {
      batchSize: 100,
      processingTimeout: 30000,
      retryAttempts: 3,
      idempotencyWindow: 86400, // 24 hours
      enableDeduplication: true,
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
        DatabaseServiceType.BILLING,
        this.configService,
      );
      this.logger.log('Billing database environment validation successful');
    } catch (error) {
      this.logger.error(
        'Billing database environment validation failed',
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
      DatabaseServiceType.BILLING,
      this.configService,
      environment,
    );
  }

  /**
   * Gets optimized pool settings for the billing service workload.
   *
   * @returns Optimized pool configuration
   */
  getOptimizedPoolSettings() {
    const baseConfig = this.getModuleOptions();

    // Billing service typically has:
    // - Moderate but critical transaction processing
    // - Webhook processing in batches
    // - Need for high consistency and durability
    // - Periodic reporting and analytics queries
    return {
      ...baseConfig,
      maximumPoolSize: 12, // Moderate pool for transaction processing
      minimumPoolSize: 2, // Keep minimal connections
      connectionTimeout: 10000, // Allow more time for complex transactions
      statementTimeout: 30000, // Longer timeout for financial operations
      idleTimeout: 60000, // Longer idle for batch processing
    };
  }

  /**
   * Gets connection pool settings optimized for batch processing.
   *
   * @returns Batch processing pool configuration
   */
  getBatchProcessingPoolSettings() {
    return {
      ...this.getOptimizedPoolSettings(),
      maximumPoolSize: 8, // Fewer connections for batch work
      minimumPoolSize: 1,
      connectionTimeout: 30000, // Longer timeout for batch operations
      statementTimeout: 300000, // 5 minutes for large batch operations
      idleTimeout: 120000, // 2 minutes idle for batch processing
    };
  }
}
