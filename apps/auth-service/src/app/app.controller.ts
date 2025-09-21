import { Controller } from '@nestjs/common';
import { EXCHANGES, AUTH_ROUTING_KEYS } from '@usecapsule/messaging';
import { RabbitRPC, RabbitPayload } from '@usecapsule/rabbitmq';
import { AuthRateLimit } from '@usecapsule/shared-redis';
import type { HealthCheckResponse } from '@usecapsule/types';

import type { RegisterUserCommand } from '../modules/user-management/commands/register-user.command';
import type { RegisterUserDto, RegisterUserResponseDto } from '../modules/user-management/dto/register-user.dto';

import type { AppService } from './app.service';

/**
 * Main application controller for the Auth Service.
 *
 * This controller handles HTTP requests in the microservice architecture,
 * providing endpoints for health checks and service status. In production,
 * most communication occurs via RabbitMQ message patterns.
 */
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly registerUserCommand: RegisterUserCommand,
  ) {}

  /**
   * Health check RPC handler for RabbitMQ monitoring.
   *
   * This handler responds to RPC calls with routing key from AUTH_ROUTING_KEYS.HEALTH,
   * allowing the system to verify that the auth-service is running
   * and responding to messages properly. Uses the @golevelup/nestjs-rabbitmq
   * library for exchange-based routing via the capsule.commands exchange.
   *
   * @returns Service health status
   */
  @RabbitRPC({
    exchange: EXCHANGES.COMMANDS,
    routingKey: AUTH_ROUTING_KEYS.HEALTH,
  })
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }

  /**
   * User registration RPC handler.
   *
   * This handler processes user registration requests from the API Gateway
   * via RabbitMQ. It handles validation, user creation, and returns
   * registration confirmation. Email verification is handled separately
   * through the mailer service integration.
   *
   * @param dto - User registration data from the request
   * @returns Promise resolving to registration response with user data
   */
  @AuthRateLimit({
    limit: 5,
    windowSize: 300, // 5 minutes
    blockDuration: 900, // 15 minutes
    keyGenerator: (context: { body?: { email?: string }; ip?: string }) => {
      const email = context.body?.email as string;
      const ip = context.ip || 'unknown';
      return email ? `auth:register:${email}` : `auth:register:${ip}`;
    },
    message: 'Too many registration attempts. Please try again later.',
  })
  @RabbitRPC({
    exchange: EXCHANGES.COMMANDS,
    routingKey: AUTH_ROUTING_KEYS.REGISTER,
  })
  async registerUser(
    @RabbitPayload() dto: RegisterUserDto,
  ): Promise<RegisterUserResponseDto> {
    return this.registerUserCommand.execute(dto);
  }
}
