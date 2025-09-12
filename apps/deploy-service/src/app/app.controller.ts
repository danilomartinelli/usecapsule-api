import { Controller } from '@nestjs/common';
import { RabbitRPC } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check RPC handler for RabbitMQ monitoring.
   *
   * This handler responds to RPC calls with routing key 'deploy.health',
   * allowing the system to verify that the deploy-service is running
   * and responding to messages properly. Uses the @golevelup/nestjs-rabbitmq
   * library for exchange-based routing via capsule.commands exchange.
   *
   * @returns Service health status
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'deploy.health',
  })
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }
}
