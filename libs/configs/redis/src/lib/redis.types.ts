import type { RedisOptions } from 'ioredis';

/**
 * Re-export ioredis types for convenience
 */
export type { Redis, RedisOptions } from 'ioredis';

/**
 * Supported Redis service types in the platform
 */
export enum RedisServiceType {
  AUTH = 'auth',
  BILLING = 'billing',
  DEPLOY = 'deploy',
  MONITOR = 'monitor',
  GATEWAY = 'gateway',
}

/**
 * Redis use case categories for optimization
 */
export enum RedisUseCase {
  SESSION = 'session',
  CACHE = 'cache',
  RATE_LIMITING = 'rate-limiting',
  JOB_QUEUE = 'job-queue',
  METRICS = 'metrics',
  PUB_SUB = 'pub-sub',
}

/**
 * Redis connection configuration for a specific service
 */
export interface ServiceRedisConfig {
  readonly service: RedisServiceType;
  readonly host: string;
  readonly port: number;
  readonly database: number;
  readonly password?: string;
  readonly username?: string;
  readonly family?: 4 | 6;
  readonly connectTimeout?: number;
  readonly lazyConnect?: boolean;
  readonly keepAlive?: number;
  readonly keyPrefix?: string;
  readonly retryDelayOnFailover?: number;
  readonly enableOfflineQueue?: boolean;
  readonly maxRetriesPerRequest?: number;
  readonly maxmemoryPolicy?:
    | 'noeviction'
    | 'allkeys-lru'
    | 'volatile-lru'
    | 'allkeys-random'
    | 'volatile-random'
    | 'volatile-ttl';
  readonly environment?: 'test' | 'development' | 'production';
  readonly useCases?: ReadonlyArray<RedisUseCase>;
  readonly cluster?: RedisClusterConfig;
  readonly sentinel?: RedisSentinelConfig;
}

/**
 * Redis cluster configuration for production environments
 */
export interface RedisClusterConfig {
  readonly enabled: boolean;
  readonly nodes: ReadonlyArray<{
    readonly host: string;
    readonly port: number;
  }>;
  readonly redisOptions?: Partial<RedisOptions>;
  readonly scaleReads?: 'master' | 'slave' | 'all';
  readonly enableReadyCheck?: boolean;
  readonly maxRedirections?: number;
}

/**
 * Redis Sentinel configuration for high availability
 */
export interface RedisSentinelConfig {
  readonly enabled: boolean;
  readonly sentinels: ReadonlyArray<{
    readonly host: string;
    readonly port: number;
  }>;
  readonly name: string;
  readonly password?: string;
  readonly sentinelPassword?: string;
  readonly preferredSlaves?: ReadonlyArray<{
    readonly ip: string;
    readonly port: string;
    readonly prio: number;
  }>;
}

/**
 * Registry of all service Redis configurations
 */
export interface ServiceRedisRegistry {
  readonly auth: ServiceRedisConfig;
  readonly billing: ServiceRedisConfig;
  readonly deploy: ServiceRedisConfig;
  readonly monitor: ServiceRedisConfig;
  readonly gateway: ServiceRedisConfig;
}

/**
 * Environment variables mapping for Redis configuration
 */
export interface RedisEnvironmentVariables {
  readonly NODE_ENV?: string;
  readonly REDIS_HOST: string;
  readonly REDIS_PORT: string;
  readonly REDIS_PASSWORD?: string;
  readonly REDIS_USERNAME?: string;

  // Service-specific database numbers
  readonly AUTH_REDIS_DB: string;
  readonly BILLING_REDIS_DB: string;
  readonly DEPLOY_REDIS_DB: string;
  readonly MONITOR_REDIS_DB: string;
  readonly GATEWAY_REDIS_DB: string;

  // Cluster configuration
  readonly REDIS_CLUSTER_ENABLED?: string;
  readonly REDIS_CLUSTER_NODES?: string; // Comma-separated list of host:port

  // Sentinel configuration
  readonly REDIS_SENTINEL_ENABLED?: string;
  readonly REDIS_SENTINEL_MASTER_NAME?: string;
  readonly REDIS_SENTINEL_NODES?: string; // Comma-separated list of host:port
  readonly REDIS_SENTINEL_PASSWORD?: string;

  // Performance tuning
  readonly REDIS_CONNECT_TIMEOUT?: string;
  readonly REDIS_MAX_RETRIES?: string;
  readonly REDIS_RETRY_DELAY?: string;
  readonly REDIS_KEEP_ALIVE?: string;
}

/**
 * Service-specific optimization profiles
 */
export interface RedisServiceProfile {
  readonly service: RedisServiceType;
  readonly useCases: ReadonlyArray<RedisUseCase>;
  readonly keyPrefix: string;
  readonly defaultTTL: number;
  readonly maxMemoryUsage: string;
  readonly evictionPolicy: ServiceRedisConfig['maxmemoryPolicy'];
  readonly connectionPoolSize: number;
  readonly optimizedFor: 'read' | 'write' | 'balanced';
}

/**
 * Cache strategy configuration
 */
export interface CacheStrategy {
  readonly type:
    | 'write-through'
    | 'write-behind'
    | 'write-around'
    | 'cache-aside';
  readonly ttl: number;
  readonly maxSize?: number;
  readonly evictionPolicy?: 'lru' | 'lfu' | 'fifo' | 'ttl';
  readonly compression?: boolean;
  readonly serialization?: 'json' | 'msgpack' | 'protobuf';
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  readonly windowSize: number; // in seconds
  readonly maxRequests: number;
  readonly blockDuration?: number; // in seconds
  readonly keyGenerator?: (context: unknown) => string;
  readonly skipIfCondition?: (context: unknown) => boolean;
  readonly headers?: boolean;
}

/**
 * Session storage configuration
 */
export interface SessionConfig {
  readonly store: 'redis';
  readonly secret: string;
  readonly ttl: number; // in seconds
  readonly keyPrefix: string;
  readonly rolling?: boolean;
  readonly resave?: boolean;
  readonly saveUninitialized?: boolean;
  readonly cookie?: {
    readonly secure?: boolean;
    readonly httpOnly?: boolean;
    readonly maxAge?: number;
    readonly sameSite?: 'strict' | 'lax' | 'none';
  };
}

/**
 * Job queue configuration
 */
export interface JobQueueConfig {
  readonly name: string;
  readonly defaultJobOptions?: {
    readonly delay?: number;
    readonly attempts?: number;
    readonly backoff?: {
      readonly type: 'fixed' | 'exponential';
      readonly delay: number;
    };
    readonly removeOnComplete?: number;
    readonly removeOnFail?: number;
  };
  readonly concurrency?: number;
  readonly limiter?: {
    readonly max: number;
    readonly duration: number;
  };
}

/**
 * Metrics storage configuration for time-series data
 */
export interface MetricsConfig {
  readonly retention: {
    readonly raw: number; // seconds
    readonly aggregated: number; // seconds
  };
  readonly aggregation: {
    readonly intervals: ReadonlyArray<number>; // seconds
    readonly functions: ReadonlyArray<'avg' | 'sum' | 'min' | 'max' | 'count'>;
  };
  readonly compaction?: {
    readonly enabled: boolean;
    readonly schedule: string; // cron expression
  };
}

/**
 * Health check configuration for Redis
 */
export interface RedisHealthConfig {
  readonly timeout: number;
  readonly retries: number;
  readonly commands: ReadonlyArray<'ping' | 'info' | 'memory'>;
  readonly thresholds: {
    readonly memoryUsagePercent: number;
    readonly responseTimeMs: number;
    readonly connectionCount: number;
  };
}
