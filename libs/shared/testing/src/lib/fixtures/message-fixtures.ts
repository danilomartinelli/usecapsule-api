import { v4 as uuidv4 } from 'uuid';
import {
  EXCHANGES,
  AUTH_ROUTING_KEYS,
  BILLING_ROUTING_KEYS,
  DEPLOY_ROUTING_KEYS,
  MONITOR_ROUTING_KEYS,
  EVENT_ROUTING_KEYS,
  ServiceName,
} from '@usecapsule/messaging';

export interface MessageFixture {
  id: string;
  content: any;
  routingKey: string;
  exchange: string;
  timestamp: string;
  correlationId?: string;
  replyTo?: string;
}

export interface RPCFixture extends MessageFixture {
  expectedResponse: any;
  timeout?: number;
}

export class MessageFixtureFactory {
  static createHealthCheckMessage(serviceName: string): MessageFixture {
    const routingKeyMap = {
      auth: AUTH_ROUTING_KEYS.HEALTH,
      billing: BILLING_ROUTING_KEYS.HEALTH,
      deploy: DEPLOY_ROUTING_KEYS.HEALTH,
      monitor: MONITOR_ROUTING_KEYS.HEALTH,
    };

    return {
      id: uuidv4(),
      content: {},
      routingKey: routingKeyMap[serviceName] || `${serviceName}.health`,
      exchange: EXCHANGES.COMMANDS,
      timestamp: new Date().toISOString(),
    };
  }

  static createHealthCheckRPC(serviceName: string): RPCFixture {
    const serviceNameMap = {
      auth: ServiceName.AUTH,
      billing: ServiceName.BILLING,
      deploy: ServiceName.DEPLOY,
      monitor: ServiceName.MONITOR,
    };

    return {
      ...this.createHealthCheckMessage(serviceName),
      expectedResponse: {
        status: 'healthy',
        service: serviceNameMap[serviceName] || `${serviceName}-service`,
        timestamp: expect.any(String),
      },
      timeout: 5000,
    };
  }

  static createUserRegistrationMessage(userData: any): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        email: userData.email || 'test@example.com',
        password: userData.password || 'password123',
        firstName: userData.firstName || 'Test',
        lastName: userData.lastName || 'User',
      },
      routingKey: AUTH_ROUTING_KEYS.REGISTER,
      exchange: EXCHANGES.COMMANDS,
      timestamp: new Date().toISOString(),
    };
  }

  static createUserCreatedEvent(userId: string, email: string): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        userId,
        email,
        createdAt: new Date().toISOString(),
      },
      routingKey: EVENT_ROUTING_KEYS.USER_CREATED,
      exchange: EXCHANGES.EVENTS,
      timestamp: new Date().toISOString(),
    };
  }

  static createBillingChargeMessage(chargeData: any): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        customerId: chargeData.customerId || uuidv4(),
        amount: chargeData.amount || 1000,
        currency: chargeData.currency || 'usd',
        description: chargeData.description || 'Test charge',
      },
      routingKey: BILLING_ROUTING_KEYS.CHARGE,
      exchange: EXCHANGES.COMMANDS,
      timestamp: new Date().toISOString(),
    };
  }

  static createPaymentProcessedEvent(paymentData: any): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        paymentId: paymentData.paymentId || uuidv4(),
        customerId: paymentData.customerId || uuidv4(),
        amount: paymentData.amount || 1000,
        status: paymentData.status || 'succeeded',
        processedAt: new Date().toISOString(),
      },
      routingKey: EVENT_ROUTING_KEYS.PAYMENT_PROCESSED,
      exchange: EXCHANGES.EVENTS,
      timestamp: new Date().toISOString(),
    };
  }

  static createDeploymentMessage(deploymentData: any): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        projectId: deploymentData.projectId || uuidv4(),
        environment: deploymentData.environment || 'production',
        imageTag: deploymentData.imageTag || 'latest',
        replicas: deploymentData.replicas || 1,
      },
      routingKey: DEPLOY_ROUTING_KEYS.CREATE,
      exchange: EXCHANGES.COMMANDS,
      timestamp: new Date().toISOString(),
    };
  }

  static createDeploymentStartedEvent(deploymentId: string): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        deploymentId,
        status: 'started',
        startedAt: new Date().toISOString(),
      },
      routingKey: EVENT_ROUTING_KEYS.DEPLOYMENT_STARTED,
      exchange: EXCHANGES.EVENTS,
      timestamp: new Date().toISOString(),
    };
  }

  static createMonitoringMetricsMessage(metricsData: any): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        serviceId: metricsData.serviceId || uuidv4(),
        metrics: {
          cpu: metricsData.cpu || 50.5,
          memory: metricsData.memory || 75.2,
          requests: metricsData.requests || 100,
        },
        timestamp: new Date().toISOString(),
      },
      routingKey: MONITOR_ROUTING_KEYS.TRACK,
      exchange: EXCHANGES.COMMANDS,
      timestamp: new Date().toISOString(),
    };
  }

  static createErrorMessage(error: any): MessageFixture {
    return {
      id: uuidv4(),
      content: {
        error: error.message || 'Test error',
        stack: error.stack || 'Error stack trace',
        service: error.service || 'test-service',
        timestamp: new Date().toISOString(),
      },
      routingKey: EVENT_ROUTING_KEYS.ERROR_OCCURRED,
      exchange: EXCHANGES.EVENTS,
      timestamp: new Date().toISOString(),
    };
  }

  static createBatchMessages(
    count: number,
    factory: () => MessageFixture,
  ): MessageFixture[] {
    return Array.from({ length: count }, () => factory());
  }

  static createDelayedMessage(
    baseMessage: MessageFixture,
    delayMs: number,
  ): MessageFixture {
    return {
      ...baseMessage,
      id: uuidv4(),
      timestamp: new Date(Date.now() + delayMs).toISOString(),
    };
  }

  static withCorrelationId(
    message: MessageFixture,
    correlationId?: string,
  ): MessageFixture {
    return {
      ...message,
      correlationId: correlationId || uuidv4(),
    };
  }

  static withReplyTo(message: MessageFixture, replyTo: string): MessageFixture {
    return {
      ...message,
      replyTo,
    };
  }
}
