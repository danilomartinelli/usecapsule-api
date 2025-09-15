import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CircuitBreakerHealthService } from './circuit-breaker-health.service';
import { CircuitBreakerMetricsService } from './circuit-breaker-metrics.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import type { CircuitBreakerHealth } from './circuit-breaker.types';
import type { TimeoutOperation } from '@usecapsule/parameters';
import type { AggregatedCircuitBreakerHealth } from './circuit-breaker-health.service';
import type {
  CircuitBreakerMetricsSnapshot,
  CircuitBreakerAlert,
} from './circuit-breaker-metrics.service';

/**
 * Enhanced health check controller that provides comprehensive
 * circuit breaker monitoring and management endpoints.
 *
 * This controller extends the basic health checks with detailed
 * circuit breaker status, metrics, and management capabilities.
 */
@ApiTags('Circuit Breaker Health')
@Controller('circuit-breaker')
export class CircuitBreakerEnhancedHealthController {
  constructor(
    private readonly healthService: CircuitBreakerHealthService,
    private readonly metricsService: CircuitBreakerMetricsService,
    private readonly circuitBreakerService: CircuitBreakerService,
  ) {}

  /**
   * Get aggregated health status for all circuit breakers.
   */
  @Get('health')
  @ApiOperation({
    summary: 'Get circuit breaker health status',
    description:
      'Returns aggregated health status for all circuit breakers in the system',
  })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker health status retrieved successfully',
  })
  getHealth(): AggregatedCircuitBreakerHealth {
    return this.healthService.getAggregatedHealth();
  }

  /**
   * Get health status for a specific service.
   */
  @Get('health/:serviceName')
  @ApiOperation({
    summary: 'Get service-specific circuit breaker health',
    description: 'Returns circuit breaker health status for a specific service',
  })
  @ApiParam({
    name: 'serviceName',
    description: 'Name of the service to check',
    example: 'auth-service',
  })
  @ApiQuery({
    name: 'operation',
    description: 'Specific operation to check (optional)',
    required: false,
    example: 'RPC_CALL',
  })
  @ApiResponse({
    status: 200,
    description: 'Service circuit breaker health retrieved successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Circuit breaker not found for the specified service',
  })
  getServiceHealth(
    @Param('serviceName') serviceName: string,
    @Query('operation') operation?: string,
  ): CircuitBreakerHealth | null {
    return this.healthService.getServiceHealth(
      serviceName,
      operation as TimeoutOperation,
    );
  }

  /**
   * Get circuit breakers currently in open state.
   */
  @Get('health/open')
  @ApiOperation({
    summary: 'Get open circuit breakers',
    description:
      'Returns all circuit breakers currently in OPEN state (failing fast)',
  })
  @ApiResponse({
    status: 200,
    description: 'Open circuit breakers retrieved successfully',
  })
  getOpenCircuitBreakers(): Record<string, CircuitBreakerHealth> {
    return this.healthService.getOpenCircuitBreakers();
  }

  /**
   * Get circuit breakers in degraded state.
   */
  @Get('health/degraded')
  @ApiOperation({
    summary: 'Get degraded circuit breakers',
    description: 'Returns all circuit breakers currently in degraded state',
  })
  @ApiResponse({
    status: 200,
    description: 'Degraded circuit breakers retrieved successfully',
  })
  getDegradedCircuitBreakers(): Record<string, CircuitBreakerHealth> {
    return this.healthService.getDegradedCircuitBreakers();
  }

  /**
   * Get health recommendations based on current state.
   */
  @Get('health/recommendations')
  @ApiOperation({
    summary: 'Get health recommendations',
    description:
      'Returns actionable recommendations based on current circuit breaker health',
  })
  @ApiResponse({
    status: 200,
    description: 'Health recommendations retrieved successfully',
  })
  getHealthRecommendations(): Array<{
    type: 'warning' | 'error' | 'info';
    service: string;
    message: string;
    action?: string;
  }> {
    return this.healthService.getHealthRecommendations();
  }

  /**
   * Reset circuit breaker for a specific service.
   */
  @Post('reset/:serviceName')
  @ApiOperation({
    summary: 'Reset service circuit breakers',
    description: 'Manually reset all circuit breakers for a specific service',
  })
  @ApiParam({
    name: 'serviceName',
    description: 'Name of the service to reset',
    example: 'auth-service',
  })
  @ApiResponse({
    status: 200,
    description: 'Circuit breakers reset successfully',
  })
  resetServiceCircuitBreakers(@Param('serviceName') serviceName: string): {
    service: string;
    resetCount: number;
    message: string;
  } {
    const resetCount =
      this.healthService.resetServiceCircuitBreakers(serviceName);

    return {
      service: serviceName,
      resetCount,
      message: `Reset ${resetCount} circuit breaker(s) for ${serviceName}`,
    };
  }

  /**
   * Get current metrics snapshot.
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'Get current circuit breaker metrics',
    description: 'Returns current metrics snapshot for all circuit breakers',
  })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker metrics retrieved successfully',
  })
  getCurrentMetrics(): CircuitBreakerMetricsSnapshot {
    return this.metricsService.getCurrentSnapshot();
  }

  /**
   * Get metrics history for a time range.
   */
  @Get('metrics/history')
  @ApiOperation({
    summary: 'Get circuit breaker metrics history',
    description: 'Returns historical metrics data for a specified time range',
  })
  @ApiQuery({
    name: 'startTime',
    description: 'Start time for metrics history (ISO string)',
    required: false,
    example: '2024-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'endTime',
    description: 'End time for metrics history (ISO string)',
    required: false,
    example: '2024-01-02T00:00:00Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Metrics history retrieved successfully',
  })
  getMetricsHistory(
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
  ): CircuitBreakerMetricsSnapshot[] {
    const start = startTime ? new Date(startTime) : undefined;
    const end = endTime ? new Date(endTime) : undefined;

    return this.metricsService.getMetricsHistory(start, end);
  }

  /**
   * Get service metrics over time with aggregation.
   */
  @Get('metrics/:serviceName/trend')
  @ApiOperation({
    summary: 'Get service metrics trend',
    description: 'Returns aggregated metrics for a service over time',
  })
  @ApiParam({
    name: 'serviceName',
    description: 'Name of the service',
    example: 'auth-service',
  })
  @ApiQuery({
    name: 'timeWindow',
    description: 'Time window in milliseconds',
    required: false,
    example: '300000',
  })
  @ApiQuery({
    name: 'bucketSize',
    description: 'Bucket size in milliseconds',
    required: false,
    example: '30000',
  })
  @ApiResponse({
    status: 200,
    description: 'Service metrics trend retrieved successfully',
  })
  getServiceMetricsTrend(
    @Param('serviceName') serviceName: string,
    @Query('timeWindow') timeWindow?: string,
    @Query('bucketSize') bucketSize?: string,
  ) {
    const options = {
      timeWindow: timeWindow ? parseInt(timeWindow) : 300000, // 5 minutes default
      bucketSize: bucketSize ? parseInt(bucketSize) : 30000, // 30 seconds default
    };

    return this.metricsService.getServiceMetricsOverTime(serviceName, options);
  }

  /**
   * Get error rate trends for all services.
   */
  @Get('metrics/error-trends')
  @ApiOperation({
    summary: 'Get error rate trends',
    description: 'Returns error rate trends for all services',
  })
  @ApiQuery({
    name: 'timeWindow',
    description: 'Time window in milliseconds',
    required: false,
    example: '300000',
  })
  @ApiResponse({
    status: 200,
    description: 'Error rate trends retrieved successfully',
  })
  getErrorRateTrends(@Query('timeWindow') timeWindow?: string) {
    const window = timeWindow ? parseInt(timeWindow) : 300000;
    return this.metricsService.getErrorRateTrends(window);
  }

  /**
   * Get response time percentiles for a service.
   */
  @Get('metrics/:serviceName/response-times')
  @ApiOperation({
    summary: 'Get response time percentiles',
    description: 'Returns response time percentiles for a specific service',
  })
  @ApiParam({
    name: 'serviceName',
    description: 'Name of the service',
    example: 'auth-service',
  })
  @ApiQuery({
    name: 'timeWindow',
    description: 'Time window in milliseconds',
    required: false,
    example: '300000',
  })
  @ApiResponse({
    status: 200,
    description: 'Response time percentiles retrieved successfully',
  })
  getResponseTimePercentiles(
    @Param('serviceName') serviceName: string,
    @Query('timeWindow') timeWindow?: string,
  ) {
    const window = timeWindow ? parseInt(timeWindow) : 300000;
    return this.metricsService.getResponseTimePercentiles(serviceName, window);
  }

  /**
   * Get recent alerts.
   */
  @Get('alerts')
  @ApiOperation({
    summary: 'Get circuit breaker alerts',
    description: 'Returns recent circuit breaker alerts',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Maximum number of alerts to return',
    required: false,
    example: '50',
  })
  @ApiQuery({
    name: 'severity',
    description: 'Filter by severity level',
    required: false,
    enum: ['info', 'warning', 'error'],
  })
  @ApiQuery({
    name: 'service',
    description: 'Filter by service name',
    required: false,
    example: 'auth-service',
  })
  @ApiResponse({
    status: 200,
    description: 'Alerts retrieved successfully',
  })
  getAlerts(
    @Query('limit') limit?: string,
    @Query('severity') severity?: 'info' | 'warning' | 'error',
    @Query('service') service?: string,
  ): CircuitBreakerAlert[] {
    const limitNum = limit ? parseInt(limit) : 50;
    return this.metricsService.getAlerts(limitNum, severity, service);
  }

  /**
   * Generate comprehensive summary report.
   */
  @Get('summary')
  @ApiOperation({
    summary: 'Get circuit breaker summary report',
    description:
      'Returns comprehensive summary report with overview, issues, and trends',
  })
  @ApiResponse({
    status: 200,
    description: 'Summary report generated successfully',
  })
  getSummaryReport() {
    return this.metricsService.generateSummaryReport();
  }

  /**
   * Get debug information about circuit breakers.
   */
  @Get('debug')
  @ApiOperation({
    summary: 'Get debug information',
    description:
      'Returns detailed debug information about circuit breaker configuration and state',
  })
  @ApiResponse({
    status: 200,
    description: 'Debug information retrieved successfully',
  })
  getDebugInfo() {
    return this.circuitBreakerService.getDebugInfo();
  }
}
