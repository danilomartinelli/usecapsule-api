import { Controller } from '@nestjs/common';
import { RabbitRPC } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

import { AppService } from './app.service';

/**
 * Main application controller for the Auth Service.
 *
 * This controller handles HTTP requests in the microservice architecture,
 * providing endpoints for health checks and service status. In production,
 * most communication occurs via RabbitMQ message patterns.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check RPC handler for RabbitMQ monitoring.
   *
   * This handler responds to RPC calls with routing key 'auth.health',
   * allowing the system to verify that the auth-service is running
   * and responding to messages properly. Uses the @golevelup/nestjs-rabbitmq
   * library for exchange-based routing via capsule.commands exchange.
   *
   * @returns Service health status
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.health',
  })
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }
}
