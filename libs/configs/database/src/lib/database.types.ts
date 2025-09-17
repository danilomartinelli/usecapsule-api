export { sql } from 'slonik';
export type { DatabasePool, QueryResult, QueryResultRow } from 'slonik';

/**
 * Supported database service types in the platform
 */
export enum DatabaseServiceType {
  AUTH = 'auth',
  BILLING = 'billing',
  DEPLOY = 'deploy',
  MONITOR = 'monitor',
}

/**
 * Database connection configuration for a specific service
 */
export interface ServiceDatabaseConfig {
  readonly service: DatabaseServiceType;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly username: string;
  readonly password: string;
  readonly ssl?: boolean;
  readonly maximumPoolSize?: number;
  readonly minimumPoolSize?: number;
  readonly connectionTimeout?: number;
  readonly idleTimeout?: number;
  readonly statementTimeout?: number;
  readonly environment?: 'test' | 'development' | 'production';
  readonly isTimescaleDB?: boolean; // For monitor service
}

/**
 * Registry of all service database configurations
 */
export interface ServiceDatabaseRegistry {
  readonly auth: ServiceDatabaseConfig;
  readonly billing: ServiceDatabaseConfig;
  readonly deploy: ServiceDatabaseConfig;
  readonly monitor: ServiceDatabaseConfig;
}

/**
 * Environment variables mapping for database configuration
 */
export interface DatabaseEnvironmentVariables {
  readonly NODE_ENV?: string;

  readonly AUTH_DB_HOST: string;
  readonly AUTH_DB_PORT: string;
  readonly AUTH_DB_NAME: string;
  readonly AUTH_DB_USER: string;
  readonly AUTH_DB_PASSWORD: string;
  readonly AUTH_DB_SSL?: string;

  readonly BILLING_DB_HOST: string;
  readonly BILLING_DB_PORT: string;
  readonly BILLING_DB_NAME: string;
  readonly BILLING_DB_USER: string;
  readonly BILLING_DB_PASSWORD: string;
  readonly BILLING_DB_SSL?: string;

  readonly DEPLOY_DB_HOST: string;
  readonly DEPLOY_DB_PORT: string;
  readonly DEPLOY_DB_NAME: string;
  readonly DEPLOY_DB_USER: string;
  readonly DEPLOY_DB_PASSWORD: string;
  readonly DEPLOY_DB_SSL?: string;

  readonly MONITOR_DB_HOST: string;
  readonly MONITOR_DB_PORT: string;
  readonly MONITOR_DB_NAME: string;
  readonly MONITOR_DB_USER: string;
  readonly MONITOR_DB_PASSWORD: string;
  readonly MONITOR_DB_SSL?: string;
}
