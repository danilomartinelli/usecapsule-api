import { Controller, Get, Post, Param } from '@nestjs/common';
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

  /**
   * Debug endpoint for timeout configuration information.
   *
   * @returns Timeout configuration debug information
   */
  @Get('debug/timeouts')
  getTimeoutInfo() {
    return this.appService.getTimeoutDebugInfo();
  }

  /**
   * Debug endpoint for circuit breaker configuration and state.
   *
   * @returns Circuit breaker debug information
   */
  @Get('debug/circuit-breakers')
  getCircuitBreakerInfo() {
    return this.appService.getCircuitBreakerDebugInfo();
  }

  /**
   * Circuit breaker health status endpoint.
   *
   * @returns Aggregated circuit breaker health status
   */
  @Get('health/circuit-breakers')
  getCircuitBreakerHealth() {
    return this.appService.getCircuitBreakerHealth();
  }

  /**
   * Health recommendations endpoint.
   *
   * @returns Array of actionable health recommendations
   */
  @Get('health/recommendations')
  getHealthRecommendations() {
    return this.appService.getHealthRecommendations();
  }

  /**
   * Reset circuit breaker for a specific service.
   *
   * @param serviceName - Service name to reset
   * @returns Reset operation result
   */
  @Post('admin/circuit-breaker/reset/:serviceName')
  resetCircuitBreaker(@Param('serviceName') serviceName: string) {
    return this.appService.resetServiceCircuitBreaker(serviceName);
  }
}
