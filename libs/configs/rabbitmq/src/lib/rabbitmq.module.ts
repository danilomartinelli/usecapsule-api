import { DynamicModule, Module } from '@nestjs/common';
import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';

/**
 * RabbitMQ module using @golevelup/nestjs-rabbitmq for proper exchange-based routing.
 *
 * This module replaces the previous custom implementation and provides:
 * - Unified exchange-based messaging for all services
 * - RPC support with Direct Reply-To queues
 * - Declarative configuration (replaces definitions.json)
 * - Type-safe message handlers with @RabbitRPC and @RabbitSubscribe
 * - Built-in retry policies and error handling
 * - Health check support through AmqpConnection
 *
 * @example
 * ```typescript
 * // For API Gateway (HTTP client)
 * RabbitMQModule.forGateway({
 *   uri: 'amqp://usecapsule:password@localhost:7010',
 * })
 *
 * // For microservices
 * RabbitMQModule.forMicroservice({
 *   uri: 'amqp://usecapsule:password@localhost:7010',
 *   serviceName: 'auth-service',
 * })
 * ```
 */
@Module({})
export class RabbitMQModule {
  /**
   * Configures RabbitMQ module for API Gateway (HTTP client).
   * Enables publishing and RPC requests to microservices.
   */
  static forGateway(options: {
    uri: string;
    connectionInitOptions?: { wait: boolean };
  }): DynamicModule {
    return GolevelupRabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'capsule.commands',
          type: 'direct',
          options: { durable: true },
        },
        {
          name: 'capsule.events',
          type: 'topic',
          options: { durable: true },
        },
      ],
      uri: options.uri,
      connectionInitOptions: options.connectionInitOptions ?? { wait: false },
      enableControllerDiscovery: true,
    });
  }

  /**
   * Configures RabbitMQ module for microservices.
   * Enables message handlers with @RabbitRPC and @RabbitSubscribe decorators.
   */
  static forMicroservice(options: {
    uri: string;
    serviceName: string;
    connectionInitOptions?: { wait: boolean };
  }): DynamicModule {
    return GolevelupRabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'capsule.commands',
          type: 'direct',
          options: { durable: true },
        },
        {
          name: 'capsule.events',
          type: 'topic',
          options: { durable: true },
        },
      ],
      uri: options.uri,
      connectionInitOptions: options.connectionInitOptions ?? { wait: false },
      enableControllerDiscovery: true,
    });
  }

  /**
   * Configures RabbitMQ module with custom configuration.
   * Use this for advanced scenarios requiring specific setup.
   */
  static forCustom(
    config: Parameters<typeof GolevelupRabbitMQModule.forRoot>[0],
  ): DynamicModule {
    return GolevelupRabbitMQModule.forRoot(config);
  }

  /**
   * Configures RabbitMQ module with async configuration.
   * Use this when configuration depends on other services.
   */
  static forRootAsync(
    options: Parameters<typeof GolevelupRabbitMQModule.forRootAsync>[0],
  ): DynamicModule {
    return GolevelupRabbitMQModule.forRootAsync(options);
  }
}
