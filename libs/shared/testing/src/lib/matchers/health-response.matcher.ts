import { HealthStatus } from '@usecapsule/types';
import type { HealthCheckResponse } from '@usecapsule/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveValidHealthResponse(): R;
      toHaveValidAggregatedHealthResponse(): R;
      toBeHealthy(): R;
      toBeUnhealthy(): R;
      toBeDegraded(): R;
    }
  }
}

function toHaveValidHealthResponse(
  received: unknown,
): jest.CustomMatcherResult {
  const obj = received as Record<string, unknown>;
  const pass =
    received &&
    typeof received === 'object' &&
    Object.prototype.hasOwnProperty.call(received, 'status') &&
    Object.values(HealthStatus).includes(obj['status'] as HealthStatus) &&
    Object.prototype.hasOwnProperty.call(received, 'service') &&
    typeof obj['service'] === 'string' &&
    Object.prototype.hasOwnProperty.call(received, 'timestamp') &&
    typeof obj['timestamp'] === 'string' &&
    !isNaN(Date.parse(obj['timestamp'] as string)) &&
    Object.prototype.hasOwnProperty.call(received, 'metadata') &&
    typeof obj['metadata'] === 'object';

  if (pass) {
    return {
      message: () =>
        `Expected ${JSON.stringify(received)} not to be a valid health response`,
      pass: true,
    };
  } else {
    const errors: string[] = [];

    if (!received || typeof received !== 'object') {
      errors.push('Expected an object');
    } else {
      if (!Object.prototype.hasOwnProperty.call(received, 'status')) {
        errors.push('Missing "status" property');
      } else if (
        !Object.values(HealthStatus).includes(obj['status'] as HealthStatus)
      ) {
        errors.push(
          `Invalid status "${obj['status']}", must be one of: ${Object.values(HealthStatus).join(', ')}`,
        );
      }

      if (!Object.prototype.hasOwnProperty.call(received, 'service')) {
        errors.push('Missing "service" property');
      } else if (typeof obj['service'] !== 'string') {
        errors.push('Property "service" must be a string');
      }

      if (!Object.prototype.hasOwnProperty.call(received, 'timestamp')) {
        errors.push('Missing "timestamp" property');
      } else if (typeof obj['timestamp'] !== 'string') {
        errors.push('Property "timestamp" must be a string');
      } else if (isNaN(Date.parse(obj['timestamp'] as string))) {
        errors.push('Property "timestamp" must be a valid ISO date string');
      }

      if (!Object.prototype.hasOwnProperty.call(received, 'metadata')) {
        errors.push('Missing "metadata" property');
      } else if (
        typeof obj['metadata'] !== 'object' ||
        obj['metadata'] === null
      ) {
        errors.push('Property "metadata" must be an object');
      }
    }

    return {
      message: () =>
        `Expected a valid health response but got:\n${JSON.stringify(received, null, 2)}\n\nErrors:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
      pass: false,
    };
  }
}

function toBeHealthy(received: unknown): jest.CustomMatcherResult {
  const response = received as HealthCheckResponse;
  const isValidHealthResponse = toHaveValidHealthResponse(received).pass;
  const pass =
    isValidHealthResponse && response.status === HealthStatus.HEALTHY;

  if (pass) {
    return {
      message: () =>
        `Expected health response not to be healthy, but got ${response.status}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expected health response to be healthy, but got ${response?.status || 'invalid response'}`,
      pass: false,
    };
  }
}

function toBeUnhealthy(received: unknown): jest.CustomMatcherResult {
  const response = received as HealthCheckResponse;
  const isValidHealthResponse = toHaveValidHealthResponse(received).pass;
  const pass =
    isValidHealthResponse && response.status === HealthStatus.UNHEALTHY;

  if (pass) {
    return {
      message: () =>
        `Expected health response not to be unhealthy, but got ${response.status}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expected health response to be unhealthy, but got ${response?.status || 'invalid response'}`,
      pass: false,
    };
  }
}

function toBeDegraded(received: unknown): jest.CustomMatcherResult {
  const response = received as HealthCheckResponse;
  const isValidHealthResponse = toHaveValidHealthResponse(received).pass;
  const pass =
    isValidHealthResponse && response.status === HealthStatus.DEGRADED;

  if (pass) {
    return {
      message: () =>
        `Expected health response not to be degraded, but got ${response.status}`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expected health response to be degraded, but got ${response?.status || 'invalid response'}`,
      pass: false,
    };
  }
}

function toHaveValidAggregatedHealthResponse(
  received: unknown,
): jest.CustomMatcherResult {
  const obj = received as Record<string, unknown>;

  // Check basic structure
  if (!received || typeof received !== 'object') {
    return {
      message: () => 'Expected an object',
      pass: false,
    };
  }

  const errors: string[] = [];

  // Check required properties
  if (!Object.prototype.hasOwnProperty.call(received, 'status')) {
    errors.push('Missing "status" property');
  } else if (
    !Object.values(HealthStatus).includes(obj['status'] as HealthStatus)
  ) {
    errors.push(
      `Invalid status "${obj['status']}", must be one of: ${Object.values(HealthStatus).join(', ')}`,
    );
  }

  if (!Object.prototype.hasOwnProperty.call(received, 'timestamp')) {
    errors.push('Missing "timestamp" property');
  } else if (typeof obj['timestamp'] !== 'string') {
    errors.push('Property "timestamp" must be a string');
  } else if (isNaN(Date.parse(obj['timestamp'] as string))) {
    errors.push('Property "timestamp" must be a valid ISO date string');
  }

  if (!Object.prototype.hasOwnProperty.call(received, 'services')) {
    errors.push('Missing "services" property');
  } else if (
    typeof obj['services'] !== 'object' ||
    obj['services'] === null ||
    Array.isArray(obj['services'])
  ) {
    errors.push('Property "services" must be an object');
  } else {
    // Validate each service in the services object
    const services = obj['services'] as Record<string, unknown>;
    for (const [serviceName, serviceHealth] of Object.entries(services)) {
      const serviceResult = toHaveValidHealthResponse(serviceHealth);
      if (!serviceResult.pass) {
        errors.push(`Service "${serviceName}" has invalid health response`);
      }
    }
  }

  const pass = errors.length === 0;

  if (pass) {
    return {
      message: () =>
        `Expected ${JSON.stringify(received)} not to be a valid aggregated health response`,
      pass: true,
    };
  } else {
    return {
      message: () =>
        `Expected a valid aggregated health response but got:\n${JSON.stringify(received, null, 2)}\n\nErrors:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
      pass: false,
    };
  }
}

export {
  toHaveValidHealthResponse,
  toHaveValidAggregatedHealthResponse,
  toBeHealthy,
  toBeUnhealthy,
  toBeDegraded,
};
