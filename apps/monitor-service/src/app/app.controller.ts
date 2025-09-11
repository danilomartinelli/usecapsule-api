import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { MESSAGE_PATTERNS } from '@usecapsule/messaging';
import type { HealthCheckResponse } from '@usecapsule/types';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check message pattern for RabbitMQ monitoring.
   *
   * This handler responds to 'health.check' messages sent via RabbitMQ,
   * allowing the system to verify that the monitor-service is running
   * and responding to messages properly.
   *
   * @returns Service health status
   */
  @MessagePattern(MESSAGE_PATTERNS.HEALTH_CHECK)
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }
}
