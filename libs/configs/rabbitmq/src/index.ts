// Core module
export * from './lib/rabbitmq.module';

// Re-export @golevelup/nestjs-rabbitmq components for convenience
// These are the main decorators and utilities needed by services
export {
  AmqpConnection,
  RabbitRPC,
  RabbitSubscribe,
  RabbitPayload,
  RabbitRequest,
  Nack,
} from '@golevelup/nestjs-rabbitmq';
