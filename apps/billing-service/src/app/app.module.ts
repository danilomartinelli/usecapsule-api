import { Module } from '@nestjs/common';
import {
  billingServiceFactory,
  billingServiceSchema,
  ParametersModule,
} from '@usecapsule/parameters';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Main application module for the Billing Service.
 *
 * This module configures the Billing Service with type-safe configuration management
 * using the parameters library. It sets up:
 * - Environment variable validation using Zod schemas
 * - Service-specific configuration filtering
 * - Global ConfigService for dependency injection
 * - Stripe payment processing configuration
 * - Database connection parameters
 * - Billing and subscription management settings
 *
 * The ParametersModule integration provides:
 * - Automatic environment variable loading and filtering
 * - Schema-based validation at startup
 * - Type-safe configuration access throughout the service
 * - Comprehensive error handling for configuration issues
 *
 * @example
 * ```typescript
 * // In other services/controllers
 * constructor(private configService: ConfigService<BillingServiceSchema>) {
 *   const dbHost = this.configService.get('BILLING_DB_HOST', { infer: true });
 *   const stripeKey = this.configService.get('STRIPE_SECRET_KEY', { infer: true });
 *   const currency = this.configService.get('BILLING_CURRENCY', { infer: true });
 * }
 * ```
 */
@Module({
  imports: [
    // Configure parameters with Billing Service schema and factory
    ParametersModule.forService({
      serviceName: 'billing-service',
      schema: billingServiceSchema,
      configFactory: billingServiceFactory,
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,
        stripUnknown: true,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
