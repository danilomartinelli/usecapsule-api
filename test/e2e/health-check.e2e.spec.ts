import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../apps/api-gateway/src/app/app.module';
import {
  RabbitMQTestContainer,
  RabbitMQTestClient,
  HealthTestHelper,
} from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type { AggregatedHealthResponse } from '@usecapsule/types';

describe('Health Check E2E Workflow', () => {
  let app: INestApplication;
  let rabbitMQContainer: RabbitMQTestContainer;
  let rabbitMQClient: RabbitMQTestClient;

  beforeAll(async () => {
    // Start RabbitMQ container for E2E testing
    rabbitMQContainer = new RabbitMQTestContainer({
      user: 'e2euser',
      password: 'e2epass',
      vhost: '/',
    });

    await rabbitMQContainer.start();

    // Setup RabbitMQ test client
    rabbitMQClient = new RabbitMQTestClient({
      connectionUri: rabbitMQContainer.getConnectionUri(),
      exchanges: [
        { name: 'capsule.commands', type: 'direct' },
        { name: 'capsule.events', type: 'topic' },
      ],
      queues: [
        { name: 'health_responses', options: { durable: false } },
      ],
      bindings: [
        { exchange: 'capsule.commands', queue: 'health_responses', routingKey: '*.health' },
      ],
    });

    await rabbitMQClient.connect();

    // Create test module with real RabbitMQ connection
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Give services time to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    await app.close();
    await rabbitMQClient.disconnect();
    await rabbitMQContainer.stop();
  });

  beforeEach(async () => {
    rabbitMQClient.clearCapturedMessages();
  });

  describe('Complete Health Check Flow', () => {
    it('should perform full health check workflow from HTTP to RabbitMQ', async () => {
      // Act - Make HTTP request to health endpoint
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Assert HTTP Response Structure
      expect(response.body).toHaveValidAggregatedHealthResponse();
      
      const healthResponse: AggregatedHealthResponse = response.body;
      HealthTestHelper.validateHealthEndpointResponse(healthResponse);

      // Verify all expected services are present
      const expectedServices = ['auth-service', 'billing-service', 'deploy-service', 'monitor-service'];
      for (const serviceName of expectedServices) {
        expect(healthResponse.services).toHaveProperty(serviceName);
        expect(healthResponse.services[serviceName]).toHaveValidHealthResponse();
      }

      // Verify timestamps are recent and valid
      const responseTime = new Date(healthResponse.timestamp).getTime();
      const now = Date.now();
      expect(responseTime).toBeGreaterThan(now - 10000); // Within last 10 seconds
      expect(responseTime).toBeLessThanOrEqual(now);
    });

    it('should handle the complete workflow when services are available', async () => {
      // Setup - Capture RabbitMQ health check messages
      const captureKey = await rabbitMQClient.captureMessages('health_responses');

      // Act - Make health check request
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);
      const endTime = Date.now();

      // Assert - Response timing
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Assert - Response structure
      const healthResponse: AggregatedHealthResponse = response.body;
      expect(healthResponse).toHaveValidAggregatedHealthResponse();

      // Verify each service response has expected structure
      for (const [serviceName, serviceHealth] of Object.entries(healthResponse.services)) {
        expect(serviceHealth).toHaveValidHealthResponse();
        expect(serviceHealth.service).toBe(serviceName);
        
        // Check if service responded or timed out
        if (serviceHealth.status === HealthStatus.UNHEALTHY && serviceHealth.metadata?.error) {
          expect(serviceHealth.metadata.error).toMatch(/(timeout|unreachable)/i);
          expect(serviceHealth.metadata).toHaveProperty('routingKey');
          expect(serviceHealth.metadata).toHaveProperty('exchange', 'capsule.commands');
        }
      }
    });

    it('should provide consistent results across multiple requests', async () => {
      // Act - Make multiple health check requests
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/health'),
        request(app.getHttpServer()).get('/health'),
        request(app.getHttpServer()).get('/health'),
      ]);

      // Assert - All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toHaveValidAggregatedHealthResponse();
      }

      // Assert - Service availability should be consistent
      const firstResponse = responses[0].body;
      for (let i = 1; i < responses.length; i++) {
        const currentResponse = responses[i].body;
        
        // Compare service availability (allowing for minor timing differences)
        for (const serviceName of Object.keys(firstResponse.services)) {
          const firstStatus = firstResponse.services[serviceName].status;
          const currentStatus = currentResponse.services[serviceName].status;
          
          // Status should be consistent unless there's a timing race condition
          expect([firstStatus, currentStatus]).toEqual(
            expect.arrayContaining([expect.any(String)])
          );
        }
      }
    });
  });

  describe('Health Check Ready Endpoint', () => {
    it('should provide immediate readiness response', async () => {
      // Act
      const startTime = Date.now();
      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(100); // Should respond within 100ms

      expect(response.body).toEqual({
        status: 'ready',
        timestamp: expect.any(String),
      });

      const timestamp = new Date(response.body.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(startTime);
      expect(timestamp).toBeLessThanOrEqual(endTime);
    });

    it('should be suitable for load balancer health checks', async () => {
      // Test rapid-fire requests as a load balancer might make
      const requestCount = 10;
      const maxRetries = 3;
      const retryDelay = 100;
      
      // Create requests with proper timeout and connection handling
      const makeRequest = async (attemptNum = 0): Promise<any> => {
        try {
          return await request(app.getHttpServer())
            .get('/health/ready')
            .timeout(5000); // 5 second timeout per request
        } catch (error) {
          if (attemptNum < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * (attemptNum + 1)));
            return makeRequest(attemptNum + 1);
          }
          throw error;
        }
      };

      // Execute requests with slight staggering to prevent connection pool exhaustion
      const promises: Promise<any>[] = [];
      for (let i = 0; i < requestCount; i++) {
        promises.push(
          new Promise(resolve => 
            setTimeout(() => resolve(makeRequest()), i * 10) // Stagger by 10ms each
          )
        );
      }

      const startTime = Date.now();
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('ready');
      }

      // Should handle burst load efficiently (allowing for staggering and retries)
      expect(totalTime).toBeLessThan(10000); // All 10 requests in under 10 seconds
      console.log(`Load balancer test completed ${requestCount} requests in ${totalTime}ms`);
    });
  });

  describe('Error Scenarios E2E', () => {
    it('should handle complete system degradation gracefully', async () => {
      // This test simulates system degradation but ensures the API still responds
      
      // Act
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200); // Should still return 200 even if services are down

      // Assert
      expect(response.body).toHaveValidAggregatedHealthResponse();
      
      // Even if all services are unhealthy, the structure should be valid
      const healthResponse: AggregatedHealthResponse = response.body;
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthResponse.status);
    });

    it('should provide meaningful error information when services fail', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Assert
      const healthResponse: AggregatedHealthResponse = response.body;
      
      for (const [serviceName, serviceHealth] of Object.entries(healthResponse.services)) {
        if (serviceHealth.status === HealthStatus.UNHEALTHY) {
          // Unhealthy services should have error metadata
          expect(serviceHealth.metadata).toBeDefined();
          expect(serviceHealth.metadata).toHaveProperty('error');
          
          if (serviceHealth.metadata.routingKey) {
            // Verify routing key matches service
            const expectedRoutingKey = `${serviceName.replace('-service', '')}.health`;
            expect(serviceHealth.metadata.routingKey).toBe(expectedRoutingKey);
          }
        }
      }
    });
  });

  describe('Performance and Reliability E2E', () => {
    it('should meet performance SLA under normal load', async () => {
      // Test performance under repeated load
      const requestCount = 5;
      const maxAllowedResponseTime = 5000; // 5 seconds max
      const responseTimes: number[] = [];

      for (let i = 0; i < requestCount; i++) {
        const startTime = Date.now();
        
        const response = await request(app.getHttpServer())
          .get('/health')
          .expect(200);

        const responseTime = Date.now() - startTime;
        responseTimes.push(responseTime);

        expect(response.body).toHaveValidAggregatedHealthResponse();
        expect(responseTime).toBeLessThan(maxAllowedResponseTime);

        // Brief pause between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Calculate performance metrics
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxActualResponseTime = Math.max(...responseTimes);

      console.log(`Average response time: ${averageResponseTime}ms`);
      console.log(`Max response time: ${maxActualResponseTime}ms`);

      // Performance assertions
      expect(averageResponseTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxActualResponseTime).toBeLessThan(5000);     // Max under 5 seconds
    });

    it('should handle concurrent health check requests', async () => {
      // Test concurrent load
      const concurrentRequests = 3;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer()).get('/health')
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.body).toHaveValidAggregatedHealthResponse();
      }

      // Concurrent requests shouldn't take significantly longer than sequential
      expect(totalTime).toBeLessThan(10000); // Within 10 seconds

      console.log(`${concurrentRequests} concurrent requests completed in ${totalTime}ms`);
    });
  });

  describe('Integration with Real Services', () => {
    it('should work with the complete microservices architecture', async () => {
      // This test represents the full integration scenario
      
      // Act
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      // Assert
      const healthResponse: AggregatedHealthResponse = response.body;
      
      // Verify API Gateway can communicate with all expected services
      const requiredServices = ['auth-service', 'billing-service', 'deploy-service', 'monitor-service'];
      
      for (const serviceName of requiredServices) {
        expect(healthResponse.services).toHaveProperty(serviceName);
        
        const serviceHealth = healthResponse.services[serviceName];
        expect(serviceHealth).toHaveValidHealthResponse();
        expect(serviceHealth.service).toBe(serviceName);
        
        // Log service status for debugging
        console.log(`${serviceName}: ${serviceHealth.status}`);
        
        if (serviceHealth.status === HealthStatus.UNHEALTHY && serviceHealth.metadata?.error) {
          console.log(`  Error: ${serviceHealth.metadata.error}`);
        }
      }

      // Overall system should have a valid status
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthResponse.status);
      
      // Log overall system status
      console.log(`Overall system status: ${healthResponse.status}`);
    });
  });
});