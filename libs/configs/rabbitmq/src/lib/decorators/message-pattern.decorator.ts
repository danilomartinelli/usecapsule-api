import { SetMetadata } from '@nestjs/common';
import { MessagePattern as NestMessagePattern } from '@nestjs/microservices';

import { MessagePatternConfig } from '../interfaces';

/**
 * Metadata key for storing message pattern configuration.
 */
export const MESSAGE_PATTERN_METADATA = 'rabbitmq:message-pattern';

/**
 * Enhanced message pattern decorator for RPC-style communication.
 * 
 * This decorator extends NestJS's @MessagePattern with additional
 * RabbitMQ-specific configuration options.
 * 
 * @param config - Message pattern configuration
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @Controller()
 * export class UserController {
 *   @RabbitMQMessagePattern({
 *     pattern: 'user.create',
 *     exchange: 'user.exchange',
 *     routingKey: 'user.create',
 *     persistent: true,
 *     priority: 10,
 *   })
 *   async createUser(data: CreateUserDto): Promise<User> {
 *     return this.userService.create(data);
 *   }
 * 
 *   @RabbitMQMessagePattern('user.findById')
 *   async findUser(id: string): Promise<User> {
 *     return this.userService.findById(id);
 *   }
 * }
 * ```
 */
export function RabbitMQMessagePattern(
  config: string | MessagePatternConfig,
): MethodDecorator {
  const patternConfig: MessagePatternConfig = typeof config === 'string'
    ? { pattern: config }
    : config;

  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    // Apply NestJS MessagePattern decorator
    const nestDecorator = NestMessagePattern(patternConfig.pattern);
    nestDecorator(target, propertyKey, descriptor);

    // Store additional RabbitMQ-specific metadata
    SetMetadata(MESSAGE_PATTERN_METADATA, {
      config: patternConfig,
      methodName: propertyKey,
      target,
      type: 'rpc',
    })(target, propertyKey, descriptor);

    return descriptor;
  };
}

/**
 * Simplified message pattern decorator for common use cases.
 * 
 * @param pattern - Message pattern string
 * @param exchange - Optional exchange name
 * @param routingKey - Optional routing key
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @MessagePattern('user.create', 'user.exchange', 'user.create')
 * async createUser(data: CreateUserDto): Promise<User> {
 *   return this.userService.create(data);
 * }
 * ```
 */
export function MessagePattern(
  pattern: string,
  exchange?: string,
  routingKey?: string,
): MethodDecorator {
  return RabbitMQMessagePattern({
    pattern,
    exchange,
    routingKey,
  });
}

/**
 * Priority message pattern decorator for high-priority messages.
 * 
 * @param pattern - Message pattern string
 * @param priority - Message priority (0-255, higher is more priority)
 * @param options - Additional options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @PriorityMessagePattern('user.urgent-notification', 255)
 * async handleUrgentNotification(data: NotificationDto): Promise<void> {
 *   // Handle urgent notification
 * }
 * ```
 */
export function PriorityMessagePattern(
  pattern: string,
  priority: number,
  options?: Partial<Omit<MessagePatternConfig, 'pattern' | 'priority'>>,
): MethodDecorator {
  return RabbitMQMessagePattern({
    pattern,
    priority,
    persistent: true,
    ...options,
  });
}

/**
 * Temporary message pattern decorator with expiration.
 * 
 * @param pattern - Message pattern string
 * @param expiration - Message expiration in milliseconds
 * @param options - Additional options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @TemporaryMessagePattern('user.temp-session', 300000) // 5 minutes
 * async handleTempSession(data: SessionDto): Promise<void> {
 *   // Handle temporary session
 * }
 * ```
 */
export function TemporaryMessagePattern(
  pattern: string,
  expiration: number,
  options?: Partial<Omit<MessagePatternConfig, 'pattern' | 'expiration'>>,
): MethodDecorator {
  return RabbitMQMessagePattern({
    pattern,
    expiration,
    persistent: false,
    ...options,
  });
}