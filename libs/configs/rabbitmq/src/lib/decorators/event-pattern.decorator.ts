import { SetMetadata } from '@nestjs/common';
import { EventPattern as NestEventPattern } from '@nestjs/microservices';

import { EventPatternConfig } from '../interfaces';

/**
 * Metadata key for storing event pattern configuration.
 */
export const EVENT_PATTERN_METADATA = 'rabbitmq:event-pattern';

/**
 * Enhanced event pattern decorator for pub/sub-style communication.
 * 
 * This decorator extends NestJS's @EventPattern with additional
 * RabbitMQ-specific configuration options.
 * 
 * @param config - Event pattern configuration
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @Controller()
 * export class UserEventHandler {
 *   @RabbitMQEventPattern({
 *     event: 'user.created',
 *     exchange: 'user.events',
 *     routingKey: 'user.created',
 *     persistent: true,
 *   })
 *   async onUserCreated(user: User): Promise<void> {
 *     // Handle user created event
 *   }
 * 
 *   @RabbitMQEventPattern('user.deleted')
 *   async onUserDeleted(userId: string): Promise<void> {
 *     // Handle user deleted event
 *   }
 * }
 * ```
 */
export function RabbitMQEventPattern(
  config: string | EventPatternConfig,
): MethodDecorator {
  const eventConfig: EventPatternConfig = typeof config === 'string'
    ? { event: config }
    : config;

  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    // Apply NestJS EventPattern decorator
    const nestDecorator = NestEventPattern(eventConfig.event);
    nestDecorator(target, propertyKey, descriptor);

    // Store additional RabbitMQ-specific metadata
    SetMetadata(EVENT_PATTERN_METADATA, {
      config: eventConfig,
      methodName: propertyKey,
      target,
      type: 'event',
    })(target, propertyKey, descriptor);

    return descriptor;
  };
}

/**
 * Simplified event pattern decorator for common use cases.
 * 
 * @param event - Event name string
 * @param exchange - Optional exchange name
 * @param routingKey - Optional routing key
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @EventPattern('user.created', 'user.events', 'user.created')
 * async onUserCreated(user: User): Promise<void> {
 *   // Handle user created event
 * }
 * ```
 */
export function EventPattern(
  event: string,
  exchange?: string,
  routingKey?: string,
): MethodDecorator {
  return RabbitMQEventPattern({
    event,
    exchange,
    routingKey,
  });
}

/**
 * Topic event pattern decorator for topic exchange routing.
 * 
 * @param topicPattern - Topic pattern with wildcards (*, #)
 * @param exchange - Topic exchange name
 * @param options - Additional options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @TopicEventPattern('user.*.created', 'user.topic.events')
 * async onAnyUserCreated(user: User): Promise<void> {
 *   // Handle any user created event (user.admin.created, user.customer.created, etc.)
 * }
 * 
 * @TopicEventPattern('user.#', 'user.topic.events')
 * async onAnyUserEvent(data: unknown): Promise<void> {
 *   // Handle any user-related event
 * }
 * ```
 */
export function TopicEventPattern(
  topicPattern: string,
  exchange: string,
  options?: Partial<Omit<EventPatternConfig, 'event' | 'exchange' | 'routingKey'>>,
): MethodDecorator {
  return RabbitMQEventPattern({
    event: topicPattern,
    exchange,
    routingKey: topicPattern,
    ...options,
  });
}

/**
 * Fanout event pattern decorator for broadcast events.
 * 
 * @param event - Event name
 * @param exchange - Fanout exchange name
 * @param options - Additional options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @FanoutEventPattern('system.shutdown', 'system.broadcast')
 * async onSystemShutdown(): Promise<void> {
 *   // Handle system shutdown broadcast
 * }
 * ```
 */
export function FanoutEventPattern(
  event: string,
  exchange: string,
  options?: Partial<Omit<EventPatternConfig, 'event' | 'exchange'>>,
): MethodDecorator {
  return RabbitMQEventPattern({
    event,
    exchange,
    ...options,
  });
}

/**
 * Priority event pattern decorator for high-priority events.
 * 
 * @param event - Event name
 * @param priority - Event priority (0-255, higher is more priority)
 * @param options - Additional options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @PriorityEventPattern('security.breach', 255)
 * async onSecurityBreach(data: SecurityEvent): Promise<void> {
 *   // Handle high-priority security breach event
 * }
 * ```
 */
export function PriorityEventPattern(
  event: string,
  priority: number,
  options?: Partial<Omit<EventPatternConfig, 'event' | 'priority'>>,
): MethodDecorator {
  return RabbitMQEventPattern({
    event,
    priority,
    persistent: true,
    ...options,
  });
}

/**
 * Temporary event pattern decorator with expiration.
 * 
 * @param event - Event name
 * @param expiration - Event expiration in milliseconds
 * @param options - Additional options
 * @returns Method decorator
 * 
 * @example
 * ```typescript
 * @TemporaryEventPattern('user.session.heartbeat', 60000) // 1 minute
 * async onSessionHeartbeat(sessionId: string): Promise<void> {
 *   // Handle temporary session heartbeat
 * }
 * ```
 */
export function TemporaryEventPattern(
  event: string,
  expiration: number,
  options?: Partial<Omit<EventPatternConfig, 'event' | 'expiration'>>,
): MethodDecorator {
  return RabbitMQEventPattern({
    event,
    expiration,
    persistent: false,
    ...options,
  });
}