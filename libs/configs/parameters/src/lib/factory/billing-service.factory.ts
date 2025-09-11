import type { BillingServiceSchema } from '../schemas/billing-service.schema';

/**
 * Configuration factory for the Billing Service.
 *
 * This factory function creates the configuration object for the Billing Service
 * by reading from environment variables. It provides type-safe configuration
 * that will be validated against the billingServiceSchema.
 *
 * The Billing Service handles subscription management, payment processing,
 * invoicing, and billing cycles within the DDD microservices architecture.
 *
 * @returns Billing Service configuration object matching the schema
 *
 * @example
 * ```typescript
 * import { billingServiceFactory, billingServiceSchema } from '@usecapsule/parameters';
 *
 * const config = billingServiceFactory();
 * const validatedConfig = billingServiceSchema.parse(config);
 * ```
 */
export const billingServiceFactory = (): BillingServiceSchema => ({
  NODE_ENV:
    (process.env.NODE_ENV as 'test' | 'development' | 'production') ||
    'development',
  APP_ENV:
    (process.env.APP_ENV as
      | 'test'
      | 'local'
      | 'development'
      | 'staging'
      | 'production'
      | 'canary') || 'local',
  SERVICE_NAME: 'billing-service' as const,
  RABBITMQ_URL: process.env.RABBITMQ_URL || '',
  RABBITMQ_QUEUE: process.env.RABBITMQ_QUEUE || 'billing_queue',
  BILLING_DB_HOST: process.env.DB_HOST || '',
  BILLING_DB_PORT: Number.parseInt(process.env.DB_PORT || '5432', 10),
  BILLING_DB_NAME: process.env.DB_NAME || '',
  BILLING_DB_USER: process.env.DB_USER || '',
  BILLING_DB_PASSWORD: process.env.DB_PASSWORD || '',
  BILLING_DB_SSL: process.env.DB_SSL === 'true',
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',
  BILLING_CURRENCY: process.env.CURRENCY || 'usd',
  TRIAL_PERIOD_DAYS: Number.parseInt(process.env.TRIAL_PERIOD_DAYS || '14', 10),
  INVOICE_GRACE_PERIOD_DAYS: Number.parseInt(
    process.env.INVOICE_GRACE_PERIOD_DAYS || '7',
    10,
  ),
  LOG_LEVEL:
    (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: Number.parseInt(process.env.REDIS_DB || '0', 10),
});

/**
 * Type alias for the billing service factory function.
 */
export type BillingServiceFactory = typeof billingServiceFactory;
