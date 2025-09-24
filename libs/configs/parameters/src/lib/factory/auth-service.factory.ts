import type { AuthServiceSchema } from '../schemas/auth-service.schema';

import { timeoutFactory } from './timeout.factory';

/**
 * Configuration factory for the Auth Service.
 *
 * This factory function creates the configuration object for the Auth Service
 * by reading from environment variables. It provides type-safe configuration
 * that will be validated against the authServiceSchema.
 *
 * @returns Auth Service configuration object matching the schema
 *
 * @example
 * ```typescript
 * import { authServiceFactory, authServiceSchema } from '@usecapsule/parameters';
 *
 * const config = authServiceFactory();
 * const validatedConfig = authServiceSchema.parse(config);
 * ```
 */
export const authServiceFactory = (): AuthServiceSchema => ({
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
  SERVICE_NAME: 'auth-service' as const,
  RABBITMQ_URL: process.env.RABBITMQ_URL || '',
  DB_HOST: process.env.DB_HOST || '',
  DB_PORT: Number.parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || '',
  DB_USER: process.env.DB_USER || '',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SSL: process.env.DB_SSL === 'true',
  JWT_SECRET: process.env.JWT_SECRET || '',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || '',
  JWT_EXPIRATION: process.env.JWT_EXPIRATION || '15m',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION || '7d',
  BCRYPT_ROUNDS: Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  LOG_LEVEL:
    (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: Number.parseInt(process.env.REDIS_DB || '0', 10),
  AUTH_RATE_LIMIT_PER_MINUTE: Number.parseInt(process.env.AUTH_RATE_LIMIT_PER_MINUTE || '5', 10),
  AUTH_RATE_LIMIT_BLOCK_DURATION: Number.parseInt(process.env.AUTH_RATE_LIMIT_BLOCK_DURATION || '300', 10),
  API_RATE_LIMIT_PER_MINUTE: Number.parseInt(process.env.API_RATE_LIMIT_PER_MINUTE || '60', 10),
  ...timeoutFactory(),
});

/**
 * Type alias for the auth service factory function.
 */
export type AuthServiceFactory = typeof authServiceFactory;
