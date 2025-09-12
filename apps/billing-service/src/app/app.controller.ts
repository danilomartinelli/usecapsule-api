import { Controller } from '@nestjs/common';
import { RabbitRPC, RabbitPayload } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check RPC handler for RabbitMQ monitoring.
   *
   * This handler responds to RPC calls with routing key 'billing.health',
   * allowing the system to verify that the billing-service is running
   * and responding to messages properly. Uses the @golevelup/nestjs-rabbitmq
   * library for exchange-based routing via capsule.commands exchange.
   *
   * @returns Service health status
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'billing.health',
  })
  healthCheck(@RabbitPayload() payload?: any): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }
}
