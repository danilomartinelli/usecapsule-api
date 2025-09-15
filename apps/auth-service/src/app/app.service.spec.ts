import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { HealthStatus } from '@usecapsule/types';

describe('Auth Service - AppService', () => {
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    service = module.get<AppService>(AppService);
  });

  describe('getHealthStatus', () => {
    it('should return healthy status by default', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      expect(result).toHaveValidHealthResponse();
      expect(result).toBeHealthy();
      expect(result.service).toBe('auth-service');
      expect(result.timestamp).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should return consistent health response structure', () => {
      // Act
      const result1 = service.getHealthStatus();
      const result2 = service.getHealthStatus();

      // Assert
      expect(result1.service).toBe(result2.service);
      expect(result1.status).toBe(result2.status);
      expect(result1).toHaveValidHealthResponse();
      expect(result2).toHaveValidHealthResponse();
    });

    it('should include valid timestamp', () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const result = service.getHealthStatus();

      // Assert
      const endTime = Date.now();
      const timestamp = new Date(result.timestamp).getTime();

      expect(timestamp).toBeGreaterThanOrEqual(startTime);
      expect(timestamp).toBeLessThanOrEqual(endTime);
    });

    it('should include metadata object', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata).toBe('object');
      expect(result.metadata).not.toBeNull();
    });

    it('should respond quickly', () => {
      // Arrange
      const startTime = process.hrtime();

      // Act
      service.getHealthStatus();

      // Assert
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const executionTime = seconds * 1000 + nanoseconds / 1000000; // Convert to milliseconds

      expect(executionTime).toBeLessThan(1); // Should execute in under 1ms
    });

    it('should be thread-safe for concurrent calls', () => {
      // Act
      const results = Array.from({ length: 100 }, () =>
        service.getHealthStatus(),
      );

      // Assert
      for (const result of results) {
        expect(result).toHaveValidHealthResponse();
        expect(result.service).toBe('auth-service');
        expect(result.status).toBe(HealthStatus.HEALTHY);
      }
    });

    it('should maintain service identity', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      expect(result.service).toBe('auth-service');
      expect(result.service).not.toBe('billing-service');
      expect(result.service).not.toBe('deploy-service');
      expect(result.service).not.toBe('monitor-service');
    });
  });
});
