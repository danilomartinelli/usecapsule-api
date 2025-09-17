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
 * Injectable service providing database configuration for the Auth service.
 *
 * This service encapsulates all database configuration logic for the authentication
 * service, including environment variable management, validation, and configuration
 * factory creation.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     DatabaseModule.forRootAsync({
 *       imports: [ConfigModule],
 *       useFactory: (authDbService: AuthDatabaseService) =>
 *         authDbService.getModuleOptions(),
 *       inject: [AuthDatabaseService],
 *     }),
 *   ],
 *   providers: [AuthDatabaseService],
 * })
 * export class AuthModule {}
 * ```
 */
@Injectable()
export class AuthDatabaseService {
  private readonly logger = new Logger(AuthDatabaseService.name);
  private readonly serviceConfig: ServiceDatabaseConfig;

  constructor(
    private readonly configService: ConfigService<DatabaseEnvironmentVariables>,
  ) {
    this.validateEnvironment();
    this.serviceConfig = this.createServiceConfig();
    this.logger.log('Auth database configuration initialized');
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
    return createDatabaseConfigFactory(DatabaseServiceType.AUTH, environment);
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
      service: DatabaseServiceType.AUTH,
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
      locations: ['filesystem:db/migration/auth'],
      validateOnMigrate: true,
      outOfOrder: false,
      ignoreMissingMigrations: false,
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
        DatabaseServiceType.AUTH,
        this.configService,
      );
      this.logger.log('Auth database environment validation successful');
    } catch (error) {
      this.logger.error('Auth database environment validation failed', error);
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
      DatabaseServiceType.AUTH,
      this.configService,
      environment,
    );
  }

  /**
   * Gets optimized pool settings for the auth service workload.
   *
   * @returns Optimized pool configuration
   */
  getOptimizedPoolSettings() {
    const baseConfig = this.getModuleOptions();

    // Auth service typically has:
    // - High read traffic for session validation
    // - Moderate write traffic for registrations/logins
    // - Need for quick response times
    return {
      ...baseConfig,
      maximumPoolSize: 15, // Higher for auth workload
      minimumPoolSize: 3, // Keep connections warm
      connectionTimeout: 5000, // Quick timeout for auth operations
      statementTimeout: 10000, // Quick statement timeout
      idleTimeout: 30000, // Longer idle for session validation
    };
  }
}
