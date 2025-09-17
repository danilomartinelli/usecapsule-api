import { z } from 'zod';

import { timeoutConfigSchema } from './timeout.schema';

/**
 * Zod schema for Deploy Service environment variables validation.
 *
 * This schema validates all required and optional environment variables
 * for the Deploy Service in the DDD microservices architecture. The Deploy Service
 * handles container image builds, Kubernetes deployments, and deployment orchestration.
 *
 * @example
 * ```typescript
 * import { deployServiceSchema, type DeployServiceSchema } from './deploy-service.schema';
 *
 * // Parse and validate environment variables
 * const config: DeployServiceSchema = deployServiceSchema.parse(process.env);
 *
 * // Safe parsing with error handling
 * const result = deployServiceSchema.safeParse(process.env);
 * if (!result.success) {
 *   console.error('Invalid environment configuration:', result.error);
 *   process.exit(1);
 * }
 * ```
 */
export const deployServiceSchema = z
  .object({
    /**
     * Application environment mode.
     * Determines the runtime behavior and feature flags.
     *
     * @default 'development'
     */
    NODE_ENV: z
      .enum(['test', 'development', 'production'])
      .default('development')
      .describe('Application environment mode'),

    /**
     * Application deployment environment.
     * Used for environment-specific configurations and feature toggles.
     *
     * @default 'local'
     */
    APP_ENV: z
      .enum(['test', 'local', 'development', 'staging', 'production', 'canary'])
      .default('local')
      .describe('Application deployment environment'),

    /**
     * Service name identifier for the Deploy Service.
     * Must be 'deploy-service' to ensure proper service identification.
     */
    SERVICE_NAME: z
      .literal('deploy-service')
      .describe('Service name identifier'),

    /**
     * RabbitMQ connection URL.
     * Used for receiving deployment requests from the API Gateway
     * and communicating with other microservices.
     *
     * @example 'amqp://user:password@localhost:5672'
     */
    RABBITMQ_URL: z
      .string()
      .url()
      .startsWith('amqp')
      .describe('RabbitMQ connection URL for inter-service communication'),

    /**
     * Database host for the Deploy Service.
     * PostgreSQL server hostname or IP address for deploy-specific data.
     */
    DEPLOY_DB_HOST: z
      .string()
      .min(1)
      .describe('Database host for Deploy Service'),

    /**
     * Database port for the Deploy Service.
     * PostgreSQL server port number.
     *
     * @default 5432
     */
    DEPLOY_DB_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(5432)
      .describe('Database port for Deploy Service'),

    /**
     * Database name for the Deploy Service.
     * PostgreSQL database name containing deployment-related tables.
     */
    DEPLOY_DB_NAME: z
      .string()
      .min(1)
      .describe('Database name for Deploy Service'),

    /**
     * Database username for the Deploy Service.
     * PostgreSQL user with appropriate permissions for deployment database operations.
     */
    DEPLOY_DB_USER: z
      .string()
      .min(1)
      .describe('Database username for Deploy Service'),

    /**
     * Database password for the Deploy Service.
     * PostgreSQL user password for secure database connections.
     */
    DEPLOY_DB_PASSWORD: z
      .string()
      .min(1)
      .describe('Database password for Deploy Service'),

    /**
     * Enable SSL for database connections.
     * Controls whether database connections use SSL encryption.
     *
     * @default false
     */
    DEPLOY_DB_SSL: z
      .boolean()
      .default(false)
      .describe('Enable SSL for database connections'),

    /**
     * Kubernetes API server URL.
     * The endpoint for the Kubernetes cluster where applications will be deployed.
     * Must be a valid HTTPS URL for security.
     *
     * @example 'https://k8s.example.com:6443'
     * @security Ensure the URL uses HTTPS in production environments
     */
    KUBERNETES_API_URL: z
      .string()
      .url()
      .startsWith('https://', 'Kubernetes API URL must use HTTPS for security')
      .describe('Kubernetes API server URL for deployment operations'),

    /**
     * Kubernetes API authentication token.
     * Service account token or bearer token for authenticating with the Kubernetes API.
     * Must be a valid Kubernetes token format.
     *
     * @security This token provides access to Kubernetes resources. Keep it secure.
     */
    KUBERNETES_TOKEN: z
      .string()
      .min(10)
      .describe('Kubernetes API authentication token'),

    /**
     * Kubernetes namespace for deployments.
     * The namespace where applications will be deployed.
     * Must be a valid Kubernetes namespace name.
     *
     * @default 'default'
     * @example 'production', 'staging', 'development'
     */
    KUBERNETES_NAMESPACE: z
      .string()
      .regex(
        /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
        'Must be a valid Kubernetes namespace name',
      )
      .default('default')
      .describe('Kubernetes namespace for application deployments'),

    /**
     * Container registry URL.
     * The URL of the container registry where Docker images are stored.
     *
     * @example 'registry.example.com', 'docker.io', 'gcr.io/project-name'
     */
    REGISTRY_URL: z
      .string()
      .min(1)
      .describe('Container registry URL for storing Docker images'),

    /**
     * Container registry username.
     * Username for authenticating with the container registry.
     */
    REGISTRY_USERNAME: z
      .string()
      .min(1)
      .describe('Container registry authentication username'),

    /**
     * Container registry password.
     * Password or access token for authenticating with the container registry.
     *
     * @security This password provides access to container images. Keep it secure.
     */
    REGISTRY_PASSWORD: z
      .string()
      .min(1)
      .describe('Container registry authentication password'),

    /**
     * Maximum number of concurrent builds.
     * Limits the number of simultaneous container image builds to prevent
     * resource exhaustion on the build server.
     *
     * @default 5
     * @minimum 1
     * @maximum 50
     */
    MAX_CONCURRENT_BUILDS: z
      .number()
      .int()
      .min(1, 'Must allow at least 1 concurrent build')
      .max(50, 'Maximum 50 concurrent builds to prevent resource exhaustion')
      .default(5)
      .describe('Maximum number of concurrent container builds'),

    /**
     * Build timeout in seconds.
     * Maximum time allowed for a single container image build before it's cancelled.
     * Helps prevent stuck builds from consuming resources indefinitely.
     *
     * @default 600 (10 minutes)
     * @minimum 60 (1 minute)
     * @maximum 7200 (2 hours)
     */
    BUILD_TIMEOUT_SECONDS: z
      .number()
      .int()
      .min(60, 'Build timeout must be at least 60 seconds')
      .max(7200, 'Build timeout cannot exceed 2 hours')
      .default(600)
      .describe('Container build timeout in seconds'),

    /**
     * Logging level for the Deploy Service.
     * Determines which log messages are output.
     *
     * @default 'info'
     */
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'debug'])
      .default('info')
      .describe('Application logging level'),

    /**
     * Redis server hostname or IP address.
     * Used for caching and session storage.
     *
     * @default 'localhost'
     */
    REDIS_HOST: z
      .string()
      .min(1)
      .default('localhost')
      .describe('Redis server hostname or IP address'),

    /**
     * Redis server port number.
     * The port on which Redis server is listening.
     *
     * @default 6379
     */
    REDIS_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(6379)
      .describe('Redis server port number'),

    /**
     * Redis password for authentication.
     * Required if Redis server has authentication enabled.
     */
    REDIS_PASSWORD: z
      .string()
      .min(1)
      .optional()
      .describe('Redis password for authentication'),

    /**
     * Redis database number to use.
     * Redis supports multiple databases (0-15 by default).
     *
     * @default 0
     */
    REDIS_DB: z
      .number()
      .int()
      .min(0)
      .max(15)
      .default(0)
      .describe('Redis database number to use'),
  })
  // Merge with timeout configuration schema
  .merge(timeoutConfigSchema)
  .strict(); // Reject undefined environment variables

/**
 * TypeScript type inferred from the Deploy Service schema.
 * Use this type for type-safe access to validated configuration.
 *
 * @example
 * ```typescript
 * function createDeployService(config: DeployServiceSchema) {
 *   const k8sClient = new KubernetesClient({
 *     url: config.KUBERNETES_API_URL,
 *     token: config.KUBERNETES_TOKEN,
 *     namespace: config.KUBERNETES_NAMESPACE,
 *   });
 *
 *   const registryConfig = {
 *     url: config.REGISTRY_URL,
 *     username: config.REGISTRY_USERNAME,
 *     password: config.REGISTRY_PASSWORD,
 *   };
 *
 *   const buildConfig = {
 *     maxConcurrent: config.MAX_CONCURRENT_BUILDS,
 *     timeout: config.BUILD_TIMEOUT_SECONDS * 1000, // Convert to milliseconds
 *   };
 * }
 * ```
 */
export type DeployServiceSchema = z.infer<typeof deployServiceSchema>;

/**
 * Input type for the Deploy Service schema before validation.
 * Useful for testing and when working with raw environment variables.
 */
export type DeployServiceInput = z.input<typeof deployServiceSchema>;
