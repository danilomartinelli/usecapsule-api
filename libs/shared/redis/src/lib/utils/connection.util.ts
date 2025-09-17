import type { Redis, Cluster } from 'ioredis';

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Whether the connection is healthy */
  healthy: boolean;
  /** Connection latency in milliseconds */
  latency?: number;
  /** Last successful ping timestamp */
  lastPing?: number;
  /** Error message if unhealthy */
  error?: string;
  /** Redis server information */
  serverInfo?: {
    version: string;
    mode: string;
    connectedClients: number;
    usedMemory: number;
    maxMemory: number;
    hitRatio: number;
  };
}

/**
 * Connection pool statistics
 */
export interface ConnectionStats {
  /** Number of active connections */
  activeConnections: number;
  /** Number of idle connections */
  idleConnections: number;
  /** Total number of commands processed */
  totalCommands: number;
  /** Number of failed commands */
  failedCommands: number;
  /** Average response time in milliseconds */
  avgResponseTime: number;
  /** Memory usage statistics */
  memoryUsage: {
    used: number;
    peak: number;
    rss: number;
    overhead: number;
  };
}

/**
 * Redis connection utilities for monitoring and management.
 *
 * This utility provides helper functions for monitoring Redis connections,
 * checking health, and gathering statistics.
 *
 * @example
 * ```typescript
 * const connectionUtils = new RedisConnectionUtils(redisClient);
 *
 * // Check connection health
 * const health = await connectionUtils.checkHealth();
 * console.log('Redis healthy:', health.healthy);
 *
 * // Get connection statistics
 * const stats = await connectionUtils.getStats();
 * console.log('Active connections:', stats.activeConnections);
 *
 * // Monitor connection with periodic health checks
 * connectionUtils.startMonitoring((health) => {
 *   if (!health.healthy) {
 *     console.error('Redis connection unhealthy:', health.error);
 *   }
 * });
 * ```
 */
export class RedisConnectionUtils {
  private monitoringInterval?: NodeJS.Timeout;
  private healthCheckHistory: ConnectionHealth[] = [];
  private readonly maxHistorySize = 100;

  constructor(private readonly redisClient: Redis | Cluster) {}

  /**
   * Checks the health of the Redis connection.
   *
   * @param timeout - Health check timeout in milliseconds
   * @returns Promise that resolves to connection health information
   */
  async checkHealth(timeout = 5000): Promise<ConnectionHealth> {
    try {
      const startTime = Date.now();

      // Perform ping with timeout
      await Promise.race([
        this.redisClient.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), timeout),
        ),
      ]);

      const latency = Date.now() - startTime;

      // Get server information
      const serverInfo = await this.getServerInfo();

      const health: ConnectionHealth = {
        healthy: true,
        latency,
        lastPing: Date.now(),
        serverInfo,
      };

      this.addToHistory(health);
      return health;
    } catch (error) {
      const health: ConnectionHealth = {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        lastPing: Date.now(),
      };

      this.addToHistory(health);
      return health;
    }
  }

  /**
   * Gets connection statistics.
   *
   * @returns Promise that resolves to connection statistics
   */
  async getStats(): Promise<ConnectionStats> {
    try {
      const info = await this.redisClient.info();
      const infoMap = this.parseRedisInfo(info);

      return {
        activeConnections: parseInt(
          infoMap.get('connected_clients') || '0',
          10,
        ),
        idleConnections: parseInt(infoMap.get('blocked_clients') || '0', 10),
        totalCommands: parseInt(
          infoMap.get('total_commands_processed') || '0',
          10,
        ),
        failedCommands: parseInt(
          infoMap.get('rejected_connections') || '0',
          10,
        ),
        avgResponseTime: 0, // This would need to be tracked separately
        memoryUsage: {
          used: parseInt(infoMap.get('used_memory') || '0', 10),
          peak: parseInt(infoMap.get('used_memory_peak') || '0', 10),
          rss: parseInt(infoMap.get('used_memory_rss') || '0', 10),
          overhead: parseInt(infoMap.get('used_memory_overhead') || '0', 10),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get connection stats: ${error}`);
    }
  }

  /**
   * Gets Redis server information.
   *
   * @returns Promise that resolves to server information
   */
  async getServerInfo(): Promise<ConnectionHealth['serverInfo']> {
    try {
      const info = await this.redisClient.info();
      const infoMap = this.parseRedisInfo(info);

      const keyspaceHits = parseInt(infoMap.get('keyspace_hits') || '0', 10);
      const keyspaceMisses = parseInt(
        infoMap.get('keyspace_misses') || '0',
        10,
      );
      const totalKeys = keyspaceHits + keyspaceMisses;
      const hitRatio = totalKeys > 0 ? keyspaceHits / totalKeys : 0;

      return {
        version: infoMap.get('redis_version') || 'unknown',
        mode: infoMap.get('redis_mode') || 'standalone',
        connectedClients: parseInt(infoMap.get('connected_clients') || '0', 10),
        usedMemory: parseInt(infoMap.get('used_memory') || '0', 10),
        maxMemory: parseInt(infoMap.get('maxmemory') || '0', 10),
        hitRatio: Math.round(hitRatio * 100) / 100,
      };
    } catch (error) {
      throw new Error(`Failed to get server info: ${error}`);
    }
  }

  /**
   * Starts monitoring the Redis connection with periodic health checks.
   *
   * @param callback - Callback function to handle health check results
   * @param interval - Health check interval in milliseconds
   */
  startMonitoring(
    callback: (health: ConnectionHealth) => void,
    interval = 30000,
  ): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        callback(health);
      } catch (error) {
        callback({
          healthy: false,
          error: error instanceof Error ? error.message : String(error),
          lastPing: Date.now(),
        });
      }
    }, interval);
  }

  /**
   * Stops connection monitoring.
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  /**
   * Gets the health check history.
   *
   * @param limit - Maximum number of history entries to return
   * @returns Array of connection health records
   */
  getHealthHistory(limit?: number): ConnectionHealth[] {
    const history = [...this.healthCheckHistory];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Gets connection uptime statistics.
   *
   * @returns Uptime statistics
   */
  getUptimeStats(): {
    totalChecks: number;
    successfulChecks: number;
    failedChecks: number;
    uptimePercentage: number;
    avgLatency: number;
    maxLatency: number;
    minLatency: number;
  } {
    const history = this.healthCheckHistory;
    const totalChecks = history.length;
    const successfulChecks = history.filter((h) => h.healthy).length;
    const failedChecks = totalChecks - successfulChecks;
    const uptimePercentage =
      totalChecks > 0 ? (successfulChecks / totalChecks) * 100 : 0;

    const latencies = history
      .filter((h) => h.healthy && h.latency !== undefined)
      .map((h) => h.latency as number);

    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length
        : 0;

    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;
    const minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;

    return {
      totalChecks,
      successfulChecks,
      failedChecks,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      avgLatency: Math.round(avgLatency * 100) / 100,
      maxLatency,
      minLatency,
    };
  }

  /**
   * Tests connection with specific operations.
   *
   * @returns Promise that resolves to test results
   */
  async testConnection(): Promise<{
    ping: { success: boolean; latency: number; error: string };
    set: { success: boolean; latency: number; error: string };
    get: { success: boolean; latency: number; error: string };
    del: { success: boolean; latency: number; error: string };
  }> {
    const testKey = `connection-test:${Date.now()}`;
    const testValue = 'test-value';

    const results = {
      ping: { success: false as boolean, latency: 0, error: '' },
      set: { success: false as boolean, latency: 0, error: '' },
      get: { success: false as boolean, latency: 0, error: '' },
      del: { success: false as boolean, latency: 0, error: '' },
    };

    // Test PING
    try {
      const startTime = Date.now();
      await this.redisClient.ping();
      results.ping = {
        success: true,
        latency: Date.now() - startTime,
        error: '',
      };
    } catch (error) {
      results.ping = {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test SET
    try {
      const startTime = Date.now();
      await this.redisClient.set(testKey, testValue);
      results.set = {
        success: true,
        latency: Date.now() - startTime,
        error: '',
      };
    } catch (error) {
      results.set = {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test GET
    try {
      const startTime = Date.now();
      const value = await this.redisClient.get(testKey);
      results.get = {
        success: value === testValue,
        latency: Date.now() - startTime,
        error: value !== testValue ? 'Value mismatch' : '',
      };
    } catch (error) {
      results.get = {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Test DEL
    try {
      const startTime = Date.now();
      await this.redisClient.del(testKey);
      results.del = {
        success: true,
        latency: Date.now() - startTime,
        error: '',
      };
    } catch (error) {
      results.del = {
        success: false,
        latency: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    return results;
  }

  /**
   * Resets the health check history.
   */
  resetHistory(): void {
    this.healthCheckHistory = [];
  }

  /**
   * Parses Redis INFO command output into a Map.
   */
  private parseRedisInfo(info: string): Map<string, string> {
    const infoMap = new Map<string, string>();
    const lines = info.split('\r\n');

    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        infoMap.set(key, value);
      }
    }

    return infoMap;
  }

  /**
   * Adds a health check result to the history.
   */
  private addToHistory(health: ConnectionHealth): void {
    this.healthCheckHistory.push(health);

    // Keep only the most recent entries
    if (this.healthCheckHistory.length > this.maxHistorySize) {
      this.healthCheckHistory = this.healthCheckHistory.slice(
        -this.maxHistorySize,
      );
    }
  }

  /**
   * Cleanup method to stop monitoring when the utility is no longer needed.
   */
  destroy(): void {
    this.stopMonitoring();
    this.resetHistory();
  }
}
