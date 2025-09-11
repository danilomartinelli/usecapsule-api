import { Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';

/**
 * Utility type for ensuring strict exchange types
 */
export type ExchangeType = 'direct' | 'topic' | 'fanout' | 'headers';

/**
 * Utility type for environment configuration
 */
export type Environment = 'test' | 'development' | 'production';

/**
 * Exchange configuration options for RabbitMQ.
 */
export interface ExchangeConfig {
  /** Name of the exchange */
  name: string;
  /** Type of exchange (direct, topic, fanout, headers) */
  type: ExchangeType;
  /** Whether the exchange should survive server restarts */
  durable?: boolean;
  /** Whether to delete the exchange when no longer in use */
  autoDelete?: boolean;
  /** Additional arguments for exchange declaration */
  arguments?: Record<string, unknown>;
}

/**
 * Queue configuration options for RabbitMQ.
 */
export interface QueueConfig {
  /** Name of the queue */
  name: string;
  /** Whether the queue should survive server restarts */
  durable?: boolean;
  /** Whether the queue is exclusive to one connection */
  exclusive?: boolean;
  /** Whether to delete the queue when no longer in use */
  autoDelete?: boolean;
  /** Additional arguments for queue declaration */
  arguments?: Record<string, unknown>;
}

/**
 * Retry policy configuration for message processing.
 */
export interface RetryPolicy {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay between retries in milliseconds */
  retryDelay?: number;
  /** Whether to use exponential backoff for retry delays */
  exponentialBackoff?: boolean;
  /** Maximum delay between retries in milliseconds */
  maxRetryDelay?: number;
  /** Custom retry condition function */
  retryCondition?: (error: Error) => boolean;
}

/**
 * Connection configuration options for RabbitMQ.
 */
export interface ConnectionConfig {
  /** RabbitMQ connection URLs */
  urls: string[];
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Heartbeat interval in seconds */
  heartbeatInterval?: number;
  /** Whether to reconnect automatically */
  reconnect?: boolean;
  /** Maximum number of reconnection attempts */
  reconnectAttempts?: number;
  /** Delay between reconnection attempts in milliseconds */
  reconnectDelay?: number;
}

/**
 * RabbitMQ module configuration options.
 */
export interface RabbitMQModuleOptions {
  /** Connection configuration */
  connection: ConnectionConfig;
  /** Default queue for the service (used in microservice mode) */
  defaultQueue?: string;
  /** Default exchange configurations */
  exchanges?: ExchangeConfig[];
  /** Default queue configurations */
  queues?: QueueConfig[];
  /** Global retry policy */
  globalRetryPolicy?: RetryPolicy;
  /** Queue options for microservice transport */
  queueOptions?: {
    durable?: boolean;
    exclusive?: boolean;
    autoDelete?: boolean;
    arguments?: Record<string, unknown>;
  };
  /** Additional transport options */
  transportOptions?: {
    prefetchCount?: number;
    isGlobalPrefetch?: boolean;
    noAck?: boolean;
  };
  /** Environment for logging and debugging */
  environment?: Environment;
}

/**
 * Async configuration options for RabbitMQ module.
 */
export interface RabbitMQModuleAsyncOptions {
  /** Factory function to create module options */
  useFactory: (
    ...args: unknown[]
  ) => Promise<RabbitMQModuleOptions> | RabbitMQModuleOptions;
  /** Dependencies to inject into the factory function */
  inject?: Array<Type<unknown> | string | symbol>;
  /** Modules to import */
  imports?: ModuleMetadata['imports'];
}

/**
 * Microservice-specific configuration options.
 */
export interface RabbitMQMicroserviceOptions {
  /** Queue name for the microservice */
  queue: string;
  /** Connection configuration */
  connection: ConnectionConfig;
  /** Queue options */
  queueOptions?: RabbitMQModuleOptions['queueOptions'];
  /** Transport options */
  transportOptions?: RabbitMQModuleOptions['transportOptions'];
  /** Global retry policy */
  globalRetryPolicy?: RetryPolicy;
  /** Environment for logging and debugging */
  environment?: Environment;
}