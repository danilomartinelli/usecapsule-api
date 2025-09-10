import type { ApiGatewayConfig } from '../schemas/api-gateway.schema';

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
export const apiGatewayFactory = (): ApiGatewayConfig => ({
  NODE_ENV: (process.env.NODE_ENV as 'test' | 'development' | 'production') || 'development',
  APP_ENV: (process.env.APP_ENV as 'test' | 'local' | 'development' | 'staging' | 'production' | 'canary') || 'local',
  SERVICE_NAME: 'api-gateway' as const,
  SERVICE_PORT: Number.parseInt(process.env.API_GATEWAY_PORT || '3000', 10),
  RABBITMQ_URL: process.env.RABBITMQ_URL || '',
  JWT_SECRET: process.env.API_GATEWAY_JWT_SECRET || '',
  JWT_EXPIRATION: process.env.API_GATEWAY_JWT_EXPIRATION || '15m',
  RATE_LIMIT_TTL: Number.parseInt(process.env.API_GATEWAY_RATE_LIMIT_TTL || '60', 10),
  RATE_LIMIT_MAX: Number.parseInt(process.env.API_GATEWAY_RATE_LIMIT_MAX || '100', 10),
  CORS_ENABLED: process.env.API_GATEWAY_CORS_ENABLED === 'false' ? false : true,
  CORS_ORIGINS: process.env.API_GATEWAY_CORS_ORIGINS || '*',
  LOG_LEVEL: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
});

/**
 * Type alias for the API Gateway factory function.
 */
export type ApiGatewayFactory = typeof apiGatewayFactory;