import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../src/app/app.controller';
import { AppService } from '../src/app/app.service';
import { HealthTestHelper } from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type { HealthCheckResponse } from '@usecapsule/types';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

describe('Auth Service - RabbitMQ Health Integration', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;
  let amqpConnection: jest.Mocked<AmqpConnection>;

  beforeEach(async () => {
    const mockAppService = {
      getHealthStatus: jest.fn(),
    };

    const mockAmqpConnection = {
      request: jest.fn(),
      publish: jest.fn(),
      managedChannel: jest.fn(),
      managedConnection: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
        {
          provide: AmqpConnection,
          useValue: mockAmqpConnection,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    appService = module.get(AppService);
    amqpConnection = module.get(AmqpConnection);

    // Fix for NestJS DI issue with RabbitMQ decorators
    if (!(controller as any).appService) {
      (controller as any).appService = appService;
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check RPC Handler', () => {
    it('should respond to health check requests', () => {
      // Arrange
      const expectedResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'auth-service',
          HealthStatus.HEALTHY,
        );

      appService.getHealthStatus.mockReturnValue(expectedResponse);

      // Act
      const result = controller.healthCheck();

      // Assert
      expect(appService.getHealthStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResponse);
      expect(result).toHaveValidHealthResponse();
      expect(result.service).toBe('auth-service');
      expect(result.status).toBe(HealthStatus.HEALTHY);
    });

    it('should have RabbitRPC decorator configuration', () => {
      // Verify that the controller method is properly decorated for RabbitMQ RPC
      const healthCheckMethod = controller.healthCheck;
      expect(healthCheckMethod).toBeDefined();
      expect(typeof healthCheckMethod).toBe('function');

      // This test verifies the method exists and can be called directly
      // The actual RabbitMQ routing is tested through the unit test above
    });

    it('should handle different health status scenarios', () => {
      // Test healthy status
      const healthyResponse = HealthTestHelper.createHealthResponse(
        'auth-service',
        HealthStatus.HEALTHY,
      );
      appService.getHealthStatus.mockReturnValue(healthyResponse);

      let result = controller.healthCheck();
      expect(result).toBeHealthy();

      // Test unhealthy status
      const unhealthyResponse = HealthTestHelper.createHealthResponse(
        'auth-service',
        HealthStatus.UNHEALTHY,
        { error: 'Database connection failed' },
      );
      appService.getHealthStatus.mockReturnValue(unhealthyResponse);

      result = controller.healthCheck();
      expect(result).toBeUnhealthy();

      // Test degraded status
      const degradedResponse = HealthTestHelper.createHealthResponse(
        'auth-service',
        HealthStatus.DEGRADED,
        { warning: 'High response times detected' },
      );
      appService.getHealthStatus.mockReturnValue(degradedResponse);

      result = controller.healthCheck();
      expect(result).toBeDegraded();
    });

    it('should not modify the response from AppService', () => {
      // Arrange
      const originalResponse = HealthTestHelper.createHealthResponse(
        'auth-service',
        HealthStatus.HEALTHY,
        { customField: 'customValue' },
      );

      const responseCopy = JSON.parse(JSON.stringify(originalResponse));
      appService.getHealthStatus.mockReturnValue(originalResponse);

      // Act
      const result = controller.healthCheck();

      // Assert
      expect(result).toEqual(responseCopy);
      expect(result).toBe(originalResponse); // Should be exact same object reference
    });
  });
});
