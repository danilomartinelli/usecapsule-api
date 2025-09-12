import { Controller, Get } from '@nestjs/common';
import type { AggregatedHealthResponse } from '@usecapsule/types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * HTTP health check endpoint that verifies all microservices.
   *
   * This endpoint sends health check messages to all microservices
   * via RabbitMQ and returns the aggregated health status.
   *
   * @returns Health status for all microservices
   */
  @Get('health')
  async checkHealth(): Promise<AggregatedHealthResponse> {
    return this.appService.checkAllServicesHealth();
  }

  /**
   * Quick health check for load balancers.
   *
   * @returns Simple OK response
   */
  @Get('health/ready')
  healthReady() {
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}
