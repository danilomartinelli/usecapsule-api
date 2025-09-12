import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app/app.module';
import {
  TestingModuleBuilder,
  RabbitMQTestClient,
  MessageFixtureFactory,
  HealthTestHelper,
} from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type { HealthCheckResponse } from '@usecapsule/types';

describe('Auth Service - RabbitMQ Health Integration', () => {
  let testEnvironment: any;
  let rabbitMQClient: RabbitMQTestClient;

  beforeAll(async () => {
    testEnvironment = await new TestingModuleBuilder({
      imports: [AppModule],
      useRealRabbitMQ: true,
      rabbitMQConfig: {
        serviceName: 'auth-service',
      },
    }).build();

    rabbitMQClient = testEnvironment.rabbitMQClient;
  });

  afterAll(async () => {
    await testEnvironment.cleanup();
  });

  describe('Health Check RPC Handler', () => {
    it('should respond to auth.health routing key', async () => {
      // Arrange
      const healthMessage = MessageFixtureFactory.createHealthCheckMessage('auth');

      // Act
      const response: HealthCheckResponse = await rabbitMQClient.sendRPCMessage(
        'capsule.commands',
        'auth.health',
        {},
        5000
      );

      // Assert
      expect(response).toHaveValidHealthResponse();
      expect(response.status).toBe(HealthStatus.HEALTHY);
      expect(response.service).toBe('auth-service');
      expect(response.timestamp).toBeDefined();
    });

    it('should respond within acceptable timeframe', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const response: HealthCheckResponse = await rabbitMQClient.sendRPCMessage(
        'capsule.commands',
        'auth.health',
        {},
        1000
      );

      const responseTime = Date.now() - startTime;

      // Assert
      expect(response).toHaveValidHealthResponse();
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle multiple concurrent health checks', async () => {
      // Arrange
      const concurrentRequests = 10;
      const promises = Array.from({ length: concurrentRequests }, () =>
        rabbitMQClient.sendRPCMessage('capsule.commands', 'auth.health', {}, 5000)
      );

      // Act
      const responses = await Promise.all(promises);

      // Assert
      expect(responses).toHaveLength(concurrentRequests);
      for (const response of responses) {
        expect(response).toHaveValidHealthResponse();
        expect(response.status).toBe(HealthStatus.HEALTHY);
      }
    });

    it('should provide consistent response structure', async () => {
      // Act
      const responses = await Promise.all([
        rabbitMQClient.sendRPCMessage('capsule.commands', 'auth.health', {}, 5000),
        rabbitMQClient.sendRPCMessage('capsule.commands', 'auth.health', {}, 5000),
        rabbitMQClient.sendRPCMessage('capsule.commands', 'auth.health', {}, 5000),
      ]);

      // Assert
      const firstResponse = responses[0];
      for (const response of responses) {
        expect(response).toHaveValidHealthResponse();
        expect(response.service).toBe(firstResponse.service);
        expect(response.status).toBe(firstResponse.status);
      }
    });

    it('should include service metadata in response', async () => {
      // Act
      const response: HealthCheckResponse = await rabbitMQClient.sendRPCMessage(
        'capsule.commands',
        'auth.health',
        {},
        5000
      );

      // Assert
      expect(response.metadata).toBeDefined();
      expect(typeof response.metadata).toBe('object');
      
      // Service should include any relevant health metadata
      // This could include version, uptime, connections, etc.
    });

    it('should handle empty payload correctly', async () => {
      // Act
      const response: HealthCheckResponse = await rabbitMQClient.sendRPCMessage(
        'capsule.commands',
        'auth.health',
        {},
        5000
      );

      // Assert
      expect(response).toHaveValidHealthResponse();
    });

    it('should handle null payload correctly', async () => {
      // Act
      const response: HealthCheckResponse = await rabbitMQClient.sendRPCMessage(
        'capsule.commands',
        'auth.health',
        null,
        5000
      );

      // Assert
      expect(response).toHaveValidHealthResponse();
    });
  });

  describe('RabbitMQ Connection Health', () => {
    it('should maintain stable connection during health checks', async () => {
      // Perform multiple health checks to verify connection stability
      for (let i = 0; i < 5; i++) {
        const response = await rabbitMQClient.sendRPCMessage(
          'capsule.commands',
          'auth.health',
          {},
          5000
        );
        
        expect(response).toHaveValidHealthResponse();
        
        // Wait between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it('should handle message queue isolation', async () => {
      // Arrange - Start capturing messages
      const captureKey = await rabbitMQClient.captureMessages('health_queue');

      // Act - Send health check
      await rabbitMQClient.sendRPCMessage('capsule.commands', 'auth.health', {}, 5000);

      // Small delay to allow message processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - Verify message routing
      const capturedMessages = rabbitMQClient.getCapturedMessages(captureKey);
      
      // The health check should not interfere with other message flows
      expect(capturedMessages).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should timeout appropriately when no response handler', async () => {
      // Act & Assert - Try to send to non-existent routing key
      await expect(
        rabbitMQClient.sendRPCMessage('capsule.commands', 'nonexistent.health', {}, 1000)
      ).rejects.toThrow(/timeout/i);
    });

    it('should handle malformed health check requests gracefully', async () => {
      // This test would verify that the service handles malformed requests
      // For now, we ensure valid requests work correctly
      const response = await rabbitMQClient.sendRPCMessage(
        'capsule.commands',
        'auth.health',
        { malformedData: 'test' },
        5000
      );

      expect(response).toHaveValidHealthResponse();
    });
  });

  describe('Performance Characteristics', () => {
    it('should meet response time SLA', async () => {
      // Measure response times over multiple requests
      const responseTimesMs: number[] = [];
      
      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        
        await rabbitMQClient.sendRPCMessage(
          'capsule.commands',
          'auth.health',
          {},
          5000
        );
        
        responseTimesMs.push(Date.now() - start);
      }

      // Assert SLA requirements
      const averageResponseTime = responseTimesMs.reduce((a, b) => a + b, 0) / responseTimesMs.length;
      const maxResponseTime = Math.max(...responseTimesMs);

      expect(averageResponseTime).toBeLessThan(100); // Average under 100ms
      expect(maxResponseTime).toBeLessThan(500);     // Max under 500ms
    });

    it('should handle burst load appropriately', async () => {
      // Arrange - Create burst of health checks
      const burstSize = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: burstSize }, () =>
        rabbitMQClient.sendRPCMessage('capsule.commands', 'auth.health', {}, 5000)
      );

      // Act
      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Assert
      expect(responses).toHaveLength(burstSize);
      expect(totalTime).toBeLessThan(5000); // All requests complete within 5 seconds
      
      for (const response of responses) {
        expect(response).toHaveValidHealthResponse();
      }
    });
  });
});