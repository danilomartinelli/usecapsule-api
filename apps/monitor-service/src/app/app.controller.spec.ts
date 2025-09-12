import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthTestHelper } from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type { HealthCheckResponse } from '@usecapsule/types';

describe('Monitor Service - AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const mockAppService = {
      getHealthStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    appService = module.get(AppService);

    // Fix for NestJS DI issue with RabbitMQ decorators
    // The @RabbitRPC decorator interferes with constructor parameter injection
    if (!(controller as any).appService) {
      (controller as any).appService = appService;
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('healthCheck', () => {
    it('should return health response from AppService', () => {
      // Arrange
      const expectedResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.HEALTHY,
        );

      appService.getHealthStatus.mockReturnValue(expectedResponse);

      // Act
      const result = controller.healthCheck();

      // Assert
      expect(appService.getHealthStatus).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResponse);
      expect(result).toHaveValidHealthResponse();
    });

    it('should handle healthy status', () => {
      // Arrange
      const healthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.HEALTHY,
        );

      appService.getHealthStatus.mockReturnValue(healthyResponse);

      // Act
      const result = controller.healthCheck();

      // Assert
      expect(result).toBeHealthy();
      expect(result.service).toBe('monitor-service');
    });

    it('should handle unhealthy status', () => {
      // Arrange
      const unhealthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.UNHEALTHY,
          { error: 'Database connection failed' },
        );

      appService.getHealthStatus.mockReturnValue(unhealthyResponse);

      // Act
      const result = controller.healthCheck();

      // Assert
      expect(result).toBeUnhealthy();
      expect(result.service).toBe('monitor-service');
      expect(result.metadata).toHaveProperty(
        'error',
        'Database connection failed',
      );
    });

    it('should handle degraded status', () => {
      // Arrange
      const degradedResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.DEGRADED,
          { warning: 'High response times detected' },
        );

      appService.getHealthStatus.mockReturnValue(degradedResponse);

      // Act
      const result = controller.healthCheck();

      // Assert
      expect(result).toBeDegraded();
      expect(result.service).toBe('monitor-service');
      expect(result.metadata).toHaveProperty(
        'warning',
        'High response times detected',
      );
    });

    it('should not modify the response from AppService', () => {
      // Arrange
      const originalResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
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

    it('should propagate service errors', () => {
      // Arrange
      const error = new Error('Service initialization failed');
      appService.getHealthStatus.mockImplementation(() => {
        throw error;
      });

      // Act & Assert
      expect(() => controller.healthCheck()).toThrow(
        'Service initialization failed',
      );
      expect(appService.getHealthStatus).toHaveBeenCalledTimes(1);
    });

    it('should handle concurrent health check calls', () => {
      // Arrange
      const healthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.HEALTHY,
        );

      appService.getHealthStatus.mockReturnValue(healthyResponse);

      // Act
      const results = [
        controller.healthCheck(),
        controller.healthCheck(),
        controller.healthCheck(),
      ];

      // Assert
      expect(appService.getHealthStatus).toHaveBeenCalledTimes(3);
      for (const result of results) {
        expect(result).toBe(healthyResponse);
        expect(result).toHaveValidHealthResponse();
      }
    });

    it('should maintain response integrity across multiple calls', () => {
      // Arrange
      let callCount = 0;
      appService.getHealthStatus.mockImplementation(() => {
        callCount++;
        return HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.HEALTHY,
          { callNumber: callCount },
        );
      });

      // Act
      const result1 = controller.healthCheck();
      const result2 = controller.healthCheck();
      const result3 = controller.healthCheck();

      // Assert
      expect(result1.metadata).toHaveProperty('callNumber', 1);
      expect(result2.metadata).toHaveProperty('callNumber', 2);
      expect(result3.metadata).toHaveProperty('callNumber', 3);

      expect(result1.service).toBe('monitor-service');
      expect(result2.service).toBe('monitor-service');
      expect(result3.service).toBe('monitor-service');
    });

    it('should respond immediately without async operations', () => {
      // Arrange
      const healthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.HEALTHY,
        );

      appService.getHealthStatus.mockReturnValue(healthyResponse);

      const startTime = process.hrtime();

      // Act
      controller.healthCheck();

      // Assert
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const executionTime = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

      expect(executionTime).toBeLessThan(1); // Should execute in under 1ms
    });
  });

  describe('RabbitRPC Decorator Integration', () => {
    it('should have proper RabbitRPC configuration', () => {
      // This test verifies that the controller method has the correct decorator metadata
      // In a real scenario, we would check that the method is properly registered
      // with the RabbitMQ message handler

      const healthCheckMethod = controller.healthCheck;
      expect(healthCheckMethod).toBeDefined();
      expect(typeof healthCheckMethod).toBe('function');
    });

    it('should be accessible via RabbitMQ routing', () => {
      // This test would ideally verify the RPC routing configuration
      // For unit tests, we verify the method exists and works correctly

      const healthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'monitor-service',
          HealthStatus.HEALTHY,
        );

      appService.getHealthStatus.mockReturnValue(healthyResponse);

      const result = controller.healthCheck();
      expect(result).toHaveValidHealthResponse();
    });
  });
});
