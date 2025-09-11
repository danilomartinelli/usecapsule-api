import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  apiGatewayFactory,
  apiGatewaySchema,
  ParametersModule,
} from '@usecapsule/parameters';
import type { ApiGatewaySchema } from '@usecapsule/parameters';
import { RabbitMQModule } from '@usecapsule/rabbitmq';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Main application module for the API Gateway.
 *
 * This module configures the API Gateway with type-safe configuration management
 * using the parameters library. It sets up:
 * - Environment variable validation using Zod schemas
 * - Service-specific configuration filtering
 * - Global ConfigService for dependency injection
 * - HTTP server configuration (port, CORS, etc.)
 * - JWT authentication settings
 * - Rate limiting configuration
 * - RabbitMQ client for microservice communication
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
 * constructor(private configService: ConfigService<ApiGatewaySchema>) {
 *   const port = this.configService.get('SERVICE_PORT', { infer: true });
 *   const jwtSecret = this.configService.get('JWT_SECRET', { infer: true });
 *   const corsOrigins = this.configService.get('CORS_ORIGINS', { infer: true });
 * }
 * ```
 */
@Module({
  imports: [
    // Configure parameters with API Gateway schema and factory
    ParametersModule.forService({
      serviceName: 'api-gateway',
      schema: apiGatewaySchema,
      configFactory: apiGatewayFactory,
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,
        stripUnknown: true,
      },
    }),
    // Configure RabbitMQ client for sending messages to microservices
    RabbitMQModule.forRootAsync({
      imports: [ParametersModule],
      inject: [ConfigService],
      useFactory: async (...args: unknown[]) => {
        const configService = args[0] as ConfigService<ApiGatewaySchema, true>;

        return {
          connection: {
            urls: [configService.get('RABBITMQ_URL', { infer: true })],
          },
          // API Gateway: no defaultQueue specified for exchange-based publishing
          // This enables the client to publish to exchanges with routing keys
          globalRetryPolicy: {
            maxRetries: configService.get('RABBITMQ_RETRY_ATTEMPTS', {
              infer: true,
            }),
            retryDelay: configService.get('RABBITMQ_RETRY_DELAY', {
              infer: true,
            }),
          },
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
