// Service-specific test setup for deploy-service
import 'reflect-metadata';

// Mock environment variables for deploy-service tests
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'deploy-service';

// Setup service-specific test configuration
beforeAll(async () => {
  // Service-specific setup
});

afterAll(async () => {
  // Service-specific cleanup
});
