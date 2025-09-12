// TestContainers
export * from './lib/containers/rabbitmq-container';
export * from './lib/containers/postgresql-container';

// RabbitMQ Testing
export * from './lib/rabbitmq/rabbitmq-test-client';
export * from './lib/rabbitmq/amqp-connection-mock';

// NestJS Testing
export * from './lib/nestjs/testing-module-builder';

// Health Testing
export * from './lib/health/health-test-helpers';

// Custom Jest Matchers
export * from './lib/matchers/health-response.matcher';

// Fixtures
export * from './lib/fixtures/message-fixtures';
export * from './lib/fixtures/http-fixtures';

// Re-export commonly used testing libraries
export { Test, TestingModule } from '@nestjs/testing';
export { INestApplication } from '@nestjs/common';
export * as request from 'supertest';