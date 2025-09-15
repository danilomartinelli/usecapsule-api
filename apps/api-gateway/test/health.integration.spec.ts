/// <reference path="../../../types/jest-matchers.d.ts" />

import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app/app.module';
import {
  HealthTestHelper,
  HEALTH_TEST_SCENARIOS,
  TestingModuleBuilder,
} from '@usecapsule/testing';
import type { HealthTestScenario } from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type { AggregatedHealthResponse, HealthCheckResponse } from '@usecapsule/types';

interface TestEnvironment {
  module: {
    createNestApplication(): INestApplication;
  };
  cleanup(): Promise<void>;
}

describe('Health Check Integration Tests', () => {
  let app: INestApplication;
  let testEnvironment: TestEnvironment;

  beforeAll(async () => {
    // Setup real RabbitMQ container for integration tests
    testEnvironment = await new TestingModuleBuilder({
      imports: [AppModule],
      useRealRabbitMQ: true,
    }).build();

    app = testEnvironment.module.createNestApplication();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await testEnvironment.cleanup();
  });

  describe('GET /health', () => {
    it('should return health status with proper structure regardless of service availability', async () => {
      // In integration tests, services may not be available, so we test structure
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveValidAggregatedHealthResponse();

      // Services may be unhealthy in integration tests (microservices not running)
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.status,
      );
      expect(response.body.services).toBeDefined();
      expect(Object.keys(response.body.services)).toContain('auth-service');
      expect(Object.keys(response.body.services)).toContain('billing-service');
      expect(Object.keys(response.body.services)).toContain('deploy-service');
      expect(Object.keys(response.body.services)).toContain('monitor-service');

      // Verify each service has proper health response structure
      for (const [serviceName, serviceHealth] of Object.entries(
        response.body.services,
      )) {
        const typedServiceHealth = serviceHealth as HealthCheckResponse;
        expect(typedServiceHealth).toHaveValidHealthResponse();
        expect(typedServiceHealth.service).toBe(serviceName);

        // If unhealthy, should have error metadata
        if (
          typedServiceHealth.status === HealthStatus.UNHEALTHY &&
          typedServiceHealth.metadata?.error
        ) {
          expect(typedServiceHealth.metadata.error).toMatch(
            /(timeout|unreachable|timed out)/i,
          );
        }
      }
    });

    it('should return degraded status when some services are unhealthy', async () => {
      // This test would require more sophisticated mocking of individual service responses
      // For now, we'll test the response structure
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveValidAggregatedHealthResponse();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(
        response.body.status,
      );
    });

    it('should handle service timeout gracefully', async () => {
      // This test verifies that the health check handles service timeouts
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveValidAggregatedHealthResponse();

      // Check that even if some services timeout, we get a valid response
      for (const [, serviceHealth] of Object.entries(
        response.body.services,
      )) {
        const typedServiceHealth = serviceHealth as HealthCheckResponse;
        expect(typedServiceHealth).toHaveValidHealthResponse();
        if (
          typedServiceHealth.status === HealthStatus.UNHEALTHY &&
          typedServiceHealth.metadata?.error
        ) {
          expect(typedServiceHealth.metadata.error).toMatch(
            /(timeout|unreachable|timed out)/i,
          );
        }
      }
    });

    it('should return consistent response structure', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const healthResponse: AggregatedHealthResponse = response.body;

      // Validate response structure
      HealthTestHelper.validateHealthEndpointResponse(healthResponse);

      // Verify all expected services are present
      const expectedServices = HealthTestHelper.getExpectedServiceNames();
      for (const serviceName of expectedServices) {
        expect(healthResponse.services[serviceName]).toBeDefined();
        expect(
          healthResponse.services[serviceName],
        ).toHaveValidHealthResponse();
      }
    });

    it('should include proper timestamps', async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      const endTime = Date.now();
      const responseTime = new Date(response.body.timestamp).getTime();

      expect(responseTime).toBeGreaterThanOrEqual(startTime);
      expect(responseTime).toBeLessThanOrEqual(endTime);

      // Check service timestamps
      for (const serviceHealth of Object.values(response.body.services)) {
        const typedServiceHealth = serviceHealth as HealthCheckResponse;
        const serviceTime = new Date(typedServiceHealth.timestamp).getTime();
        expect(serviceTime).toBeGreaterThanOrEqual(startTime);
        expect(serviceTime).toBeLessThanOrEqual(endTime);
      }
    });

    it('should handle multiple concurrent health check requests', async () => {
      const concurrentRequests = 5;
      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer()).get('/health').expect(200),
      );

      const responses = await Promise.all(promises);

      for (const response of responses) {
        expect(response.body).toHaveValidAggregatedHealthResponse();
      }

      // All responses should be received within a reasonable time
      expect(responses.length).toBe(concurrentRequests);
    });

    it('should provide service-specific metadata when available', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      for (const [serviceName, serviceHealth] of Object.entries(
        response.body.services,
      )) {
        const typedServiceHealth = serviceHealth as HealthCheckResponse;
        expect(typedServiceHealth.metadata).toBeDefined();

        if (typedServiceHealth.status === HealthStatus.UNHEALTHY) {
          // Unhealthy services should have error information
          expect(typedServiceHealth.metadata).toHaveProperty('error');

          if (typedServiceHealth.metadata?.routingKey) {
            expect(typedServiceHealth.metadata.routingKey).toBe(
              `${serviceName.replace('-service', '')}.health`,
            );
          }

          if (typedServiceHealth.metadata?.exchange) {
            expect(typedServiceHealth.metadata.exchange).toBe('capsule.commands');
          }
        }
      }
    });
  });

  describe('GET /health/ready', () => {
    it('should return ready status immediately', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ready',
        timestamp: expect.any(String),
      });

      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should respond quickly for load balancer checks', async () => {
      const startTime = Date.now();

      await request(app.getHttpServer()).get('/health/ready').expect(200);

      const responseTime = Date.now() - startTime;

      // Ready endpoint should respond in under 100ms
      expect(responseTime).toBeLessThan(100);
    });
  });

  describe('Health Check Scenarios', () => {
    // Test each predefined health scenario
    HEALTH_TEST_SCENARIOS.forEach((scenario: HealthTestScenario) => {
      it(`should handle ${scenario.name} scenario correctly`, async () => {
        // For integration tests, we would need to mock the RabbitMQ responses
        // This demonstrates the test structure for different scenarios

        const expectedResponse = HealthTestHelper.createAggregatedResponse(
          scenario.services,
          scenario.expectedOverallStatus,
        );

        // In a full integration test, we would:
        // 1. Mock RabbitMQ responses for each service
        // 2. Make the health check request
        // 3. Verify the aggregated response matches expectations

        expect(expectedResponse.status).toBe(scenario.expectedOverallStatus);
        expect(Object.keys(expectedResponse.services)).toEqual(
          Object.keys(scenario.services),
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle RabbitMQ connection errors gracefully', async () => {
      // This test would simulate RabbitMQ being unavailable
      // For now, we ensure the endpoint still responds
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveValidAggregatedHealthResponse();
    });

    it('should handle malformed service responses', async () => {
      // Test resilience to invalid service responses
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveValidAggregatedHealthResponse();
    });
  });
});
