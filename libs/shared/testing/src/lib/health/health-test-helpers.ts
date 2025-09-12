import { HealthStatus } from '@usecapsule/types';
import type { HealthCheckResponse, AggregatedHealthResponse } from '@usecapsule/types';

export interface HealthTestScenario {
  name: string;
  services: Record<string, HealthStatus>;
  expectedOverallStatus: HealthStatus;
  description?: string;
}

export const HEALTH_TEST_SCENARIOS: HealthTestScenario[] = [
  {
    name: 'all_healthy',
    services: {
      'auth-service': HealthStatus.HEALTHY,
      'billing-service': HealthStatus.HEALTHY,
      'deploy-service': HealthStatus.HEALTHY,
      'monitor-service': HealthStatus.HEALTHY,
    },
    expectedOverallStatus: HealthStatus.HEALTHY,
    description: 'All services are healthy',
  },
  {
    name: 'one_unhealthy',
    services: {
      'auth-service': HealthStatus.HEALTHY,
      'billing-service': HealthStatus.UNHEALTHY,
      'deploy-service': HealthStatus.HEALTHY,
      'monitor-service': HealthStatus.HEALTHY,
    },
    expectedOverallStatus: HealthStatus.DEGRADED,
    description: 'One service unhealthy, others healthy (degraded)',
  },
  {
    name: 'majority_unhealthy',
    services: {
      'auth-service': HealthStatus.UNHEALTHY,
      'billing-service': HealthStatus.UNHEALTHY,
      'deploy-service': HealthStatus.UNHEALTHY,
      'monitor-service': HealthStatus.HEALTHY,
    },
    expectedOverallStatus: HealthStatus.UNHEALTHY,
    description: 'Majority of services unhealthy',
  },
  {
    name: 'all_unhealthy',
    services: {
      'auth-service': HealthStatus.UNHEALTHY,
      'billing-service': HealthStatus.UNHEALTHY,
      'deploy-service': HealthStatus.UNHEALTHY,
      'monitor-service': HealthStatus.UNHEALTHY,
    },
    expectedOverallStatus: HealthStatus.UNHEALTHY,
    description: 'All services are unhealthy',
  },
  {
    name: 'mixed_degraded',
    services: {
      'auth-service': HealthStatus.HEALTHY,
      'billing-service': HealthStatus.DEGRADED,
      'deploy-service': HealthStatus.HEALTHY,
      'monitor-service': HealthStatus.DEGRADED,
    },
    expectedOverallStatus: HealthStatus.DEGRADED,
    description: 'Mixed healthy and degraded services',
  },
];

export class HealthTestHelper {
  static createHealthResponse(
    service: string,
    status: HealthStatus,
    metadata?: Record<string, any>
  ): HealthCheckResponse {
    return {
      status,
      service,
      timestamp: new Date().toISOString(),
      metadata: metadata || {},
    };
  }

  static createAggregatedResponse(
    services: Record<string, HealthStatus>,
    overallStatus?: HealthStatus
  ): AggregatedHealthResponse {
    const serviceResponses: Record<string, HealthCheckResponse> = {};

    for (const [serviceName, status] of Object.entries(services)) {
      serviceResponses[serviceName] = this.createHealthResponse(serviceName, status);
    }

    // Calculate overall status if not provided
    let calculatedStatus = overallStatus;
    if (!calculatedStatus) {
      const healthyCount = Object.values(services).filter(
        status => status === HealthStatus.HEALTHY
      ).length;
      const degradedCount = Object.values(services).filter(
        status => status === HealthStatus.DEGRADED
      ).length;
      const unhealthyCount = Object.values(services).filter(
        status => status === HealthStatus.UNHEALTHY
      ).length;

      const totalServices = healthyCount + degradedCount + unhealthyCount;

      if (unhealthyCount === 0 && degradedCount === 0) {
        // All services are healthy
        calculatedStatus = HealthStatus.HEALTHY;
      } else if (unhealthyCount >= (totalServices / 2)) {
        // Majority or half of services are unhealthy 
        calculatedStatus = HealthStatus.UNHEALTHY;
      } else {
        // Some services have issues but not majority unhealthy
        calculatedStatus = HealthStatus.DEGRADED;
      }
    }

    return {
      status: calculatedStatus,
      services: serviceResponses,
      timestamp: new Date().toISOString(),
    };
  }

  static assertHealthResponse(
    actual: HealthCheckResponse,
    expected: Partial<HealthCheckResponse>
  ): void {
    if (expected.status !== undefined) {
      expect(actual.status).toBe(expected.status);
    }
    if (expected.service !== undefined) {
      expect(actual.service).toBe(expected.service);
    }
    if (expected.metadata !== undefined) {
      expect(actual.metadata).toMatchObject(expected.metadata);
    }
    expect(actual.timestamp).toBeDefined();
    expect(new Date(actual.timestamp)).toBeInstanceOf(Date);
  }

  static assertAggregatedResponse(
    actual: AggregatedHealthResponse,
    expected: Partial<AggregatedHealthResponse>
  ): void {
    if (expected.status !== undefined) {
      expect(actual.status).toBe(expected.status);
    }
    if (expected.services !== undefined) {
      expect(Object.keys(actual.services)).toEqual(
        expect.arrayContaining(Object.keys(expected.services))
      );
      for (const [serviceName, expectedHealth] of Object.entries(expected.services)) {
        expect(actual.services[serviceName]).toBeDefined();
        this.assertHealthResponse(actual.services[serviceName], expectedHealth);
      }
    }
    expect(actual.timestamp).toBeDefined();
    expect(new Date(actual.timestamp)).toBeInstanceOf(Date);
  }

  static createTimeoutResponse(service: string, routingKey: string): HealthCheckResponse {
    return this.createHealthResponse(service, HealthStatus.UNHEALTHY, {
      error: 'Service unreachable',
      exchange: 'capsule.commands',
      routingKey,
    });
  }

  static createErrorResponse(service: string, error: string): HealthCheckResponse {
    return this.createHealthResponse(service, HealthStatus.UNHEALTHY, {
      error,
    });
  }

  static getServiceRoutingKeys(): Record<string, string> {
    return {
      'auth-service': 'auth.health',
      'billing-service': 'billing.health',
      'deploy-service': 'deploy.health',
      'monitor-service': 'monitor.health',
    };
  }

  static getExpectedServiceNames(): string[] {
    return Object.keys(this.getServiceRoutingKeys());
  }

  static validateHealthEndpointResponse(response: AggregatedHealthResponse): void {
    // Basic structure validation
    expect(response).toHaveProperty('status');
    expect(response).toHaveProperty('services');
    expect(response).toHaveProperty('timestamp');

    // Status should be valid enum value
    expect(Object.values(HealthStatus)).toContain(response.status);

    // Services should be an object with expected service names
    expect(typeof response.services).toBe('object');
    expect(response.services).not.toBeNull();

    // Each service should have valid health response
    for (const [serviceName, healthResponse] of Object.entries(response.services)) {
      expect(this.getExpectedServiceNames()).toContain(serviceName);
      this.assertHealthResponse(healthResponse, {});
    }

    // Timestamp should be valid ISO string
    expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
    expect(new Date(response.timestamp)).toBeInstanceOf(Date);
  }
}