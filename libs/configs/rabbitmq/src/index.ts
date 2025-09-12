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
