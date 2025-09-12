import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthTestHelper } from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type { AggregatedHealthResponse } from '@usecapsule/types';

describe('AppController', () => {
  let controller: AppController;
  let appService: jest.Mocked<AppService>;

  beforeEach(async () => {
    const mockAppService = {
      checkAllServicesHealth: jest.fn(),
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkHealth', () => {
    it('should return aggregated health status from AppService', async () => {
      // Arrange
      const expectedResponse: AggregatedHealthResponse = HealthTestHelper.createAggregatedResponse({
        'auth-service': HealthStatus.HEALTHY,
        'billing-service': HealthStatus.HEALTHY,
        'deploy-service': HealthStatus.HEALTHY,
        'monitor-service': HealthStatus.HEALTHY,
      });

      appService.checkAllServicesHealth.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.checkHealth();

      // Assert
      expect(appService.checkAllServicesHealth).toHaveBeenCalledTimes(1);
      expect(result).toBe(expectedResponse);
      expect(result).toHaveValidAggregatedHealthResponse();
    });

    it('should handle degraded health status', async () => {
      // Arrange
      const expectedResponse: AggregatedHealthResponse = HealthTestHelper.createAggregatedResponse({
        'auth-service': HealthStatus.HEALTHY,
        'billing-service': HealthStatus.UNHEALTHY,
        'deploy-service': HealthStatus.HEALTHY,
        'monitor-service': HealthStatus.HEALTHY,
      }, HealthStatus.DEGRADED);

      appService.checkAllServicesHealth.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.checkHealth();

      // Assert
      expect(result.status).toBe(HealthStatus.DEGRADED);
      expect(result).toHaveValidAggregatedHealthResponse();
    });

    it('should handle unhealthy status', async () => {
      // Arrange
      const expectedResponse: AggregatedHealthResponse = HealthTestHelper.createAggregatedResponse({
        'auth-service': HealthStatus.UNHEALTHY,
        'billing-service': HealthStatus.UNHEALTHY,
        'deploy-service': HealthStatus.UNHEALTHY,
        'monitor-service': HealthStatus.HEALTHY,
      }, HealthStatus.UNHEALTHY);

      appService.checkAllServicesHealth.mockResolvedValue(expectedResponse);

      // Act
      const result = await controller.checkHealth();

      // Assert
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
      expect(result).toHaveValidAggregatedHealthResponse();
    });

    it('should propagate service errors', async () => {
      // Arrange
      const error = new Error('Service unavailable');
      appService.checkAllServicesHealth.mockRejectedValue(error);

      // Act & Assert
      await expect(controller.checkHealth()).rejects.toThrow('Service unavailable');
      expect(appService.checkAllServicesHealth).toHaveBeenCalledTimes(1);
    });

    it('should not modify the response from AppService', async () => {
      // Arrange
      const originalResponse: AggregatedHealthResponse = HealthTestHelper.createAggregatedResponse({
        'auth-service': HealthStatus.HEALTHY,
        'billing-service': HealthStatus.DEGRADED,
        'deploy-service': HealthStatus.HEALTHY,
        'monitor-service': HealthStatus.HEALTHY,
      });

      const responseCopy = JSON.parse(JSON.stringify(originalResponse));
      appService.checkAllServicesHealth.mockResolvedValue(originalResponse);

      // Act
      const result = await controller.checkHealth();

      // Assert
      expect(result).toEqual(responseCopy);
      expect(result).toBe(originalResponse); // Should be exact same object reference
    });
  });

  describe('healthReady', () => {
    it('should return ready status with timestamp', () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const result = controller.healthReady();

      // Assert
      const endTime = Date.now();

      expect(result).toEqual({
        status: 'ready',
        timestamp: expect.any(String),
      });

      const timestamp = new Date(result.timestamp).getTime();
      expect(timestamp).toBeGreaterThanOrEqual(startTime);
      expect(timestamp).toBeLessThanOrEqual(endTime);
    });

    it('should return ready status immediately without external dependencies', () => {
      // Arrange
      const startTime = process.hrtime();

      // Act
      const result = controller.healthReady();

      // Assert
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const executionTime = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

      expect(result.status).toBe('ready');
      expect(executionTime).toBeLessThan(1); // Should execute in under 1ms
      expect(appService.checkAllServicesHealth).not.toHaveBeenCalled();
    });

    it('should return valid ISO timestamp format', () => {
      // Act
      const result = controller.healthReady();

      // Assert
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
      expect(isNaN(new Date(result.timestamp).getTime())).toBe(false);
    });

    it('should return consistent structure on multiple calls', () => {
      // Act
      const results = [
        controller.healthReady(),
        controller.healthReady(),
        controller.healthReady(),
      ];

      // Assert
      for (const result of results) {
        expect(result).toHaveProperty('status', 'ready');
        expect(result).toHaveProperty('timestamp');
        expect(typeof result.timestamp).toBe('string');
      }

      // Timestamps should be different (or very close)
      const timestamps = results.map(r => new Date(r.timestamp).getTime());
      expect(timestamps[0]).toBeLessThanOrEqual(timestamps[1]);
      expect(timestamps[1]).toBeLessThanOrEqual(timestamps[2]);
    });
  });
});