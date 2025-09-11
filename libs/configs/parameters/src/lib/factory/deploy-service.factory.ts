import type { DeployServiceConfig } from '../schemas/deploy-service.schema';

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
export const deployServiceFactory = (): DeployServiceConfig => ({
  NODE_ENV: (process.env.NODE_ENV as 'test' | 'development' | 'production') || 'development',
  APP_ENV: (process.env.APP_ENV as 'test' | 'local' | 'development' | 'staging' | 'production' | 'canary') || 'local',
  SERVICE_NAME: 'deploy-service' as const,
  RABBITMQ_URL: process.env.RABBITMQ_URL || '',
  RABBITMQ_QUEUE: process.env.RABBITMQ_QUEUE || 'deploy_queue',
  DEPLOY_DB_HOST: process.env.DEPLOY_SERVICE_DB_HOST || '',
  DEPLOY_DB_PORT: Number.parseInt(process.env.DEPLOY_SERVICE_DB_PORT || '5432', 10),
  DEPLOY_DB_NAME: process.env.DEPLOY_SERVICE_DB_NAME || '',
  DEPLOY_DB_USER: process.env.DEPLOY_SERVICE_DB_USER || '',
  DEPLOY_DB_PASSWORD: process.env.DEPLOY_SERVICE_DB_PASSWORD || '',
  DEPLOY_DB_SSL: process.env.DEPLOY_SERVICE_DB_SSL === 'true',
  KUBERNETES_API_URL: process.env.DEPLOY_SERVICE_KUBERNETES_API_URL || '',
  KUBERNETES_TOKEN: process.env.DEPLOY_SERVICE_KUBERNETES_TOKEN || '',
  KUBERNETES_NAMESPACE: process.env.DEPLOY_SERVICE_KUBERNETES_NAMESPACE || 'default',
  REGISTRY_URL: process.env.DEPLOY_SERVICE_REGISTRY_URL || '',
  REGISTRY_USERNAME: process.env.DEPLOY_SERVICE_REGISTRY_USERNAME || '',
  REGISTRY_PASSWORD: process.env.DEPLOY_SERVICE_REGISTRY_PASSWORD || '',
  MAX_CONCURRENT_BUILDS: Number.parseInt(process.env.MAX_CONCURRENT_BUILDS || '5', 10),
  BUILD_TIMEOUT_SECONDS: Number.parseInt(process.env.BUILD_TIMEOUT_SECONDS || '600', 10),
  LOG_LEVEL: (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: Number.parseInt(process.env.REDIS_DB || '0', 10),
});

/**
 * Type alias for the deploy service factory function.
 */
export type DeployServiceFactory = typeof deployServiceFactory;