import type { ConfigService } from '@nestjs/config';

import type { RedisModuleOptions } from './interfaces';
import type {
  RedisEnvironmentVariables,
  ServiceRedisConfig,
  ServiceRedisRegistry,
  RedisUseCase,
} from './redis.types';
import { RedisServiceType } from './redis.types';

/**
 * Default Redis configuration values for development environment
 */
const DEVELOPMENT_REDIS_DEFAULTS = {
  auth: {
    host: 'localhost',
    port: 7120,
    database: 0,
    keyPrefix: 'auth:',
    useCases: ['session', 'cache'] as RedisUseCase[],
  },
  billing: {
    host: 'localhost',
    port: 7120,
    database: 1,
    keyPrefix: 'billing:',
    useCases: ['cache', 'rate-limiting'] as RedisUseCase[],
  },
  deploy: {
    host: 'localhost',
    port: 7120,
    database: 2,
    keyPrefix: 'deploy:',
    useCases: ['cache', 'job-queue'] as RedisUseCase[],
  },
  monitor: {
    host: 'localhost',
    port: 7120,
    database: 3,
    keyPrefix: 'monitor:',
    useCases: ['metrics', 'cache'] as RedisUseCase[],
  },
  gateway: {
    host: 'localhost',
    port: 7120,
    database: 4,
    keyPrefix: 'gateway:',
    useCases: ['rate-limiting', 'session', 'cache'] as RedisUseCase[],
  },
} as const;

/**
 * Default Redis connection settings
 */
const DEFAULT_REDIS_SETTINGS = {
  connectTimeout: 10_000, // 10 seconds
  lazyConnect: true,
  keepAlive: 30_000, // 30 seconds
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  maxmemoryPolicy: 'allkeys-lru' as const,
} as const;

/**
 * Service-specific optimization profiles
 */
const SERVICE_OPTIMIZATION_PROFILES = {
  [RedisServiceType.AUTH]: {
    // Auth service needs fast session validation and user caching
    maxRetriesPerRequest: 2, // Fast failure for auth operations
    connectTimeout: 5_000, // Quick connection for auth
    maxmemoryPolicy: 'volatile-lru' as const, // Preserve long-term sessions
  },
  [RedisServiceType.BILLING]: {
    // Billing needs reliable rate limiting and payment caching
    maxRetriesPerRequest: 5, // More retries for financial operations
    connectTimeout: 15_000, // Longer timeout for reliability
    maxmemoryPolicy: 'allkeys-lru' as const, // General purpose caching
  },
  [RedisServiceType.DEPLOY]: {
    // Deploy service needs job queue reliability
    maxRetriesPerRequest: 5, // Retry job operations
    connectTimeout: 20_000, // Long timeout for deploy operations
    maxmemoryPolicy: 'noeviction' as const, // Don't lose job data
  },
  [RedisServiceType.MONITOR]: {
    // Monitor service handles high-volume metrics
    maxRetriesPerRequest: 1, // Fast failure for metrics
    connectTimeout: 8_000, // Moderate timeout
    maxmemoryPolicy: 'volatile-ttl' as const, // Time-based eviction for metrics
  },
  [RedisServiceType.GATEWAY]: {
    // Gateway needs fast rate limiting and session access
    maxRetriesPerRequest: 2, // Fast failure for rate limiting
    connectTimeout: 5_000, // Quick connection
    maxmemoryPolicy: 'allkeys-lru' as const, // General purpose caching
  },
} as const;

/**
 * Creates Redis configuration for a specific service using environment variables
 * with fallback to development defaults.
 *
 * @param service - The service type to create configuration for
 * @param configService - NestJS ConfigService for reading environment variables
 * @param environment - Target environment (development, production, test)
 * @returns Service-specific Redis configuration
 *
 * @example
 * ```typescript
 * const authConfig = createServiceRedisConfig(
 *   RedisServiceType.AUTH,
 *   configService,
 *   'development'
 * );
 * ```
 */
export function createServiceRedisConfig(
  service: RedisServiceType,
  configService: ConfigService<RedisEnvironmentVariables>,
  environment: 'development' | 'production' | 'test' = 'development',
): ServiceRedisConfig {
  const serviceDefaults = DEVELOPMENT_REDIS_DEFAULTS[service];
  const optimizationProfile = SERVICE_OPTIMIZATION_PROFILES[service];

  // Get common Redis connection settings
  const host = configService.get('REDIS_HOST', serviceDefaults.host);
  const port = Number(
    configService.get('REDIS_PORT', String(serviceDefaults.port)),
  );
  const password = configService.get('REDIS_PASSWORD');
  const username = configService.get('REDIS_USERNAME');

  // Get service-specific database number
  let database: number;
  switch (service) {
    case RedisServiceType.AUTH:
      database = Number(
        configService.get('AUTH_REDIS_DB', String(serviceDefaults.database)),
      );
      break;
    case RedisServiceType.BILLING:
      database = Number(
        configService.get('BILLING_REDIS_DB', String(serviceDefaults.database)),
      );
      break;
    case RedisServiceType.DEPLOY:
      database = Number(
        configService.get('DEPLOY_REDIS_DB', String(serviceDefaults.database)),
      );
      break;
    case RedisServiceType.MONITOR:
      database = Number(
        configService.get('MONITOR_REDIS_DB', String(serviceDefaults.database)),
      );
      break;
    case RedisServiceType.GATEWAY:
      database = Number(
        configService.get('GATEWAY_REDIS_DB', String(serviceDefaults.database)),
      );
      break;
    default:
      throw new Error(`Unsupported service type: ${service}`);
  }

  // Parse cluster configuration if enabled
  const clusterEnabled =
    configService.get('REDIS_CLUSTER_ENABLED', 'false') === 'true';
  const clusterNodes = configService.get('REDIS_CLUSTER_NODES', '');

  let cluster = undefined;
  if (clusterEnabled && clusterNodes) {
    cluster = {
      enabled: true,
      nodes: clusterNodes.split(',').map((node: string) => {
        const [nodeHost, nodePort] = node.trim().split(':');
        return { host: nodeHost, port: Number(nodePort) };
      }),
      scaleReads: 'slave' as const,
      enableReadyCheck: true,
      maxRedirections: 6,
    };
  }

  // Parse sentinel configuration if enabled
  const sentinelEnabled =
    configService.get('REDIS_SENTINEL_ENABLED', 'false') === 'true';
  const sentinelMasterName = configService.get(
    'REDIS_SENTINEL_MASTER_NAME',
    'mymaster',
  );
  const sentinelNodes = configService.get('REDIS_SENTINEL_NODES', '');
  const sentinelPassword = configService.get('REDIS_SENTINEL_PASSWORD');

  let sentinel = undefined;
  if (sentinelEnabled && sentinelNodes) {
    sentinel = {
      enabled: true,
      name: sentinelMasterName,
      sentinels: sentinelNodes.split(',').map((node: string) => {
        const [nodeHost, nodePort] = node.trim().split(':');
        return { host: nodeHost, port: Number(nodePort) };
      }),
      password,
      sentinelPassword,
    };
  }

  return {
    service,
    host,
    port,
    database,
    password,
    username,
    environment,
    keyPrefix: serviceDefaults.keyPrefix,
    useCases: serviceDefaults.useCases,
    cluster,
    sentinel,
    // Apply default settings
    ...DEFAULT_REDIS_SETTINGS,
    // Apply service-specific optimizations
    ...optimizationProfile,
    // Override with environment-specific settings
    connectTimeout: Number(
      configService.get(
        'REDIS_CONNECT_TIMEOUT',
        String(optimizationProfile.connectTimeout),
      ),
    ),
    maxRetriesPerRequest: Number(
      configService.get(
        'REDIS_MAX_RETRIES',
        String(optimizationProfile.maxRetriesPerRequest),
      ),
    ),
    retryDelayOnFailover: Number(
      configService.get(
        'REDIS_RETRY_DELAY',
        String(DEFAULT_REDIS_SETTINGS.retryDelayOnFailover),
      ),
    ),
    keepAlive: Number(
      configService.get(
        'REDIS_KEEP_ALIVE',
        String(DEFAULT_REDIS_SETTINGS.keepAlive),
      ),
    ),
  };
}

/**
 * Creates a complete service Redis registry with all service configurations.
 *
 * @param configService - NestJS ConfigService for reading environment variables
 * @param environment - Target environment
 * @returns Complete registry of all service Redis configurations
 *
 * @example
 * ```typescript
 * const registry = createServiceRedisRegistry(configService, 'production');
 * const authConfig = registry.auth;
 * ```
 */
export function createServiceRedisRegistry(
  configService: ConfigService<RedisEnvironmentVariables>,
  environment: 'development' | 'production' | 'test' = 'development',
): ServiceRedisRegistry {
  return {
    auth: createServiceRedisConfig(
      RedisServiceType.AUTH,
      configService,
      environment,
    ),
    billing: createServiceRedisConfig(
      RedisServiceType.BILLING,
      configService,
      environment,
    ),
    deploy: createServiceRedisConfig(
      RedisServiceType.DEPLOY,
      configService,
      environment,
    ),
    monitor: createServiceRedisConfig(
      RedisServiceType.MONITOR,
      configService,
      environment,
    ),
    gateway: createServiceRedisConfig(
      RedisServiceType.GATEWAY,
      configService,
      environment,
    ),
  };
}

/**
 * Converts a ServiceRedisConfig to the RedisModuleOptions format
 * for use with RedisModule.
 *
 * @param serviceConfig - Service-specific Redis configuration
 * @returns RedisModuleOptions format
 */
export function serviceConfigToModuleOptions(
  serviceConfig: ServiceRedisConfig,
): RedisModuleOptions {
  return {
    host: serviceConfig.host,
    port: serviceConfig.port,
    database: serviceConfig.database,
    password: serviceConfig.password,
    username: serviceConfig.username,
    connectTimeout: serviceConfig.connectTimeout,
    lazyConnect: serviceConfig.lazyConnect,
    keepAlive: serviceConfig.keepAlive,
    keyPrefix: serviceConfig.keyPrefix,
    enableOfflineQueue: serviceConfig.enableOfflineQueue,
    maxRetriesPerRequest: serviceConfig.maxRetriesPerRequest,
    retryDelayOnFailover: serviceConfig.retryDelayOnFailover,
    maxmemoryPolicy: serviceConfig.maxmemoryPolicy,
    environment: serviceConfig.environment,
    useCases: serviceConfig.useCases,
    cluster: serviceConfig.cluster,
    sentinel: serviceConfig.sentinel,
  };
}

/**
 * Validates that all required environment variables are present for a service.
 *
 * @param service - Service type to validate
 * @param configService - ConfigService instance
 * @returns True if all required variables are present
 * @throws Error if required variables are missing
 */
export function validateServiceRedisEnvironment(
  service: RedisServiceType,
  configService: ConfigService<RedisEnvironmentVariables>,
): boolean {
  let serviceDbKey: keyof RedisEnvironmentVariables;

  switch (service) {
    case RedisServiceType.AUTH:
      serviceDbKey = 'AUTH_REDIS_DB';
      break;
    case RedisServiceType.BILLING:
      serviceDbKey = 'BILLING_REDIS_DB';
      break;
    case RedisServiceType.DEPLOY:
      serviceDbKey = 'DEPLOY_REDIS_DB';
      break;
    case RedisServiceType.MONITOR:
      serviceDbKey = 'MONITOR_REDIS_DB';
      break;
    case RedisServiceType.GATEWAY:
      serviceDbKey = 'GATEWAY_REDIS_DB';
      break;
    default:
      throw new Error(`Unsupported service type: ${service}`);
  }

  const requiredKeys: (keyof RedisEnvironmentVariables)[] = [
    'REDIS_HOST',
    'REDIS_PORT',
    serviceDbKey,
  ];

  const missingVars = requiredKeys.filter(
    (varName) => !configService.get(varName),
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables for ${service} Redis service: ${missingVars.join(', ')}`,
    );
  }

  return true;
}

/**
 * Creates a Redis configuration factory function for use with RedisModule.forRootAsync()
 *
 * @param service - Service type to create factory for
 * @param environment - Target environment
 * @returns Factory function for RedisModule async configuration
 *
 * @example
 * ```typescript
 * RedisModule.forRootAsync({
 *   imports: [ConfigModule],
 *   useFactory: createRedisConfigFactory(RedisServiceType.AUTH, 'production'),
 *   inject: [ConfigService],
 * })
 * ```
 */
export function createRedisConfigFactory(
  service: RedisServiceType,
  environment: 'development' | 'production' | 'test' = 'development',
) {
  return (configService: ConfigService<RedisEnvironmentVariables>) => {
    const serviceConfig = createServiceRedisConfig(
      service,
      configService,
      environment,
    );
    return serviceConfigToModuleOptions(serviceConfig);
  };
}

/**
 * Gets optimized Redis settings for specific use cases
 *
 * @param useCases - Array of use cases for the Redis instance
 * @param baseConfig - Base configuration to optimize
 * @returns Optimized configuration
 */
export function getOptimizedRedisSettings(
  useCases: ReadonlyArray<RedisUseCase>,
  _baseConfig: ServiceRedisConfig,
): Partial<{
  maxmemoryPolicy: string;
  connectTimeout: number;
  maxRetriesPerRequest: number;
  enableOfflineQueue: boolean;
  lazyConnect: boolean;
}> {
  const optimizations: Partial<{
    maxmemoryPolicy: string;
    connectTimeout: number;
    maxRetriesPerRequest: number;
    enableOfflineQueue: boolean;
    lazyConnect: boolean;
  }> = {};

  // Session storage optimization
  if (useCases.includes('session' as RedisUseCase)) {
    optimizations.maxmemoryPolicy = 'volatile-lru'; // Keep sessions, evict by LRU
    optimizations.connectTimeout = 5_000; // Fast session validation
  }

  // Cache optimization
  if (useCases.includes('cache' as RedisUseCase)) {
    optimizations.maxmemoryPolicy = 'allkeys-lru'; // General purpose caching
  }

  // Rate limiting optimization
  if (useCases.includes('rate-limiting' as RedisUseCase)) {
    optimizations.maxRetriesPerRequest = 1; // Fast failure for rate limits
    optimizations.connectTimeout = 3_000; // Very fast connection
  }

  // Job queue optimization
  if (useCases.includes('job-queue' as RedisUseCase)) {
    optimizations.maxmemoryPolicy = 'noeviction'; // Don't lose job data
    optimizations.maxRetriesPerRequest = 5; // Retry job operations
    optimizations.enableOfflineQueue = true; // Queue operations when disconnected
  }

  // Metrics optimization
  if (useCases.includes('metrics' as RedisUseCase)) {
    optimizations.maxmemoryPolicy = 'volatile-ttl'; // Time-based eviction
    optimizations.maxRetriesPerRequest = 1; // Fast failure for metrics
  }

  // Pub/Sub optimization
  if (useCases.includes('pub-sub' as RedisUseCase)) {
    optimizations.lazyConnect = false; // Immediate connection for pub/sub
    optimizations.enableOfflineQueue = false; // Don't queue pub/sub messages
  }

  return optimizations;
}
