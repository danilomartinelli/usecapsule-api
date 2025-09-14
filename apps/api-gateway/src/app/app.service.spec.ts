import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { AmqpConnection } from '@usecapsule/rabbitmq';
import {
  HealthTestHelper,
  HEALTH_TEST_SCENARIOS,
  createAmqpConnectionMock,
  AmqpConnectionMockHelper,
} from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type {
  AggregatedHealthResponse,
  HealthCheckResponse,
} from '@usecapsule/types';
import {
  AUTH_ROUTING_KEYS,
  BILLING_ROUTING_KEYS,
  DEPLOY_ROUTING_KEYS,
  MONITOR_ROUTING_KEYS,
} from '@usecapsule/messaging';

describe('AppService', () => {
  let service: AppService;
  let amqpConnection: jest.Mocked<AmqpConnection>;
  let mockHelper: AmqpConnectionMockHelper;

  beforeEach(async () => {
    const mockAmqpConnection = createAmqpConnectionMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    amqpConnection = module.get(AmqpConnection);
    mockHelper = new AmqpConnectionMockHelper(amqpConnection);
  });

  afterEach(() => {
    mockHelper.clearMocks();
  });

  describe('checkAllServicesHealth', () => {
    it('should return healthy status when all services respond with healthy', async () => {
      // Arrange
      const healthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'test-service',
          HealthStatus.HEALTHY,
        );

      amqpConnection.request.mockResolvedValue(healthyResponse);

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(Object.keys(result.services)).toHaveLength(4);
      expect(result.services['auth-service']).toBeHealthy();
      expect(result.services['billing-service']).toBeHealthy();
      expect(result.services['deploy-service']).toBeHealthy();
      expect(result.services['monitor-service']).toBeHealthy();
    });

    it('should return degraded status when one service is unhealthy', async () => {
      // Arrange - billing service fails, others succeed
      amqpConnection.request
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'auth-service',
            HealthStatus.HEALTHY,
          ),
        )
        .mockRejectedValueOnce(new Error('Service unreachable'))
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'deploy-service',
            HealthStatus.HEALTHY,
          ),
        )
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'monitor-service',
            HealthStatus.HEALTHY,
          ),
        );

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.services['auth-service']).toBeHealthy();
      expect(result.services['billing-service']).toBeUnhealthy();
      expect(result.services['deploy-service']).toBeHealthy();
      expect(result.services['monitor-service']).toBeHealthy();
    });

    it('should return unhealthy status when majority of services fail', async () => {
      // Arrange - 3 services fail, 1 succeeds
      amqpConnection.request
        .mockRejectedValueOnce(new Error('Auth service down'))
        .mockRejectedValueOnce(new Error('Billing service down'))
        .mockRejectedValueOnce(new Error('Deploy service down'))
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'monitor-service',
            HealthStatus.HEALTHY,
          ),
        );

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result.services['auth-service']).toBeUnhealthy();
      expect(result.services['billing-service']).toBeUnhealthy();
      expect(result.services['deploy-service']).toBeUnhealthy();
      expect(result.services['monitor-service']).toBeHealthy();
    });

    it('should handle service timeouts with proper error metadata', async () => {
      // Arrange
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';

      amqpConnection.request
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'auth-service',
            HealthStatus.HEALTHY,
          ),
        )
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'deploy-service',
            HealthStatus.HEALTHY,
          ),
        )
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'monitor-service',
            HealthStatus.HEALTHY,
          ),
        );

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.DEGRADED);

      const billingHealth = result.services['billing-service'];
      expect(billingHealth).toBeUnhealthy();
      expect(billingHealth.metadata).toMatchObject({
        error: 'Request timeout',
        exchange: 'capsule.commands',
        routingKey: BILLING_ROUTING_KEYS.HEALTH,
      });
    });

    it('should make requests to correct routing keys', async () => {
      // Arrange
      const healthyResponse = HealthTestHelper.createHealthResponse(
        'service',
        HealthStatus.HEALTHY,
      );
      amqpConnection.request.mockResolvedValue(healthyResponse);

      // Act
      await service.checkAllServicesHealth();

      // Assert
      expect(amqpConnection.request).toHaveBeenCalledTimes(4);
      expect(amqpConnection.request).toHaveBeenCalledWith({
        exchange: 'capsule.commands',
        routingKey: AUTH_ROUTING_KEYS.HEALTH,
        payload: {},
        timeout: 5000,
      });
      expect(amqpConnection.request).toHaveBeenCalledWith({
        exchange: 'capsule.commands',
        routingKey: BILLING_ROUTING_KEYS.HEALTH,
        payload: {},
        timeout: 5000,
      });
      expect(amqpConnection.request).toHaveBeenCalledWith({
        exchange: 'capsule.commands',
        routingKey: DEPLOY_ROUTING_KEYS.HEALTH,
        payload: {},
        timeout: 5000,
      });
      expect(amqpConnection.request).toHaveBeenCalledWith({
        exchange: 'capsule.commands',
        routingKey: MONITOR_ROUTING_KEYS.HEALTH,
        payload: {},
        timeout: 5000,
      });
    });

    it('should handle mixed response statuses correctly', async () => {
      // Arrange
      amqpConnection.request
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'auth-service',
            HealthStatus.HEALTHY,
          ),
        )
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'billing-service',
            HealthStatus.DEGRADED,
          ),
        )
        .mockRejectedValueOnce(new Error('Deploy service error'))
        .mockResolvedValueOnce(
          HealthTestHelper.createHealthResponse(
            'monitor-service',
            HealthStatus.HEALTHY,
          ),
        );

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result.services['auth-service']).toBeHealthy();
      expect(result.services['billing-service']).toBeDegraded();
      expect(result.services['deploy-service']).toBeUnhealthy();
      expect(result.services['monitor-service']).toBeHealthy();
    });

    it('should include valid timestamps for all responses', async () => {
      // Arrange
      const startTime = Date.now();
      const healthyResponse = HealthTestHelper.createHealthResponse(
        'service',
        HealthStatus.HEALTHY,
      );
      amqpConnection.request.mockResolvedValue(healthyResponse);

      // Act
      const result = await service.checkAllServicesHealth();
      const endTime = Date.now();

      // Assert
      const responseTime = new Date(result.timestamp).getTime();
      expect(responseTime).toBeGreaterThanOrEqual(startTime);
      expect(responseTime).toBeLessThanOrEqual(endTime);

      for (const serviceHealth of Object.values(result.services)) {
        const serviceTime = new Date(serviceHealth.timestamp).getTime();
        expect(serviceTime).toBeGreaterThanOrEqual(startTime);
        expect(serviceTime).toBeLessThanOrEqual(endTime);
      }
    });

    it('should process all health check scenarios correctly', async () => {
      // Test each predefined scenario
      for (const scenario of HEALTH_TEST_SCENARIOS) {
        // Reset mocks
        amqpConnection.request.mockClear();

        // Setup mock responses based on scenario
        const services = [
          'auth-service',
          'billing-service',
          'deploy-service',
          'monitor-service',
        ];

        services.forEach((serviceName, index) => {
          const status = scenario.services[serviceName];
          if (
            status === HealthStatus.HEALTHY ||
            status === HealthStatus.DEGRADED
          ) {
            amqpConnection.request.mockResolvedValueOnce(
              HealthTestHelper.createHealthResponse(serviceName, status),
            );
          } else {
            amqpConnection.request.mockRejectedValueOnce(
              new Error('Service unreachable'),
            );
          }
        });

        // Act
        const result = await service.checkAllServicesHealth();

        // Assert
        expect(result.status).toBe(scenario.expectedOverallStatus);
        expect(result).toHaveValidAggregatedHealthResponse();

        // Verify individual service statuses
        for (const [serviceName, expectedStatus] of Object.entries(
          scenario.services,
        )) {
          const serviceResult = result.services[serviceName];
          expect(serviceResult.status).toBe(expectedStatus);
        }
      }
    });

    it('should handle concurrent health checks properly', async () => {
      // Arrange
      const healthyResponse = HealthTestHelper.createHealthResponse(
        'service',
        HealthStatus.HEALTHY,
      );
      amqpConnection.request.mockResolvedValue(healthyResponse);

      // Act - make multiple concurrent calls
      const promises = [
        service.checkAllServicesHealth(),
        service.checkAllServicesHealth(),
        service.checkAllServicesHealth(),
      ];

      const results = await Promise.all(promises);

      // Assert - all should succeed
      for (const result of results) {
        expect(result).toHaveValidAggregatedHealthResponse();
        expect(result.status).toBe(HealthStatus.HEALTHY);
      }

      // Should have made 12 total requests (3 calls × 4 services)
      expect(amqpConnection.request).toHaveBeenCalledTimes(12);
    });
  });
});
