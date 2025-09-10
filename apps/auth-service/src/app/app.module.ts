import { Module } from '@nestjs/common';
import {
  authServiceFactory,
  authServiceSchema,
  ParametersModule,
} from '@usecapsule/parameters';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Main application module for the Auth Service.
 *
 * This module configures the Auth Service with type-safe configuration management
 * using the parameters library. It sets up:
 * - Environment variable validation using Zod schemas
 * - Service-specific configuration filtering
 * - Global ConfigService for dependency injection
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
 * constructor(private configService: ConfigService<AuthServiceSchema>) {
 *   const dbHost = this.configService.get('AUTH_DB_HOST', { infer: true });
 *   const jwtSecret = this.configService.get('JWT_SECRET', { infer: true });
 * }
 * ```
 */
@Module({
  imports: [
    // Configure parameters with Auth Service schema and factory
    ParametersModule.forService({
      serviceName: 'auth-service',
      schema: authServiceSchema,
      configFactory: authServiceFactory,
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
