import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { HealthStatus } from '@usecapsule/types';
import type { HealthCheckResponse } from '@usecapsule/types';

describe('Monitor Service - AppService', () => {
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
      expect(result.status).toBe(HealthStatus.HEALTHY);
      expect(result.service).toBe('monitor-service');
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('should include memory usage metadata', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      expect(result.metadata).toBeDefined();
      expect(result.metadata).toHaveProperty('memory');
      expect(result.metadata.memory).toHaveProperty('used');
      expect(result.metadata.memory).toHaveProperty('total');
      expect(result.metadata.memory).toHaveProperty('unit', 'MB');
      expect(typeof result.metadata.memory.used).toBe('number');
      expect(typeof result.metadata.memory.total).toBe('number');
    });

    it('should include version information', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      expect(result.metadata).toHaveProperty('version', '1.0.0');
    });

    it('should have consistent timestamps on subsequent calls', () => {
      // Act
      const result1 = service.getHealthStatus();
      const result2 = service.getHealthStatus();

      // Assert
      const time1 = new Date(result1.timestamp).getTime();
      const time2 = new Date(result2.timestamp).getTime();

      expect(time2).toBeGreaterThanOrEqual(time1);
      expect(time2 - time1).toBeLessThan(100); // Should be within 100ms
    });

    it('should return valid health response structure', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      expect(result).toHaveValidHealthResponse();
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('service');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metadata');
    });

    it('should handle memory calculations correctly', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      const memoryMetadata = result.metadata.memory;
      expect(memoryMetadata.used).toBeGreaterThan(0);
      expect(memoryMetadata.total).toBeGreaterThan(0);
      expect(memoryMetadata.used).toBeLessThanOrEqual(memoryMetadata.total);
    });

    it('should be deterministic for service name', () => {
      // Act
      const results = [
        service.getHealthStatus(),
        service.getHealthStatus(),
        service.getHealthStatus(),
      ];

      // Assert
      for (const result of results) {
        expect(result.service).toBe('monitor-service');
        expect(result.status).toBe(HealthStatus.HEALTHY);
        expect(result.metadata.version).toBe('1.0.0');
      }
    });

    it('should have recent timestamps', () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const result = service.getHealthStatus();

      // Assert
      const endTime = Date.now();
      const resultTime = new Date(result.timestamp).getTime();

      expect(resultTime).toBeGreaterThanOrEqual(startTime);
      expect(resultTime).toBeLessThanOrEqual(endTime);
    });

    it('should maintain consistent metadata structure', () => {
      // Act
      const result = service.getHealthStatus();

      // Assert
      expect(result.metadata).toMatchObject({
        version: expect.any(String),
        memory: {
          used: expect.any(Number),
          total: expect.any(Number),
          unit: 'MB',
        },
      });
    });

    it('should execute quickly', () => {
      // Arrange
      const startTime = process.hrtime();

      // Act
      service.getHealthStatus();

      // Assert
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const executionTime = seconds * 1000 + nanoseconds / 1000000;

      expect(executionTime).toBeLessThan(1); // Should execute in under 1ms
    });

    it('should handle multiple rapid calls', () => {
      // Act
      const results = Array.from({ length: 100 }, () =>
        service.getHealthStatus(),
      );

      // Assert
      for (const result of results) {
        expect(result).toHaveValidHealthResponse();
        expect(result.service).toBe('monitor-service');
        expect(result.status).toBe(HealthStatus.HEALTHY);
      }

      // Verify timestamps are in ascending order (or very close)
      const timestamps = results.map((r) => new Date(r.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });
});
