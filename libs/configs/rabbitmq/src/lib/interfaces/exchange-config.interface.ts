import type { ExchangeType } from './rabbitmq-options.interface';

/**
 * Exchange binding configuration.
 */
export interface ExchangeBinding {
  /** Source exchange name */
  source: string;
  /** Destination exchange name */
  destination: string;
  /** Routing key for the binding */
  routingKey?: string;
  /** Additional binding arguments */
  arguments?: Record<string, unknown>;
}

/**
 * Queue binding configuration.
 */
export interface QueueBinding {
  /** Queue name to bind */
  queue: string;
  /** Exchange to bind to */
  exchange: string;
  /** Routing key for the binding */
  routingKey?: string;
  /** Additional binding arguments */
  arguments?: Record<string, unknown>;
}

/**
 * Dead letter queue configuration.
 */
export interface DeadLetterConfig {
  /** Dead letter exchange name */
  exchange: string;
  /** Dead letter routing key */
  routingKey?: string;
  /** Message TTL before moving to dead letter queue */
  messageTtl?: number;
  /** Queue TTL for the dead letter queue */
  queueTtl?: number;
}

/**
 * Advanced exchange configuration with topology setup.
 */
export interface AdvancedExchangeConfig {
  /** Basic exchange configuration */
  name: string;
  type: ExchangeType;
  durable?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, unknown>;
  
  /** Exchange bindings to other exchanges */
  bindings?: ExchangeBinding[];
  
  /** Queues to bind to this exchange */
  queueBindings?: QueueBinding[];
  
  /** Dead letter configuration */
  deadLetter?: DeadLetterConfig;
  
  /** Whether to create the exchange if it doesn't exist */
  assertExchange?: boolean;
}

/**
 * Advanced queue configuration with topology setup.
 */
export interface AdvancedQueueConfig {
  /** Basic queue configuration */
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, unknown>;
  
  /** Bindings to exchanges */
  bindings?: Array<{
    exchange: string;
    routingKey?: string;
    arguments?: Record<string, unknown>;
  }>;
  
  /** Dead letter configuration */
  deadLetter?: DeadLetterConfig;
  
  /** Maximum number of messages in the queue */
  maxLength?: number;
  
  /** Maximum size of the queue in bytes */
  maxLengthBytes?: number;
  
  /** Message TTL in milliseconds */
  messageTtl?: number;
  
  /** Queue TTL in milliseconds */
  queueTtl?: number;
  
  /** Maximum priority for messages */
  maxPriority?: number;
  
  /** Whether to create the queue if it doesn't exist */
  assertQueue?: boolean;
}

/**
 * Topology configuration for setting up exchanges, queues, and bindings.
 */
export interface TopologyConfig {
  /** Exchanges to create and configure */
  exchanges?: AdvancedExchangeConfig[];
  
  /** Queues to create and configure */
  queues?: AdvancedQueueConfig[];
  
  /** Additional bindings to create */
  bindings?: Array<QueueBinding | ExchangeBinding>;
  
  /** Whether to setup topology on module initialization */
  autoSetup?: boolean;
  
  /** Whether to delete topology on module destruction */
  autoCleanup?: boolean;
}