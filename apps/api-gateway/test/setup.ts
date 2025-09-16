// Service-specific test setup for API Gateway
import 'reflect-metadata';

// Import shared testing setup (includes Jest matchers and configuration)
import '@usecapsule/testing';

// Mock environment variables for API Gateway tests
process.env.NODE_ENV = 'test';
process.env.SERVICE_NAME = 'api-gateway';
process.env.PORT = '3001'; // Use different port for tests
process.env.JWT_SECRET =
  'test-jwt-secret-key-for-testing-purposes-only-32-characters-long';

// Setup API Gateway specific test configuration
beforeAll(async () => {
  // API Gateway specific setup
});

afterAll(async () => {
  // API Gateway specific cleanup
});
