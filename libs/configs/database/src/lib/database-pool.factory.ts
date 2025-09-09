import { createPool, DatabasePool } from 'slonik';

import { createInterceptors } from './interceptors';
import { DatabaseModuleOptions } from './interfaces';
import { createTypeParsers } from './type-parsers';

/**
 * Default configuration values for database pool settings.
 * These values are used when options are not explicitly provided.
 */
const DEFAULT_POOL_CONFIG = {
  maximumPoolSize: 10,
  minimumPoolSize: 1,
  connectionTimeout: 30_000, // 30 seconds
  idleTimeout: 10_000, // 10 seconds
  statementTimeout: 30_000, // 30 seconds
  environment: 'development' as const,
} as const;

/**
 * Configuration interface for database connection string parameters.
 */
interface ConnectionConfig {
  readonly username: string;
  readonly password: string;
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly ssl?: boolean;
}

/**
 * Creates a configured Slonik database pool with optimized settings.
 * 
 * This factory function initializes a database connection pool with:
 * - Custom type parsers for PostgreSQL data types
 * - Environment-specific logging interceptors
 * - Configurable connection, pool, and timeout settings
 * - SSL support when enabled
 * 
 * @param options - Database module configuration options
 * @returns Promise that resolves to a configured DatabasePool instance
 * 
 * @example
 * ```typescript
 * const pool = await createDatabasePool({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'myapp',
 *   username: 'user',
 *   password: 'password',
 *   ssl: true,
 *   maximumPoolSize: 20
 * });
 * ```
 * 
 * @throws {Error} When connection parameters are invalid or connection fails
 */
export async function createDatabasePool(
  options: DatabaseModuleOptions,
): Promise<DatabasePool> {
  const connectionString = buildConnectionString(options);
  const poolConfiguration = createPoolConfiguration(options);

  return createPool(connectionString, poolConfiguration);
}

/**
 * Creates the Slonik pool configuration object with default fallbacks.
 * 
 * @param options - Database module options
 * @returns Configured pool settings object
 */
function createPoolConfiguration(options: DatabaseModuleOptions) {
  return {
    maximumPoolSize: options.maximumPoolSize ?? DEFAULT_POOL_CONFIG.maximumPoolSize,
    minimumPoolSize: options.minimumPoolSize ?? DEFAULT_POOL_CONFIG.minimumPoolSize,
    connectionTimeout: options.connectionTimeout ?? DEFAULT_POOL_CONFIG.connectionTimeout,
    idleTimeout: options.idleTimeout ?? DEFAULT_POOL_CONFIG.idleTimeout,
    statementTimeout: options.statementTimeout ?? DEFAULT_POOL_CONFIG.statementTimeout,
    interceptors: createInterceptors(options.environment ?? DEFAULT_POOL_CONFIG.environment),
    typeParsers: createTypeParsers(),
  };
}

/**
 * Constructs a PostgreSQL connection string from database options.
 * 
 * Builds a properly formatted connection string with optional SSL support.
 * The connection string follows the format:
 * `postgresql://username:password@host:port/database[?ssl=require]`
 * 
 * @param options - Connection configuration parameters
 * @returns Formatted PostgreSQL connection string
 * 
 * @example
 * ```typescript
 * const connStr = buildConnectionString({
 *   username: 'user',
 *   password: 'pass',
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mydb',
 *   ssl: true
 * });
 * // Returns: "postgresql://user:pass@localhost:5432/mydb?ssl=require"
 * ```
 */
function buildConnectionString(options: ConnectionConfig): string {
  const { username, password, host, port, database, ssl } = options;
  
  const baseUrl = `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  
  return ssl ? `${baseUrl}?ssl=require` : baseUrl;
}
