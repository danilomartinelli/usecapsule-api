import 'reflect-metadata';

// Extend Jest matchers with custom ones for our domain
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeHealthy(): R;
      toBeUnhealthy(): R;
      toBeDegraded(): R;
      toHaveValidHealthResponse(): R;
      toHaveValidAggregatedHealthResponse(): R;
      toMatchMessagePattern(pattern: any): R;
    }
  }
}

// Custom Jest matchers for health checks
expect.extend({
  toBeHealthy(received) {
    const pass = received?.status === 'healthy';
    if (pass) {
      return {
        message: () => `expected health status not to be healthy`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected health status to be healthy, received: ${received?.status}`,
        pass: false,
      };
    }
  },

  toBeUnhealthy(received) {
    const pass = received?.status === 'unhealthy';
    if (pass) {
      return {
        message: () => `expected health status not to be unhealthy`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected health status to be unhealthy, received: ${received?.status}`,
        pass: false,
      };
    }
  },

  toBeDegraded(received) {
    const pass = received?.status === 'degraded';
    if (pass) {
      return {
        message: () => `expected health status not to be degraded`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected health status to be degraded, received: ${received?.status}`,
        pass: false,
      };
    }
  },

  toHaveValidHealthResponse(received) {
    const hasRequiredFields =
      received &&
      typeof received === 'object' &&
      typeof received.status === 'string' &&
      typeof received.service === 'string' &&
      typeof received.timestamp === 'string' &&
      received.metadata !== undefined;

    const hasValidTimestamp =
      received?.timestamp && !isNaN(new Date(received.timestamp).getTime());

    const hasValidStatus = ['healthy', 'unhealthy', 'degraded'].includes(
      received?.status,
    );

    const pass = hasRequiredFields && hasValidTimestamp && hasValidStatus;

    if (pass) {
      return {
        message: () => `expected object not to be a valid health response`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected object to be a valid health response with status, service, timestamp, and metadata fields`,
        pass: false,
      };
    }
  },

  toHaveValidAggregatedHealthResponse(received) {
    const hasRequiredFields =
      received &&
      typeof received === 'object' &&
      typeof received.status === 'string' &&
      typeof received.timestamp === 'string' &&
      typeof received.services === 'object' &&
      received.services !== null;

    const hasValidTimestamp =
      received?.timestamp && !isNaN(new Date(received.timestamp).getTime());

    const hasValidStatus = ['healthy', 'unhealthy', 'degraded'].includes(
      received?.status,
    );

    const hasValidServices =
      received?.services &&
      Object.values(received.services).every(
        (service: any) =>
          service &&
          typeof service.status === 'string' &&
          typeof service.service === 'string' &&
          typeof service.timestamp === 'string' &&
          service.metadata !== undefined,
      );

    const pass =
      hasRequiredFields &&
      hasValidTimestamp &&
      hasValidStatus &&
      hasValidServices;

    if (pass) {
      return {
        message: () =>
          `expected object not to be a valid aggregated health response`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected object to be a valid aggregated health response with status, services, and timestamp fields`,
        pass: false,
      };
    }
  },

  toMatchMessagePattern(received, pattern) {
    const pass =
      received &&
      typeof received === 'object' &&
      received.content !== undefined &&
      received.routingKey === pattern.routingKey &&
      received.exchange === pattern.exchange;

    if (pass) {
      return {
        message: () => `expected message not to match pattern`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected message to match pattern with routingKey: ${pattern.routingKey} and exchange: ${pattern.exchange}`,
        pass: false,
      };
    }
  },
});

// Global test configuration
jest.setTimeout(30000);

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.RABBITMQ_URL = 'amqp://test:test@localhost:5672';

// Global setup for tests
beforeAll(async () => {
  // Any global setup logic can go here
});

afterAll(async () => {
  // Any global cleanup logic can go here
});
