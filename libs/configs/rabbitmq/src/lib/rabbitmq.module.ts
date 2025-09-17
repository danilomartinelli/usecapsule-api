import { RabbitMQModule as GolevelupRabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import type { DynamicModule } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { TimeoutConfig } from '@usecapsule/parameters';

import { CircuitBreakerModule } from './circuit-breaker/circuit-breaker.module';
import { CircuitBreakerAwareAmqpService } from './circuit-breaker-aware-amqp.service';
import { TimeoutAwareAmqpService } from './timeout-aware-amqp.service';

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
   * Enables publishing and RPC requests to microservices with circuit breaker protection.
   */
  static forGateway(options: {
    uri: string;
    connectionInitOptions?: { wait: boolean };
    timeoutConfig?: Partial<TimeoutConfig>;
    enableCircuitBreaker?: boolean;
  }): DynamicModule {
    const enableCircuitBreaker = options.enableCircuitBreaker !== false; // Default to true

    return {
      module: RabbitMQModule,
      imports: [
        ConfigModule,
        CircuitBreakerModule,
        GolevelupRabbitMQModule.forRoot({
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
          connectionInitOptions: options.connectionInitOptions ?? {
            wait: false,
          },
          enableControllerDiscovery: true,
        }),
      ],
      providers: [
        TimeoutAwareAmqpService,
        ...(enableCircuitBreaker ? [CircuitBreakerAwareAmqpService] : []),
      ],
      exports: [
        TimeoutAwareAmqpService,
        ...(enableCircuitBreaker ? [CircuitBreakerAwareAmqpService] : []),
      ],
    };
  }

  /**
   * Configures RabbitMQ module for microservices.
   * Enables message handlers with @RabbitRPC and @RabbitSubscribe decorators with circuit breaker protection.
   */
  static forMicroservice(options: {
    uri: string;
    serviceName: string;
    connectionInitOptions?: { wait: boolean };
    timeoutConfig?: Partial<TimeoutConfig>;
    enableCircuitBreaker?: boolean;
  }): DynamicModule {
    const enableCircuitBreaker = options.enableCircuitBreaker !== false; // Default to true

    return {
      module: RabbitMQModule,
      imports: [
        ConfigModule,
        CircuitBreakerModule,
        GolevelupRabbitMQModule.forRoot({
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
          connectionInitOptions: options.connectionInitOptions ?? {
            wait: false,
          },
          enableControllerDiscovery: true,
        }),
      ],
      providers: [
        TimeoutAwareAmqpService,
        ...(enableCircuitBreaker ? [CircuitBreakerAwareAmqpService] : []),
      ],
      exports: [
        TimeoutAwareAmqpService,
        ...(enableCircuitBreaker ? [CircuitBreakerAwareAmqpService] : []),
      ],
    };
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
