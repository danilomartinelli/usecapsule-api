import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { GlobalExceptionFilter, UsecapsuleExceptionsModule } from '@usecapsule/exceptions';
import {
  authServiceFactory,
  authServiceSchema,
  ParametersModule,
} from '@usecapsule/parameters';
import { RabbitMQModule } from '@usecapsule/rabbitmq';
import { RedisModule } from '@usecapsule/redis';
import { RateLimitGuard } from '@usecapsule/shared-redis';

import { AuthModule } from '../modules/auth/auth.module';
import { RolesModule } from '../modules/roles/roles.module';
import { UserManagementModule } from '../modules/user-management/user-management.module';

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
    // Configure RabbitMQ for microservice
    RabbitMQModule.forMicroservice({
      uri:
        process.env.RABBITMQ_URL ||
        'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
      serviceName: 'auth-service',
    }),
    // Configure Redis for rate limiting and caching
    RedisModule.forRoot({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0', 10),
    }),
    // Shared modules
    UsecapsuleExceptionsModule,
    // Auth, Roles and User Management modules
    AuthModule,
    RolesModule,
    UserManagementModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global exception filter
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global rate limiting guard
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
