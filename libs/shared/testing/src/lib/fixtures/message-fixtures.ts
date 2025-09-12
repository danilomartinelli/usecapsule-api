import { v4 as uuidv4 } from 'uuid';

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
    return {
      id: uuidv4(),
      content: {},
      routingKey: `${serviceName}.health`,
      exchange: 'capsule.commands',
      timestamp: new Date().toISOString(),
    };
  }

  static createHealthCheckRPC(serviceName: string): RPCFixture {
    return {
      ...this.createHealthCheckMessage(serviceName),
      expectedResponse: {
        status: 'healthy',
        service: `${serviceName}-service`,
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
      routingKey: 'auth.register',
      exchange: 'capsule.commands',
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
      routingKey: 'user.created',
      exchange: 'capsule.events',
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
      routingKey: 'billing.charge',
      exchange: 'capsule.commands',
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
      routingKey: 'payment.processed',
      exchange: 'capsule.events',
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
      routingKey: 'deploy.create',
      exchange: 'capsule.commands',
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
      routingKey: 'deployment.started',
      exchange: 'capsule.events',
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
      routingKey: 'monitor.track',
      exchange: 'capsule.commands',
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
      routingKey: 'error.occurred',
      exchange: 'capsule.events',
      timestamp: new Date().toISOString(),
    };
  }

  static createBatchMessages(count: number, factory: () => MessageFixture): MessageFixture[] {
    return Array.from({ length: count }, () => factory());
  }

  static createDelayedMessage(baseMessage: MessageFixture, delayMs: number): MessageFixture {
    return {
      ...baseMessage,
      id: uuidv4(),
      timestamp: new Date(Date.now() + delayMs).toISOString(),
    };
  }

  static withCorrelationId(message: MessageFixture, correlationId?: string): MessageFixture {
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