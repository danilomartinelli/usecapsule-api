import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';

import { RABBITMQ_CLIENT, RABBITMQ_OPTIONS } from '../rabbitmq.constants';
import type {
  RabbitMQModuleOptions,
  ExchangeConfig,
  QueueConfig,
  AdvancedExchangeConfig,
  AdvancedQueueConfig,
  TopologyConfig,
  QueueBinding,
  ExchangeBinding,
} from '../interfaces';

/**
 * Exchange manager service for managing RabbitMQ topology.
 *
 * This service handles:
 * - Exchange creation and management
 * - Queue creation and management
 * - Binding management between exchanges and queues
 * - Topology setup and teardown
 * - Dead letter queue configuration
 *
 * @example
 * ```typescript
 * // Inject the service
 * constructor(private readonly exchangeManager: ExchangeManagerService) {}
 *
 * // Create an exchange
 * await this.exchangeManager.createExchange({
 *   name: 'user.events',
 *   type: 'topic',
 *   durable: true,
 * });
 *
 * // Create a queue with bindings
 * await this.exchangeManager.createQueue({
 *   name: 'user.notifications',
 *   durable: true,
 *   bindings: [
 *     { exchange: 'user.events', routingKey: 'user.created' },
 *   ],
 * });
 * ```
 */
@Injectable()
export class ExchangeManagerService implements OnModuleInit {
  private readonly logger = new Logger(ExchangeManagerService.name);
  private topologySetup = false;

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
    @Inject(RABBITMQ_OPTIONS) private readonly options: RabbitMQModuleOptions,
  ) {
    this.logger.log('Exchange Manager Service initialized');
  }

  /**
   * Module initialization lifecycle hook.
   */
  async onModuleInit(): Promise<void> {
    try {
      // Setup topology if auto-setup is enabled
      if (this.options.exchanges || this.options.queues) {
        await this.setupBasicTopology();
      }
    } catch (error) {
      this.logger.error(
        'Failed to setup topology during module initialization:',
        error instanceof Error ? error.message : error,
      );
      // Don't throw here to allow the module to continue loading
    }
  }

  /**
   * Creates an exchange with the specified configuration.
   *
   * @param config - Exchange configuration
   * @returns Promise resolving when exchange is created
   */
  async createExchange(config: ExchangeConfig): Promise<void> {
    try {
      this.logger.debug(`Creating exchange: ${config.name} (${config.type})`);

      // Note: In a real implementation, you would use a direct RabbitMQ connection
      // For this example, we'll emit a management command through the client
      await this.emitManagementCommand('exchange.create', config);

      this.logger.log(`Exchange created successfully: ${config.name}`);
    } catch (error) {
      this.logger.error(
        `Failed to create exchange ${config.name}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Creates a queue with the specified configuration.
   *
   * @param config - Queue configuration
   * @returns Promise resolving when queue is created
   */
  async createQueue(config: QueueConfig): Promise<void> {
    try {
      this.logger.debug(`Creating queue: ${config.name}`);

      // Note: In a real implementation, you would use a direct RabbitMQ connection
      await this.emitManagementCommand('queue.create', config);

      this.logger.log(`Queue created successfully: ${config.name}`);
    } catch (error) {
      this.logger.error(
        `Failed to create queue ${config.name}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Creates an advanced exchange with topology setup.
   *
   * @param config - Advanced exchange configuration
   * @returns Promise resolving when exchange and topology are created
   */
  async createAdvancedExchange(config: AdvancedExchangeConfig): Promise<void> {
    try {
      this.logger.debug(`Creating advanced exchange: ${config.name}`);

      // Create the exchange if needed
      if (config.assertExchange !== false) {
        await this.createExchange({
          name: config.name,
          type: config.type,
          durable: config.durable,
          autoDelete: config.autoDelete,
          arguments: config.arguments,
        });
      }

      // Create bindings to other exchanges
      if (config.bindings) {
        for (const binding of config.bindings) {
          await this.bindExchange(binding);
        }
      }

      // Create queue bindings
      if (config.queueBindings) {
        for (const binding of config.queueBindings) {
          await this.bindQueue(binding);
        }
      }

      this.logger.log(`Advanced exchange setup completed: ${config.name}`);
    } catch (error) {
      this.logger.error(
        `Failed to create advanced exchange ${config.name}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Creates an advanced queue with topology setup.
   *
   * @param config - Advanced queue configuration
   * @returns Promise resolving when queue and topology are created
   */
  async createAdvancedQueue(config: AdvancedQueueConfig): Promise<void> {
    try {
      this.logger.debug(`Creating advanced queue: ${config.name}`);

      // Build queue arguments
      const queueArgs: Record<string, unknown> = { ...config.arguments };

      if (config.deadLetter) {
        queueArgs['x-dead-letter-exchange'] = config.deadLetter.exchange;
        if (config.deadLetter.routingKey) {
          queueArgs['x-dead-letter-routing-key'] = config.deadLetter.routingKey;
        }
        if (config.deadLetter.messageTtl) {
          queueArgs['x-message-ttl'] = config.deadLetter.messageTtl;
        }
      }

      if (config.maxLength) {
        queueArgs['x-max-length'] = config.maxLength;
      }

      if (config.maxLengthBytes) {
        queueArgs['x-max-length-bytes'] = config.maxLengthBytes;
      }

      if (config.messageTtl) {
        queueArgs['x-message-ttl'] = config.messageTtl;
      }

      if (config.queueTtl) {
        queueArgs['x-expires'] = config.queueTtl;
      }

      if (config.maxPriority) {
        queueArgs['x-max-priority'] = config.maxPriority;
      }

      // Create the queue if needed
      if (config.assertQueue !== false) {
        await this.createQueue({
          name: config.name,
          durable: config.durable,
          exclusive: config.exclusive,
          autoDelete: config.autoDelete,
          arguments: queueArgs,
        });
      }

      // Create bindings
      if (config.bindings) {
        for (const binding of config.bindings) {
          await this.bindQueue({
            queue: config.name,
            exchange: binding.exchange,
            routingKey: binding.routingKey,
            arguments: binding.arguments,
          });
        }
      }

      this.logger.log(`Advanced queue setup completed: ${config.name}`);
    } catch (error) {
      this.logger.error(
        `Failed to create advanced queue ${config.name}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Binds a queue to an exchange.
   *
   * @param binding - Queue binding configuration
   * @returns Promise resolving when binding is created
   */
  async bindQueue(binding: QueueBinding): Promise<void> {
    try {
      this.logger.debug(
        `Binding queue ${binding.queue} to exchange ${binding.exchange} with key: ${binding.routingKey || '(default)'}`,
      );

      await this.emitManagementCommand('queue.bind', binding);

      this.logger.log(
        `Queue binding created: ${binding.queue} -> ${binding.exchange}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to bind queue ${binding.queue} to exchange ${binding.exchange}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Binds an exchange to another exchange.
   *
   * @param binding - Exchange binding configuration
   * @returns Promise resolving when binding is created
   */
  async bindExchange(binding: ExchangeBinding): Promise<void> {
    try {
      this.logger.debug(
        `Binding exchange ${binding.destination} to exchange ${binding.source} with key: ${binding.routingKey || '(default)'}`,
      );

      await this.emitManagementCommand('exchange.bind', binding);

      this.logger.log(
        `Exchange binding created: ${binding.destination} -> ${binding.source}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to bind exchange ${binding.destination} to exchange ${binding.source}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Sets up complete topology from configuration.
   *
   * @param topology - Topology configuration
   * @returns Promise resolving when topology is setup
   */
  async setupTopology(topology: TopologyConfig): Promise<void> {
    try {
      this.logger.log('Setting up RabbitMQ topology...');

      // Create exchanges
      if (topology.exchanges) {
        for (const exchangeConfig of topology.exchanges) {
          await this.createAdvancedExchange(exchangeConfig);
        }
      }

      // Create queues
      if (topology.queues) {
        for (const queueConfig of topology.queues) {
          await this.createAdvancedQueue(queueConfig);
        }
      }

      // Create additional bindings
      if (topology.bindings) {
        for (const binding of topology.bindings) {
          if ('queue' in binding) {
            await this.bindQueue(binding as QueueBinding);
          } else {
            await this.bindExchange(binding as ExchangeBinding);
          }
        }
      }

      this.topologySetup = true;
      this.logger.log('RabbitMQ topology setup completed successfully');
    } catch (error) {
      this.logger.error(
        'Failed to setup RabbitMQ topology:',
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Sets up basic topology from module options.
   */
  private async setupBasicTopology(): Promise<void> {
    try {
      this.logger.debug('Setting up basic topology from module options...');

      // Create exchanges from options
      if (this.options.exchanges) {
        for (const exchange of this.options.exchanges) {
          await this.createExchange(exchange);
        }
      }

      // Create queues from options
      if (this.options.queues) {
        for (const queue of this.options.queues) {
          await this.createQueue(queue);
        }
      }

      this.logger.debug('Basic topology setup completed');
    } catch (error) {
      this.logger.error(
        'Failed to setup basic topology:',
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Emits a management command through the RabbitMQ client.
   *
   * @param command - Management command
   * @param data - Command data
   * @returns Promise resolving when command is processed
   */
  private async emitManagementCommand(
    command: string,
    data: unknown,
  ): Promise<void> {
    try {
      // In a real implementation, this would use RabbitMQ management API
      // or direct AMQP channel operations
      this.client.emit(`rabbitmq.management.${command}`, data);
    } catch (error) {
      this.logger.error(
        `Failed to emit management command ${command}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Gets topology setup status.
   *
   * @returns Whether topology has been setup
   */
  isTopologySetup(): boolean {
    return this.topologySetup;
  }

  /**
   * Gets manager information.
   *
   * @returns Manager information
   */
  getManagerInfo(): {
    topologySetup: boolean;
    configuredExchanges: number;
    configuredQueues: number;
  } {
    return {
      topologySetup: this.topologySetup,
      configuredExchanges: this.options.exchanges?.length || 0,
      configuredQueues: this.options.queues?.length || 0,
    };
  }
}
