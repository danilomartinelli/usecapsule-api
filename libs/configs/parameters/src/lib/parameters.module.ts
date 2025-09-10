import { DynamicModule, Global, Logger, Module } from '@nestjs/common';
import {
  ConfigModule,
  ConfigModuleOptions,
  ConfigService,
} from '@nestjs/config';
import { z } from 'zod';

import { EnvLoader } from './env-loader';

/**
 * Supported schema validation type for the ParametersModule.
 * Uses Zod for modern schema validation.
 */
export type ValidationSchema = z.ZodSchema;

/**
 * Generic configuration factory function type.
 * Must return a configuration object that matches the provided schema.
 *
 * @template TConfig - The expected configuration type
 * @returns Configuration object for the service
 */
export type ConfigFactory<TConfig = Record<string, unknown>> = () => TConfig;

/**
 * Service configuration options for the ParametersModule.
 * Provides type-safe configuration setup for microservices.
 *
 * @template TConfig - The configuration type that will be validated and returned
 * @template TSchema - The validation schema type (Zod)
 */
export interface ServiceConfigOptions<
  TConfig = Record<string, unknown>,
  TSchema extends ValidationSchema = ValidationSchema,
> {
  /**
   * The name of the service (e.g., 'api-gateway', 'auth-service').
   * Used for environment variable filtering and logging context.
   *
   * @example 'auth-service'
   */
  serviceName: string;

  /**
   * Zod schema for validating environment configuration.
   * Must be a valid Zod schema that matches the expected configuration shape.
   *
   * @example authServiceSchema
   */
  schema: TSchema;

  /**
   * Factory function that creates the configuration object.
   * This function is called after environment variables are loaded and filtered.
   * Should return a configuration object that will be validated against the schema.
   *
   * @returns Configuration object for the service
   *
   * @example
   * ```typescript
   * configFactory: () => ({
   *   port: parseInt(process.env.SERVICE_PORT || '3000'),
   *   database: {
   *     host: process.env.DB_HOST,
   *     port: parseInt(process.env.DB_PORT || '5432'),
   *   },
   * })
   * ```
   */
  configFactory: ConfigFactory<TConfig>;

  /**
   * Optional validation options for schema validation.
   * These options are passed to the schema validation process.
   */
  validationOptions?: {
    /**
     * Whether to allow unknown properties in the configuration.
     * @default false
     */
    allowUnknown?: boolean;

    /**
     * Whether to abort validation on the first error.
     * When false, collects all validation errors.
     * @default false
     */
    abortEarly?: boolean;

    /**
     * Whether to strip unknown properties from the configuration.
     * @default true
     */
    stripUnknown?: boolean;
  };

  /**
   * Optional custom logger instance for configuration-related logging.
   * If not provided, a default logger will be created.
   */
  logger?: Logger;
}

/**
 * Custom error class for ParametersModule-specific errors.
 * Provides additional context about which service encountered the error.
 */
export class ParametersModuleError extends Error {
  override readonly message: string;

  /**
   * The name of the service that encountered the error.
   */
  public readonly serviceName: string;

  constructor(serviceName: string, message: string, cause?: Error) {
    const fullMessage = `[${serviceName}] ${message}`;
    super(fullMessage);

    this.name = 'ParametersModuleError';
    this.serviceName = serviceName;
    this.message = fullMessage;

    // Maintain proper stack trace (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ParametersModuleError);
    }

    // Chain the original error if provided
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Configuration token for dependency injection.
 * Used to inject the configuration options into providers.
 */
export const CONFIG_OPTIONS_TOKEN = 'CONFIG_OPTIONS';

/**
 * Global configuration module for microservices in the DDD architecture.
 *
 * This module provides a standardized way to load, validate, and inject
 * service-specific configuration using Zod schemas. It integrates with
 * the ConfigLoader to handle environment variable filtering and the
 * NestJS ConfigModule for dependency injection.
 *
 * ## Features:
 * - **Type-safe configuration** with Zod schema validation
 * - **Service-specific environment filtering** using ConfigLoader
 * - **Comprehensive error handling** with detailed validation messages
 * - **Global module** - available throughout the application
 * - **Caching support** for improved performance
 * - **Flexible validation options** with sensible defaults
 *
 * ## Architecture Integration:
 * This module is designed for the DDD microservices architecture where:
 * - Each service has its own configuration schema
 * - Environment variables are filtered per service
 * - Configuration is validated at startup
 * - Type safety is maintained throughout the application
 *
 * @example
 * ### Basic Usage with Auth Service
 * ```typescript
 * import { authServiceSchema, createAuthConfig } from './config';
 *
 * @Module({
 *   imports: [
 *     ParametersModule.forService<AuthServiceConfig>({
 *       serviceName: 'auth-service',
 *       schema: authServiceSchema,
 *       configFactory: createAuthConfig,
 *     }),
 *   ],
 * })
 * export class AuthModule {}
 * ```
 *
 * @example
 * ### Advanced Usage with Custom Options
 * ```typescript
 * ParametersModule.forService({
 *   serviceName: 'api-gateway',
 *   schema: apiGatewaySchema,
 *   configFactory: createApiGatewayConfig,
 *   validationOptions: {
 *     allowUnknown: false,
 *     abortEarly: false,
 *   },
 *   logger: new Logger('ApiGatewayConfig'),
 * })
 * ```
 *
 * @example
 * ### Using Configuration in Services
 * ```typescript
 * @Injectable()
 * export class AuthService {
 *   constructor(private configService: ConfigService<AuthServiceConfig>) {}
 *
 *   getJwtConfig() {
 *     return {
 *       secret: this.configService.get('JWT_SECRET', { infer: true }),
 *       expiresIn: this.configService.get('JWT_EXPIRATION', { infer: true }),
 *     };
 *   }
 * }
 * ```
 */
@Global()
@Module({})
export class ParametersModule {
  /**
   * Creates a dynamic module configured for a specific service.
   *
   * This method sets up the complete configuration pipeline:
   * 1. Loads and filters environment variables using ConfigLoader
   * 2. Validates configuration using the provided Zod schema
   * 3. Configures NestJS ConfigModule with the validated configuration
   * 4. Provides ConfigService for dependency injection
   *
   * @template TConfig - The configuration type that will be validated and injected
   * @template TSchema - The Zod schema type for validation
   *
   * @param options - Service configuration options including schema and factory
   * @returns Configured dynamic module ready for import
   *
   * @throws {ParametersModuleError} When configuration validation fails
   * @throws {ParametersModuleError} When invalid schema type is provided
   * @throws {ParametersModuleError} When ConfigLoader initialization fails
   *
   * @example
   * ```typescript
   * // In your service module
   * @Module({
   *   imports: [
   *     ParametersModule.forService<AuthServiceConfig>({
   *       serviceName: 'auth-service',
   *       schema: authServiceSchema,
   *       configFactory: () => ({
   *         port: parseInt(process.env.SERVICE_PORT || '3000'),
   *         jwtSecret: process.env.JWT_SECRET,
   *         database: {
   *           host: process.env.DB_HOST,
   *           port: parseInt(process.env.DB_PORT || '5432'),
   *         },
   *       }),
   *     }),
   *   ],
   * })
   * export class AuthModule {}
   * ```
   */
  static forService<
    TConfig = Record<string, unknown>,
    TSchema extends ValidationSchema = ValidationSchema,
  >(options: ServiceConfigOptions<TConfig, TSchema>): DynamicModule {
    // Validate required parameters
    if (!options.serviceName?.trim()) {
      throw new ParametersModuleError(
        'unknown',
        'serviceName is required and cannot be empty',
      );
    }

    if (!options.schema) {
      throw new ParametersModuleError(
        options.serviceName,
        'schema is required',
      );
    }

    if (!options.configFactory || typeof options.configFactory !== 'function') {
      throw new ParametersModuleError(
        options.serviceName,
        'configFactory is required and must be a function',
      );
    }

    // Create logger for this service configuration
    const logger =
      options.logger || new Logger(`ParametersModule:${options.serviceName}`);

    try {
      // Initialize ConfigLoader to filter environment variables for this service
      // This step loads .env files and filters variables specific to the service
      logger.log(
        `Initializing configuration for service: ${options.serviceName}`,
      );
      EnvLoader.create(options.serviceName);
      logger.log(
        `Environment variables loaded and filtered for ${options.serviceName}`,
      );
    } catch (error) {
      const errorMessage = `Failed to initialize ConfigLoader for ${options.serviceName}`;
      logger.error(errorMessage, error);
      throw new ParametersModuleError(
        options.serviceName,
        errorMessage,
        error instanceof Error ? error : new Error(String(error)),
      );
    }

    // Prepare ConfigModule options with defaults
    const configModuleOptions: ConfigModuleOptions<Record<string, unknown>> = {
      isGlobal: true,
      cache: true,
      ignoreEnvFile: true, // We handle .env files through ConfigLoader
      ignoreEnvVars: false, // Use the filtered environment variables
      load: [] as Array<ConfigFactory | Promise<ConfigFactory>>,
    };

    // Validate schema type and configure Zod validation
    if (!this.isZodSchema(options.schema)) {
      throw new ParametersModuleError(
        options.serviceName,
        'Invalid schema type provided. Expected Zod schema.',
      );
    }

    // Zod schema configuration
    // NestJS ConfigModule doesn't natively support Zod, so we'll validate in the factory
    const originalFactory = options.configFactory;
    configModuleOptions.load = [
      () => {
        const config = originalFactory();
        const result = options.schema.safeParse(config);

        if (!result.success) {
          const errorMessage = `Configuration validation failed for ${options.serviceName}: ${result.error.message}`;
          logger?.error?.(errorMessage, result.error.errors);
          throw new ParametersModuleError(options.serviceName, errorMessage);
        }

        return result.data;
      },
    ];

    logger.log(
      `Configuration validation setup completed for ${options.serviceName}`,
    );

    return {
      module: ParametersModule,
      imports: [ConfigModule.forRoot(configModuleOptions)],
      providers: [
        ConfigService,
        {
          provide: CONFIG_OPTIONS_TOKEN,
          useValue: Object.freeze({ ...options }),
        },
      ],
      exports: [ConfigService, CONFIG_OPTIONS_TOKEN],
    };
  }

  /**
   * Validates that the provided schema is a Zod schema.
   *
   * @param schema - The schema to validate
   * @returns True if the schema is a valid Zod schema
   */
  private static isZodSchema(
    schema: ValidationSchema,
  ): schema is z.ZodSchema {
    return (
      typeof schema.parse === 'function' &&
      typeof schema.safeParse === 'function'
    );
  }
}
