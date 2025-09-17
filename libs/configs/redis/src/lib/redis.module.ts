import { Module } from '@nestjs/common';
import type { DynamicModule, Provider } from '@nestjs/common';

import type { RedisModuleOptions, RedisModuleAsyncOptions } from './interfaces';
import { createRedisClient } from './redis-client.factory';
import { REDIS_CLIENT, REDIS_OPTIONS } from './redis.constants';
import { RedisService } from './redis.service';

/**
 * Module export configuration interface
 */
interface ModuleExports {
  readonly service: typeof RedisService;
  readonly client: typeof REDIS_CLIENT;
}

/**
 * Redis module providing Redis connection and service functionality.
 *
 * This module supports both synchronous and asynchronous configuration:
 * - `forRoot()` - Direct configuration with immediate options
 * - `forRootAsync()` - Factory-based configuration for dynamic options
 *
 * The module provides:
 * - RedisService for high-level Redis operations
 * - Direct access to the Redis client via REDIS_CLIENT token
 * - Proper lifecycle management and cleanup
 *
 * @example
 * ```typescript
 * // Synchronous configuration
 * RedisModule.forRoot({
 *   host: 'localhost',
 *   port: 6379,
 *   database: 0
 * })
 *
 * // Asynchronous configuration
 * RedisModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (configService: ConfigService) => ({
 *     host: configService.get('REDIS_HOST'),
 *     port: configService.get('REDIS_PORT'),
 *     database: configService.get('REDIS_DATABASE'),
 *     password: configService.get('REDIS_PASSWORD'),
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 */
@Module({})
export class RedisModule {
  /**
   * Module exports that are available to importing modules
   */
  private static readonly EXPORTS: ModuleExports = {
    service: RedisService,
    client: REDIS_CLIENT,
  } as const;

  /**
   * Configures the Redis module with static options.
   *
   * Use this method when Redis configuration is known at compile time
   * and doesn't depend on other services or environment variables.
   *
   * @param options - Redis configuration options
   * @returns Configured dynamic module
   */
  static forRoot(options: RedisModuleOptions): DynamicModule {
    const providers = this.createProviders({
      optionsProvider: this.createOptionsProvider(options),
      clientProvider: this.createClientProvider(),
    });

    return this.createDynamicModule({
      providers,
      imports: [],
    });
  }

  /**
   * Configures the Redis module with factory-based async options.
   *
   * Use this method when Redis configuration depends on other services,
   * environment variables, or needs to be computed at runtime.
   *
   * @param options - Async configuration options with factory function
   * @returns Configured dynamic module
   */
  static forRootAsync(options: RedisModuleAsyncOptions): DynamicModule {
    const providers = this.createProviders({
      optionsProvider: this.createAsyncOptionsProvider(options),
      clientProvider: this.createAsyncClientProvider(),
    });

    return this.createDynamicModule({
      providers,
      imports: options.imports || [],
    });
  }

  /**
   * Creates the base dynamic module configuration.
   *
   * @param config - Module configuration
   * @returns Dynamic module configuration object
   */
  private static createDynamicModule(config: {
    providers: Provider[];
    imports: DynamicModule['imports'];
  }): DynamicModule {
    return {
      module: RedisModule,
      imports: config.imports,
      providers: config.providers,
      exports: [this.EXPORTS.service, this.EXPORTS.client],
      global: false, // Not global by default, services can make it global if needed
    };
  }

  /**
   * Creates the complete provider array for the module.
   *
   * @param config - Provider configuration
   * @returns Array of providers
   */
  private static createProviders(config: {
    optionsProvider: Provider;
    clientProvider: Provider;
  }): Provider[] {
    return [config.optionsProvider, config.clientProvider, RedisService];
  }

  /**
   * Creates the Redis options provider for synchronous configuration.
   *
   * @param options - Redis options
   * @returns Options provider configuration
   */
  private static createOptionsProvider(options: RedisModuleOptions): Provider {
    return {
      provide: REDIS_OPTIONS,
      useValue: options,
    };
  }

  /**
   * Creates the Redis options provider for asynchronous configuration.
   *
   * @param options - Async options configuration
   * @returns Async options provider configuration
   */
  private static createAsyncOptionsProvider(
    options: RedisModuleAsyncOptions,
  ): Provider {
    return {
      provide: REDIS_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };
  }

  /**
   * Creates the Redis client provider for synchronous configuration.
   *
   * @returns Synchronous client provider configuration
   */
  private static createClientProvider(): Provider {
    return {
      provide: REDIS_CLIENT,
      useFactory: (options: RedisModuleOptions) => createRedisClient(options),
      inject: [REDIS_OPTIONS],
    };
  }

  /**
   * Creates the Redis client provider for asynchronous configuration.
   *
   * @returns Asynchronous client provider configuration
   */
  private static createAsyncClientProvider(): Provider {
    return {
      provide: REDIS_CLIENT,
      useFactory: async (options: RedisModuleOptions) =>
        createRedisClient(options),
      inject: [REDIS_OPTIONS],
    };
  }
}
