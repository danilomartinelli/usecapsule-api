import { Controller } from '@nestjs/common';
import { EXCHANGES, BILLING_ROUTING_KEYS } from '@usecapsule/messaging';
import { RabbitRPC } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

import type { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check RPC handler for RabbitMQ monitoring.
   *
   * This handler responds to RPC calls with routing key from BILLING_ROUTING_KEYS.HEALTH,
   * allowing the system to verify that the billing-service is running
   * and responding to messages properly. Uses the @golevelup/nestjs-rabbitmq
   * library for exchange-based routing via the capsule.commands exchange.
   *
   * @returns Service health status
   */
  @RabbitRPC({
    exchange: EXCHANGES.COMMANDS,
    routingKey: BILLING_ROUTING_KEYS.HEALTH,
  })
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }
}
