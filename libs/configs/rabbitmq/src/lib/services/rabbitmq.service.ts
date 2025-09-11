import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Observable, firstValueFrom, timeout, retry, catchError, throwError } from 'rxjs';

import { RABBITMQ_CLIENT, RABBITMQ_OPTIONS } from '../rabbitmq.constants';
import type { RabbitMQModuleOptions, PublishOptions } from '../interfaces';

/**
 * Main RabbitMQ service providing core messaging operations.
 * 
 * This service handles:
 * - Direct message sending via RabbitMQ client
 * - RPC-style request/response patterns
 * - Connection management and health checks
 * - Error handling and retry logic
 * 
 * @example
 * ```typescript
 * // Inject the service
 * constructor(private readonly rabbitMQService: RabbitMQService) {}
 * 
 * // Send a message
 * await this.rabbitMQService.send('user.create', { name: 'John' });
 * 
 * // Emit an event
 * this.rabbitMQService.emit('user.created', { id: 1, name: 'John' });
 * 
 * // Check connection health
 * const isHealthy = await this.rabbitMQService.isHealthy();
 * ```
 */
@Injectable()
export class RabbitMQService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(
    @Inject(RABBITMQ_CLIENT) private readonly client: ClientProxy,
    @Inject(RABBITMQ_OPTIONS) private readonly options: RabbitMQModuleOptions,
  ) {
    this.logger.log('RabbitMQ Service initialized');
  }

  /**
   * Sends a message using request/response pattern (RPC).
   * 
   * @template TResult - Type of the expected response
   * @template TInput - Type of the input data
   * @param pattern - Message pattern identifier
   * @param data - Data to send
   * @param options - Publishing options
   * @returns Promise resolving to the response
   */
  async send<TResult = unknown, TInput = unknown>(
    pattern: string,
    data: TInput,
    options?: PublishOptions,
  ): Promise<TResult> {
    try {
      const timeoutMs = options?.timeout || 30000;
      const maxRetries = this.options.globalRetryPolicy?.maxRetries || 3;

      this.logger.debug(`Sending RPC message to pattern: ${pattern}`);

      const response$ = this.client.send<TResult, TInput>(pattern, data).pipe(
        timeout(timeoutMs),
        retry(maxRetries),
        catchError((error) => {
          this.logger.error(
            `Failed to send message to pattern ${pattern}:`,
            error.message,
          );
          return throwError(() => error);
        }),
      );

      const result = await firstValueFrom(response$);
      this.logger.debug(`Received response for pattern: ${pattern}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Error sending message to pattern ${pattern}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Emits an event without expecting a response (pub/sub).
   * 
   * @template T - Type of the data being emitted
   * @param event - Event name
   * @param data - Data to emit
   * @param options - Publishing options
   */
  emit<T = unknown>(event: string, data: T, options?: PublishOptions): void {
    try {
      this.logger.debug(`Emitting event: ${event}`, { options });
      this.client.emit<T>(event, data);
    } catch (error) {
      this.logger.error(
        `Error emitting event ${event}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Sends a message and returns an Observable for streaming responses.
   * 
   * @template TResult - Type of the expected stream responses
   * @template TInput - Type of the input data
   * @param pattern - Message pattern identifier
   * @param data - Data to send
   * @param options - Publishing options
   * @returns Observable of responses
   */
  sendStream<TResult = unknown, TInput = unknown>(
    pattern: string,
    data: TInput,
    options?: PublishOptions,
  ): Observable<TResult> {
    try {
      const timeoutMs = options?.timeout || 30000;
      
      this.logger.debug(`Sending streaming message to pattern: ${pattern}`);

      return this.client.send<TResult, TInput>(pattern, data).pipe(
        timeout(timeoutMs),
        catchError((error) => {
          this.logger.error(
            `Failed to send streaming message to pattern ${pattern}:`,
            error.message,
          );
          return throwError(() => error);
        }),
      );
    } catch (error) {
      this.logger.error(
        `Error sending streaming message to pattern ${pattern}:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Checks if the RabbitMQ connection is healthy.
   * 
   * @returns Promise resolving to health status
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Try to send a simple health check message
      const healthCheck$ = this.client.send('health.check', {}).pipe(
        timeout(5000),
        catchError(() => throwError(() => new Error('Health check failed'))),
      );

      await firstValueFrom(healthCheck$);
      return true;
    } catch (error) {
      this.logger.warn('RabbitMQ health check failed:', error);
      return false;
    }
  }

  /**
   * Gets connection information and statistics.
   * 
   * @returns Connection information
   */
  getConnectionInfo(): {
    urls: string[];
    defaultQueue?: string;
    environment?: string;
  } {
    return {
      urls: this.options.connection.urls,
      defaultQueue: this.options.defaultQueue,
      environment: this.options.environment,
    };
  }

  /**
   * Closes the RabbitMQ client connection.
   */
  async close(): Promise<void> {
    try {
      this.logger.log('Closing RabbitMQ client connection...');
      await this.client.close();
      this.logger.log('RabbitMQ client connection closed successfully');
    } catch (error) {
      this.logger.error(
        'Error closing RabbitMQ client connection:',
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  /**
   * Module destruction lifecycle hook.
   */
  async onModuleDestroy(): Promise<void> {
    await this.close();
  }
}