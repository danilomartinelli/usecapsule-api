import Redis, { Cluster, type RedisOptions } from 'ioredis';

import type { RedisModuleOptions } from './interfaces';

/**
 * Creates a Redis client instance based on the provided configuration.
 *
 * This factory function handles different Redis deployment scenarios:
 * - Single Redis instance
 * - Redis Cluster
 * - Redis Sentinel
 *
 * @param options - Redis module configuration options
 * @returns Configured Redis client instance
 *
 * @example
 * ```typescript
 * const client = createRedisClient({
 *   host: 'localhost',
 *   port: 6379,
 *   database: 0
 * });
 * ```
 */
export function createRedisClient(
  options: RedisModuleOptions,
): Redis | Cluster {
  // Build base Redis options
  const redisOptions: RedisOptions = {
    host: options.host,
    port: options.port,
    db: options.database,
    password: options.password,
    username: options.username,
    connectTimeout: options.connectTimeout || 10_000,
    lazyConnect: options.lazyConnect !== false, // Default to true
    keepAlive: options.keepAlive || 30_000,
    keyPrefix: options.keyPrefix,
    enableOfflineQueue: options.enableOfflineQueue !== false, // Default to true
    maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
    // retryDelayOnFailover option has been removed from ioredis
    family: 4, // IPv4

    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },

    // Connection recovery options
    enableAutoPipelining: true,
    // maxmemoryPolicy is not a Redis client option, it's a server configuration

    // Apply any custom ioredis options
    ...options.redisOptions,
  };

  // Handle Redis Cluster configuration
  if (options.cluster?.enabled && options.cluster.nodes.length > 0) {
    return new Cluster(
      options.cluster.nodes.map((node) => ({
        host: node.host,
        port: node.port,
      })),
      {
        redisOptions: {
          ...redisOptions,
          ...options.cluster.redisOptions,
        },
        scaleReads: options.cluster.scaleReads || 'slave',
        enableReadyCheck: options.cluster.enableReadyCheck !== false,
        maxRedirections: options.cluster.maxRedirections || 6,
      },
    );
  }

  // Handle Redis Sentinel configuration
  if (options.sentinel?.enabled && options.sentinel.sentinels.length > 0) {
    return new Redis({
      ...redisOptions,
      sentinels: options.sentinel.sentinels.map((sentinel) => ({
        host: sentinel.host,
        port: sentinel.port,
      })),
      name: options.sentinel.name,
      password: options.sentinel.password || options.password,
      sentinelPassword: options.sentinel.sentinelPassword,
      preferredSlaves: options.sentinel.preferredSlaves ? [...options.sentinel.preferredSlaves] : undefined,
      enableTLSForSentinelMode: false,
    });
  }

  // Create standard Redis instance
  return new Redis(redisOptions);
}

/**
 * Creates multiple Redis clients for service-specific configurations.
 *
 * This function is useful when you need to create clients for different
 * databases or with different configurations within the same Redis instance.
 *
 * @param baseOptions - Base Redis configuration
 * @param serviceConfigs - Service-specific overrides
 * @returns Map of service names to Redis clients
 *
 * @example
 * ```typescript
 * const clients = createMultiServiceRedisClients(
 *   { host: 'localhost', port: 6379 },
 *   {
 *     auth: { database: 0, keyPrefix: 'auth:' },
 *     billing: { database: 1, keyPrefix: 'billing:' }
 *   }
 * );
 * ```
 */
export function createMultiServiceRedisClients(
  baseOptions: Omit<RedisModuleOptions, 'database' | 'keyPrefix'>,
  serviceConfigs: Record<
    string,
    Pick<RedisModuleOptions, 'database' | 'keyPrefix'>
  >,
): Map<string, Redis | Cluster> {
  const clients = new Map<string, Redis | Cluster>();

  for (const [serviceName, serviceConfig] of Object.entries(serviceConfigs)) {
    const serviceOptions: RedisModuleOptions = {
      ...baseOptions,
      ...serviceConfig,
    };

    clients.set(serviceName, createRedisClient(serviceOptions));
  }

  return clients;
}

/**
 * Gracefully closes a Redis client connection.
 *
 * @param client - Redis client to close
 * @param timeout - Maximum time to wait for graceful shutdown (ms)
 * @returns Promise that resolves when connection is closed
 */
export async function closeRedisClient(
  client: Redis | Cluster,
  timeout = 5_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Redis client failed to close within ${timeout}ms`));
    }, timeout);

    try {
      client.disconnect(false);
      clearTimeout(timeoutId);
      resolve();
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

/**
 * Tests the connection to a Redis instance.
 *
 * @param client - Redis client to test
 * @param timeout - Test timeout in milliseconds
 * @returns Promise that resolves to connection status
 */
export async function testRedisConnection(
  client: Redis | Cluster,
  timeout = 5_000,
): Promise<{ connected: boolean; latency?: number; error?: Error }> {
  try {
    const startTime = Date.now();
    await Promise.race([
      client.ping(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timeout')), timeout),
      ),
    ]);
    const latency = Date.now() - startTime;

    return { connected: true, latency };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Gets Redis server information and statistics.
 *
 * @param client - Redis client
 * @returns Promise that resolves to server info
 */
export async function getRedisInfo(client: Redis | Cluster): Promise<{
  version: string;
  mode: string;
  connectedClients: number;
  usedMemory: number;
  usedMemoryHuman: string;
  totalSystemMemory: number;
  maxmemoryPolicy: string;
  keyspaceHits: number;
  keyspaceMisses: number;
  hitRatio: number;
}> {
  const info = await client.info();
  const infoLines = info.split('\r\n');
  const infoMap = new Map<string, string>();

  // Parse Redis INFO output
  for (const line of infoLines) {
    if (line.includes(':')) {
      const [key, value] = line.split(':');
      infoMap.set(key, value);
    }
  }

  const keyspaceHits = parseInt(infoMap.get('keyspace_hits') || '0', 10);
  const keyspaceMisses = parseInt(infoMap.get('keyspace_misses') || '0', 10);
  const totalKeys = keyspaceHits + keyspaceMisses;
  const hitRatio = totalKeys > 0 ? keyspaceHits / totalKeys : 0;

  return {
    version: infoMap.get('redis_version') || 'unknown',
    mode: infoMap.get('redis_mode') || 'standalone',
    connectedClients: parseInt(infoMap.get('connected_clients') || '0', 10),
    usedMemory: parseInt(infoMap.get('used_memory') || '0', 10),
    usedMemoryHuman: infoMap.get('used_memory_human') || '0B',
    totalSystemMemory: parseInt(infoMap.get('total_system_memory') || '0', 10),
    maxmemoryPolicy: infoMap.get('maxmemory_policy') || 'noeviction',
    keyspaceHits,
    keyspaceMisses,
    hitRatio: Math.round(hitRatio * 100) / 100, // Round to 2 decimal places
  };
}
