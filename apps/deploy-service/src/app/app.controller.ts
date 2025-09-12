import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { HEALTH_CHECK_ROUTING_KEYS } from '@usecapsule/messaging';
import type { HealthCheckResponse } from '@usecapsule/types';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check message pattern for RabbitMQ monitoring.
   *
   * This handler responds to 'deploy.health' messages sent via RabbitMQ,
   * allowing the system to verify that the deploy-service is running
   * and responding to messages properly.
   *
   * @returns Service health status
   */
  @MessagePattern(HEALTH_CHECK_ROUTING_KEYS.DEPLOY)
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }
}
