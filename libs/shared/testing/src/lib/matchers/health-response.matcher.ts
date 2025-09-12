import { HealthStatus } from '@usecapsule/types';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toHaveValidHealthResponse(): R;
      toBeHealthy(): R;
      toBeUnhealthy(): R;
      toBeDegraded(): R;
    }
  }
}

function toHaveValidHealthResponse(received: any): jest.CustomMatcherResult {
  const pass = (
    received &&
    typeof received === 'object' &&
    received.hasOwnProperty('status') &&
    Object.values(HealthStatus).includes(received.status) &&
    received.hasOwnProperty('service') &&
    typeof received.service === 'string' &&
    received.hasOwnProperty('timestamp') &&
    typeof received.timestamp === 'string' &&
    !isNaN(Date.parse(received.timestamp)) &&
    received.hasOwnProperty('metadata') &&
    typeof received.metadata === 'object'
  );

  if (pass) {
    return {
      message: () => `Expected ${JSON.stringify(received)} not to be a valid health response`,
      pass: true,
    };
  } else {
    const errors: string[] = [];
    
    if (!received || typeof received !== 'object') {
      errors.push('Expected an object');
    } else {
      if (!received.hasOwnProperty('status')) {
        errors.push('Missing "status" property');
      } else if (!Object.values(HealthStatus).includes(received.status)) {
        errors.push(`Invalid status "${received.status}", must be one of: ${Object.values(HealthStatus).join(', ')}`);
      }

      if (!received.hasOwnProperty('service')) {
        errors.push('Missing "service" property');
      } else if (typeof received.service !== 'string') {
        errors.push('Property "service" must be a string');
      }

      if (!received.hasOwnProperty('timestamp')) {
        errors.push('Missing "timestamp" property');
      } else if (typeof received.timestamp !== 'string') {
        errors.push('Property "timestamp" must be a string');
      } else if (isNaN(Date.parse(received.timestamp))) {
        errors.push('Property "timestamp" must be a valid ISO date string');
      }

      if (!received.hasOwnProperty('metadata')) {
        errors.push('Missing "metadata" property');
      } else if (typeof received.metadata !== 'object' || received.metadata === null) {
        errors.push('Property "metadata" must be an object');
      }
    }

    return {
      message: () => `Expected a valid health response but got:\n${JSON.stringify(received, null, 2)}\n\nErrors:\n${errors.map(e => `  - ${e}`).join('\n')}`,
      pass: false,
    };
  }
}

function toBeHealthy(received: any): jest.CustomMatcherResult {
  const isValidHealthResponse = toHaveValidHealthResponse(received).pass;
  const pass = isValidHealthResponse && received.status === HealthStatus.HEALTHY;

  if (pass) {
    return {
      message: () => `Expected health response not to be healthy, but got ${received.status}`,
      pass: true,
    };
  } else {
    return {
      message: () => `Expected health response to be healthy, but got ${received?.status || 'invalid response'}`,
      pass: false,
    };
  }
}

function toBeUnhealthy(received: any): jest.CustomMatcherResult {
  const isValidHealthResponse = toHaveValidHealthResponse(received).pass;
  const pass = isValidHealthResponse && received.status === HealthStatus.UNHEALTHY;

  if (pass) {
    return {
      message: () => `Expected health response not to be unhealthy, but got ${received.status}`,
      pass: true,
    };
  } else {
    return {
      message: () => `Expected health response to be unhealthy, but got ${received?.status || 'invalid response'}`,
      pass: false,
    };
  }
}

function toBeDegraded(received: any): jest.CustomMatcherResult {
  const isValidHealthResponse = toHaveValidHealthResponse(received).pass;
  const pass = isValidHealthResponse && received.status === HealthStatus.DEGRADED;

  if (pass) {
    return {
      message: () => `Expected health response not to be degraded, but got ${received.status}`,
      pass: true,
    };
  } else {
    return {
      message: () => `Expected health response to be degraded, but got ${received?.status || 'invalid response'}`,
      pass: false,
    };
  }
}

export { toHaveValidHealthResponse, toBeHealthy, toBeUnhealthy, toBeDegraded };