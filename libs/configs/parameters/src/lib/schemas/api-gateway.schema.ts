import { z } from 'zod';

/**
 * Zod schema for API Gateway environment variables validation.
 *
 * This schema validates all required and optional environment variables
 * for the API Gateway service in the DDD microservices architecture.
 *
 * @example
 * ```typescript
 * import { apiGatewaySchema, type ApiGatewaySchema } from './api-gateway.schema';
 *
 * // Parse and validate environment variables
 * const config: ApiGatewaySchema = apiGatewaySchema.parse(process.env);
 *
 * // Safe parsing with error handling
 * const result = apiGatewaySchema.safeParse(process.env);
 * if (!result.success) {
 *   console.error('Invalid environment configuration:', result.error);
 *   process.exit(1);
 * }
 * ```
 */
export const apiGatewaySchema = z
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
     * Service name identifier for the API Gateway.
     * Must be 'api-gateway' to ensure proper service identification.
     */
    SERVICE_NAME: z.literal('api-gateway').describe('Service name identifier'),

    /**
     * Port number for the HTTP server.
     * The API Gateway will listen on this port for incoming HTTP requests.
     *
     * @default 3000
     */
    SERVICE_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(3000)
      .describe('HTTP server port number'),

    /**
     * RabbitMQ connection URL.
     * Used for proxying requests to other microservices via message queues.
     *
     * @example 'amqp://user:password@localhost:5672'
     */
    RABBITMQ_URL: z
      .string()
      .url()
      .startsWith('amqp')
      .describe('RabbitMQ connection URL for inter-service communication'),


    /**
     * Number of retry attempts for failed RabbitMQ messages.
     */
    RABBITMQ_RETRY_ATTEMPTS: z
      .number()
      .int()
      .min(0)
      .default(3)
      .describe('Number of retry attempts for failed RabbitMQ messages'),

    /**
     * Delay between retry attempts for failed RabbitMQ messages (in milliseconds).
     */
    RABBITMQ_RETRY_DELAY: z
      .number()
      .int()
      .min(0)
      .default(1000)
      .describe(
        'Delay between retry attempts for failed RabbitMQ messages (in milliseconds)',
      ),


    /**
     * JWT secret key for token validation.
     * Used to verify JWT tokens for authentication and authorization.
     */
    JWT_SECRET: z
      .string()
      .min(32)
      .describe('JWT secret key for token validation'),

    /**
     * JWT token expiration time.
     * Defines how long JWT tokens remain valid.
     *
     * @default '15m'
     * @example '15m', '1h', '2d'
     */
    JWT_EXPIRATION: z
      .string()
      .regex(/^\d+[smhdw]$/, 'Must be a valid time format (e.g., 15m, 1h, 2d)')
      .default('15m')
      .describe('JWT token expiration time'),

    /**
     * Rate limiting time window in seconds.
     * Defines the time window for rate limiting requests.
     *
     * @default 60
     */
    RATE_LIMIT_TTL: z
      .number()
      .int()
      .positive()
      .default(60)
      .describe('Rate limiting time window in seconds'),

    /**
     * Maximum number of requests per time window.
     * Defines the maximum number of requests allowed per TTL window.
     *
     * @default 100
     */
    RATE_LIMIT_MAX: z
      .number()
      .int()
      .positive()
      .default(100)
      .describe('Maximum requests per rate limit window'),

    /**
     * Enable or disable CORS.
     * Controls whether Cross-Origin Resource Sharing is enabled.
     *
     * @default true
     */
    CORS_ENABLED: z
      .boolean()
      .default(true)
      .describe('Enable Cross-Origin Resource Sharing'),

    /**
     * Allowed CORS origins.
     * Comma-separated list of allowed origins for CORS.
     * Use '*' to allow all origins (not recommended for production).
     *
     * @default '*'
     * @example 'https://app.example.com,https://admin.example.com'
     */
    CORS_ORIGINS: z
      .string()
      .default('*')
      .describe('Comma-separated list of allowed CORS origins'),

    /**
     * Logging level for the application.
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
  .strict(); // Reject undefined environment variables

/**
 * TypeScript type inferred from the API Gateway schema.
 * Use this type for type-safe access to validated configuration.
 *
 * @example
 * ```typescript
 * function createServer(config: ApiGatewaySchema) {
 *   const app = express();
 *   app.listen(config.SERVICE_PORT, () => {
 *     console.log(`API Gateway listening on port ${config.SERVICE_PORT}`);
 *   });
 * }
 * ```
 */
export type ApiGatewaySchema = z.infer<typeof apiGatewaySchema>;

/**
 * Input type for the API Gateway schema before validation.
 * Useful for testing and when working with raw environment variables.
 */
export type ApiGatewayInput = z.input<typeof apiGatewaySchema>;
