import { DynamicModule, Module, Provider } from '@nestjs/common';

import { createDatabasePool } from './database-pool.factory';
import { DATABASE_OPTIONS, DATABASE_POOL } from './database.constants';
import { DatabaseService } from './database.service';
import {
  DatabaseModuleAsyncOptions,
  DatabaseModuleOptions,
} from './interfaces';

/**
 * Module export configuration interface
 */
interface ModuleExports {
  readonly service: typeof DatabaseService;
  readonly pool: typeof DATABASE_POOL;
}

/**
 * Database module providing database connection and service functionality.
 * 
 * This module supports both synchronous and asynchronous configuration:
 * - `forRoot()` - Direct configuration with immediate options
 * - `forRootAsync()` - Factory-based configuration for dynamic options
 * 
 * The module provides:
 * - DatabaseService for typed database operations
 * - Direct access to the database pool via DATABASE_POOL token
 * - Proper lifecycle management and cleanup
 * 
 * @example
 * ```typescript
 * // Synchronous configuration
 * DatabaseModule.forRoot({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'myapp',
 *   username: 'user',
 *   password: 'password'
 * })
 * 
 * // Asynchronous configuration
 * DatabaseModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (configService: ConfigService) => ({
 *     host: configService.get('DB_HOST'),
 *     port: configService.get('DB_PORT'),
 *     database: configService.get('DB_NAME'),
 *     username: configService.get('DB_USER'),
 *     password: configService.get('DB_PASSWORD'),
 *   }),
 *   inject: [ConfigService],
 * })
 * ```
 */
@Module({})
export class DatabaseModule {
  /**
   * Module exports that are available to importing modules
   */
  private static readonly EXPORTS: ModuleExports = {
    service: DatabaseService,
    pool: DATABASE_POOL,
  } as const;

  /**
   * Configures the database module with static options.
   * 
   * Use this method when database configuration is known at compile time
   * and doesn't depend on other services or environment variables.
   * 
   * @param options - Database configuration options
   * @returns Configured dynamic module
   */
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    const providers = this.createProviders({
      optionsProvider: this.createOptionsProvider(options),
      poolProvider: this.createPoolProvider(),
    });

    return this.createDynamicModule({
      providers,
      imports: [],
    });
  }

  /**
   * Configures the database module with factory-based async options.
   * 
   * Use this method when database configuration depends on other services,
   * environment variables, or needs to be computed at runtime.
   * 
   * @param options - Async configuration options with factory function
   * @returns Configured dynamic module
   */
  static forRootAsync(options: DatabaseModuleAsyncOptions): DynamicModule {
    const providers = this.createProviders({
      optionsProvider: this.createAsyncOptionsProvider(options),
      poolProvider: this.createAsyncPoolProvider(),
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
      module: DatabaseModule,
      imports: config.imports,
      providers: config.providers,
      exports: [this.EXPORTS.service, this.EXPORTS.pool],
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
    poolProvider: Provider;
  }): Provider[] {
    return [
      config.optionsProvider,
      config.poolProvider,
      DatabaseService,
    ];
  }

  /**
   * Creates the database options provider for synchronous configuration.
   * 
   * @param options - Database options
   * @returns Options provider configuration
   */
  private static createOptionsProvider(options: DatabaseModuleOptions): Provider {
    return {
      provide: DATABASE_OPTIONS,
      useValue: options,
    };
  }

  /**
   * Creates the database options provider for asynchronous configuration.
   * 
   * @param options - Async options configuration
   * @returns Async options provider configuration
   */
  private static createAsyncOptionsProvider(
    options: DatabaseModuleAsyncOptions,
  ): Provider {
    return {
      provide: DATABASE_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };
  }

  /**
   * Creates the database pool provider for synchronous configuration.
   * 
   * @returns Synchronous pool provider configuration
   */
  private static createPoolProvider(): Provider {
    return {
      provide: DATABASE_POOL,
      useFactory: (options: DatabaseModuleOptions) => createDatabasePool(options),
      inject: [DATABASE_OPTIONS],
    };
  }

  /**
   * Creates the database pool provider for asynchronous configuration.
   * 
   * @returns Asynchronous pool provider configuration
   */
  private static createAsyncPoolProvider(): Provider {
    return {
      provide: DATABASE_POOL,
      useFactory: async (options: DatabaseModuleOptions) => createDatabasePool(options),
      inject: [DATABASE_OPTIONS],
    };
  }
}
