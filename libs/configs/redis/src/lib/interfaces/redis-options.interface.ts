import type { Type } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces';
import type { RedisOptions } from 'ioredis';

import type {
  RedisClusterConfig,
  RedisSentinelConfig,
  RedisUseCase,
} from '../redis.types';

/**
 * Basic Redis module configuration options
 */
export interface RedisModuleOptions {
  /** Redis server host */
  host: string;
  /** Redis server port */
  port: number;
  /** Redis database number (0-15) */
  database: number;
  /** Redis authentication password */
  password?: string;
  /** Redis authentication username (Redis 6+) */
  username?: string;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Keep alive interval in milliseconds */
  keepAlive?: number;
  /** Key prefix for all operations */
  keyPrefix?: string;
  /** Lazy connection establishment */
  lazyConnect?: boolean;
  /** Enable offline command queue */
  enableOfflineQueue?: boolean;
  /** Maximum retries per request */
  maxRetriesPerRequest?: number;
  /** Retry delay on failover in milliseconds */
  retryDelayOnFailover?: number;
  /** Memory eviction policy */
  maxmemoryPolicy?:
    | 'noeviction'
    | 'allkeys-lru'
    | 'volatile-lru'
    | 'allkeys-random'
    | 'volatile-random'
    | 'volatile-ttl';
  /** Target environment */
  environment?: 'test' | 'development' | 'production';
  /** Service use cases for optimization */
  useCases?: ReadonlyArray<RedisUseCase>;
  /** Cluster configuration */
  cluster?: RedisClusterConfig;
  /** Sentinel configuration */
  sentinel?: RedisSentinelConfig;
  /** Raw ioredis options (for advanced configuration) */
  redisOptions?: Partial<RedisOptions>;
}

/**
 * Async Redis module configuration options
 */
export interface RedisModuleAsyncOptions {
  /** Factory function to create Redis options */
  useFactory: (
    ...args: unknown[]
  ) => Promise<RedisModuleOptions> | RedisModuleOptions;
  /** Dependencies to inject into the factory function */
  inject?: Array<Type<unknown> | string | symbol>;
  /** Modules to import */
  imports?: ModuleMetadata['imports'];
}

/**
 * Service-specific Redis module options with additional metadata
 */
export interface ServiceRedisModuleOptions extends RedisModuleOptions {
  /** Service identifier */
  service: string;
  /** Service-specific key prefix override */
  serviceKeyPrefix?: string;
  /** Service-specific database override */
  serviceDatabase?: number;
  /** Service-specific connection pool size */
  connectionPoolSize?: number;
  /** Optimization profile for the service */
  optimizedFor?: 'read' | 'write' | 'balanced';
}

/**
 * Multi-service Redis configuration options
 */
export interface MultiServiceRedisOptions {
  /** Common Redis connection settings */
  common: Omit<RedisModuleOptions, 'database' | 'keyPrefix'>;
  /** Service-specific overrides */
  services: {
    auth?: Partial<ServiceRedisModuleOptions>;
    billing?: Partial<ServiceRedisModuleOptions>;
    deploy?: Partial<ServiceRedisModuleOptions>;
    monitor?: Partial<ServiceRedisModuleOptions>;
    gateway?: Partial<ServiceRedisModuleOptions>;
  };
}

/**
 * Redis health check options
 */
export interface RedisHealthCheckOptions {
  /** Health check timeout in milliseconds */
  timeout?: number;
  /** Number of retries for health checks */
  retries?: number;
  /** Commands to run for health verification */
  commands?: ReadonlyArray<'ping' | 'info' | 'memory'>;
  /** Performance thresholds */
  thresholds?: {
    memoryUsagePercent?: number;
    responseTimeMs?: number;
    connectionCount?: number;
  };
}

/**
 * Redis caching options
 */
export interface RedisCacheOptions {
  /** Default TTL in seconds */
  defaultTTL?: number;
  /** Maximum cache size in bytes */
  maxSize?: number;
  /** Key serialization strategy */
  keySerializer?: (key: unknown) => string;
  /** Value serialization strategy */
  valueSerializer?: {
    serialize: (value: unknown) => string;
    deserialize: (value: string) => unknown;
  };
  /** Compression settings */
  compression?: {
    enabled: boolean;
    algorithm?: 'gzip' | 'deflate' | 'brotli';
    threshold?: number; // Compress values larger than this (bytes)
  };
}

/**
 * Redis session options
 */
export interface RedisSessionOptions {
  /** Session TTL in seconds */
  ttl?: number;
  /** Key prefix for sessions */
  keyPrefix?: string;
  /** Session rolling behavior */
  rolling?: boolean;
  /** Cookie configuration */
  cookie?: {
    secure?: boolean;
    httpOnly?: boolean;
    maxAge?: number;
    sameSite?: 'strict' | 'lax' | 'none';
  };
}

/**
 * Redis rate limiting options
 */
export interface RedisRateLimitOptions {
  /** Time window in seconds */
  windowSize: number;
  /** Maximum requests per window */
  maxRequests: number;
  /** Block duration after limit exceeded (seconds) */
  blockDuration?: number;
  /** Key generation strategy */
  keyGenerator?: (context: unknown) => string;
  /** Condition to skip rate limiting */
  skipIfCondition?: (context: unknown) => boolean;
  /** Include rate limit headers in response */
  headers?: boolean;
}

/**
 * Redis job queue options
 */
export interface RedisJobQueueOptions {
  /** Queue name */
  name: string;
  /** Default job options */
  defaultJobOptions?: {
    delay?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
    removeOnComplete?: number;
    removeOnFail?: number;
  };
  /** Processing concurrency */
  concurrency?: number;
  /** Rate limiter settings */
  limiter?: {
    max: number;
    duration: number;
  };
}

/**
 * Redis metrics storage options
 */
export interface RedisMetricsOptions {
  /** Data retention settings */
  retention?: {
    raw: number; // seconds
    aggregated: number; // seconds
  };
  /** Aggregation configuration */
  aggregation?: {
    intervals: ReadonlyArray<number>; // seconds
    functions: ReadonlyArray<'avg' | 'sum' | 'min' | 'max' | 'count'>;
  };
  /** Data compaction settings */
  compaction?: {
    enabled: boolean;
    schedule: string; // cron expression
  };
}
