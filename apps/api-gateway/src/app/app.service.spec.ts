import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import {
  TimeoutAwareAmqpService,
  CircuitBreakerAwareAmqpService,
  CircuitBreakerHealthService,
  CircuitBreakerState,
} from '@usecapsule/rabbitmq';
import { HealthTestHelper } from '@usecapsule/testing';
import { HealthStatus } from '@usecapsule/types';
import type { HealthCheckResponse } from '@usecapsule/types';
import { ServiceName } from '@usecapsule/messaging';

// Cache-busting comment for fresh lint results

describe('AppService', () => {
  let service: AppService;
  let timeoutAwareAmqpService: jest.Mocked<TimeoutAwareAmqpService>;
  let circuitBreakerAmqpService: jest.Mocked<CircuitBreakerAwareAmqpService>;
  let circuitBreakerHealthService: jest.Mocked<CircuitBreakerHealthService>;

  beforeEach(async () => {
    const mockTimeoutAwareAmqpService = {
      getTimeoutDebugInfo: jest.fn(),
    };

    const mockCircuitBreakerAmqpService = {
      healthCheck: jest.fn(),
      getCircuitBreakerDebugInfo: jest.fn(),
    };

    const mockCircuitBreakerHealthService = {
      getAggregatedHealth: jest.fn(),
      getServiceHealth: jest.fn(),
      resetServiceCircuitBreakers: jest.fn(),
      getHealthRecommendations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: TimeoutAwareAmqpService,
          useValue: mockTimeoutAwareAmqpService,
        },
        {
          provide: CircuitBreakerAwareAmqpService,
          useValue: mockCircuitBreakerAmqpService,
        },
        {
          provide: CircuitBreakerHealthService,
          useValue: mockCircuitBreakerHealthService,
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    timeoutAwareAmqpService = module.get(TimeoutAwareAmqpService);
    circuitBreakerAmqpService = module.get(CircuitBreakerAwareAmqpService);
    circuitBreakerHealthService = module.get(CircuitBreakerHealthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkAllServicesHealth', () => {
    it('should return healthy status when all services respond with healthy', async () => {
      // Arrange
      const healthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'test-service',
          HealthStatus.HEALTHY,
        );

      const mockHealthCheckResult = {
        data: healthyResponse,
        circuitState: CircuitBreakerState.CLOSED,
        fromFallback: false,
        actualDuration: 100,
        timeout: 5000,
        timedOut: false,
      };

      circuitBreakerAmqpService.healthCheck.mockResolvedValue(
        mockHealthCheckResult,
      );
      circuitBreakerHealthService.getAggregatedHealth.mockReturnValue({
        summary: { open: 0, halfOpen: 0, closed: 4 },
        services: {},
      });
      circuitBreakerHealthService.getServiceHealth.mockReturnValue(null);

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(Object.keys(result.services)).toHaveLength(4);
      expect(result.services[ServiceName.AUTH]).toBeHealthy();
      expect(result.services[ServiceName.BILLING]).toBeHealthy();
      expect(result.services[ServiceName.DEPLOY]).toBeHealthy();
      expect(result.services[ServiceName.MONITOR]).toBeHealthy();
    });

    it('should return degraded status when circuit breaker is open', async () => {
      // Arrange
      const healthyResponse: HealthCheckResponse =
        HealthTestHelper.createHealthResponse(
          'test-service',
          HealthStatus.HEALTHY,
        );

      const mockHealthCheckResult = {
        data: healthyResponse,
        circuitState: CircuitBreakerState.OPEN,
        fromFallback: true,
        actualDuration: 100,
        timeout: 5000,
        timedOut: false,
      };

      circuitBreakerAmqpService.healthCheck.mockResolvedValue(
        mockHealthCheckResult,
      );
      circuitBreakerHealthService.getAggregatedHealth.mockReturnValue({
        summary: { open: 1, halfOpen: 0, closed: 3 },
        services: {},
      });
      circuitBreakerHealthService.getServiceHealth.mockReturnValue(null);

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.DEGRADED);
    });

    it('should handle service health check errors gracefully', async () => {
      // Arrange
      const error = new Error('Service unreachable');
      circuitBreakerAmqpService.healthCheck.mockRejectedValue(error);
      circuitBreakerHealthService.getAggregatedHealth.mockReturnValue({
        summary: { open: 0, halfOpen: 0, closed: 4 },
        services: {},
      });
      circuitBreakerHealthService.getServiceHealth.mockReturnValue(null);

      // Act
      const result = await service.checkAllServicesHealth();

      // Assert
      expect(result).toHaveValidAggregatedHealthResponse();
      expect(result.status).toBe(HealthStatus.UNHEALTHY);
    });
  });

  describe('getTimeoutDebugInfo', () => {
    it('should return timeout debug info from amqp service', () => {
      // Arrange
      const mockDebugInfo = { timeout: 5000 };
      timeoutAwareAmqpService.getTimeoutDebugInfo.mockReturnValue(
        mockDebugInfo,
      );

      // Act
      const result = service.getTimeoutDebugInfo();

      // Assert
      expect(result).toBe(mockDebugInfo);
      expect(timeoutAwareAmqpService.getTimeoutDebugInfo).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe('getCircuitBreakerDebugInfo', () => {
    it('should return circuit breaker debug info from circuit breaker service', () => {
      // Arrange
      const mockDebugInfo = { state: 'CLOSED' };
      circuitBreakerAmqpService.getCircuitBreakerDebugInfo.mockReturnValue(
        mockDebugInfo,
      );

      // Act
      const result = service.getCircuitBreakerDebugInfo();

      // Assert
      expect(result).toBe(mockDebugInfo);
      expect(
        circuitBreakerAmqpService.getCircuitBreakerDebugInfo,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCircuitBreakerHealth', () => {
    it('should return aggregated circuit breaker health', () => {
      // Arrange
      const mockHealth = {
        summary: { open: 0, halfOpen: 0, closed: 4 },
        services: {},
      };
      circuitBreakerHealthService.getAggregatedHealth.mockReturnValue(
        mockHealth,
      );

      // Act
      const result = service.getCircuitBreakerHealth();

      // Assert
      expect(result).toBe(mockHealth);
      expect(
        circuitBreakerHealthService.getAggregatedHealth,
      ).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetServiceCircuitBreaker', () => {
    it('should successfully reset circuit breakers for a service', () => {
      // Arrange
      const serviceName = 'auth-service';
      circuitBreakerHealthService.resetServiceCircuitBreakers.mockReturnValue(
        2,
      );

      // Act
      const result = service.resetServiceCircuitBreaker(serviceName);

      // Assert
      expect(result).toEqual({
        success: true,
        message: 'Successfully reset 2 circuit breaker(s) for auth-service',
      });
      expect(
        circuitBreakerHealthService.resetServiceCircuitBreakers,
      ).toHaveBeenCalledWith(serviceName);
    });

    it('should handle reset failures gracefully', () => {
      // Arrange
      const serviceName = 'auth-service';
      const error = new Error('Reset failed');
      circuitBreakerHealthService.resetServiceCircuitBreakers.mockImplementation(
        () => {
          throw error;
        },
      );

      // Act
      const result = service.resetServiceCircuitBreaker(serviceName);

      // Assert
      expect(result).toEqual({
        success: false,
        message:
          'Failed to reset circuit breakers for auth-service: Reset failed',
      });
    });
  });

  describe('getHealthRecommendations', () => {
    it('should return health recommendations from circuit breaker health service', () => {
      // Arrange
      const mockRecommendations = ['Recommendation 1', 'Recommendation 2'];
      circuitBreakerHealthService.getHealthRecommendations.mockReturnValue(
        mockRecommendations,
      );

      // Act
      const result = service.getHealthRecommendations();

      // Assert
      expect(result).toBe(mockRecommendations);
      expect(
        circuitBreakerHealthService.getHealthRecommendations,
      ).toHaveBeenCalledTimes(1);
    });
  });
});
