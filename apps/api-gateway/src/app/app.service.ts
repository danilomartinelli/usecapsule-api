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
    let unhealthyCount = 0;

    healthChecks.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { serviceName, health } = result.value;
        services[serviceName] = health;

        if (health.status === HealthStatus.HEALTHY) {
          healthyCount++;
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

    // Determine overall system status
    let overallStatus: HealthStatus;
    if (unhealthyCount === 0) {
      overallStatus = HealthStatus.HEALTHY;
    } else if (healthyCount > unhealthyCount) {
      overallStatus = HealthStatus.DEGRADED;
    } else {
      overallStatus = HealthStatus.UNHEALTHY;
    }

    return {
      status: overallStatus,
      services,
      timestamp: new Date().toISOString(),
    };
  }
}
