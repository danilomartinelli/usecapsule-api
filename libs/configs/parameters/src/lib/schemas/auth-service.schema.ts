import { z } from 'zod';

/**
 * Zod schema for Auth Service environment variables validation.
 *
 * This schema validates all required and optional environment variables
 * for the Auth Service in the DDD microservices architecture. The Auth Service
 * handles user authentication, JWT token management, and OAuth integrations.
 *
 * @example
 * ```typescript
 * import { authServiceSchema, type AuthServiceSchema } from './auth-service.schema';
 *
 * // Parse and validate environment variables
 * const config: AuthServiceSchema = authServiceSchema.parse(process.env);
 *
 * // Safe parsing with error handling
 * const result = authServiceSchema.safeParse(process.env);
 * if (!result.success) {
 *   console.error('Invalid environment configuration:', result.error);
 *   process.exit(1);
 * }
 * ```
 */
export const authServiceSchema = z
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
     * Service name identifier for the Auth Service.
     * Must be 'auth-service' to ensure proper service identification.
     */
    SERVICE_NAME: z.literal('auth-service').describe('Service name identifier'),

    /**
     * RabbitMQ connection URL.
     * Used for receiving authentication requests from the API Gateway
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
     * Database host for the Auth Service.
     * PostgreSQL server hostname or IP address for auth-specific data.
     */
    DB_HOST: z.string().min(1).describe('Database host for Auth Service'),

    /**
     * Database port for the Auth Service.
     * PostgreSQL server port number.
     *
     * @default 5432
     */
    DB_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(5432)
      .describe('Database port for Auth Service'),

    /**
     * Database name for the Auth Service.
     * PostgreSQL database name containing auth-related tables.
     */
    DB_NAME: z.string().min(1).describe('Database name for Auth Service'),

    /**
     * Database username for the Auth Service.
     * PostgreSQL user with appropriate permissions for auth database operations.
     */
    DB_USER: z.string().min(1).describe('Database username for Auth Service'),

    /**
     * Database password for the Auth Service.
     * PostgreSQL user password for secure database connections.
     */
    DB_PASSWORD: z
      .string()
      .min(1)
      .describe('Database password for Auth Service'),

    /**
     * Enable SSL for database connections.
     * Controls whether PostgreSQL connections use SSL encryption.
     *
     * @default false
     */
    DB_SSL: z
      .boolean()
      .default(false)
      .describe('Enable SSL for database connections'),

    /**
     * JWT secret key for token generation and validation.
     * Used for signing and verifying JWT tokens. Must be a strong secret.
     * Minimum 32 characters recommended for security.
     */
    JWT_SECRET: z
      .string()
      .min(32)
      .describe('JWT secret key for token signing and validation'),

    /**
     * JWT access token expiration time.
     * Defines how long access tokens remain valid.
     * Short expiration times improve security.
     *
     * @default '15m'
     * @example '15m', '1h', '30m'
     */
    JWT_EXPIRATION: z
      .string()
      .regex(/^\d+[smhdw]$/, 'Must be a valid time format (e.g., 15m, 1h, 2d)')
      .default('15m')
      .describe('JWT access token expiration time'),

    /**
     * JWT refresh token expiration time.
     * Defines how long refresh tokens remain valid.
     * Longer expiration times provide better user experience.
     *
     * @default '7d'
     * @example '7d', '30d', '1w'
     */
    JWT_REFRESH_EXPIRATION: z
      .string()
      .regex(/^\d+[smhdw]$/, 'Must be a valid time format (e.g., 7d, 30d, 1w)')
      .default('7d')
      .describe('JWT refresh token expiration time'),

    /**
     * Bcrypt salt rounds for password hashing.
     * Higher values increase security but reduce performance.
     * 10-12 rounds are recommended for production.
     *
     * @default 10
     */
    BCRYPT_ROUNDS: z
      .number()
      .int()
      .min(4)
      .max(20)
      .default(10)
      .describe('Bcrypt salt rounds for password hashing'),

    /**
     * GitHub OAuth client ID.
     * Required for GitHub OAuth integration.
     * Optional - GitHub OAuth is disabled if not provided.
     *
     * @example 'Iv1.abc123def456'
     */
    GITHUB_CLIENT_ID: z
      .string()
      .min(1)
      .optional()
      .describe('GitHub OAuth client ID for social authentication'),

    /**
     * GitHub OAuth client secret.
     * Required for GitHub OAuth integration.
     * Optional - GitHub OAuth is disabled if not provided.
     */
    GITHUB_CLIENT_SECRET: z
      .string()
      .min(1)
      .optional()
      .describe('GitHub OAuth client secret for social authentication'),

    /**
     * Logging level for the Auth Service.
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
 * TypeScript type inferred from the Auth Service schema.
 * Use this type for type-safe access to validated configuration.
 *
 * @example
 * ```typescript
 * function createAuthService(config: AuthServiceSchema) {
 *   const jwtService = new JwtService({
 *     secret: config.JWT_SECRET,
 *     expiresIn: config.JWT_EXPIRATION,
 *   });
 *
 *   const dbConfig = {
 *     host: config.DB_HOST,
 *     port: config.DB_PORT,
 *     database: config.DB_NAME,
 *     ssl: config.DB_SSL,
 *   };
 * }
 * ```
 */
export type AuthServiceSchema = z.infer<typeof authServiceSchema>;

/**
 * Input type for the Auth Service schema before validation.
 * Useful for testing and when working with raw environment variables.
 */
export type AuthServiceInput = z.input<typeof authServiceSchema>;
