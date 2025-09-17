import type { ApiGatewaySchema } from '../schemas/api-gateway.schema';

import { timeoutFactory } from './timeout.factory';

/**
 * Configuration factory for the API Gateway.
 *
 * This factory function creates the configuration object for the API Gateway
 * by reading from environment variables. It provides type-safe configuration
 * that will be validated against the apiGatewaySchema.
 *
 * The API Gateway serves as the single HTTP entry point for all external traffic,
 * routing requests to appropriate microservices via RabbitMQ message queues.
 *
 * @returns API Gateway configuration object matching the schema
 *
 * @example
 * ```typescript
 * import { apiGatewayFactory, apiGatewaySchema } from '@usecapsule/parameters';
 *
 * const config = apiGatewayFactory();
 * const validatedConfig = apiGatewaySchema.parse(config);
 * ```
 */
export const apiGatewayFactory = (): ApiGatewaySchema => ({
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
  SERVICE_NAME: 'api-gateway' as const,
  SERVICE_PORT: Number.parseInt(process.env.PORT || '3000', 10),
  RABBITMQ_URL: process.env.RABBITMQ_URL || '',
  RABBITMQ_RETRY_ATTEMPTS: Number.parseInt(
    process.env.RABBITMQ_RETRY_ATTEMPTS || '3',
    10,
  ),
  RABBITMQ_RETRY_DELAY: Number.parseInt(
    process.env.RABBITMQ_RETRY_DELAY || '1000',
    10,
  ),
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '15m',
  RATE_LIMIT_TTL: Number.parseInt(process.env.RATE_LIMIT_TTL || '60', 10),
  RATE_LIMIT_MAX: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  CORS_ENABLED: process.env.CORS_ENABLED === 'false' ? false : true,
  CORS_ORIGINS: process.env.CORS_ORIGINS || '*',
  LOG_LEVEL:
    (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: Number.parseInt(process.env.REDIS_DB || '0', 10),
  ...timeoutFactory(),
});

/**
 * Type alias for the API Gateway factory function.
 */
export type ApiGatewayFactory = typeof apiGatewayFactory;
