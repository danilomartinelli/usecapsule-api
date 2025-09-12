import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@usecapsule/rabbitmq';
import type {
  AggregatedHealthResponse,
  HealthCheckResponse,
} from '@usecapsule/types';
import { HealthStatus } from '@usecapsule/types';

@Injectable()
export class AppService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  /**
   * Checks the health of all microservices by sending RabbitMQ RPC requests.
   *
   * @returns Aggregated health status of all microservices
   */
  async checkAllServicesHealth(): Promise<AggregatedHealthResponse> {
    // Services to health check with their routing keys
    const servicesToCheck = {
      'auth.health': 'auth-service',
      'billing.health': 'billing-service',
      'deploy.health': 'deploy-service',
      'monitor.health': 'monitor-service',
    };

    const healthChecks = await Promise.allSettled(
      Object.entries(servicesToCheck).map(async ([routingKey, serviceName]) => {
        try {
          const response: HealthCheckResponse =
            await this.amqpConnection.request({
              exchange: 'capsule.commands',
              routingKey,
              payload: {},
              timeout: 5000,
            });
          return { serviceName, health: response };
        } catch (error) {
          // If service doesn't respond, mark as unhealthy
          return {
            serviceName,
            health: {
              status: HealthStatus.UNHEALTHY,
              service: serviceName,
              timestamp: new Date().toISOString(),
              metadata: {
                error:
                  error instanceof Error
                    ? error.message
                    : 'Service unreachable',
                exchange: 'capsule.commands',
                routingKey,
              },
            } as HealthCheckResponse,
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

    // Determine overall system status based on service health distribution
    let overallStatus: HealthStatus;
    const totalServices = healthyCount + degradedCount + unhealthyCount;
    
    if (unhealthyCount === 0 && degradedCount === 0) {
      // All services are healthy
      overallStatus = HealthStatus.HEALTHY;
    } else if (unhealthyCount >= (totalServices / 2)) {
      // Majority or half of services are unhealthy 
      overallStatus = HealthStatus.UNHEALTHY;
    } else {
      // Some services have issues but not majority unhealthy
      overallStatus = HealthStatus.DEGRADED;
    }

    return {
      status: overallStatus,
      services,
      timestamp: new Date().toISOString(),
    };
  }
}
