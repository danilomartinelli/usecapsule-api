import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type {
  DatabaseEnvironmentVariables,
  ServiceDatabaseRegistry,
} from '../database.types';
import { DatabaseServiceType } from '../database.types';
import { createServiceDatabaseRegistry } from '../service-database.factory';

import type { AuthDatabaseService } from './auth-database.service';
import type { BillingDatabaseService } from './billing-database.service';
import type { DeployDatabaseService } from './deploy-database.service';
import type { MonitorDatabaseService } from './monitor-database.service';

/**
 * Central registry service for all database configurations across microservices.
 *
 * This service provides a unified interface to access database configurations
 * for all services in the platform. It's useful for infrastructure operations,
 * health monitoring, and cross-service operations.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class InfrastructureService {
 *   constructor(private readonly dbRegistry: DatabaseRegistryService) {}
 *
 *   async healthCheckAllDatabases() {
 *     const configs = this.dbRegistry.getAllConfigurations();
 *     // Perform health checks on all databases
 *   }
 * }
 * ```
 */
@Injectable()
export class DatabaseRegistryService {
  private readonly logger = new Logger(DatabaseRegistryService.name);
  private readonly registry: ServiceDatabaseRegistry;

  constructor(
    private readonly configService: ConfigService<DatabaseEnvironmentVariables>,
    private readonly authDbService: AuthDatabaseService,
    private readonly billingDbService: BillingDatabaseService,
    private readonly deployDbService: DeployDatabaseService,
    private readonly monitorDbService: MonitorDatabaseService,
  ) {
    this.registry = this.createRegistry();
    this.logger.log(
      'Database registry initialized with all service configurations',
    );
  }

  /**
   * Gets the complete service database registry.
   *
   * @returns Registry containing all service database configurations
   */
  getRegistry(): ServiceDatabaseRegistry {
    return this.registry;
  }

  /**
   * Gets database configuration for a specific service.
   *
   * @param service - Service type to get configuration for
   * @returns Service-specific database configuration
   */
  getServiceConfig(service: DatabaseServiceType) {
    switch (service) {
      case DatabaseServiceType.AUTH:
        return this.authDbService.getServiceConfig();
      case DatabaseServiceType.BILLING:
        return this.billingDbService.getServiceConfig();
      case DatabaseServiceType.DEPLOY:
        return this.deployDbService.getServiceConfig();
      case DatabaseServiceType.MONITOR:
        return this.monitorDbService.getServiceConfig();
      default:
        throw new Error(`Unknown service type: ${service}`);
    }
  }

  /**
   * Gets all database configurations as an array.
   *
   * @returns Array of all service database configurations
   */
  getAllConfigurations() {
    return [
      this.authDbService.getServiceConfig(),
      this.billingDbService.getServiceConfig(),
      this.deployDbService.getServiceConfig(),
      this.monitorDbService.getServiceConfig(),
    ];
  }

  /**
   * Gets connection strings for all services.
   *
   * @returns Map of service names to connection strings
   */
  getAllConnectionStrings(): Record<DatabaseServiceType, string> {
    return {
      [DatabaseServiceType.AUTH]: this.authDbService.getConnectionString(),
      [DatabaseServiceType.BILLING]:
        this.billingDbService.getConnectionString(),
      [DatabaseServiceType.DEPLOY]: this.deployDbService.getConnectionString(),
      [DatabaseServiceType.MONITOR]:
        this.monitorDbService.getConnectionString(),
    };
  }

  /**
   * Gets health check configurations for all services.
   *
   * @returns Array of health check configurations
   */
  getAllHealthCheckConfigs() {
    return [
      this.authDbService.getHealthCheckConfig(),
      this.billingDbService.getHealthCheckConfig(),
      this.deployDbService.getHealthCheckConfig(),
      this.monitorDbService.getHealthCheckConfig(),
    ];
  }

  /**
   * Gets migration configurations for all services.
   *
   * @returns Map of service names to migration configurations
   */
  getAllMigrationConfigs() {
    return {
      [DatabaseServiceType.AUTH]: this.authDbService.getMigrationConfig(),
      [DatabaseServiceType.BILLING]: this.billingDbService.getMigrationConfig(),
      [DatabaseServiceType.DEPLOY]: this.deployDbService.getMigrationConfig(),
      [DatabaseServiceType.MONITOR]: this.monitorDbService.getMigrationConfig(),
    };
  }

  /**
   * Gets services that use TimescaleDB.
   *
   * @returns Array of services using TimescaleDB
   */
  getTimescaleServices() {
    return this.getAllConfigurations().filter((config) => config.isTimescaleDB);
  }

  /**
   * Gets services that use regular PostgreSQL.
   *
   * @returns Array of services using PostgreSQL
   */
  getPostgreSQLServices() {
    return this.getAllConfigurations().filter(
      (config) => !config.isTimescaleDB,
    );
  }

  /**
   * Validates all service database environments.
   *
   * @returns Validation results for all services
   */
  validateAllEnvironments() {
    const results = {
      auth: this.validateServiceEnvironment(DatabaseServiceType.AUTH),
      billing: this.validateServiceEnvironment(DatabaseServiceType.BILLING),
      deploy: this.validateServiceEnvironment(DatabaseServiceType.DEPLOY),
      monitor: this.validateServiceEnvironment(DatabaseServiceType.MONITOR),
    };

    const allValid = Object.values(results).every((result) => result.isValid);
    this.logger.log(`Environment validation complete. All valid: ${allValid}`);

    return {
      allValid,
      results,
    };
  }

  /**
   * Gets database statistics for monitoring and alerting.
   *
   * @returns Database statistics summary
   */
  getDatabaseStatistics() {
    const configs = this.getAllConfigurations();

    return {
      totalServices: configs.length,
      timescaleServices: configs.filter((c) => c.isTimescaleDB).length,
      postgresServices: configs.filter((c) => !c.isTimescaleDB).length,
      totalMaxConnections: configs.reduce(
        (sum, c) => sum + (c.maximumPoolSize || 0),
        0,
      ),
      totalMinConnections: configs.reduce(
        (sum, c) => sum + (c.minimumPoolSize || 0),
        0,
      ),
      sslEnabled: configs.filter((c) => c.ssl).length,
      environments: [...new Set(configs.map((c) => c.environment))],
      servicesByEnvironment: configs.reduce(
        (acc, config) => {
          const env = config.environment || 'unknown';
          acc[env] = (acc[env] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
    };
  }

  /**
   * Creates optimized pool settings for all services.
   *
   * @returns Map of service names to optimized pool settings
   */
  getAllOptimizedPoolSettings() {
    return {
      [DatabaseServiceType.AUTH]: this.authDbService.getOptimizedPoolSettings(),
      [DatabaseServiceType.BILLING]:
        this.billingDbService.getOptimizedPoolSettings(),
      [DatabaseServiceType.DEPLOY]:
        this.deployDbService.getOptimizedPoolSettings(),
      [DatabaseServiceType.MONITOR]:
        this.monitorDbService.getOptimizedPoolSettings(),
    };
  }

  /**
   * Creates the service database registry.
   *
   * @returns Complete service database registry
   */
  private createRegistry(): ServiceDatabaseRegistry {
    const environment = this.configService.get('NODE_ENV', 'development') as
      | 'development'
      | 'production'
      | 'test';

    return createServiceDatabaseRegistry(this.configService, environment);
  }

  /**
   * Validates environment for a specific service.
   *
   * @param service - Service to validate
   * @returns Validation result
   */
  private validateServiceEnvironment(service: DatabaseServiceType) {
    try {
      const config = this.getServiceConfig(service);
      return {
        service,
        isValid: true,
        config,
        errors: [],
      };
    } catch (error) {
      return {
        service,
        isValid: false,
        config: null,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }
}
