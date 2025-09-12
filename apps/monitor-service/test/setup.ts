// Service-specific test setup for monitor-service
import 'reflect-metadata';

// Mock environment variables for monitor-service tests
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'monitor-service';

// Setup service-specific test configuration
beforeAll(async () => {
  // Service-specific setup
});

afterAll(async () => {
  // Service-specific cleanup
});
