/**
 * Advanced TypeScript utility types for RabbitMQ module.
 *
 * These types provide better type safety, inference, and developer experience
 * when working with RabbitMQ configurations and message handling.
 */

/**
 * Utility type to make specific properties required while keeping others optional.
 *
 * @template T - Base type
 * @template K - Keys to make required
 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Utility type to make specific properties optional while keeping others as-is.
 *
 * @template T - Base type
 * @template K - Keys to make optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

/**
 * Utility type for creating readonly versions of complex objects.
 *
 * @template T - Type to make deeply readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Utility type for non-empty arrays.
 *
 * @template T - Array element type
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Utility type for ensuring string literals are non-empty.
 */
export type NonEmptyString<T extends string> = T extends '' ? never : T;

/**
 * Utility type for branded types to prevent primitive obsession.
 *
 * @template T - Base type
 * @template B - Brand name
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Branded types for RabbitMQ-specific values.
 */
export type QueueName = Brand<string, 'QueueName'>;
export type ExchangeName = Brand<string, 'ExchangeName'>;
export type RoutingKey = Brand<string, 'RoutingKey'>;
export type MessagePattern = Brand<string, 'MessagePattern'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;

/**
 * Type-safe priority range (0-255).
 */
export type MessagePriority = Brand<number, 'MessagePriority'> & {
  readonly value: number extends infer N
    ? N extends number
      ? N extends 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
        ? N
        : number
      : never
    : never;
};

/**
 * Helper to create a message priority value.
 *
 * @param value - Priority value (0-255)
 * @returns Branded priority type
 */
export const createMessagePriority = (value: number): MessagePriority => {
  if (value < 0 || value > 255 || !Number.isInteger(value)) {
    throw new Error('Message priority must be an integer between 0 and 255');
  }
  return value as MessagePriority;
};

/**
 * Helper to create branded queue name.
 *
 * @param name - Queue name
 * @returns Branded queue name
 */
export const createQueueName = (name: string): QueueName => {
  if (!name || name.trim().length === 0) {
    throw new Error('Queue name cannot be empty');
  }
  return name as QueueName;
};

/**
 * Helper to create branded exchange name.
 *
 * @param name - Exchange name
 * @returns Branded exchange name
 */
export const createExchangeName = (name: string): ExchangeName => {
  if (!name || name.trim().length === 0) {
    throw new Error('Exchange name cannot be empty');
  }
  return name as ExchangeName;
};

/**
 * Helper to create branded routing key.
 *
 * @param key - Routing key
 * @returns Branded routing key
 */
export const createRoutingKey = (key: string): RoutingKey => {
  return key as RoutingKey;
};

/**
 * Helper to create branded message pattern.
 *
 * @param pattern - Message pattern
 * @returns Branded message pattern
 */
export const createMessagePattern = (pattern: string): MessagePattern => {
  if (!pattern || pattern.trim().length === 0) {
    throw new Error('Message pattern cannot be empty');
  }
  return pattern as MessagePattern;
};

/**
 * Type guard to check if a value is a valid queue name.
 *
 * @param value - Value to check
 * @returns Type predicate
 */
export const isQueueName = (value: unknown): value is QueueName => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Type guard to check if a value is a valid exchange name.
 *
 * @param value - Value to check
 * @returns Type predicate
 */
export const isExchangeName = (value: unknown): value is ExchangeName => {
  return typeof value === 'string' && value.trim().length > 0;
};

/**
 * Type guard to check if a value is a valid message priority.
 *
 * @param value - Value to check
 * @returns Type predicate
 */
export const isMessagePriority = (value: unknown): value is MessagePriority => {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 255
  );
};
