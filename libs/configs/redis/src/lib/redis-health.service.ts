import { Injectable, Logger, Inject } from '@nestjs/common';
import type { Redis, Cluster } from 'ioredis';

import { testRedisConnection, getRedisInfo } from './redis-client.factory';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Health check status enumeration
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

/**
 * Health check response interface
 */
export interface HealthCheckResponse {
  /** Health status */
  status: HealthStatus;
  /** Service name */
  service: string;
  /** Timestamp of the health check */
  timestamp: string;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Additional details */
  details?: {
    /** Redis server version */
    version?: string;
    /** Connection mode (standalone, cluster, sentinel) */
    mode?: string;
    /** Number of connected clients */
    connectedClients?: number;
    /** Memory usage information */
    memory?: {
      used: number;
      usedHuman: string;
      peak: number;
      total?: number;
    };
    /** Cache hit ratio */
    hitRatio?: number;
    /** Last successful ping timestamp */
    lastPing?: string;
    /** Error message if unhealthy */
    error?: string;
  };
  /** Performance metrics */
  metrics?: {
    /** Commands processed per second */
    opsPerSecond?: number;
    /** Keyspace hits */
    keyspaceHits?: number;
    /** Keyspace misses */
    keyspaceMisses?: number;
    /** Total system memory */
    totalSystemMemory?: number;
  };
}

/**
 * Redis health check service providing comprehensive health monitoring.
 *
 * This service provides health check functionality for Redis instances,
 * including connection testing, performance metrics, and detailed status reporting.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class AppHealthService {
 *   constructor(private readonly redisHealthService: RedisHealthService) {}
 *
 *   async getHealth(): Promise<any> {
 *     const redisHealth = await this.redisHealthService.check();
 *     return {
 *       redis: redisHealth,
 *       // other health checks...
 *     };
 *   }
 * }
 * ```
 */
@Injectable()
export class RedisHealthService {
  private readonly logger = new Logger(RedisHealthService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis | Cluster,
  ) {}

  /**
   * Performs a basic health check on the Redis connection.
   *
   * @param timeout - Health check timeout in milliseconds
   * @returns Promise that resolves to health check response
   */
  async check(timeout = 5000): Promise<HealthCheckResponse> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      // Test connection
      const connectionResult = await testRedisConnection(
        this.redisClient,
        timeout,
      );

      if (!connectionResult.connected) {
        return {
          status: HealthStatus.UNHEALTHY,
          service: 'redis',
          timestamp,
          details: {
            error: connectionResult.error?.message || 'Connection failed',
          },
        };
      }

      // Get server information
      const serverInfo = await getRedisInfo(this.redisClient);

      const responseTime = Date.now() - startTime;

      // Determine health status based on metrics
      const status = this.determineHealthStatus(serverInfo, responseTime);

      return {
        status,
        service: 'redis',
        timestamp,
        responseTime,
        details: {
          version: serverInfo.version,
          mode: serverInfo.mode,
          connectedClients: serverInfo.connectedClients,
          memory: {
            used: serverInfo.usedMemory,
            usedHuman: serverInfo.usedMemoryHuman,
            peak: Math.max(serverInfo.usedMemory, 0),
            total:
              serverInfo.totalSystemMemory > 0
                ? serverInfo.totalSystemMemory
                : undefined,
          },
          hitRatio: serverInfo.hitRatio,
          lastPing: timestamp,
        },
        metrics: {
          keyspaceHits: serverInfo.keyspaceHits,
          keyspaceMisses: serverInfo.keyspaceMisses,
          totalSystemMemory: serverInfo.totalSystemMemory,
        },
      };
    } catch (error) {
      this.logger.error('Redis health check failed:', error);

      return {
        status: HealthStatus.UNHEALTHY,
        service: 'redis',
        timestamp,
        responseTime: Date.now() - startTime,
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  /**
   * Performs a detailed health check with extended metrics.
   *
   * @param timeout - Health check timeout in milliseconds
   * @returns Promise that resolves to detailed health check response
   */
  async checkDetailed(timeout = 10000): Promise<HealthCheckResponse> {
    const basicHealth = await this.check(timeout);

    if (basicHealth.status === HealthStatus.UNHEALTHY) {
      return basicHealth;
    }

    try {
      // Additional health checks
      const extendedMetrics = await this.getExtendedMetrics();

      return {
        ...basicHealth,
        metrics: {
          ...basicHealth.metrics,
          ...extendedMetrics,
        },
      };
    } catch (error) {
      this.logger.warn('Extended health check failed:', error);
      return basicHealth;
    }
  }

  /**
   * Checks if Redis is ready to accept connections.
   *
   * @returns Promise that resolves to true if ready
   */
  async isReady(): Promise<boolean> {
    try {
      const result = await testRedisConnection(this.redisClient, 3000);
      return result.connected;
    } catch {
      return false;
    }
  }

  /**
   * Checks if Redis is alive (basic ping test).
   *
   * @returns Promise that resolves to true if alive
   */
  async isAlive(): Promise<boolean> {
    try {
      await this.redisClient.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Gets Redis server statistics.
   *
   * @returns Promise that resolves to server statistics
   */
  async getStats(): Promise<{
    uptime: number;
    version: string;
    connectedClients: number;
    usedMemory: number;
    maxMemory: number;
    hitRatio: number;
    commandsProcessed: number;
    keyspaceHits: number;
    keyspaceMisses: number;
  }> {
    try {
      const info = await this.redisClient.info();
      const serverInfo = await getRedisInfo(this.redisClient);

      const infoLines = info.split('\r\n');
      const infoMap = new Map<string, string>();

      for (const line of infoLines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          infoMap.set(key, value);
        }
      }

      return {
        uptime: parseInt(infoMap.get('uptime_in_seconds') || '0', 10),
        version: serverInfo.version,
        connectedClients: serverInfo.connectedClients,
        usedMemory: serverInfo.usedMemory,
        maxMemory: parseInt(infoMap.get('maxmemory') || '0', 10),
        hitRatio: serverInfo.hitRatio,
        commandsProcessed: parseInt(
          infoMap.get('total_commands_processed') || '0',
          10,
        ),
        keyspaceHits: serverInfo.keyspaceHits,
        keyspaceMisses: serverInfo.keyspaceMisses,
      };
    } catch (error) {
      this.logger.error('Failed to get Redis stats:', error);
      throw error;
    }
  }

  /**
   * Determines health status based on server metrics.
   */
  private determineHealthStatus(
    serverInfo: Awaited<ReturnType<typeof getRedisInfo>>,
    responseTime: number,
  ): HealthStatus {
    // Check response time
    if (responseTime > 5000) {
      return HealthStatus.UNHEALTHY;
    }

    if (responseTime > 1000) {
      return HealthStatus.DEGRADED;
    }

    // Check memory usage (if max memory is set)
    if (serverInfo.totalSystemMemory > 0) {
      const memoryUsagePercent =
        (serverInfo.usedMemory / serverInfo.totalSystemMemory) * 100;

      if (memoryUsagePercent > 95) {
        return HealthStatus.UNHEALTHY;
      }

      if (memoryUsagePercent > 85) {
        return HealthStatus.DEGRADED;
      }
    }

    // Check hit ratio (if there are any cache operations)
    const totalKeys = serverInfo.keyspaceHits + serverInfo.keyspaceMisses;
    if (totalKeys > 1000 && serverInfo.hitRatio < 0.5) {
      return HealthStatus.DEGRADED;
    }

    // Check connected clients (reasonable threshold)
    if (serverInfo.connectedClients > 1000) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Gets extended metrics for detailed health checks.
   */
  private async getExtendedMetrics(): Promise<Record<string, unknown>> {
    try {
      const info = await this.redisClient.info();
      const infoLines = info.split('\r\n');
      const metrics: Record<string, unknown> = {};

      for (const line of infoLines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':');

          // Include specific metrics
          if (
            key.includes('commands_processed') ||
            key.includes('connections_received') ||
            key.includes('rejected_connections') ||
            key.includes('expired_keys') ||
            key.includes('evicted_keys') ||
            key.includes('keyspace_')
          ) {
            metrics[key] = isNaN(Number(value)) ? value : Number(value);
          }
        }
      }

      return metrics;
    } catch (error) {
      this.logger.warn('Failed to get extended metrics:', error);
      return {};
    }
  }
}
