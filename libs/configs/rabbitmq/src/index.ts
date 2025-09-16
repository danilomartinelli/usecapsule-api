// Core module
export * from './lib/rabbitmq.module';
export * from './lib/timeout-aware-amqp.service';
export * from './lib/circuit-breaker-aware-amqp.service';

// Circuit breaker components
export * from './lib/circuit-breaker/circuit-breaker.module';
export * from './lib/circuit-breaker/circuit-breaker.service';
export * from './lib/circuit-breaker/circuit-breaker.config';
export * from './lib/circuit-breaker/circuit-breaker-health.service';
export * from './lib/circuit-breaker/circuit-breaker-metrics.service';
export * from './lib/circuit-breaker/circuit-breaker.types';

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
