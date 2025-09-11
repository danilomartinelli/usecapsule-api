import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * Simple RabbitMQ service for basic functionality.
 */
@Injectable()
export class RabbitMQSimpleService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQSimpleService.name);

  constructor() {
    this.logger.log('Simple RabbitMQ Service initialized');
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Simple RabbitMQ Service destroyed');
  }
}