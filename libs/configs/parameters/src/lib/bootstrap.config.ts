import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Bootstrap configuration loader using the Singleton pattern.
 *
 * This class provides centralized configuration management for microservices
 * during the bootstrap phase. It handles environment variable loading,
 * service-specific filtering, and provides typed access to configuration values.
 *
 * @deprecated This class is being deprecated in favor of the new EnvLoader class.
 * Use EnvLoader for new implementations.
 *
 * @example
 * ```typescript
 * const config = BootstrapConfig.getInstance('auth-service');
 * const dbConfig = config.getDatabaseConfig();
 * const rabbitConfig = config.getRabbitMQConfig();
 * ```
 */
export class BootstrapConfig {
  private static instance: BootstrapConfig | undefined;
  private readonly config: Record<string, unknown> = {};
  private readonly serviceName: string;

  private constructor(serviceName: string) {
    if (!serviceName?.trim()) {
      throw new Error('Service name cannot be empty');
    }
    this.serviceName = serviceName.trim();
    this.loadConfiguration();
  }

  /**
   * Gets the singleton instance of BootstrapConfig.
   *
   * @param serviceName - The name of the service
   * @returns The singleton BootstrapConfig instance
   */
  static getInstance(serviceName: string): BootstrapConfig {
    if (!BootstrapConfig.instance) {
      BootstrapConfig.instance = new BootstrapConfig(serviceName);
    }
    return BootstrapConfig.instance;
  }

  /**
   * Loads configuration from multiple sources in priority order.
   * This method loads environment variables from various sources:
   * 1. Global .env file
   * 2. Environment-specific .env file
   * 3. Service-specific .env file
   * 4. Applies service-specific filtering
   */
  private loadConfiguration(): void {
    // Load global .env file
    this.loadEnvFile('.env');

    // Load environment-specific .env file
    if (process.env.NODE_ENV) {
      this.loadEnvFile(`.env.${process.env.NODE_ENV}`);
    }

    // Load service-specific .env file
    this.loadEnvFile(`.env.${this.serviceName}`);

    // Apply service-specific filtering
    this.applyServiceFilter();
  }

  /**
   * Loads environment variables from a specific file.
   *
   * @param filename - The environment file name
   */
  private loadEnvFile(filename: string): void {
    try {
      const envPath = path.resolve(process.cwd(), filename);
      if (fs.existsSync(envPath)) {
        const result = dotenv.config({ path: envPath });
        if (result.parsed) {
          Object.assign(this.config, result.parsed);
        }
      }
    } catch (error) {
      // Silently skip files that cannot be loaded
      console.warn(`Failed to load environment file '${filename}':`, error);
    }
  }

  /**
   * Applies service-specific filtering to environment variables.
   * Filters variables to include only global and service-specific ones.
   */
  private applyServiceFilter(): void {
    const servicePrefix = this.serviceName.toUpperCase().replace(/-/g, '_');
    const globalVars: readonly string[] = [
      'NODE_ENV',
      'APP_ENV', 
      'LOG_LEVEL',
      'RABBITMQ_URL'
    ] as const;

    // Create new object with only allowed variables
    const filtered: Record<string, string> = {};

    for (const [key, value] of Object.entries(this.config)) {
      if (globalVars.includes(key)) {
        filtered[key] = value as string;
      } else if (key.startsWith(`${servicePrefix}_`)) {
        // Remove prefix for cleaner usage
        const cleanKey = key.replace(`${servicePrefix}_`, '');
        filtered[cleanKey] = value as string;
      }
    }

    // Update process.env with filtered values
    Object.assign(process.env, filtered);
    Object.assign(this.config, filtered);
  }

  /**
   * Gets a configuration value with optional default.
   *
   * @param key - The configuration key
   * @param defaultValue - Optional default value
   * @returns The configuration value or default
   */
  get<T = string>(key: string): T | undefined;
  get<T = string>(key: string, defaultValue: T): T;
  get<T = string>(key: string, defaultValue?: T): T | undefined {
    return (this.config[key] as T) ?? defaultValue;
  }

  /**
   * Gets RabbitMQ configuration with sensible defaults.
   *
   * @returns RabbitMQ connection configuration
   */
  getRabbitMQConfig(): {
    urls: string[];
    queue: string;
    prefetchCount: number;
  } {
    return {
      urls: [this.get('RABBITMQ_URL', 'amqp://localhost:5672')],
      queue: this.get('QUEUE', `${this.serviceName}_queue`),
      prefetchCount: Number.parseInt(this.get('PREFETCH_COUNT', '10'), 10),
    };
  }

  /**
   * Gets database configuration for the service.
   *
   * @returns Database connection configuration
   */
  getDatabaseConfig(): Readonly<{
    host: string | undefined;
    port: number;
    database: string | undefined;
    username: string | undefined;
    password: string | undefined;
  }> {
    return {
      host: this.get('DB_HOST'),
      port: Number.parseInt(this.get('DB_PORT', '5432'), 10),
      database: this.get('DB_NAME'),
      username: this.get('DB_USER'),
      password: this.get('DB_PASSWORD'),
    } as const;
  }
}
