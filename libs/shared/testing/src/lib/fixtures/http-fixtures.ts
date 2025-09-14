import { HealthStatus } from '@usecapsule/types';
import type { AggregatedHealthResponse } from '@usecapsule/types';
import {
  AUTH_ROUTING_KEYS,
  BILLING_ROUTING_KEYS,
  DEPLOY_ROUTING_KEYS,
  ServiceName,
} from '@usecapsule/messaging';

export interface HttpRequestFixture {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
  query?: Record<string, string>;
}

export interface HttpResponseFixture {
  statusCode: number;
  body: any;
  headers?: Record<string, string>;
}

export class HttpFixtureFactory {
  static createHealthCheckRequest(): HttpRequestFixture {
    return {
      method: 'GET',
      path: '/health',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'test-client',
      },
    };
  }

  static createHealthReadyRequest(): HttpRequestFixture {
    return {
      method: 'GET',
      path: '/health/ready',
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createHealthyResponse(): HttpResponseFixture {
    const response: AggregatedHealthResponse = {
      status: HealthStatus.HEALTHY,
      services: {
        'auth-service': {
          status: HealthStatus.HEALTHY,
          service: 'auth-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        'billing-service': {
          status: HealthStatus.HEALTHY,
          service: 'billing-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        'deploy-service': {
          status: HealthStatus.HEALTHY,
          service: 'deploy-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        'monitor-service': {
          status: HealthStatus.HEALTHY,
          service: 'monitor-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      body: response,
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createDegradedResponse(): HttpResponseFixture {
    const response: AggregatedHealthResponse = {
      status: HealthStatus.DEGRADED,
      services: {
        'auth-service': {
          status: HealthStatus.HEALTHY,
          service: 'auth-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        'billing-service': {
          status: HealthStatus.UNHEALTHY,
          service: 'billing-service',
          timestamp: new Date().toISOString(),
          metadata: {
            error: 'Service unreachable',
            exchange: 'capsule.commands',
            routingKey: BILLING_ROUTING_KEYS.HEALTH,
          },
        },
        'deploy-service': {
          status: HealthStatus.HEALTHY,
          service: 'deploy-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
        'monitor-service': {
          status: HealthStatus.HEALTHY,
          service: 'monitor-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      body: response,
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createUnhealthyResponse(): HttpResponseFixture {
    const response: AggregatedHealthResponse = {
      status: HealthStatus.UNHEALTHY,
      services: {
        'auth-service': {
          status: HealthStatus.UNHEALTHY,
          service: 'auth-service',
          timestamp: new Date().toISOString(),
          metadata: {
            error: 'Service unreachable',
            exchange: 'capsule.commands',
            routingKey: AUTH_ROUTING_KEYS.HEALTH,
          },
        },
        'billing-service': {
          status: HealthStatus.UNHEALTHY,
          service: 'billing-service',
          timestamp: new Date().toISOString(),
          metadata: {
            error: 'Service unreachable',
            exchange: 'capsule.commands',
            routingKey: BILLING_ROUTING_KEYS.HEALTH,
          },
        },
        'deploy-service': {
          status: HealthStatus.UNHEALTHY,
          service: 'deploy-service',
          timestamp: new Date().toISOString(),
          metadata: {
            error: 'Service unreachable',
            exchange: 'capsule.commands',
            routingKey: DEPLOY_ROUTING_KEYS.HEALTH,
          },
        },
        'monitor-service': {
          status: HealthStatus.HEALTHY,
          service: 'monitor-service',
          timestamp: new Date().toISOString(),
          metadata: {},
        },
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      body: response,
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createReadyResponse(): HttpResponseFixture {
    return {
      statusCode: 200,
      body: {
        status: 'ready',
        timestamp: new Date().toISOString(),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createUserRegistrationRequest(userData?: any): HttpRequestFixture {
    return {
      method: 'POST',
      path: '/auth/register',
      body: {
        email: userData?.email || 'test@example.com',
        password: userData?.password || 'password123',
        firstName: userData?.firstName || 'Test',
        lastName: userData?.lastName || 'User',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createUserLoginRequest(credentials?: any): HttpRequestFixture {
    return {
      method: 'POST',
      path: '/auth/login',
      body: {
        email: credentials?.email || 'test@example.com',
        password: credentials?.password || 'password123',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createDeploymentRequest(deploymentData?: any): HttpRequestFixture {
    return {
      method: 'POST',
      path: '/deploy',
      body: {
        projectId: deploymentData?.projectId || 'test-project',
        environment: deploymentData?.environment || 'production',
        imageTag: deploymentData?.imageTag || 'latest',
        replicas: deploymentData?.replicas || 1,
      },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deploymentData?.token || 'test-token'}`,
      },
    };
  }

  static createBillingChargeRequest(chargeData?: any): HttpRequestFixture {
    return {
      method: 'POST',
      path: '/billing/charges',
      body: {
        customerId: chargeData?.customerId || 'test-customer',
        amount: chargeData?.amount || 1000,
        currency: chargeData?.currency || 'usd',
        description: chargeData?.description || 'Test charge',
      },
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${chargeData?.token || 'test-token'}`,
      },
    };
  }

  static createErrorResponse(
    statusCode: number,
    message: string,
    details?: any,
  ): HttpResponseFixture {
    return {
      statusCode,
      body: {
        statusCode,
        message,
        error: this.getErrorName(statusCode),
        timestamp: new Date().toISOString(),
        ...(details && { details }),
      },
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  static createTimeoutResponse(): HttpResponseFixture {
    return this.createErrorResponse(
      408,
      'Request timeout - service did not respond in time',
      { timeout: 5000 },
    );
  }

  static createServiceUnavailableResponse(): HttpResponseFixture {
    return this.createErrorResponse(503, 'Service temporarily unavailable', {
      retryAfter: 60,
    });
  }

  private static getErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      408: 'Request Timeout',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
      504: 'Gateway Timeout',
    };

    return errorNames[statusCode] || 'Unknown Error';
  }

  static withCustomHeaders(
    fixture: HttpRequestFixture | HttpResponseFixture,
    headers: Record<string, string>,
  ): HttpRequestFixture | HttpResponseFixture {
    return {
      ...fixture,
      headers: {
        ...fixture.headers,
        ...headers,
      },
    };
  }

  static withAuth(
    fixture: HttpRequestFixture,
    token: string,
    type: 'Bearer' | 'Basic' = 'Bearer',
  ): HttpRequestFixture {
    return this.withCustomHeaders(fixture, {
      Authorization: `${type} ${token}`,
    });
  }
}
