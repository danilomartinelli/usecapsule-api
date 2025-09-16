import { Injectable } from '@nestjs/common';
import type { HealthCheckResponse } from '@usecapsule/types';
import { HealthStatus } from '@usecapsule/types';

@Injectable()
export class AppService {
  getHealthStatus(): HealthCheckResponse {
    return {
      status: HealthStatus.HEALTHY,
      service: 'monitor-service',
      timestamp: new Date().toISOString(),
      metadata: {
        version: '1.0.0',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    };
  }
}
