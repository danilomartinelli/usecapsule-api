import { z } from 'zod';

/**
 * Timeout configuration schema for service-to-service communication.
 *
 * This schema defines configurable timeout values for different types of operations
 * and service tiers, allowing fine-tuned performance optimization and environment-specific
 * timeout configurations.
 *
 * Service Tiers:
 * - CRITICAL: Auth, security-related services (shorter timeouts, fail fast)
 * - STANDARD: Business logic services (moderate timeouts)
 * - NON_CRITICAL: Analytics, logging, monitoring (longer timeouts, more tolerance)
 *
 * @example
 * ```typescript
 * import { timeoutConfigSchema, type TimeoutConfig } from './timeout.schema';
 *
 * const config: TimeoutConfig = timeoutConfigSchema.parse(process.env);
 * ```
 */
export const timeoutConfigSchema = z
  .object({
    /**
     * Default RabbitMQ request timeout for all services (milliseconds).
     * Fallback value when service-specific timeouts are not configured.
     *
     * @default 5000
     * @minimum 1000 (1 second)
     * @maximum 30000 (30 seconds)
     */
    RABBITMQ_DEFAULT_TIMEOUT: z
      .number()
      .int()
      .min(1000, 'Default timeout must be at least 1000ms')
      .max(30000, 'Default timeout cannot exceed 30 seconds')
      .default(5000)
      .describe('Default RabbitMQ request timeout in milliseconds'),

    /**
     * Health check timeout for all services (milliseconds).
     * Used for service health monitoring and readiness probes.
     *
     * @default 3000
     * @minimum 500 (0.5 seconds)
     * @maximum 10000 (10 seconds)
     */
    HEALTH_CHECK_TIMEOUT: z
      .number()
      .int()
      .min(500, 'Health check timeout must be at least 500ms')
      .max(10000, 'Health check timeout cannot exceed 10 seconds')
      .default(3000)
      .describe('Health check timeout in milliseconds'),

    /**
     * Critical service timeout (auth, security) (milliseconds).
     * These services should fail fast to prevent cascade failures.
     *
     * @default 2000
     * @minimum 500 (0.5 seconds)
     * @maximum 5000 (5 seconds)
     */
    CRITICAL_SERVICE_TIMEOUT: z
      .number()
      .int()
      .min(500, 'Critical service timeout must be at least 500ms')
      .max(5000, 'Critical service timeout cannot exceed 5 seconds')
      .default(2000)
      .describe('Critical service timeout in milliseconds'),

    /**
     * Standard service timeout (business logic) (milliseconds).
     * Balanced timeout for regular business operations.
     *
     * @default 5000
     * @minimum 1000 (1 second)
     * @maximum 15000 (15 seconds)
     */
    STANDARD_SERVICE_TIMEOUT: z
      .number()
      .int()
      .min(1000, 'Standard service timeout must be at least 1000ms')
      .max(15000, 'Standard service timeout cannot exceed 15 seconds')
      .default(5000)
      .describe('Standard service timeout in milliseconds'),

    /**
     * Non-critical service timeout (analytics, monitoring) (milliseconds).
     * Longer timeout for services that can tolerate delays.
     *
     * @default 10000
     * @minimum 2000 (2 seconds)
     * @maximum 30000 (30 seconds)
     */
    NON_CRITICAL_SERVICE_TIMEOUT: z
      .number()
      .int()
      .min(2000, 'Non-critical service timeout must be at least 2000ms')
      .max(30000, 'Non-critical service timeout cannot exceed 30 seconds')
      .default(10000)
      .describe('Non-critical service timeout in milliseconds'),

    /**
     * Auth service specific timeout (milliseconds).
     * Authentication operations - critical path.
     *
     * @default 2000
     */
    AUTH_SERVICE_TIMEOUT: z
      .number()
      .int()
      .min(500, 'Auth service timeout must be at least 500ms')
      .max(5000, 'Auth service timeout cannot exceed 5 seconds')
      .default(2000)
      .describe('Auth service specific timeout in milliseconds'),

    /**
     * Billing service specific timeout (milliseconds).
     * Payment processing - standard service tier.
     *
     * @default 8000
     */
    BILLING_SERVICE_TIMEOUT: z
      .number()
      .int()
      .min(1000, 'Billing service timeout must be at least 1000ms')
      .max(15000, 'Billing service timeout cannot exceed 15 seconds')
      .default(8000)
      .describe('Billing service specific timeout in milliseconds'),

    /**
     * Deploy service specific timeout (milliseconds).
     * Deployment operations - longer timeout for complex operations.
     *
     * @default 15000
     */
    DEPLOY_SERVICE_TIMEOUT: z
      .number()
      .int()
      .min(2000, 'Deploy service timeout must be at least 2000ms')
      .max(30000, 'Deploy service timeout cannot exceed 30 seconds')
      .default(15000)
      .describe('Deploy service specific timeout in milliseconds'),

    /**
     * Monitor service specific timeout (milliseconds).
     * Monitoring operations - non-critical tier.
     *
     * @default 10000
     */
    MONITOR_SERVICE_TIMEOUT: z
      .number()
      .int()
      .min(2000, 'Monitor service timeout must be at least 2000ms')
      .max(30000, 'Monitor service timeout cannot exceed 30 seconds')
      .default(10000)
      .describe('Monitor service specific timeout in milliseconds'),

    /**
     * Database operation timeout (milliseconds).
     * Timeout for database queries and transactions.
     *
     * @default 10000
     */
    DATABASE_OPERATION_TIMEOUT: z
      .number()
      .int()
      .min(1000, 'Database timeout must be at least 1000ms')
      .max(60000, 'Database timeout cannot exceed 60 seconds')
      .default(10000)
      .describe('Database operation timeout in milliseconds'),

    /**
     * HTTP request timeout for external API calls (milliseconds).
     * Timeout for outbound HTTP requests to external services.
     *
     * @default 30000
     */
    HTTP_REQUEST_TIMEOUT: z
      .number()
      .int()
      .min(1000, 'HTTP request timeout must be at least 1000ms')
      .max(120000, 'HTTP request timeout cannot exceed 120 seconds')
      .default(30000)
      .describe('HTTP request timeout for external APIs in milliseconds'),

    /**
     * Enable timeout scaling based on environment.
     * Allows automatic timeout adjustment in production vs development.
     *
     * @default true
     */
    ENABLE_TIMEOUT_SCALING: z
      .boolean()
      .default(true)
      .describe('Enable environment-based timeout scaling'),

    /**
     * Timeout scaling factor for production environment.
     * Multiplier applied to all timeouts in production (typically higher).
     *
     * @default 1.5
     * @minimum 0.5
     * @maximum 5.0
     */
    PRODUCTION_TIMEOUT_SCALE_FACTOR: z
      .number()
      .min(0.5, 'Scale factor must be at least 0.5')
      .max(5.0, 'Scale factor cannot exceed 5.0')
      .default(1.5)
      .describe('Timeout scaling factor for production environment'),

    /**
     * Timeout scaling factor for development environment.
     * Multiplier applied to all timeouts in development (typically lower for faster feedback).
     *
     * @default 0.8
     * @minimum 0.1
     * @maximum 2.0
     */
    DEVELOPMENT_TIMEOUT_SCALE_FACTOR: z
      .number()
      .min(0.1, 'Scale factor must be at least 0.1')
      .max(2.0, 'Scale factor cannot exceed 2.0')
      .default(0.8)
      .describe('Timeout scaling factor for development environment'),
  })
  .strict();

/**
 * Service tier enumeration for timeout classification.
 */
export enum ServiceTier {
  CRITICAL = 'critical',
  STANDARD = 'standard',
  NON_CRITICAL = 'non-critical',
}

/**
 * Service timeout mapping configuration.
 * Maps service names to their specific timeout configurations.
 */
export const SERVICE_TIMEOUT_MAPPING = {
  'auth-service': {
    tier: ServiceTier.CRITICAL,
    specific: 'AUTH_SERVICE_TIMEOUT',
    healthCheck: 'HEALTH_CHECK_TIMEOUT',
  },
  'billing-service': {
    tier: ServiceTier.STANDARD,
    specific: 'BILLING_SERVICE_TIMEOUT',
    healthCheck: 'HEALTH_CHECK_TIMEOUT',
  },
  'deploy-service': {
    tier: ServiceTier.STANDARD,
    specific: 'DEPLOY_SERVICE_TIMEOUT',
    healthCheck: 'HEALTH_CHECK_TIMEOUT',
  },
  'monitor-service': {
    tier: ServiceTier.NON_CRITICAL,
    specific: 'MONITOR_SERVICE_TIMEOUT',
    healthCheck: 'HEALTH_CHECK_TIMEOUT',
  },
} as const;

/**
 * TypeScript type inferred from the timeout configuration schema.
 */
export type TimeoutConfig = z.infer<typeof timeoutConfigSchema>;

/**
 * Input type for the timeout configuration schema before validation.
 */
export type TimeoutConfigInput = z.input<typeof timeoutConfigSchema>;

/**
 * Service timeout mapping type.
 */
export type ServiceTimeoutMapping = typeof SERVICE_TIMEOUT_MAPPING;

/**
 * Service name type derived from the mapping.
 */
export type ServiceName = keyof ServiceTimeoutMapping;
