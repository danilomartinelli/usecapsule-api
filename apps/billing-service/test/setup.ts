// Service-specific test setup for billing-service
import 'reflect-metadata';

// Mock environment variables for billing-service tests
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'billing-service';

// Setup service-specific test configuration
beforeAll(async () => {
  // Service-specific setup
});

afterAll(async () => {
  // Service-specific cleanup
});
