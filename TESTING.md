# Capsule Platform Testing Infrastructure

This document describes the comprehensive testing infrastructure for the Capsule Platform, a microservices architecture built with NestJS, RabbitMQ, and Domain-Driven Design principles.

## Table of Contents

1. [Overview](#overview)
2. [Test Categories](#test-categories)
3. [Shared Testing Library](#shared-testing-library)
4. [Running Tests](#running-tests)
5. [Performance Testing](#performance-testing)
6. [CI/CD Integration](#cicd-integration)
7. [Writing Tests](#writing-tests)
8. [Troubleshooting](#troubleshooting)

## Overview

Our testing strategy follows the testing pyramid with four main layers:

```
          ┌─────────────────┐
          │   Performance   │ (k6 scripts)
          └─────────────────┘
        ┌───────────────────────┐
        │      E2E Tests        │ (Full workflows)
        └───────────────────────┘
      ┌─────────────────────────────┐
      │    Integration Tests        │ (Service communication)
      └─────────────────────────────┘
    ┌───────────────────────────────────┐
    │         Unit Tests              │ (Individual components)
    └───────────────────────────────────┘
```

### Architecture Under Test

The platform consists of:
- **API Gateway**: HTTP entry point (port 3000)
- **Auth Service**: Authentication bounded context
- **Billing Service**: Billing and subscription management  
- **Deploy Service**: Deployment orchestration
- **Monitor Service**: Metrics and observability
- **RabbitMQ**: Message broker for inter-service communication

## Test Categories

### 1. Unit Tests (`.spec.ts`)

Test individual components, services, and controllers in isolation.

**Location**: `apps/*/src/**/*.spec.ts`
**Technology**: Jest + NestJS Testing
**Coverage Target**: 80%+

**What we test**:
- Business logic in services
- HTTP controllers
- Message handlers
- Domain entities
- Utilities and helpers

### 2. Integration Tests (`.integration.spec.ts`)

Test interactions between components within a service or with external systems.

**Location**: `apps/*/test/*.integration.spec.ts`, `test/integration/*.spec.ts`
**Technology**: Jest + TestContainers + Real dependencies
**Coverage Target**: Key integration points

**What we test**:
- RabbitMQ message routing
- Database operations
- Health check flows
- Service startup and configuration

### 3. End-to-End Tests (`.e2e.spec.ts`)

Test complete user workflows across the entire system.

**Location**: `test/e2e/*.e2e.spec.ts`
**Technology**: Jest + Supertest + TestContainers
**Coverage Target**: Critical user journeys

**What we test**:
- Complete health check workflow
- API Gateway to microservices communication
- Error handling and recovery
- System resilience

### 4. Performance Tests (`.js`)

Test system performance under various load conditions.

**Location**: `test/performance/*.js`
**Technology**: k6
**Coverage Target**: SLA compliance

**What we test**:
- Load testing (normal operations)
- Spike testing (sudden load increases)
- Soak testing (extended duration)
- Stress testing (breaking point)

## Shared Testing Library

The `@usecapsule/testing` library provides common testing utilities:

### TestContainers

```typescript
import { RabbitMQTestContainer, PostgreSQLTestContainer } from '@usecapsule/testing';

// Start RabbitMQ for testing
const rabbitMQ = new RabbitMQTestContainer();
await rabbitMQ.start();
const connectionUri = rabbitMQ.getConnectionUri();
```

### RabbitMQ Test Client

```typescript
import { RabbitMQTestClient } from '@usecapsule/testing';

const client = new RabbitMQTestClient({
  connectionUri: 'amqp://localhost:5672',
  exchanges: [{ name: 'test.commands', type: 'direct' }]
});

await client.connect();
await client.publishMessage('test.commands', 'test.route', { data: 'test' });
```

### Health Check Helpers

```typescript
import { HealthTestHelper, HEALTH_TEST_SCENARIOS } from '@usecapsule/testing';

// Create mock health responses
const healthResponse = HealthTestHelper.createHealthResponse(
  'auth-service',
  HealthStatus.HEALTHY
);

// Test health check scenarios
HEALTH_TEST_SCENARIOS.forEach(scenario => {
  // Test each predefined health scenario
});
```

### Testing Module Builder

```typescript
import { TestingModuleBuilder } from '@usecapsule/testing';

const testEnvironment = await new TestingModuleBuilder({
  imports: [AppModule],
  useRealRabbitMQ: true,
  useRealDatabase: true,
}).build();

// Use testEnvironment.module for testing
// Cleanup with testEnvironment.cleanup()
```

## Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run affected tests only
npm run test:affected
```

### Service-Specific Tests

```bash
# Test specific service
nx test auth-service
nx test api-gateway

# Test with coverage
nx test auth-service --coverage

# Test in watch mode
nx test auth-service --watch
```

### Prerequisites

1. **Docker**: Required for TestContainers
2. **Node.js 20+**: Runtime environment
3. **RabbitMQ**: For integration tests (via Docker)

### Environment Setup

```bash
# Install dependencies
npm install

# Start infrastructure
npm run infrastructure:up

# Run tests
npm test
```

## Performance Testing

### k6 Performance Tests

We use k6 for performance testing with three main scenarios:

#### 1. Load Testing
Tests normal operational load with gradual ramp-up.

```bash
npm run test:performance:load
# or directly
k6 run test/performance/health-check-load.js
```

**Thresholds**:
- Failure rate < 5%
- Average response time < 2000ms
- 95th percentile < 5000ms

#### 2. Spike Testing
Tests system behavior under sudden load spikes.

```bash
npm run test:performance:spike
# or directly
k6 run test/performance/health-check-spike.js
```

**Thresholds**:
- Total failures < 50 requests
- 90th percentile < 8000ms
- HTTP error rate < 20%

#### 3. Soak Testing
Extended duration testing to detect memory leaks and degradation.

```bash
npm run test:performance:soak
# or directly
k6 run test/performance/health-check-soak.js
```

**Thresholds**:
- Average response time < 1500ms
- System degradation rate < 10%
- Response size stability (no memory leaks)

### Performance Test Runner

```bash
# Run complete performance test suite
npm run test:performance

# Run with soak test (long duration)
RUN_SOAK_TEST=true npm run test:performance

# Run against different environment
BASE_URL=https://staging.example.com npm run test:performance
```

## CI/CD Integration

### GitHub Actions Workflows

#### 1. Test Suite (`test.yml`)
Runs on every push and PR:
- Unit tests
- Integration tests (with real RabbitMQ/PostgreSQL)
- E2E tests
- Coverage reporting
- Lint and format checking

#### 2. Performance Tests (`performance.yml`)
Runs weekly and on-demand:
- Complete performance test suite
- Benchmark comparison
- Performance regression detection
- Results archival

### Test Execution Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Unit Tests  │───▶│ Integration  │───▶│ E2E Tests   │
│ (Fast)      │    │ Tests        │    │ (Complete)  │
└─────────────┘    └──────────────┘    └─────────────┘
                                              │
                   ┌──────────────┐          │
                   │ Performance  │◀─────────┘
                   │ Tests        │
                   └──────────────┘
```

### Coverage Reporting

- **Unit Tests**: 80%+ line coverage
- **Integration Tests**: Critical paths covered
- **E2E Tests**: Major user workflows
- **Combined Coverage**: Merged reports in CI

## Writing Tests

### Unit Test Example

```typescript
// auth-service/src/app/app.service.spec.ts
import { Test } from '@nestjs/testing';
import { AppService } from './app.service';
import { HealthTestHelper } from '@usecapsule/testing';

describe('AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AppService],
    }).compile();
    
    service = module.get<AppService>(AppService);
  });

  it('should return healthy status', () => {
    const result = service.getHealthStatus();
    
    expect(result).toHaveValidHealthResponse();
    expect(result).toBeHealthy();
  });
});
```

### Integration Test Example

```typescript
// test/integration/rabbitmq-health.integration.spec.ts
import { RabbitMQTestContainer, RabbitMQTestClient } from '@usecapsule/testing';

describe('RabbitMQ Health Integration', () => {
  let container: RabbitMQTestContainer;
  let client: RabbitMQTestClient;

  beforeAll(async () => {
    container = new RabbitMQTestContainer();
    await container.start();
    
    client = new RabbitMQTestClient({
      connectionUri: container.getConnectionUri(),
    });
    await client.connect();
  });

  afterAll(async () => {
    await client.disconnect();
    await container.stop();
  });

  it('should route health check messages', async () => {
    const response = await client.sendRPCMessage(
      'capsule.commands',
      'auth.health',
      {}
    );
    
    expect(response).toHaveValidHealthResponse();
  });
});
```

### E2E Test Example

```typescript
// test/e2e/health-check.e2e.spec.ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../../apps/api-gateway/src/app/app.module';

describe('Health Check E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return health status', async () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect(res => {
        expect(res.body).toHaveValidAggregatedHealthResponse();
      });
  });
});
```

### Performance Test Example

```javascript
// test/performance/health-check-load.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    'http_req_duration': ['p(95)<2000'],
    'http_req_failed': ['rate<0.05'],
  },
};

export default function () {
  const response = http.get('http://localhost:3000/health');
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });
}
```

## Custom Jest Matchers

The testing infrastructure includes custom Jest matchers:

```typescript
// Available custom matchers
expect(healthResponse).toBeHealthy();
expect(healthResponse).toBeUnhealthy();
expect(healthResponse).toBeDegraded();
expect(healthResponse).toHaveValidHealthResponse();
expect(aggregatedResponse).toHaveValidAggregatedHealthResponse();
expect(message).toMatchMessagePattern({ routingKey: 'auth.health', exchange: 'capsule.commands' });
```

## Test Data Management

### Fixtures and Factories

```typescript
import { MessageFixtureFactory, HttpFixtureFactory } from '@usecapsule/testing';

// Create test messages
const healthMessage = MessageFixtureFactory.createHealthCheckMessage('auth');
const userEvent = MessageFixtureFactory.createUserCreatedEvent('user-123', 'test@example.com');

// Create HTTP test data
const request = HttpFixtureFactory.createHealthCheckRequest();
const response = HttpFixtureFactory.createHealthyResponse();
```

### Test Database Management

Each service uses isolated test databases:

```typescript
// Integration tests automatically use TestContainers
const postgres = new PostgreSQLTestContainer({
  database: 'test_auth_db',
  user: 'test_user',
  password: 'test_pass'
});

await postgres.start();
const connectionUri = postgres.getConnectionUri();
```

## Troubleshooting

### Common Issues

#### 1. TestContainers Timeout
```
Error: Container startup timeout
```

**Solution**: Increase timeout or check Docker daemon
```typescript
const container = new RabbitMQTestContainer();
await container.start(); // Has built-in 60s timeout
```

#### 2. Port Conflicts
```
Error: Port 5672 already in use
```

**Solution**: Stop existing containers or use different ports
```bash
docker ps
docker stop $(docker ps -q)
```

#### 3. Jest Open Handles
```
Jest has detected open handles
```

**Solution**: Ensure proper cleanup
```typescript
afterAll(async () => {
  await testEnvironment.cleanup();
});
```

#### 4. RabbitMQ Connection Issues
```
Error: AMQP connection failed
```

**Solution**: Wait for container readiness
```typescript
await new Promise(resolve => setTimeout(resolve, 2000));
```

### Debug Commands

```bash
# Run specific test with debug output
npm run test -- --testNamePattern="health check" --verbose

# Run with debug logs
DEBUG=testcontainers* npm run test:integration

# Check Docker containers
docker ps -a
docker logs container_name

# Check test coverage
npm run test:coverage
open coverage/lcov-report/index.html
```

### Environment Variables

```bash
# Test environment variables
NODE_ENV=test
RABBITMQ_URL=amqp://test:test@localhost:5672
DATABASE_URL=postgresql://test:test@localhost:5432/testdb

# Performance testing
BASE_URL=http://localhost:3000
RUN_SOAK_TEST=false

# CI environment
CI=true
GITHUB_ACTIONS=true
```

## Best Practices

### 1. Test Organization
- Group related tests in `describe` blocks
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)

### 2. Test Isolation
- Each test should be independent
- Use proper setup/teardown
- Avoid shared state between tests

### 3. Mock Strategy
- Mock external dependencies
- Use real implementations for integration tests
- Provide meaningful mock data

### 4. Performance Considerations
- Parallel test execution where possible
- Optimize TestContainer startup
- Use appropriate timeouts

### 5. Maintenance
- Regular test review and cleanup
- Update dependencies regularly
- Monitor test execution times

## Metrics and Reporting

### Test Metrics
- **Test Coverage**: Line, branch, function coverage
- **Test Duration**: Per suite and overall execution time
- **Test Reliability**: Pass/fail rates, flaky test detection
- **Performance Metrics**: Response times, throughput, error rates

### Reporting
- **Coverage Reports**: HTML and LCOV formats
- **Performance Reports**: k6 HTML and JSON outputs
- **CI Reports**: GitHub Actions summaries and artifacts
- **Trend Analysis**: Historical performance comparison

---

For questions or issues with the testing infrastructure, please refer to this documentation or reach out to the development team.