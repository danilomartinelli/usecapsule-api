import type { TimeoutConfig } from '../schemas/timeout.schema';

/**
 * Configuration factory for timeout settings.
 *
 * This factory function creates the timeout configuration object by reading
 * from environment variables with appropriate defaults and type coercion.
 *
 * It supports environment-specific scaling based on NODE_ENV and provides
 * fallback values for all timeout configurations to ensure services can
 * operate even without explicit timeout configuration.
 *
 * @returns Timeout configuration object matching the schema
 *
 * @example
 * ```typescript
 * import { timeoutFactory, timeoutConfigSchema } from '@usecapsule/parameters';
 *
 * const config = timeoutFactory();
 * const validatedConfig = timeoutConfigSchema.parse(config);
 * ```
 */
export const timeoutFactory = (): TimeoutConfig => ({
  // Default RabbitMQ timeout
  RABBITMQ_DEFAULT_TIMEOUT: parseInt(
    process.env.RABBITMQ_DEFAULT_TIMEOUT || '5000',
    10,
  ),

  // Health check timeout
  HEALTH_CHECK_TIMEOUT: parseInt(
    process.env.HEALTH_CHECK_TIMEOUT || '3000',
    10,
  ),

  // Service tier timeouts
  CRITICAL_SERVICE_TIMEOUT: parseInt(
    process.env.CRITICAL_SERVICE_TIMEOUT || '2000',
    10,
  ),
  STANDARD_SERVICE_TIMEOUT: parseInt(
    process.env.STANDARD_SERVICE_TIMEOUT || '5000',
    10,
  ),
  NON_CRITICAL_SERVICE_TIMEOUT: parseInt(
    process.env.NON_CRITICAL_SERVICE_TIMEOUT || '10000',
    10,
  ),

  // Service-specific timeouts
  AUTH_SERVICE_TIMEOUT: parseInt(
    process.env.AUTH_SERVICE_TIMEOUT || '2000',
    10,
  ),
  BILLING_SERVICE_TIMEOUT: parseInt(
    process.env.BILLING_SERVICE_TIMEOUT || '8000',
    10,
  ),
  DEPLOY_SERVICE_TIMEOUT: parseInt(
    process.env.DEPLOY_SERVICE_TIMEOUT || '15000',
    10,
  ),
  MONITOR_SERVICE_TIMEOUT: parseInt(
    process.env.MONITOR_SERVICE_TIMEOUT || '10000',
    10,
  ),

  // Infrastructure timeouts
  DATABASE_OPERATION_TIMEOUT: parseInt(
    process.env.DATABASE_OPERATION_TIMEOUT || '10000',
    10,
  ),
  HTTP_REQUEST_TIMEOUT: parseInt(
    process.env.HTTP_REQUEST_TIMEOUT || '30000',
    10,
  ),

  // Environment scaling
  ENABLE_TIMEOUT_SCALING:
    process.env.ENABLE_TIMEOUT_SCALING?.toLowerCase() !== 'false',
  PRODUCTION_TIMEOUT_SCALE_FACTOR: parseFloat(
    process.env.PRODUCTION_TIMEOUT_SCALE_FACTOR || '1.5',
  ),
  DEVELOPMENT_TIMEOUT_SCALE_FACTOR: parseFloat(
    process.env.DEVELOPMENT_TIMEOUT_SCALE_FACTOR || '0.8',
  ),
});

/**
 * Type alias for the timeout factory function.
 */
export type TimeoutFactory = typeof timeoutFactory;
