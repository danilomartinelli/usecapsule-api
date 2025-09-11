/**
 * RabbitMQ module constants for dependency injection tokens.
 *
 * These symbols ensure type-safe dependency injection for RabbitMQ-related
 * services throughout the application.
 */

/**
 * Injection token for the RabbitMQ client instance.
 * Used to inject the configured RabbitMQ client into services.
 */
export const RABBITMQ_CLIENT = Symbol('RABBITMQ_CLIENT') as symbol;

/**
 * Injection token for RabbitMQ module options.
 * Used to inject configuration options into RabbitMQ providers.
 */
export const RABBITMQ_OPTIONS = Symbol('RABBITMQ_OPTIONS') as symbol;

/**
 * Injection token for the RabbitMQ publisher service.
 * Used to inject the message publisher service into other services.
 */
export const RABBITMQ_PUBLISHER = Symbol('RABBITMQ_PUBLISHER') as symbol;

/**
 * Injection token for the exchange manager service.
 * Used to inject the exchange management service into other services.
 */
export const RABBITMQ_EXCHANGE_MANAGER = Symbol('RABBITMQ_EXCHANGE_MANAGER') as symbol;

/**
 * Default retry configuration for message processing.
 */
export const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  maxRetryDelay: 30000,
} as const;

/**
 * Default exchange configuration.
 */
export const DEFAULT_EXCHANGE_CONFIG = {
  type: 'direct',
  durable: true,
  autoDelete: false,
} as const;

/**
 * Default queue configuration.
 */
export const DEFAULT_QUEUE_CONFIG = {
  durable: true,
  exclusive: false,
  autoDelete: false,
} as const;