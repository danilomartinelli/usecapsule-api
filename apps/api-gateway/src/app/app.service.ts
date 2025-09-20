import { Injectable } from '@nestjs/common';
import {
  AUTH_ROUTING_KEYS,
  BILLING_ROUTING_KEYS,
  DEPLOY_ROUTING_KEYS,
  MONITOR_ROUTING_KEYS,
  ServiceName,
  EXCHANGES,
} from '@usecapsule/messaging';
import type {
  TimeoutAwareAmqpService,
  CircuitBreakerAwareAmqpService,
  CircuitBreakerHealthService,
  CircuitBreakerResult,
} from '@usecapsule/rabbitmq';
import { CircuitBreakerState } from '@usecapsule/rabbitmq';
import type {
  AggregatedHealthResponse,
  HealthCheckResponse,
} from '@usecapsule/types';
import { HealthStatus } from '@usecapsule/types';

// Extended metadata interface for circuit breaker health responses
interface ExtendedHealthMetadata extends Record<string, unknown> {
  reason?: string;
  error?: string;
  exchange?: string;
  routingKey?: string;
  timeout?: boolean;
  circuitBreaker?: {
    state: CircuitBreakerState;
    fromFallback?: boolean;
    executionTime?: number;
    timeout?: number;
    timedOut?: boolean;
    errorPercentage?: number;
    requestCount?: number;
    averageResponseTime?: number;
    lastStateChange?: number;
    lastError?: string;
  };
  circuitBreakerResult?: CircuitBreakerResult;
}

@Injectable()
export class AppService {
  constructor(
    private readonly amqpService: TimeoutAwareAmqpService,
    private readonly circuitBreakerAmqpService: CircuitBreakerAwareAmqpService,
    private readonly circuitBreakerHealthService: CircuitBreakerHealthService,
  ) {}

  /**
   * Checks the health of all microservices with circuit breaker protection.
   *
   * This enhanced health check includes circuit breaker status and provides
   * more detailed information about service health and fault tolerance state.
   *
   * @returns Aggregated health status of all microservices with circuit breaker information
   */
  async checkAllServicesHealth(): Promise<AggregatedHealthResponse> {
    // Services to health check with their routing keys
    const servicesToCheck = {
      [AUTH_ROUTING_KEYS.HEALTH]: ServiceName.AUTH,
      [BILLING_ROUTING_KEYS.HEALTH]: ServiceName.BILLING,
      [DEPLOY_ROUTING_KEYS.HEALTH]: ServiceName.DEPLOY,
      [MONITOR_ROUTING_KEYS.HEALTH]: ServiceName.MONITOR,
    };

    // Get circuit breaker health status for context
    const circuitBreakerHealth =
      this.circuitBreakerHealthService.getAggregatedHealth();

    const healthChecks = await Promise.allSettled(
      Object.entries(servicesToCheck).map(async ([routingKey, serviceName]) => {
        try {
          // Use circuit breaker aware AMQP service for enhanced fault tolerance
          const response =
            await this.circuitBreakerAmqpService.healthCheck<HealthCheckResponse>(
              serviceName,
              routingKey,
            );

          // Get circuit breaker status for this service
          const circuitHealth =
            this.circuitBreakerHealthService.getServiceHealth(serviceName);

          // Enhance health response with circuit breaker information
          const baseMetadata = response.data.metadata || {};
          const enhancedMetadata: ExtendedHealthMetadata = {
            ...(baseMetadata as ExtendedHealthMetadata),
            circuitBreaker: {
              state: response.circuitState,
              fromFallback: response.fromFallback,
              executionTime: response.actualDuration,
              timeout: response.timeout,
              timedOut: response.timedOut,
              ...(circuitHealth && {
                errorPercentage: circuitHealth.metrics.errorPercentage,
                requestCount: circuitHealth.metrics.requestCount,
                averageResponseTime: circuitHealth.metrics.averageResponseTime,
                lastStateChange: circuitHealth.metrics.lastStateChange,
              }),
            },
          };

          const enhancedHealth: HealthCheckResponse = {
            ...response.data,
            metadata: enhancedMetadata,
          };

          // Ensure metadata object exists
          if (!enhancedHealth.metadata) {
            enhancedHealth.metadata = {};
          }

          // Adjust health status based on circuit breaker state
          if (
            response.fromFallback &&
            enhancedHealth.status === HealthStatus.HEALTHY
          ) {
            // If we got a healthy response from fallback, it's actually degraded
            enhancedHealth.status = HealthStatus.DEGRADED;
            const metadata = enhancedHealth.metadata as ExtendedHealthMetadata;
            metadata.reason = 'Circuit breaker fallback response';
          } else if (response.circuitState === CircuitBreakerState.OPEN) {
            // Circuit breaker is open, service is failing fast
            enhancedHealth.status = HealthStatus.UNHEALTHY;
            const metadata = enhancedHealth.metadata as ExtendedHealthMetadata;
            metadata.reason = 'Circuit breaker is OPEN - service failing fast';
          } else if (response.circuitState === CircuitBreakerState.HALF_OPEN) {
            // Circuit breaker is testing recovery
            enhancedHealth.status = HealthStatus.DEGRADED;
            const metadata = enhancedHealth.metadata as ExtendedHealthMetadata;
            metadata.reason = 'Circuit breaker is HALF_OPEN - testing recovery';
          }

          return { serviceName, health: enhancedHealth };
        } catch (error) {
          // Get circuit breaker status for error context
          const circuitHealth =
            this.circuitBreakerHealthService.getServiceHealth(serviceName);

          // Enhanced error response with circuit breaker information
          const errorMetadata: ExtendedHealthMetadata = {
            error:
              error instanceof Error ? error.message : 'Service unreachable',
            exchange: EXCHANGES.COMMANDS,
            routingKey,
            timeout: true,
            circuitBreaker: {
              state: circuitHealth?.state || CircuitBreakerState.CLOSED,
              ...(circuitHealth && {
                errorPercentage: circuitHealth.metrics.errorPercentage,
                requestCount: circuitHealth.metrics.requestCount,
                lastError: circuitHealth.metrics.lastError,
              }),
            },
          };

          // Include circuit breaker result if available
          const errorWithResult = error as Error & {
            circuitBreakerResult?: CircuitBreakerResult;
          };
          if (errorWithResult?.circuitBreakerResult) {
            errorMetadata.circuitBreakerResult =
              errorWithResult.circuitBreakerResult;
          }

          return {
            serviceName,
            health: {
              status: HealthStatus.UNHEALTHY,
              service: serviceName,
              timestamp: new Date().toISOString(),
              metadata: errorMetadata,
            },
          };
        }
      }),
    );

    // Process results and determine overall status
    const services: Record<string, HealthCheckResponse> = {};
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    healthChecks.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { serviceName, health } = result.value;
        services[serviceName] = health;

        if (health.status === HealthStatus.HEALTHY) {
          healthyCount++;
        } else if (health.status === HealthStatus.DEGRADED) {
          degradedCount++;
        } else {
          unhealthyCount++;
        }
      } else {
        // Handle promise rejection - this shouldn't happen with our current logic
        const errorService = 'unknown-service';
        services[errorService] = {
          status: HealthStatus.UNHEALTHY,
          service: errorService,
          timestamp: new Date().toISOString(),
          metadata: {
            error: 'Health check failed to execute',
          },
        };
        unhealthyCount++;
      }
    });

    // Determine overall system status based on service health distribution and circuit breaker state
    let overallStatus: HealthStatus;
    const totalServices = healthyCount + degradedCount + unhealthyCount;

    // Consider circuit breaker health in overall status
    const openCircuitBreakers = Object.keys(
      circuitBreakerHealth.services,
    ).filter(
      (service) =>
        circuitBreakerHealth.services[service].state ===
        CircuitBreakerState.OPEN,
    ).length;

    if (
      unhealthyCount === 0 &&
      degradedCount === 0 &&
      openCircuitBreakers === 0
    ) {
      // All services are healthy and no circuit breakers are open
      overallStatus = HealthStatus.HEALTHY;
    } else if (
      unhealthyCount >= totalServices / 2 ||
      openCircuitBreakers >= totalServices / 2
    ) {
      // Majority of services are unhealthy or many circuit breakers are open
      overallStatus = HealthStatus.UNHEALTHY;
    } else {
      // Some services have issues but not majority unhealthy
      overallStatus = HealthStatus.DEGRADED;
    }

    // Enhanced response with circuit breaker information
    return {
      status: overallStatus,
      services,
      timestamp: new Date().toISOString(),
      metadata: {
        circuitBreakers: {
          summary: circuitBreakerHealth.summary,
          openCount: openCircuitBreakers,
          totalCount: Object.keys(circuitBreakerHealth.services).length,
        },
        healthDistribution: {
          healthy: healthyCount,
          degraded: degradedCount,
          unhealthy: unhealthyCount,
          total: totalServices,
        },
      },
    } as AggregatedHealthResponse;
  }

  /**
   * Gets timeout configuration debug information.
   *
   * @returns Debug information about timeout configuration
   */
  getTimeoutDebugInfo(): Record<string, unknown> {
    return this.amqpService.getTimeoutDebugInfo();
  }

  /**
   * Gets circuit breaker debug information.
   *
   * @returns Debug information about circuit breaker configuration and state
   */
  getCircuitBreakerDebugInfo(): Record<string, unknown> {
    return this.circuitBreakerAmqpService.getCircuitBreakerDebugInfo();
  }

  /**
   * Gets aggregated circuit breaker health status.
   *
   * @returns Circuit breaker health information for all services
   */
  getCircuitBreakerHealth() {
    return this.circuitBreakerHealthService.getAggregatedHealth();
  }

  /**
   * Resets circuit breaker for a specific service.
   *
   * @param serviceName - Service name to reset
   * @returns Reset operation result
   */
  resetServiceCircuitBreaker(serviceName: string): {
    success: boolean;
    message: string;
  } {
    try {
      const resetCount =
        this.circuitBreakerHealthService.resetServiceCircuitBreakers(
          serviceName,
        );
      return {
        success: true,
        message: `Successfully reset ${resetCount} circuit breaker(s) for ${serviceName}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to reset circuit breakers for ${serviceName}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      };
    }
  }

  /**
   * Gets health recommendations based on current circuit breaker state.
   *
   * @returns Array of actionable health recommendations
   */
  getHealthRecommendations() {
    return this.circuitBreakerHealthService.getHealthRecommendations();
  }
}
