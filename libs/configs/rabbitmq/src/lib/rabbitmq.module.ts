import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';

import {
  RabbitMQMicroserviceOptions,
  RabbitMQModuleAsyncOptions,
  RabbitMQModuleOptions,
} from './interfaces';
import {
  DEFAULT_QUEUE_CONFIG,
  RABBITMQ_CLIENT,
  RABBITMQ_EXCHANGE_MANAGER,
  RABBITMQ_OPTIONS,
  RABBITMQ_PUBLISHER,
} from './rabbitmq.constants';
import {
  ExchangeManagerService,
  ExchangePublisherService,
  MessagePublisherService,
  RabbitMQService,
} from './services';

/**
 * Module export configuration interface
 */
interface ModuleExports {
  readonly service: typeof RabbitMQService;
  readonly publisher: typeof MessagePublisherService;
  readonly exchangeManager: typeof ExchangeManagerService;
  readonly exchangePublisher: typeof ExchangePublisherService;
  readonly client: typeof RABBITMQ_CLIENT;
}

/**
 * RabbitMQ module providing comprehensive messaging functionality.
 *
 * This module supports multiple configuration patterns:
 * - `forRoot()` - Direct configuration with immediate options
 * - `forRootAsync()` - Factory-based configuration for dynamic options
 * - `forMicroservice()` - Simplified configuration for microservice setup
 *
 * The module provides:
 * - RabbitMQService for core messaging operations
 * - MessagePublisherService for advanced publishing
 * - ExchangeManagerService for topology management
 * - Direct access to the RabbitMQ client via RABBITMQ_CLIENT token
 * - Enhanced decorators for message and event patterns
 * - Retry policy support with custom decorators
 *
 * @example
 * ```typescript
 * // Basic configuration
 * RabbitMQModule.forRoot({
 *   connection: {
 *     urls: ['amqp://localhost:5672'],
 *   },
 *   defaultQueue: 'my-service',
 * })
 *
 * // Async configuration with ConfigService
 * RabbitMQModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: (configService: ConfigService) => ({
 *     connection: {
 *       urls: [configService.get('RABBITMQ_URL')],
 *     },
 *     defaultQueue: configService.get('RABBITMQ_QUEUE'),
 *   }),
 *   inject: [ConfigService],
 * })
 *
 * // Microservice configuration
 * RabbitMQModule.forMicroservice({
 *   queue: 'auth-service',
 *   connection: {
 *     urls: ['amqp://localhost:5672'],
 *   },
 * })
 * ```
 */
@Module({})
export class RabbitMQModule {
  /**
   * Module exports that are available to importing modules
   */
  private static readonly EXPORTS: ModuleExports = {
    service: RabbitMQService,
    publisher: MessagePublisherService,
    exchangeManager: ExchangeManagerService,
    exchangePublisher: ExchangePublisherService,
    client: RABBITMQ_CLIENT,
  } as const;

  /**
   * Configures the RabbitMQ module with static options.
   *
   * Use this method when RabbitMQ configuration is known at compile time
   * and doesn't depend on other services or environment variables.
   *
   * @param options - RabbitMQ configuration options
   * @returns Configured dynamic module
   */
  static forRoot(options: RabbitMQModuleOptions): DynamicModule {
    const clientModule = this.createClientModule(options);
    const providers = this.createProviders({
      optionsProvider: this.createOptionsProvider(options),
      clientProvider: this.createClientProvider(),
    });

    return this.createDynamicModule({
      providers,
      imports: [clientModule],
    });
  }

  /**
   * Configures the RabbitMQ module with factory-based async options.
   *
   * Use this method when RabbitMQ configuration depends on other services,
   * environment variables, or needs to be computed at runtime.
   *
   * @param options - Async configuration options with factory function
   * @returns Configured dynamic module
   */
  static forRootAsync(options: RabbitMQModuleAsyncOptions): DynamicModule {
    const clientModule = this.createAsyncClientModule(options);
    const providers = this.createProviders({
      optionsProvider: this.createAsyncOptionsProvider(options),
      clientProvider: this.createAsyncClientProvider(),
    });

    return this.createDynamicModule({
      providers,
      imports: [clientModule, ...(options.imports || [])],
    });
  }

  /**
   * Configures the RabbitMQ module for microservice use.
   *
   * This is a convenience method for setting up RabbitMQ in microservices
   * with simplified configuration focused on queue-based communication.
   *
   * @param options - Microservice configuration options
   * @returns Configured dynamic module
   */
  static forMicroservice(options: RabbitMQMicroserviceOptions): DynamicModule {
    const rabbitMQOptions: RabbitMQModuleOptions = {
      connection: options.connection,
      defaultQueue: options.queue,
      queueOptions: {
        ...DEFAULT_QUEUE_CONFIG,
        ...options.queueOptions,
      },
      transportOptions: options.transportOptions,
      globalRetryPolicy: options.globalRetryPolicy,
      environment: options.environment,
    };

    return this.forRoot(rabbitMQOptions);
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
      module: RabbitMQModule,
      imports: config.imports,
      providers: config.providers,
      exports: [
        this.EXPORTS.service,
        this.EXPORTS.publisher,
        this.EXPORTS.exchangeManager,
        this.EXPORTS.exchangePublisher,
        this.EXPORTS.client,
      ],
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
    return [
      config.optionsProvider,
      config.clientProvider,
      RabbitMQService,
      ExchangePublisherService,
      {
        provide: RABBITMQ_PUBLISHER,
        useClass: MessagePublisherService,
      },
      {
        provide: RABBITMQ_EXCHANGE_MANAGER,
        useClass: ExchangeManagerService,
      },
    ];
  }

  /**
   * Creates the RabbitMQ options provider for synchronous configuration.
   *
   * @param options - RabbitMQ options
   * @returns Options provider configuration
   */
  private static createOptionsProvider(
    options: RabbitMQModuleOptions,
  ): Provider {
    return {
      provide: RABBITMQ_OPTIONS,
      useValue: options,
    };
  }

  /**
   * Creates the RabbitMQ options provider for asynchronous configuration.
   *
   * @param options - Async options configuration
   * @returns Async options provider configuration
   */
  private static createAsyncOptionsProvider(
    options: RabbitMQModuleAsyncOptions,
  ): Provider {
    return {
      provide: RABBITMQ_OPTIONS,
      useFactory: options.useFactory,
      inject: options.inject || [],
    };
  }

  /**
   * Creates the RabbitMQ client provider for synchronous configuration.
   *
   * @returns Synchronous client provider configuration
   */
  private static createClientProvider(): Provider {
    return {
      provide: RABBITMQ_CLIENT,
      useFactory: (clientsModule: { get: (token: string) => unknown }) =>
        clientsModule.get('RABBITMQ_CLIENT'),
      inject: ['RABBITMQ_CLIENT'],
    };
  }

  /**
   * Creates the RabbitMQ client provider for asynchronous configuration.
   *
   * @returns Asynchronous client provider configuration
   */
  private static createAsyncClientProvider(): Provider {
    return {
      provide: RABBITMQ_CLIENT,
      useFactory: (clientsModule: { get: (token: string) => unknown }) =>
        clientsModule.get('RABBITMQ_CLIENT'),
      inject: ['RABBITMQ_CLIENT'],
    };
  }

  /**
   * Creates the ClientsModule for synchronous configuration.
   *
   * @param options - RabbitMQ options
   * @returns Configured ClientsModule
   */
  private static createClientModule(
    options: RabbitMQModuleOptions,
  ): DynamicModule {
    // For API Gateway (no defaultQueue) - configure for exchange-based publishing
    const clientOptions = options.defaultQueue
      ? {
          // Microservice configuration - direct queue binding
          urls: options.connection.urls,
          queue: options.defaultQueue,
          queueOptions: options.queueOptions,
          socketOptions: {
            heartbeatInterval: options.connection.heartbeatInterval,
            connectionTimeout: options.connection.connectionTimeout,
          },
          ...options.transportOptions,
        }
      : {
          // API Gateway configuration - exchange-based routing
          urls: options.connection.urls,
          // No queue specified - allows publishing to exchanges with routing keys
          socketOptions: {
            heartbeatInterval: options.connection.heartbeatInterval,
            connectionTimeout: options.connection.connectionTimeout,
          },
          ...options.transportOptions,
        };

    return ClientsModule.register([
      {
        name: 'RABBITMQ_CLIENT',
        transport: Transport.RMQ,
        options: clientOptions,
      },
    ]);
  }

  /**
   * Creates the ClientsModule for asynchronous configuration.
   *
   * @param options - Async options configuration
   * @returns Configured ClientsModule
   */
  private static createAsyncClientModule<Args extends unknown[] = unknown[]>(
    options: RabbitMQModuleAsyncOptions<Args>,
  ): DynamicModule {
    return ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_CLIENT',
        imports: options.imports,
        useFactory: async (...args: Args) => {
          const config = await options.useFactory(...args);
          
          // For API Gateway (no defaultQueue) - configure for exchange-based publishing
          const clientOptions = config.defaultQueue
            ? {
                // Microservice configuration - direct queue binding
                urls: config.connection.urls,
                queue: config.defaultQueue,
                queueOptions: config.queueOptions,
                socketOptions: {
                  heartbeatInterval: config.connection.heartbeatInterval,
                  connectionTimeout: config.connection.connectionTimeout,
                },
                ...config.transportOptions,
              }
            : {
                // API Gateway configuration - exchange-based routing
                urls: config.connection.urls,
                // No queue specified - allows publishing to exchanges with routing keys
                socketOptions: {
                  heartbeatInterval: config.connection.heartbeatInterval,
                  connectionTimeout: config.connection.connectionTimeout,
                },
                ...config.transportOptions,
              };

          return {
            transport: Transport.RMQ,
            options: clientOptions,
          };
        },
        inject: options.inject || [],
      },
    ]);
  }
}
