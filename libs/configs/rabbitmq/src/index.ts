// Core module
export * from './lib/rabbitmq.module';

// Re-export @golevelup/nestjs-rabbitmq components for convenience
export {
  AmqpConnection,
  RabbitRPC,
  RabbitSubscribe,
  RabbitPayload,
  RabbitRequest,
  Nack,
} from '@golevelup/nestjs-rabbitmq';

// Legacy exports for backward compatibility (deprecated - use @golevelup decorators instead)
// Constants
export * from './lib/rabbitmq.constants';

// Interfaces
export * from './lib/interfaces';

// Services (deprecated - use AmqpConnection instead)
export * from './lib/services';

// Types and utilities
export * from './lib/types';

// Legacy decorators (deprecated - use @RabbitRPC/@RabbitSubscribe instead)
export {
  RabbitMQMessagePattern,
  MessagePattern,
  PriorityMessagePattern,
  TemporaryMessagePattern,
  MESSAGE_PATTERN_METADATA,
} from './lib/decorators/message-pattern.decorator';

export {
  RabbitMQEventPattern,
  EventPattern,
  TopicEventPattern,
  FanoutEventPattern,
  PriorityEventPattern,
  TemporaryEventPattern,
  EVENT_PATTERN_METADATA,
} from './lib/decorators/event-pattern.decorator';

export {
  RetryPolicy,
  Retry,
  ExponentialBackoffRetry,
  ConditionalRetry,
  NoRetry,
  DatabaseRetry,
  NetworkRetry,
  RETRY_POLICY_METADATA,
} from './lib/decorators/retry-policy.decorator';
