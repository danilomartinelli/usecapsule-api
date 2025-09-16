# Circuit Breaker Testing and Validation Guide

This guide provides comprehensive testing strategies and validation procedures for the circuit breaker implementation in the Capsule Platform.

## Testing Strategy Overview

The circuit breaker implementation includes several types of tests:

1. **Unit Tests**: Test individual circuit breaker components
2. **Integration Tests**: Test circuit breaker with RabbitMQ
3. **End-to-End Tests**: Test complete failure scenarios
4. **Performance Tests**: Test under high load conditions
5. **Chaos Engineering**: Test resilience to various failures

## Unit Testing

### Circuit Breaker Service Tests

```typescript
// libs/configs/rabbitmq/src/lib/circuit-breaker/circuit-breaker.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerConfigService } from './circuit-breaker.config';
import { CircuitBreakerState } from './circuit-breaker.types';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let configService: CircuitBreakerConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        CircuitBreakerConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                CIRCUIT_BREAKER_ENABLED: 'true',
                CIRCUIT_BREAKER_ERROR_THRESHOLD: '50',
                CIRCUIT_BREAKER_RESET_TIMEOUT: '60000',
                NODE_ENV: 'test',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    configService = module.get<CircuitBreakerConfigService>(
      CircuitBreakerConfigService,
    );
  });

  describe('execute', () => {
    it('should execute function successfully when circuit breaker is closed', async () => {
      const mockFunction = jest.fn().mockResolvedValue('success');

      const result = await service.execute(
        mockFunction,
        { serviceName: 'test-service' },
        'test-arg',
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.circuitState).toBe(CircuitBreakerState.CLOSED);
      expect(result.fromFallback).toBe(false);
    });

    it('should open circuit breaker after error threshold is reached', async () => {
      const mockFunction = jest
        .fn()
        .mockRejectedValue(new Error('Service error'));

      // Execute multiple times to reach error threshold
      for (let i = 0; i < 15; i++) {
        try {
          await service.execute(mockFunction, { serviceName: 'test-service' });
        } catch (error) {
          // Expected failures
        }
      }

      // Check that circuit breaker is now open
      const health = service.getHealth('test-service');
      expect(health?.state).toBe(CircuitBreakerState.OPEN);
    });

    it('should use fallback when circuit breaker is open', async () => {
      const mockFunction = jest
        .fn()
        .mockRejectedValue(new Error('Service error'));
      const fallbackValue = 'fallback-result';

      // Force circuit breaker to open
      await forceCircuitBreakerOpen(service, 'test-service');

      const result = await service.execute(mockFunction, {
        serviceName: 'test-service',
        config: {
          fallback: () => fallbackValue,
        },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(fallbackValue);
      expect(result.fromFallback).toBe(true);
      expect(result.circuitState).toBe(CircuitBreakerState.OPEN);
    });

    it('should transition to half-open state after reset timeout', async () => {
      // This would require time manipulation or mocking
      // Implementation depends on your testing strategy
    });
  });

  describe('getMetrics', () => {
    it('should return circuit breaker metrics', async () => {
      // Execute some operations to generate metrics
      const mockFunction = jest.fn().mockResolvedValue('success');
      await service.execute(mockFunction, { serviceName: 'test-service' });

      const metrics = service.getMetrics('test-service');
      expect(metrics).toBeDefined();
      expect(metrics?.requestCount).toBeGreaterThan(0);
      expect(metrics?.successCount).toBe(1);
      expect(metrics?.errorPercentage).toBe(0);
    });
  });
});

// Helper function to force circuit breaker open
async function forceCircuitBreakerOpen(
  service: CircuitBreakerService,
  serviceName: string,
) {
  const mockFunction = jest.fn().mockRejectedValue(new Error('Forced error'));

  for (let i = 0; i < 20; i++) {
    try {
      await service.execute(mockFunction, { serviceName });
    } catch (error) {
      // Expected failures
    }
  }
}
```

### Configuration Service Tests

```typescript
// libs/configs/rabbitmq/src/lib/circuit-breaker/circuit-breaker.config.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerConfigService } from './circuit-breaker.config';
import { TimeoutOperation } from '@usecapsule/parameters';

describe('CircuitBreakerConfigService', () => {
  let service: CircuitBreakerConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerConfigService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                CIRCUIT_BREAKER_ENABLED: 'true',
                AUTH_SERVICE_TIMEOUT: '2000',
                BILLING_SERVICE_TIMEOUT: '8000',
                NODE_ENV: 'test',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerConfigService>(
      CircuitBreakerConfigService,
    );
  });

  it('should return service-specific configuration', () => {
    const authConfig = service.getServiceConfig('auth-service');
    const billingConfig = service.getServiceConfig('billing-service');

    expect(authConfig.timeout).toBe(2000);
    expect(billingConfig.timeout).toBe(8000);

    // Auth service should be more sensitive
    expect(authConfig.errorThresholdPercentage).toBeLessThan(
      billingConfig.errorThresholdPercentage,
    );
  });

  it('should return operation-specific configuration', () => {
    const healthCheckConfig = service.getServiceConfig(
      'auth-service',
      TimeoutOperation.HEALTH_CHECK,
    );
    const rpcConfig = service.getServiceConfig(
      'auth-service',
      TimeoutOperation.RPC_CALL,
    );

    expect(healthCheckConfig.timeout).toBeLessThan(rpcConfig.timeout);
    expect(healthCheckConfig.errorThresholdPercentage).toBeLessThan(
      rpcConfig.errorThresholdPercentage,
    );
  });

  it('should return appropriate recovery strategies', () => {
    const authStrategy = service.getRecoveryStrategy('auth-service');
    const billingStrategy = service.getRecoveryStrategy('billing-service');

    expect(authStrategy.type).toBe('exponential_backoff');
    expect(billingStrategy.type).toBe('linear_backoff');
    expect(authStrategy.maxAttempts).toBeLessThan(billingStrategy.maxAttempts);
  });
});
```

## Integration Testing

### Circuit Breaker with RabbitMQ

```typescript
// apps/api-gateway/test/circuit-breaker-integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app/app.module';
import {
  RabbitMQTestContainer,
  RabbitMQTestClient,
  TestingModuleBuilder,
} from '@usecapsule/testing';
import { CircuitBreakerState } from '@usecapsule/rabbitmq';

describe('Circuit Breaker Integration Tests', () => {
  let app: INestApplication;
  let testEnvironment: any;
  let rabbitMQContainer: RabbitMQTestContainer;
  let rabbitMQClient: RabbitMQTestClient;

  beforeAll(async () => {
    testEnvironment = await new TestingModuleBuilder({
      imports: [AppModule],
      useRealRabbitMQ: true,
    }).build();

    app = testEnvironment.module.createNestApplication();
    rabbitMQContainer = testEnvironment.rabbitMQContainer;
    rabbitMQClient = testEnvironment.rabbitMQClient;

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await testEnvironment.cleanup();
  });

  describe('Service Failure Scenarios', () => {
    it('should handle service unavailability gracefully', async () => {
      // Stop a service to simulate unavailability
      await rabbitMQContainer.stopService('auth-service');

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('degraded');
      expect(response.body.services['auth-service'].status).toBe('unhealthy');
      expect(response.body.metadata.circuitBreakers).toBeDefined();
    });

    it('should open circuit breaker after repeated failures', async () => {
      // Simulate service that returns errors
      await rabbitMQClient.mockServiceResponses('auth-service', {
        'auth.health': () => {
          throw new Error('Service error');
        },
      });

      // Make multiple health check requests
      for (let i = 0; i < 15; i++) {
        await request(app.getHttpServer()).get('/health');
      }

      // Check circuit breaker status
      const cbResponse = await request(app.getHttpServer())
        .get('/health/circuit-breakers')
        .expect(200);

      const authServiceBreaker = Object.entries(cbResponse.body.services).find(
        ([key]) => key.includes('auth-service'),
      );

      expect(authServiceBreaker[1].state).toBe(CircuitBreakerState.OPEN);
    });

    it('should use fallback when circuit breaker is open', async () => {
      // Force circuit breaker to open state
      await forceCircuitBreakerOpen('auth-service');

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const authService = response.body.services['auth-service'];
      expect(authService.metadata.circuitBreaker.fromFallback).toBe(true);
      expect(authService.metadata.circuitBreaker.state).toBe(
        CircuitBreakerState.OPEN,
      );
    });

    it('should provide circuit breaker metrics', async () => {
      const response = await request(app.getHttpServer())
        .get('/debug/circuit-breakers')
        .expect(200);

      expect(response.body).toHaveProperty('activeCircuitBreakers');
      expect(response.body).toHaveProperty('circuitBreakers');
      expect(response.body).toHaveProperty('globalConfig');
    });

    it('should allow manual circuit breaker reset', async () => {
      const response = await request(app.getHttpServer())
        .post('/admin/circuit-breaker/reset/auth-service')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Successfully reset');
    });
  });

  async function forceCircuitBreakerOpen(serviceName: string) {
    await rabbitMQClient.mockServiceResponses(serviceName, {
      [`${serviceName.replace('-service', '')}.health`]: () => {
        throw new Error('Forced error');
      },
    });

    // Make multiple requests to trip the circuit breaker
    for (let i = 0; i < 20; i++) {
      try {
        await request(app.getHttpServer()).get('/health');
      } catch (error) {
        // Expected failures
      }
    }
  }
});
```

## Performance Testing

### Load Testing with Circuit Breaker

```typescript
// test/performance/circuit-breaker-load.spec.ts
describe('Circuit Breaker Performance Tests', () => {
  it('should handle high concurrent load without degrading', async () => {
    const concurrentRequests = 100;
    const startTime = Date.now();

    const promises = Array.from({ length: concurrentRequests }, () =>
      request(app.getHttpServer()).get('/health'),
    );

    const responses = await Promise.allSettled(promises);
    const endTime = Date.now();

    const successfulResponses = responses.filter(
      (result) => result.status === 'fulfilled',
    ).length;

    expect(successfulResponses).toBeGreaterThan(concurrentRequests * 0.9); // 90% success rate
    expect(endTime - startTime).toBeLessThan(5000); // Complete within 5 seconds
  });

  it('should maintain performance with circuit breaker enabled vs disabled', async () => {
    // Test with circuit breaker enabled
    const withCbStart = Date.now();
    await makeHealthCheckRequests(100);
    const withCbDuration = Date.now() - withCbStart;

    // Temporarily disable circuit breaker for comparison
    process.env.CIRCUIT_BREAKER_ENABLED = 'false';

    const withoutCbStart = Date.now();
    await makeHealthCheckRequests(100);
    const withoutCbDuration = Date.now() - withoutCbStart;

    // Circuit breaker should add minimal overhead (less than 20%)
    expect(withCbDuration).toBeLessThan(withoutCbDuration * 1.2);

    // Reset environment
    process.env.CIRCUIT_BREAKER_ENABLED = 'true';
  });

  async function makeHealthCheckRequests(count: number) {
    const promises = Array.from({ length: count }, () =>
      request(app.getHttpServer()).get('/health'),
    );
    return Promise.allSettled(promises);
  }
});
```

## End-to-End Testing

### Complete Failure Recovery Scenarios

```typescript
// test/e2e/circuit-breaker-recovery.spec.ts
describe('Circuit Breaker Recovery E2E Tests', () => {
  it('should recover from complete service failure', async () => {
    // 1. Verify services are healthy
    let response = await request(app.getHttpServer()).get('/health');
    expect(response.body.status).toBe('healthy');

    // 2. Simulate complete auth service failure
    await rabbitMQContainer.stopService('auth-service');

    // 3. Verify circuit breaker opens
    await waitForCircuitBreakerState('auth-service', CircuitBreakerState.OPEN);

    // 4. Verify system is degraded but functional
    response = await request(app.getHttpServer()).get('/health');
    expect(response.body.status).toBe('degraded');
    expect(response.body.services['auth-service'].status).toBe('unhealthy');

    // 5. Restart service
    await rabbitMQContainer.startService('auth-service');

    // 6. Wait for circuit breaker recovery
    await waitForCircuitBreakerState(
      'auth-service',
      CircuitBreakerState.CLOSED,
    );

    // 7. Verify system is healthy again
    response = await request(app.getHttpServer()).get('/health');
    expect(response.body.status).toBe('healthy');
  });

  it('should handle cascading failures gracefully', async () => {
    // Simulate multiple service failures
    await rabbitMQContainer.stopService('auth-service');
    await rabbitMQContainer.stopService('billing-service');

    // System should still respond but be unhealthy
    const response = await request(app.getHttpServer()).get('/health');
    expect(response.body.status).toBe('unhealthy');
    expect(response.status).toBe(200); // Still responsive

    // Check that fallbacks are working
    expect(
      response.body.services['auth-service'].metadata.circuitBreaker
        .fromFallback,
    ).toBe(true);
    expect(
      response.body.services['billing-service'].metadata.circuitBreaker
        .fromFallback,
    ).toBe(true);
  });

  async function waitForCircuitBreakerState(
    serviceName: string,
    expectedState: CircuitBreakerState,
    timeoutMs: number = 60000,
  ) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const response = await request(app.getHttpServer()).get(
        '/health/circuit-breakers',
      );

      const serviceBreaker = Object.entries(response.body.services).find(
        ([key]) => key.includes(serviceName),
      );

      if (serviceBreaker && serviceBreaker[1].state === expectedState) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(
      `Circuit breaker for ${serviceName} did not reach ${expectedState} state within timeout`,
    );
  }
});
```

## Chaos Engineering Tests

### Resilience Testing

```typescript
// test/chaos/circuit-breaker-chaos.spec.ts
describe('Circuit Breaker Chaos Engineering Tests', () => {
  it('should handle random service interruptions', async () => {
    const services = ['auth-service', 'billing-service', 'deploy-service'];
    const duration = 60000; // 1 minute test
    const startTime = Date.now();

    // Start chaos monkey
    const chaosInterval = setInterval(async () => {
      const randomService =
        services[Math.floor(Math.random() * services.length)];
      const action = Math.random() > 0.5 ? 'stop' : 'start';

      if (action === 'stop') {
        await rabbitMQContainer.stopService(randomService);
      } else {
        await rabbitMQContainer.startService(randomService);
      }
    }, 5000); // Every 5 seconds

    // Continuously make requests during chaos
    const requestPromises = [];
    while (Date.now() - startTime < duration) {
      requestPromises.push(
        request(app.getHttpServer())
          .get('/health')
          .then((res) => ({ success: true, status: res.status }))
          .catch((err) => ({ success: false, error: err.message })),
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    clearInterval(chaosInterval);

    // Analyze results
    const results = await Promise.allSettled(requestPromises);
    const successful = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success,
    ).length;

    // Should maintain at least 80% availability during chaos
    expect(successful / results.length).toBeGreaterThan(0.8);
  });

  it('should handle network partitions', async () => {
    // Simulate network partition by introducing delays
    await rabbitMQClient.setNetworkDelay('auth-service', 30000); // 30 second delay

    const response = await request(app.getHttpServer())
      .get('/health')
      .timeout(5000); // 5 second timeout

    // Circuit breaker should handle the timeout
    expect(response.body.services['auth-service'].status).toBe('unhealthy');
    expect(
      response.body.services['auth-service'].metadata.circuitBreaker.timedOut,
    ).toBe(true);

    // Clear network delay
    await rabbitMQClient.clearNetworkDelay('auth-service');
  });
});
```

## Testing Configuration

### Jest Configuration for Circuit Breaker Tests

```javascript
// jest.config.circuit-breaker.js
module.exports = {
  displayName: 'Circuit Breaker Tests',
  testMatch: [
    '**/circuit-breaker/**/*.spec.ts',
    '**/test/**/circuit-breaker*.spec.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/test/setup/circuit-breaker-matchers.ts'],
  testEnvironment: 'node',
  testTimeout: 30000, // Longer timeout for circuit breaker tests
  verbose: true,
};
```

### Custom Test Matchers

```typescript
// test/setup/circuit-breaker-matchers.ts
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveCircuitBreakerState(expectedState: CircuitBreakerState): R;
      toHaveCircuitBreakerMetrics(): R;
      toBeCircuitBreakerHealthy(): R;
    }
  }
}

expect.extend({
  toHaveCircuitBreakerState(received: any, expectedState: CircuitBreakerState) {
    const state =
      received?.state || received?.circuitBreakerResult?.circuitState;
    const pass = state === expectedState;

    return {
      message: () =>
        `expected circuit breaker to have state ${expectedState}, but received ${state}`,
      pass,
    };
  },

  toHaveCircuitBreakerMetrics(received: any) {
    const hasMetrics =
      received &&
      typeof received.requestCount === 'number' &&
      typeof received.errorPercentage === 'number' &&
      typeof received.averageResponseTime === 'number';

    return {
      message: () =>
        `expected object to have circuit breaker metrics properties`,
      pass: hasMetrics,
    };
  },

  toBeCircuitBreakerHealthy(received: any) {
    const isHealthy =
      received?.status === 'healthy' &&
      received?.state === CircuitBreakerState.CLOSED;

    return {
      message: () =>
        `expected circuit breaker to be healthy (status: healthy, state: closed)`,
      pass: isHealthy,
    };
  },
});
```

## Manual Testing Procedures

### Testing Circuit Breaker Behavior

1. **Test Circuit Breaker Opening:**

   ```bash
   # Stop a service
   docker stop auth_service_container

   # Make multiple health check requests
   for i in {1..10}; do
     curl http://localhost:3000/health
     sleep 1
   done

   # Check circuit breaker status
   curl http://localhost:3000/health/circuit-breakers
   ```

2. **Test Fallback Behavior:**

   ```bash
   # With circuit breaker open, check fallback responses
   curl http://localhost:3000/health | jq '.services."auth-service".metadata.circuitBreaker.fromFallback'
   ```

3. **Test Recovery:**

   ```bash
   # Restart service
   docker start auth_service_container

   # Wait for recovery and check status
   curl http://localhost:3000/health/circuit-breakers | jq '.services."auth-service".state'
   ```

4. **Test Manual Reset:**

   ```bash
   # Reset circuit breaker manually
   curl -X POST http://localhost:3000/admin/circuit-breaker/reset/auth-service

   # Verify reset
   curl http://localhost:3000/health/circuit-breakers
   ```

### Monitoring During Tests

```bash
# Monitor circuit breaker metrics
watch -n 2 'curl -s http://localhost:3000/debug/circuit-breakers | jq .activeCircuitBreakers'

# Monitor health recommendations
curl http://localhost:3000/health/recommendations | jq '.'

# Check RabbitMQ queue status
docker exec rabbitmq_dev rabbitmqctl list_queues name messages consumers
```

This comprehensive testing guide ensures that your circuit breaker implementation is robust, performant, and handles various failure scenarios gracefully.
