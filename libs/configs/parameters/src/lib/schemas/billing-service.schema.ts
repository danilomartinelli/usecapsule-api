import { z } from 'zod';

/**
 * Zod schema for Billing Service environment variables validation.
 *
 * This schema validates all required and optional environment variables
 * for the Billing Service in the DDD microservices architecture. The Billing Service
 * handles subscription management, payment processing, invoicing, and billing cycles.
 *
 * @example
 * ```typescript
 * import { billingServiceSchema, type BillingServiceSchema } from './billing-service.schema';
 *
 * // Parse and validate environment variables
 * const config: BillingServiceSchema = billingServiceSchema.parse(process.env);
 *
 * // Safe parsing with error handling
 * const result = billingServiceSchema.safeParse(process.env);
 * if (!result.success) {
 *   console.error('Invalid environment configuration:', result.error);
 *   process.exit(1);
 * }
 * ```
 */
export const billingServiceSchema = z
  .object({
    /**
     * Application environment mode.
     * Determines the runtime behavior and feature flags.
     *
     * @default 'development'
     */
    NODE_ENV: z
      .enum(['test', 'development', 'production'])
      .default('development')
      .describe('Application environment mode'),

    /**
     * Application deployment environment.
     * Used for environment-specific configurations and feature toggles.
     *
     * @default 'local'
     */
    APP_ENV: z
      .enum(['test', 'local', 'development', 'staging', 'production', 'canary'])
      .default('local')
      .describe('Application deployment environment'),

    /**
     * Service name identifier for the Billing Service.
     * Must be 'billing-service' to ensure proper service identification.
     */
    SERVICE_NAME: z
      .literal('billing-service')
      .describe('Service name identifier'),

    /**
     * RabbitMQ connection URL.
     * Used for receiving billing requests from the API Gateway
     * and communicating with other microservices.
     *
     * @example 'amqp://user:password@localhost:5672'
     */
    RABBITMQ_URL: z
      .string()
      .url()
      .startsWith('amqp')
      .describe('RabbitMQ connection URL for inter-service communication'),

    /**
     * Database host for the Billing Service.
     * PostgreSQL server hostname or IP address for billing-specific data.
     */
    BILLING_DB_HOST: z
      .string()
      .min(1)
      .describe('Database host for Billing Service'),

    /**
     * Database port for the Billing Service.
     * PostgreSQL server port number.
     *
     * @default 5432
     */
    BILLING_DB_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(5432)
      .describe('Database port for Billing Service'),

    /**
     * Database name for the Billing Service.
     * PostgreSQL database name containing billing-related tables.
     */
    BILLING_DB_NAME: z
      .string()
      .min(1)
      .describe('Database name for Billing Service'),

    /**
     * Database username for the Billing Service.
     * PostgreSQL user with appropriate permissions for billing database operations.
     */
    BILLING_DB_USER: z
      .string()
      .min(1)
      .describe('Database username for Billing Service'),

    /**
     * Database password for the Billing Service.
     * PostgreSQL user password for secure database connections.
     */
    BILLING_DB_PASSWORD: z
      .string()
      .min(1)
      .describe('Database password for Billing Service'),

    /**
     * Enable SSL for database connections.
     * Controls whether database connections use SSL encryption.
     *
     * @default false
     */
    BILLING_DB_SSL: z
      .boolean()
      .default(false)
      .describe('Enable SSL for database connections'),

    /**
     * Stripe API secret key.
     * Secret key for interacting with the Stripe payment processing API.
     * Required for processing payments, subscriptions, and webhooks.
     *
     * @example 'sk_test_...' or 'sk_live_...'
     * @security This key provides access to Stripe account. Keep it secure.
     */
    STRIPE_SECRET_KEY: z
      .string()
      .min(1)
      .regex(/^sk_(test|live)_/, 'Must be a valid Stripe secret key format')
      .describe('Stripe API secret key for payment processing'),

    /**
     * Stripe publishable key.
     * Publishable key for client-side Stripe integrations.
     * Safe to expose in frontend applications.
     *
     * @example 'pk_test_...' or 'pk_live_...'
     */
    STRIPE_PUBLISHABLE_KEY: z
      .string()
      .min(1)
      .regex(
        /^pk_(test|live)_/,
        'Must be a valid Stripe publishable key format',
      )
      .describe('Stripe publishable key for client-side integrations'),

    /**
     * Stripe webhook endpoint secret.
     * Secret used to verify webhook signatures from Stripe.
     * Ensures that webhook requests are legitimately from Stripe.
     *
     * @example 'whsec_...'
     * @security Used for webhook signature verification. Keep it secure.
     */
    STRIPE_WEBHOOK_SECRET: z
      .string()
      .min(1)
      .startsWith('whsec_', 'Must be a valid Stripe webhook secret format')
      .describe('Stripe webhook endpoint secret for signature verification'),

    /**
     * Default currency for billing operations.
     * ISO 4217 currency code used for pricing and invoicing.
     *
     * @default 'usd'
     * @example 'usd', 'eur', 'gbp'
     */
    BILLING_CURRENCY: z
      .string()
      .length(3)
      .toLowerCase()
      .regex(/^[a-z]{3}$/, 'Must be a valid 3-letter ISO 4217 currency code')
      .default('usd')
      .describe('Default currency for billing operations'),

    /**
     * Trial period duration in days.
     * Number of days for free trial period for new subscriptions.
     *
     * @default 14
     * @minimum 0
     * @maximum 365
     */
    TRIAL_PERIOD_DAYS: z
      .number()
      .int()
      .min(0, 'Trial period cannot be negative')
      .max(365, 'Trial period cannot exceed 365 days')
      .default(14)
      .describe('Free trial period duration in days'),

    /**
     * Invoice grace period in days.
     * Number of days after invoice due date before service suspension.
     *
     * @default 7
     * @minimum 1
     * @maximum 90
     */
    INVOICE_GRACE_PERIOD_DAYS: z
      .number()
      .int()
      .min(1, 'Grace period must be at least 1 day')
      .max(90, 'Grace period cannot exceed 90 days')
      .default(7)
      .describe('Invoice grace period before service suspension'),

    /**
     * Logging level for the Billing Service.
     * Determines which log messages are output.
     *
     * @default 'info'
     */
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'debug'])
      .default('info')
      .describe('Application logging level'),

    /**
     * Redis server hostname or IP address.
     * Used for caching and session storage.
     *
     * @default 'localhost'
     */
    REDIS_HOST: z
      .string()
      .min(1)
      .default('localhost')
      .describe('Redis server hostname or IP address'),

    /**
     * Redis server port number.
     * The port on which Redis server is listening.
     *
     * @default 6379
     */
    REDIS_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(6379)
      .describe('Redis server port number'),

    /**
     * Redis password for authentication.
     * Required if Redis server has authentication enabled.
     */
    REDIS_PASSWORD: z
      .string()
      .min(1)
      .optional()
      .describe('Redis password for authentication'),

    /**
     * Redis database number to use.
     * Redis supports multiple databases (0-15 by default).
     *
     * @default 0
     */
    REDIS_DB: z
      .number()
      .int()
      .min(0)
      .max(15)
      .default(0)
      .describe('Redis database number to use'),
  })
  .strict(); // Reject undefined environment variables

/**
 * TypeScript type inferred from the Billing Service schema.
 * Use this type for type-safe access to validated configuration.
 *
 * @example
 * ```typescript
 * function createBillingService(config: BillingServiceSchema) {
 *   const stripeClient = new Stripe(config.STRIPE_SECRET_KEY, {
 *     apiVersion: '2023-10-16',
 *   });
 *
 *   const dbConfig = {
 *     host: config.BILLING_DB_HOST,
 *     port: config.BILLING_DB_PORT,
 *     database: config.BILLING_DB_NAME,
 *     username: config.BILLING_DB_USER,
 *     password: config.BILLING_DB_PASSWORD,
 *     ssl: config.BILLING_DB_SSL,
 *   };
 *
 *   const billingConfig = {
 *     currency: config.BILLING_CURRENCY,
 *     trialDays: config.TRIAL_PERIOD_DAYS,
 *     gracePeriod: config.INVOICE_GRACE_PERIOD_DAYS,
 *   };
 * }
 * ```
 */
export type BillingServiceSchema = z.infer<typeof billingServiceSchema>;

/**
 * Input type for the Billing Service schema before validation.
 * Useful for testing and when working with raw environment variables.
 */
export type BillingServiceInput = z.input<typeof billingServiceSchema>;
