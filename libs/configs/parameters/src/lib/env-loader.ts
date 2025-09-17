import * as fs from 'fs';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';

/**
 * Configuration loader for NestJS microservices.
 *
 * This class provides a standardized way to load environment variables
 * for microservices in the DDD architecture. It supports:
 * - Global environment files (.env)
 * - Environment-specific files (.env.{NODE_ENV})
 * - Service-specific files (.env.{service-name})
 * - Automatic filtering of service-prefixed variables
 *
 * @example
 * ```typescript
 * // In a service module
 * const envLoader = new EnvLoader('auth-service');
 * const parameters = envLoader.getParameters();
 *
 * // Static factory method for cleaner instantiation
 * const envLoader = EnvLoader.create('deploy-service');
 * ```
 */
@Injectable()
export class EnvLoader {
  private static readonly logger = new Logger(EnvLoader.name);

  private readonly serviceName: string;
  private readonly normalizedServiceName: string;
  private readonly parameters: Record<string, string | undefined>;
  private readonly loadedFiles: string[] = [];

  /**
   * Creates a new EnvLoader instance.
   *
   * @param serviceName - The name of the service (e.g., 'auth-service', 'deploy-service')
   * @throws {Error} If serviceName is empty or invalid
   */
  constructor(serviceName: string) {
    if (!serviceName?.trim()) {
      throw new Error('Service name cannot be empty');
    }

    this.serviceName = serviceName.trim();
    this.normalizedServiceName = this.normalizeServiceName(serviceName);

    // Always include service name in parameters
    this.parameters = {
      SERVICE_NAME: this.serviceName,
    };

    try {
      this.loadConfiguration();
      EnvLoader.logger.log(
        `Configuration loaded for service '${this.serviceName}'. ` +
          `Files loaded: [${this.loadedFiles.join(', ')}]`,
      );
    } catch (error) {
      EnvLoader.logger.error(
        `Failed to load configuration for service '${this.serviceName}': ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Static factory method to create a EnvLoader instance.
   * Provides a cleaner API for instantiation.
   *
   * @param serviceName - The name of the service
   * @returns A new EnvLoader instance
   */
  static create(serviceName: string): EnvLoader {
    return new EnvLoader(serviceName);
  }

  /**
   * Normalizes service name for environment variable prefixing.
   * Converts kebab-case to SCREAMING_SNAKE_CASE.
   *
   * @param serviceName - The original service name
   * @returns Normalized service name
   *
   * @example
   * 'auth-service' -> 'AUTH_SERVICE'
   * 'deploy-service' -> 'DEPLOY_SERVICE'
   */
  private normalizeServiceName(serviceName: string): string {
    return serviceName
      .toUpperCase()
      .replace(/[-\s]/g, '_')
      .replace(/[^A-Z0-9_]/g, '');
  }

  /**
   * Loads configuration from multiple sources in priority order:
   * 1. Global .env file
   * 2. Environment-specific .env.{NODE_ENV} file
   * 3. Service-specific .env.{service-name} file
   * 4. Process environment variables
   */
  private loadConfiguration(): void {
    // Load global environment file
    this.loadEnvFile('.env');

    // Load environment-specific file
    const nodeEnv = process.env.NODE_ENV || 'development';
    this.loadEnvFile(`.env.${nodeEnv}`);

    // Load service-specific file
    this.loadEnvFile(`.env.${this.serviceName}`);

    // Process and filter environment variables
    this.processEnvironmentVariables();
  }

  /**
   * Loads environment variables from a specific file.
   * Silently skips files that don't exist.
   *
   * @param filename - The environment file name relative to process.cwd()
   */
  private loadEnvFile(filename: string): void {
    try {
      const envPath = path.resolve(process.cwd(), filename);

      if (!fs.existsSync(envPath)) {
        EnvLoader.logger.debug(`Environment file not found: ${filename}`);
        return;
      }

      const fileContent = fs.readFileSync(envPath, 'utf8');
      const envConfig = dotenv.parse(fileContent);

      // Merge into internal parameters
      Object.assign(this.parameters, envConfig);
      this.loadedFiles.push(filename);

      EnvLoader.logger.debug(
        `Loaded ${Object.keys(envConfig).length} variables from ${filename}`,
      );
    } catch (error) {
      EnvLoader.logger.warn(
        `Failed to load environment file '${filename}': ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /**
   * Processes and filters environment variables for the service.
   * Creates a clean environment with only relevant variables.
   */
  private processEnvironmentVariables(): void {
    const filteredEnv: Record<string, string | undefined> = {};

    // Global variables that all services need (sem prefixo)
    const globalVariables: readonly string[] = [
      'NODE_ENV',
      'APP_ENV',
      'LOG_LEVEL',
      'RABBITMQ_URL',
      'RABBITMQ_EXCHANGE_EVENTS',
      'RABBITMQ_EXCHANGE_COMMANDS',
      'RABBITMQ_DLQ_ENABLED',
      'RABBITMQ_RETRY_ATTEMPTS',
      'RABBITMQ_RETRY_DELAY',
      'REDIS_HOST',
      'REDIS_PORT',
      'REDIS_PASSWORD',
      'REDIS_DB',
    ] as const;

    // Process all environment variables
    const allEnvVars = { ...process.env, ...this.parameters };

    for (const [key, value] of Object.entries(allEnvVars)) {
      if (value === undefined) continue;

      // Include global variables without modification
      if (globalVariables.includes(key)) {
        filteredEnv[key] = value;
        continue;
      }

      // Include service-specific variables (remove prefix)
      if (key.startsWith(`${this.normalizedServiceName}_`)) {
        const cleanKey = key.replace(`${this.normalizedServiceName}_`, '');
        filteredEnv[cleanKey] = value;
        continue;
      }
    }

    // Update process.env with filtered variables
    this.updateProcessEnvironment(filteredEnv);

    EnvLoader.logger.debug(
      `Filtered ${Object.keys(filteredEnv).length} relevant environment variables for service '${this.serviceName}'`,
    );
  }

  /**
   * Safely updates process.env with filtered variables.
   * Preserves system-critical environment variables.
   *
   * @param filteredEnv - The filtered environment variables
   */
  private updateProcessEnvironment(
    filteredEnv: Record<string, string | undefined>,
  ): void {
    // Preserve critical system variables
    const preserveKeys: readonly string[] = [
      'PATH',
      'HOME',
      'USER',
      'SHELL',
      'PWD',
      'LANG',
      'LC_ALL',
      'TZ',
    ] as const;

    const preserved: Record<string, string | undefined> = {};
    for (const key of preserveKeys) {
      if (process.env[key]) {
        preserved[key] = process.env[key];
      }
    }

    // Clear current environment (except preserved)
    for (const key of Object.keys(process.env)) {
      if (!preserveKeys.includes(key)) {
        delete process.env[key];
      }
    }

    // Apply filtered environment and preserved variables
    Object.assign(process.env, filteredEnv, preserved);
  }

  /**
   * Gets the loaded and filtered configuration.
   * Returns a readonly copy to prevent external modification.
   *
   * @returns The service configuration as key-value pairs
   */
  getParameters(): Readonly<Record<string, string | undefined>> {
    return Object.freeze({ ...this.parameters });
  }

  /**
   * Gets a specific configuration value with optional type conversion.
   *
   * @param key - The configuration key
   * @param defaultValue - Optional default value if key is not found
   * @returns The configuration value or default
   */
  getValue(key: string, defaultValue?: string): string | undefined {
    return process.env[key] ?? defaultValue;
  }

  /**
   * Gets a configuration value as a number.
   *
   * @param key - The configuration key
   * @param defaultValue - Optional default value if key is not found or invalid
   * @returns The numeric value or default
   */
  getNumericValue(key: string, defaultValue?: number): number | undefined {
    const value = this.getValue(key);
    if (value === undefined) return defaultValue;

    const numValue = Number(value);
    return isNaN(numValue) ? defaultValue : numValue;
  }

  /**
   * Gets a configuration value as a boolean.
   * Treats 'true', '1', 'yes', 'on' as true (case-insensitive).
   *
   * @param key - The configuration key
   * @param defaultValue - Optional default value if key is not found
   * @returns The boolean value or default
   */
  getBooleanValue(key: string, defaultValue?: boolean): boolean | undefined {
    const value = this.getValue(key);
    if (value === undefined) return defaultValue;

    return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
  }

  /**
   * Gets diagnostic information about the configuration loading process.
   * Useful for debugging configuration issues.
   *
   * @returns Configuration loading diagnostics
   */
  getDiagnostics(): Readonly<{
    serviceName: string;
    normalizedServiceName: string;
    loadedFiles: string[];
    configKeys: string[];
    envKeys: string[];
  }> {
    return Object.freeze({
      serviceName: this.serviceName,
      normalizedServiceName: this.normalizedServiceName,
      loadedFiles: [...this.loadedFiles],
      configKeys: Object.keys(this.parameters),
      envKeys: Object.keys(process.env).filter(
        (key) => process.env[key] !== undefined,
      ),
    });
  }
}
