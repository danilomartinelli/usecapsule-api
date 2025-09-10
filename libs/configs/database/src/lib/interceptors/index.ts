import { Interceptor } from 'slonik';

import { loggingInterceptor } from './logging.interceptor';

/**
 * Environment type for database interceptor configuration.
 */
export type DatabaseEnvironment = 'development' | 'production' | 'test';

/**
 * Creates a configured array of database interceptors based on environment.
 *
 * This factory function provides environment-specific interceptor configuration
 * for the Slonik database connection pool. It enables different logging
 * behaviors and monitoring capabilities based on the runtime environment.
 *
 * @param environment - The application environment
 * @returns Array of configured Slonik interceptors
 *
 * @example
 * ```typescript
 * import { createPool } from 'slonik';
 * import { createInterceptors } from './interceptors';
 *
 * const pool = createPool(connectionString, {
 *   interceptors: createInterceptors('production'),
 * });
 * ```
 */
export function createInterceptors(
  environment: DatabaseEnvironment,
): readonly Interceptor[] {
  return [
    loggingInterceptor(environment),
    // Additional interceptors can be added here based on environment
  ] as const;
}

// Re-export specific interceptors for direct usage
export { loggingInterceptor } from './logging.interceptor';
