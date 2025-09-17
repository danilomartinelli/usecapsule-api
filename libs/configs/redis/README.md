# @usecapsule/redis

Comprehensive Redis configuration module for NestJS microservices, following the same architectural patterns as the database configuration.

## Features

- **Service-specific configurations** - Each microservice gets its own Redis database and optimized settings
- **Multiple deployment scenarios** - Support for standalone, cluster, and sentinel Redis deployments
- **Environment-aware configuration** - Automatic configuration based on environment variables
- **Type-safe configuration** - Full TypeScript support with comprehensive interfaces
- **Injectable services** - Easy integration with NestJS dependency injection
- **Health monitoring** - Built-in health checks and connection monitoring
- **Performance optimization** - Service-specific optimizations based on use cases

## Supported Services

| Service             | Database | Key Prefix | Use Cases                                           |
| ------------------- | -------- | ---------- | --------------------------------------------------- |
| **auth-service**    | 0        | `auth:`    | Session storage, user caching                       |
| **billing-service** | 1        | `billing:` | Payment caching, rate limiting                      |
| **deploy-service**  | 2        | `deploy:`  | Deployment status, job queues                       |
| **monitor-service** | 3        | `monitor:` | Real-time metrics, time-series caching              |
| **api-gateway**     | 4        | `gateway:` | Rate limiting, response caching, session management |

## Installation

The module is already configured in the monorepo. Import it in your microservice:

```typescript
import { RedisModule, AuthRedisService } from '@usecapsule/redis';
import { CacheInterceptor, RateLimitGuard } from '@usecapsule/shared-redis';
```

## Quick Start

### 1. Environment Configuration

```bash
# Required
REDIS_HOST=localhost
REDIS_PORT=7120
AUTH_REDIS_DB=0
BILLING_REDIS_DB=1
DEPLOY_REDIS_DB=2
MONITOR_REDIS_DB=3
GATEWAY_REDIS_DB=4

# Optional
REDIS_PASSWORD=your_password
REDIS_USERNAME=your_username
REDIS_CONNECT_TIMEOUT=10000
REDIS_MAX_RETRIES=3
```

### 2. Basic Module Setup

```typescript
// apps/auth-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { RedisModule, AuthRedisService } from '@usecapsule/redis';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: AuthRedisService.createConfigFactory(),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthRedisService],
})
export class AppModule {}
```

### 3. Service Usage

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from '@usecapsule/redis';
import { Cache, RateLimit } from '@usecapsule/shared-redis';

@Injectable()
export class UserService {
  constructor(private readonly redisService: RedisService) {}

  @Cache({ prefix: 'user', ttl: 300 })
  async findById(id: string): Promise<User> {
    return this.userRepository.findById(id);
  }

  @RateLimit({ windowSize: 60, limit: 10 })
  async createUser(userData: CreateUserDto): Promise<User> {
    return this.userRepository.create(userData);
  }
}
```

## Architecture

### Service Factory Pattern

Each microservice has its own Redis service with optimized configurations:

```typescript
// Service-specific optimizations
const authConfig = createServiceRedisConfig(
  RedisServiceType.AUTH,
  configService,
);
// → Fast session validation, user caching optimizations

const billingConfig = createServiceRedisConfig(
  RedisServiceType.BILLING,
  configService,
);
// → Reliable rate limiting, payment caching optimizations

const deployConfig = createServiceRedisConfig(
  RedisServiceType.DEPLOY,
  configService,
);
// → Job queue reliability, deployment status caching

const monitorConfig = createServiceRedisConfig(
  RedisServiceType.MONITOR,
  configService,
);
// → High-volume metrics, time-based eviction

const gatewayConfig = createServiceRedisConfig(
  RedisServiceType.GATEWAY,
  configService,
);
// → Fast rate limiting, response caching
```

### Configuration Registry

The module provides a central registry for all service configurations:

```typescript
const registry = createServiceRedisRegistry(configService, 'production');
console.log(registry.auth.database); // 0
console.log(registry.billing.keyPrefix); // 'billing:'
console.log(registry.deploy.useCases); // ['cache', 'job-queue']
```

## Shared Utilities (@usecapsule/shared-redis)

### Caching Decorators

```typescript
import { Cache, CacheEvict, CachePut } from '@usecapsule/shared-redis';

@Cache({ prefix: 'user', ttl: 300 })
async getUser(id: string): Promise<User> { ... }

@CacheEvict({ prefix: 'user', allEntries: true })
async clearAllUsers(): Promise<void> { ... }

@CachePut({ prefix: 'user', ttl: 600 })
async updateUser(user: User): Promise<User> { ... }
```

### Rate Limiting

```typescript
import { RateLimit, AuthRateLimit, ApiRateLimit } from '@usecapsule/shared-redis';

@AuthRateLimit() // 5 attempts per 15 minutes
async login(credentials: LoginDto): Promise<AuthResult> { ... }

@ApiRateLimit({ limit: 100 }) // 100 requests per minute
async getData(): Promise<Data[]> { ... }

@RateLimit({ windowSize: 3600, limit: 10 })
async expensiveOperation(): Promise<Result> { ... }
```

### Session Management

```typescript
import { SessionManager } from '@usecapsule/shared-redis';

const sessionManager = new SessionManager(redisClient, {
  keyPrefix: 'session:',
  defaultTTL: 3600,
  rolling: true,
});

const session = await sessionManager.create('user123', { role: 'admin' });
```

### Connection Monitoring

```typescript
import { RedisConnectionUtils } from '@usecapsule/shared-redis';

const connectionUtils = new RedisConnectionUtils(redisClient);
connectionUtils.startMonitoring((health) => {
  if (!health.healthy) {
    console.error('Redis unhealthy:', health.error);
  }
});
```

## Production Deployment

### Cluster Configuration

```bash
REDIS_CLUSTER_ENABLED=true
REDIS_CLUSTER_NODES=redis1:7000,redis2:7001,redis3:7002
```

### Sentinel Configuration

```bash
REDIS_SENTINEL_ENABLED=true
REDIS_SENTINEL_MASTER_NAME=mymaster
REDIS_SENTINEL_NODES=sentinel1:26379,sentinel2:26379
REDIS_SENTINEL_PASSWORD=sentinel_password
```

### Performance Tuning

```bash
# Connection settings
REDIS_CONNECT_TIMEOUT=5000
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
REDIS_KEEP_ALIVE=30000

# Memory management
REDIS_MAX_MEMORY_POLICY=allkeys-lru
```

## Health Monitoring

### Health Check Integration

```typescript
import { RedisHealthService } from '@usecapsule/redis';

@Injectable()
export class HealthService {
  constructor(private readonly redisHealth: RedisHealthService) {}

  async check() {
    const redis = await this.redisHealth.check();
    return { redis };
  }
}
```

### Monitoring Metrics

```typescript
const stats = await redisHealthService.getStats();
// {
//   uptime: 12345,
//   connectedClients: 5,
//   usedMemory: 1024000,
//   hitRatio: 0.95,
//   commandsProcessed: 1000000
// }
```

## Error Handling

The module implements graceful error handling:

- **Connection failures**: Automatic retry with exponential backoff
- **Redis unavailability**: Fail-open behavior for non-critical operations
- **Memory pressure**: Configurable eviction policies
- **Network timeouts**: Configurable timeout settings

## Development vs Production

### Development

```typescript
// Uses localhost Redis with relaxed settings
const config = createServiceRedisConfig(
  RedisServiceType.AUTH,
  configService,
  'development',
);
```

### Production

```typescript
// Uses cluster/sentinel with optimized settings
const config = createServiceRedisConfig(
  RedisServiceType.AUTH,
  configService,
  'production',
);
```

## Testing

The module supports comprehensive testing:

```typescript
describe('Redis Integration', () => {
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        RedisModule.forRoot({
          host: 'localhost',
          port: 6379,
          database: 15, // Test database
        }),
      ],
    }).compile();
  });
});
```

## Migration from Manual Redis Setup

If you have existing Redis code, migration is straightforward:

```typescript
// Before
const redis = new Redis({ host: 'localhost', port: 6379 });
await redis.set('key', 'value');

// After
@Injectable()
export class MyService {
  constructor(private readonly redisService: RedisService) {}

  async setValue() {
    await this.redisService.set('key', 'value');
  }
}
```

## Best Practices

1. **Use service-specific configurations** for optimal performance
2. **Implement health checks** for production monitoring
3. **Configure appropriate TTLs** based on data characteristics
4. **Use caching decorators** for transparent caching
5. **Apply rate limiting** to protect against abuse
6. **Monitor memory usage** and configure eviction policies
7. **Test Redis operations** in your test suites
8. **Handle errors gracefully** with proper fallbacks

## Related Modules

- `@usecapsule/database` - Database configuration with similar patterns
- `@usecapsule/shared-redis` - Shared Redis utilities and decorators
- `@usecapsule/observability` - Monitoring and metrics integration

## License

Private - Capsule Platform

## Support

For questions and support, please refer to the [USAGE.md](./USAGE.md) file for detailed examples and troubleshooting guidance.
