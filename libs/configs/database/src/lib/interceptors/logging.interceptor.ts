import { Logger } from '@nestjs/common';
import type { Interceptor, QueryContext } from 'slonik';

/**
 * Connection context information for logging
 */
interface ConnectionLogContext {
  readonly poolId: string;
  readonly connectionId: string;
}

/**
 * Pool context information for logging (before connection is established)
 */
interface PoolLogContext {
  readonly poolId: string;
}

/**
 * Query error context information for enhanced error logging
 */
interface QueryErrorContext {
  readonly sql: string;
  readonly values?: readonly unknown[];
  readonly error: string;
  readonly stack?: string;
}

/**
 * Creates a database logging interceptor with environment-aware logging levels.
 *
 * The interceptor provides comprehensive logging for database operations:
 * - Connection lifecycle events (acquire, release) in development mode
 * - Query execution errors with detailed context in all environments
 * - Structured logging using NestJS Logger for consistency
 * - Performance-aware logging that respects environment settings
 *
 * @param environment - Current application environment
 * @returns Configured Slonik interceptor for database logging
 *
 * @example
 * ```typescript
 * import { createPool } from 'slonik';
 * import { loggingInterceptor } from './logging.interceptor';
 *
 * const pool = createPool(connectionString, {
 *   interceptors: [
 *     loggingInterceptor('development'), // Enables verbose connection logging
 *   ],
 * });
 * ```
 */
export function loggingInterceptor(
  environment: 'development' | 'production' | 'test',
): Interceptor {
  const logger = new Logger('DatabaseInterceptor');

  /**
   * Checks if development-level logging is enabled
   */
  const isDevelopment = (): boolean => environment === 'development';

  /**
   * Logs connection-related events with consistent formatting
   */
  const logConnectionEvent = (
    event: string,
    context: ConnectionLogContext,
  ): void => {
    if (isDevelopment()) {
      logger.debug(
        `${event} - Pool: ${context.poolId}, Connection: ${context.connectionId}`,
      );
    }
  };

  /**
   * Logs pool-related events with consistent formatting (before connection is established)
   */
  const logPoolEvent = (event: string, context: PoolLogContext): void => {
    if (isDevelopment()) {
      logger.debug(`${event} - Pool: ${context.poolId}`);
    }
  };

  /**
   * Logs query execution errors with enhanced context
   */
  const logQueryError = (
    queryContext: QueryContext,
    query: { sql: string; values?: readonly unknown[] },
    error: Error,
  ): void => {
    const errorContext: QueryErrorContext = {
      sql: query.sql,
      values: query.values,
      error: error.message,
      stack: error.stack,
    };

    // Always log query errors regardless of environment
    logger.error('Query execution failed', {
      context: errorContext,
      queryId: queryContext.queryId,
      connectionId: queryContext.connectionId,
    });
  };

  return {
    name: 'DatabaseLoggingInterceptor',

    /**
     * Logs when a connection is being acquired from the pool
     */
    beforePoolConnection: (poolContext) => {
      logPoolEvent('Acquiring connection', {
        poolId: poolContext.poolId,
      });
      return null;
    },

    /**
     * Logs when a connection has been successfully acquired
     */
    afterPoolConnection: (connectionContext) => {
      logConnectionEvent('Connection acquired', {
        poolId: connectionContext.poolId,
        connectionId: connectionContext.connectionId,
      });
      return null;
    },

    /**
     * Logs when a connection is being released back to the pool
     */
    beforePoolConnectionRelease: async (connectionContext) => {
      logConnectionEvent('Releasing connection', {
        poolId: connectionContext.poolId,
        connectionId: connectionContext.connectionId,
      });
      return null;
    },

    /**
     * Handles and logs query execution errors with detailed context
     * Always re-throws the error to maintain normal error flow
     */
    queryExecutionError: (queryContext, query, error) => {
      logQueryError(queryContext, query, error);

      // Re-throw the original error to maintain error flow
      throw error;
    },
  };
}
