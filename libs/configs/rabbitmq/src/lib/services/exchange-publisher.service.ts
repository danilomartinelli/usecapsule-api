import { Injectable, Logger } from '@nestjs/common';
import { RabbitMQService } from './rabbitmq.service';
import type { HealthCheckResponse } from '@usecapsule/types';
import { HealthStatus } from '@usecapsule/types';

/**
 * Exchange-based publisher service that extends RabbitMQService functionality.
 *
 * This service provides exchange-based publishing capabilities using NestJS's
 * built-in RabbitMQ client. It handles routing keys and message patterns
 * according to the Capsule Platform's exchange topology.
 */
@Injectable()
export class ExchangePublisherService {
  private readonly logger = new Logger(ExchangePublisherService.name);

  constructor(private readonly rabbitMQService: RabbitMQService) {}

  /**
   * Sends a health check command to a specific service using exchange routing.
   *
   * This method publishes to the RabbitMQ exchange using routing keys.
   * The message will be routed to the appropriate queue based on the
   * exchange bindings defined in definitions.json.
   *
   * @param routingKey - Service routing key (e.g., 'auth.health')
   * @returns Promise resolving to health status response
   */
  async sendHealthCheck(routingKey: string): Promise<HealthCheckResponse> {
    try {
      this.logger.debug(`Sending health check with routing key: ${routingKey}`);

      // Delegate to the RabbitMQService which has the correct health check implementation
      const response = await this.rabbitMQService.sendHealthCheck(routingKey);

      this.logger.debug(`Health check successful for ${routingKey}`);
      return response;
    } catch (error) {
      this.logger.warn(`Health check failed for ${routingKey}:`, error);

      // Return unhealthy status instead of throwing
      return {
        status: HealthStatus.UNHEALTHY,
        service: routingKey.split('.')[0], // Extract service name from routing key
        timestamp: new Date().toISOString(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          queue: {
            name: routingKey,
            connected: false,
          },
        },
      } satisfies HealthCheckResponse;
    }
  }

  /**
   * Publishes an event to the capsule.events exchange.
   *
   * @param routingKey - Event routing key (e.g., 'user.created')
   * @param data - Event payload
   */
  async publishEvent(routingKey: string, data: unknown): Promise<void> {
    try {
      this.logger.debug(`Publishing event with routing key: ${routingKey}`);

      // Use emit for fire-and-forget event publishing
      this.rabbitMQService.emit(routingKey, data);

      this.logger.debug(
        `Event published successfully with routing key: ${routingKey}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish event with routing key ${routingKey}:`,
        error,
      );
      throw error;
    }
  }
}
