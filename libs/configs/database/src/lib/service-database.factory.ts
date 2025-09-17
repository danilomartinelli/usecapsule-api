import type { ConfigService } from '@nestjs/config';

import type {
  DatabaseEnvironmentVariables,
  ServiceDatabaseConfig,
  ServiceDatabaseRegistry,
} from './database.types';
import { DatabaseServiceType } from './database.types';
import type { DatabaseModuleOptions } from './interfaces';

/**
 * Default database configuration values for development environment
 */
const DEVELOPMENT_DATABASE_DEFAULTS = {
  auth: {
    host: 'localhost',
    port: 7110,
    database: 'auth_service_db',
    username: 'auth_user',
    password: 'auth_pass',
  },
  billing: {
    host: 'localhost',
    port: 7113,
    database: 'billing_service_db',
    username: 'billing_user',
    password: 'billing_pass',
  },
  deploy: {
    host: 'localhost',
    port: 7111,
    database: 'deploy_service_db',
    username: 'deploy_user',
    password: 'deploy_pass',
  },
  monitor: {
    host: 'localhost',
    port: 7112,
    database: 'monitor_service_db',
    username: 'monitor_user',
    password: 'monitor_pass',
    isTimescaleDB: true,
  },
} as const;

/**
 * Default pool configuration settings
 */
const DEFAULT_POOL_SETTINGS = {
  maximumPoolSize: 10,
  minimumPoolSize: 1,
  connectionTimeout: 30_000, // 30 seconds
  idleTimeout: 10_000, // 10 seconds
  statementTimeout: 30_000, // 30 seconds
  ssl: false,
} as const;

/**
 * Creates database configuration for a specific service using environment variables
 * with fallback to development defaults.
 *
 * @param service - The service type to create configuration for
 * @param configService - NestJS ConfigService for reading environment variables
 * @param environment - Target environment (development, production, test)
 * @returns Service-specific database configuration
 *
 * @example
 * ```typescript
 * const authConfig = createServiceDatabaseConfig(
 *   DatabaseServiceType.AUTH,
 *   configService,
 *   'development'
 * );
 * ```
 */
export function createServiceDatabaseConfig(
  service: DatabaseServiceType,
  configService: ConfigService<DatabaseEnvironmentVariables>,
  environment: 'development' | 'production' | 'test' = 'development',
): ServiceDatabaseConfig {
  const serviceDefaults = DEVELOPMENT_DATABASE_DEFAULTS[service];

  // Use explicit keys for type safety
  let host: string;
  let port: number;
  let database: string;
  let username: string;
  let password: string;
  let ssl: boolean;

  switch (service) {
    case DatabaseServiceType.AUTH:
      host = configService.get('AUTH_DB_HOST', serviceDefaults.host);
      port = Number(
        configService.get('AUTH_DB_PORT', String(serviceDefaults.port)),
      );
      database = configService.get('AUTH_DB_NAME', serviceDefaults.database);
      username = configService.get('AUTH_DB_USER', serviceDefaults.username);
      password = configService.get(
        'AUTH_DB_PASSWORD',
        serviceDefaults.password,
      );
      ssl = configService.get('AUTH_DB_SSL', 'false') === 'true';
      break;
    case DatabaseServiceType.BILLING:
      host = configService.get('BILLING_DB_HOST', serviceDefaults.host);
      port = Number(
        configService.get('BILLING_DB_PORT', String(serviceDefaults.port)),
      );
      database = configService.get('BILLING_DB_NAME', serviceDefaults.database);
      username = configService.get('BILLING_DB_USER', serviceDefaults.username);
      password = configService.get(
        'BILLING_DB_PASSWORD',
        serviceDefaults.password,
      );
      ssl = configService.get('BILLING_DB_SSL', 'false') === 'true';
      break;
    case DatabaseServiceType.DEPLOY:
      host = configService.get('DEPLOY_DB_HOST', serviceDefaults.host);
      port = Number(
        configService.get('DEPLOY_DB_PORT', String(serviceDefaults.port)),
      );
      database = configService.get('DEPLOY_DB_NAME', serviceDefaults.database);
      username = configService.get('DEPLOY_DB_USER', serviceDefaults.username);
      password = configService.get(
        'DEPLOY_DB_PASSWORD',
        serviceDefaults.password,
      );
      ssl = configService.get('DEPLOY_DB_SSL', 'false') === 'true';
      break;
    case DatabaseServiceType.MONITOR:
      host = configService.get('MONITOR_DB_HOST', serviceDefaults.host);
      port = Number(
        configService.get('MONITOR_DB_PORT', String(serviceDefaults.port)),
      );
      database = configService.get('MONITOR_DB_NAME', serviceDefaults.database);
      username = configService.get('MONITOR_DB_USER', serviceDefaults.username);
      password = configService.get(
        'MONITOR_DB_PASSWORD',
        serviceDefaults.password,
      );
      ssl = configService.get('MONITOR_DB_SSL', 'false') === 'true';
      break;
    default:
      throw new Error(`Unsupported service type: ${service}`);
  }

  return {
    service,
    host,
    port,
    database,
    username,
    password,
    environment,
    isTimescaleDB: service === DatabaseServiceType.MONITOR,
    ...DEFAULT_POOL_SETTINGS,
    ssl, // Override ssl from defaults
  };
}

/**
 * Creates a complete service database registry with all service configurations.
 *
 * @param configService - NestJS ConfigService for reading environment variables
 * @param environment - Target environment
 * @returns Complete registry of all service database configurations
 *
 * @example
 * ```typescript
 * const registry = createServiceDatabaseRegistry(configService, 'production');
 * const authConfig = registry.auth;
 * ```
 */
export function createServiceDatabaseRegistry(
  configService: ConfigService<DatabaseEnvironmentVariables>,
  environment: 'development' | 'production' | 'test' = 'development',
): ServiceDatabaseRegistry {
  return {
    auth: createServiceDatabaseConfig(
      DatabaseServiceType.AUTH,
      configService,
      environment,
    ),
    billing: createServiceDatabaseConfig(
      DatabaseServiceType.BILLING,
      configService,
      environment,
    ),
    deploy: createServiceDatabaseConfig(
      DatabaseServiceType.DEPLOY,
      configService,
      environment,
    ),
    monitor: createServiceDatabaseConfig(
      DatabaseServiceType.MONITOR,
      configService,
      environment,
    ),
  };
}

/**
 * Converts a ServiceDatabaseConfig to the legacy DatabaseModuleOptions format
 * for backward compatibility with existing DatabaseModule.
 *
 * @param serviceConfig - Service-specific database configuration
 * @returns Legacy DatabaseModuleOptions format
 */
export function serviceConfigToModuleOptions(
  serviceConfig: ServiceDatabaseConfig,
): DatabaseModuleOptions {
  return {
    host: serviceConfig.host,
    port: serviceConfig.port,
    database: serviceConfig.database,
    username: serviceConfig.username,
    password: serviceConfig.password,
    ssl: serviceConfig.ssl,
    maximumPoolSize: serviceConfig.maximumPoolSize,
    minimumPoolSize: serviceConfig.minimumPoolSize,
    connectionTimeout: serviceConfig.connectionTimeout,
    idleTimeout: serviceConfig.idleTimeout,
    statementTimeout: serviceConfig.statementTimeout,
    environment: serviceConfig.environment,
  };
}

/**
 * Validates that all required environment variables are present for a service.
 *
 * @param service - Service type to validate
 * @param configService - ConfigService instance
 * @returns True if all required variables are present
 * @throws Error if required variables are missing
 */
export function validateServiceDatabaseEnvironment(
  service: DatabaseServiceType,
  configService: ConfigService<DatabaseEnvironmentVariables>,
): boolean {
  let requiredKeys: (keyof DatabaseEnvironmentVariables)[];

  switch (service) {
    case DatabaseServiceType.AUTH:
      requiredKeys = [
        'AUTH_DB_HOST',
        'AUTH_DB_PORT',
        'AUTH_DB_NAME',
        'AUTH_DB_USER',
        'AUTH_DB_PASSWORD',
      ];
      break;
    case DatabaseServiceType.BILLING:
      requiredKeys = [
        'BILLING_DB_HOST',
        'BILLING_DB_PORT',
        'BILLING_DB_NAME',
        'BILLING_DB_USER',
        'BILLING_DB_PASSWORD',
      ];
      break;
    case DatabaseServiceType.DEPLOY:
      requiredKeys = [
        'DEPLOY_DB_HOST',
        'DEPLOY_DB_PORT',
        'DEPLOY_DB_NAME',
        'DEPLOY_DB_USER',
        'DEPLOY_DB_PASSWORD',
      ];
      break;
    case DatabaseServiceType.MONITOR:
      requiredKeys = [
        'MONITOR_DB_HOST',
        'MONITOR_DB_PORT',
        'MONITOR_DB_NAME',
        'MONITOR_DB_USER',
        'MONITOR_DB_PASSWORD',
      ];
      break;
    default:
      throw new Error(`Unsupported service type: ${service}`);
  }

  const missingVars = requiredKeys.filter(
    (varName) => !configService.get(varName),
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for ${service} service: ${missingVars.join(', ')}`,
    );
  }

  return true;
}

/**
 * Creates a database configuration factory function for use with DatabaseModule.forRootAsync()
 *
 * @param service - Service type to create factory for
 * @param environment - Target environment
 * @returns Factory function for DatabaseModule async configuration
 *
 * @example
 * ```typescript
 * DatabaseModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: createDatabaseConfigFactory(DatabaseServiceType.AUTH, 'production'),
 *   inject: [ConfigService],
 * })
 * ```
 */
export function createDatabaseConfigFactory(
  service: DatabaseServiceType,
  environment: 'development' | 'production' | 'test' = 'development',
) {
  return (configService: ConfigService<DatabaseEnvironmentVariables>) => {
    const serviceConfig = createServiceDatabaseConfig(
      service,
      configService,
      environment,
    );
    return serviceConfigToModuleOptions(serviceConfig);
  };
}
