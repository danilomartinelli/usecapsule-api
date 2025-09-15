import {
  toHaveValidHealthResponse,
  toHaveValidAggregatedHealthResponse,
  toBeHealthy,
  toBeUnhealthy,
  toBeDegraded,
} from '../matchers/health-response.matcher';

// Extend Jest with custom matchers
expect.extend({
  toHaveValidHealthResponse,
  toHaveValidAggregatedHealthResponse,
  toBeHealthy,
  toBeUnhealthy,
  toBeDegraded,
});

// Additional global test configuration
jest.setTimeout(30000);

// Mock environment variables for tests
if (!process.env['RABBITMQ_URL']) {
  process.env['RABBITMQ_URL'] = 'amqp://test:test@localhost:5672';
}

if (!process.env['NODE_ENV']) {
  process.env['NODE_ENV'] = 'test';
}