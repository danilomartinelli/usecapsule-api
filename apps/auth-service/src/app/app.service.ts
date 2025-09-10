import { Injectable } from '@nestjs/common';

/**
 * Application service providing core business logic for the Auth Service.
 *
 * This service implements the Domain-Driven Design pattern as part of the
 * microservices architecture. It handles authentication-related operations
 * and communicates with other services via RabbitMQ.
 */
@Injectable()
export class AppService {
  /**
   * Retrieves application data for health checks and service identification.
   *
   * @returns Service identification message with proper typing
   */
  getData(): Readonly<{ message: string }> {
    return { message: 'Auth Service - Ready' } as const;
  }
}
