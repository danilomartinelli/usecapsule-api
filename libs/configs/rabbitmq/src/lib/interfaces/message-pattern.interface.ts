/**
 * Message pattern configuration for RPC-style communication.
 */
export interface MessagePatternConfig {
  /** The pattern identifier for the message */
  pattern: string;
  /** Optional exchange to bind the pattern to */
  exchange?: string;
  /** Optional routing key for the pattern */
  routingKey?: string;
  /** Whether this is a persistent message */
  persistent?: boolean;
  /** Message priority (0-255) */
  priority?: number;
  /** Message expiration time in milliseconds */
  expiration?: number;
  /** Additional message properties */
  properties?: Record<string, unknown>;
}

/**
 * Event pattern configuration for pub/sub-style communication.
 */
export interface EventPatternConfig {
  /** The event name or pattern */
  event: string;
  /** Exchange to publish/subscribe to */
  exchange?: string;
  /** Routing key pattern for topic exchanges */
  routingKey?: string;
  /** Whether this is a persistent message */
  persistent?: boolean;
  /** Message priority (0-255) */
  priority?: number;
  /** Message expiration time in milliseconds */
  expiration?: number;
  /** Additional message properties */
  properties?: Record<string, unknown>;
}

/**
 * Message metadata interface for decorated handlers.
 */
export interface MessageMetadata {
  /** The pattern or event configuration */
  config: MessagePatternConfig | EventPatternConfig;
  /** The handler method name */
  methodName: string;
  /** The target class constructor */
  target: object;
  /** Whether this is an RPC or Event pattern */
  type: 'rpc' | 'event';
}

/**
 * Message context information passed to handlers.
 */
export interface MessageContext {
  /** The original message pattern or event */
  pattern: string;
  /** Exchange the message was received from */
  exchange?: string;
  /** Routing key of the message */
  routingKey?: string;
  /** Message properties */
  properties?: Record<string, unknown>;
  /** Correlation ID for RPC messages */
  correlationId?: string;
  /** Reply-to queue for RPC messages */
  replyTo?: string;
  /** Message delivery information */
  deliveryInfo?: {
    consumerTag: string;
    deliveryTag: number;
    redelivered: boolean;
  };
}

/**
 * Publisher options for sending messages.
 */
export interface PublishOptions {
  /** Exchange to publish to */
  exchange?: string;
  /** Routing key for the message */
  routingKey?: string;
  /** Whether the message should be persistent */
  persistent?: boolean;
  /** Message priority (0-255) */
  priority?: number;
  /** Message expiration time in milliseconds */
  expiration?: number;
  /** Correlation ID for RPC-style communication */
  correlationId?: string;
  /** Reply-to queue for RPC-style communication */
  replyTo?: string;
  /** Additional message properties */
  properties?: Record<string, unknown>;
  /** Timeout for RPC calls in milliseconds */
  timeout?: number;
}