import type { DeployServiceSchema } from '../schemas/deploy-service.schema';

import { timeoutFactory } from './timeout.factory';

/**
 * Configuration factory for the Deploy Service.
 *
 * This factory function creates the configuration object for the Deploy Service
 * by reading from environment variables. It provides type-safe configuration
 * that will be validated against the deployServiceSchema.
 *
 * The Deploy Service handles container image builds, Kubernetes deployments,
 * and deployment orchestration within the DDD microservices architecture.
 *
 * @returns Deploy Service configuration object matching the schema
 *
 * @example
 * ```typescript
 * import { deployServiceFactory, deployServiceSchema } from '@usecapsule/parameters';
 *
 * const config = deployServiceFactory();
 * const validatedConfig = deployServiceSchema.parse(config);
 * ```
 */
export const deployServiceFactory = (): DeployServiceSchema => ({
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
  SERVICE_NAME: 'deploy-service' as const,
  RABBITMQ_URL: process.env.RABBITMQ_URL || '',
  DEPLOY_DB_HOST: process.env.DB_HOST || '',
  DEPLOY_DB_PORT: Number.parseInt(process.env.DB_PORT || '5432', 10),
  DEPLOY_DB_NAME: process.env.DB_NAME || '',
  DEPLOY_DB_USER: process.env.DB_USER || '',
  DEPLOY_DB_PASSWORD: process.env.DB_PASSWORD || '',
  DEPLOY_DB_SSL: process.env.DB_SSL === 'true',
  KUBERNETES_API_URL: process.env.KUBERNETES_API_URL || '',
  KUBERNETES_TOKEN: process.env.KUBERNETES_TOKEN || '',
  KUBERNETES_NAMESPACE: process.env.KUBERNETES_NAMESPACE || 'default',
  REGISTRY_URL: process.env.REGISTRY_URL || '',
  REGISTRY_USERNAME: process.env.REGISTRY_USERNAME || '',
  REGISTRY_PASSWORD: process.env.REGISTRY_PASSWORD || '',
  MAX_CONCURRENT_BUILDS: Number.parseInt(
    process.env.MAX_CONCURRENT_BUILDS || '5',
    10,
  ),
  BUILD_TIMEOUT_SECONDS: Number.parseInt(
    process.env.BUILD_TIMEOUT_SECONDS || '600',
    10,
  ),
  LOG_LEVEL:
    (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: Number.parseInt(process.env.REDIS_DB || '0', 10),
  ...timeoutFactory(),
});

/**
 * Type alias for the deploy service factory function.
 */
export type DeployServiceFactory = typeof deployServiceFactory;
