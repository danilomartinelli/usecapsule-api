import { Injectable } from '@nestjs/common';
import type { HealthCheckResponse } from '@usecapsule/types';
import { HealthStatus } from '@usecapsule/types';

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
   * Provides detailed health status for RabbitMQ health checks.
   *
   * @returns Comprehensive health status information
   */
  getHealthStatus(): HealthCheckResponse {
    return {
      status: HealthStatus.HEALTHY,
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      metadata: {
        version: '1.0.0',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    };
  }
}
