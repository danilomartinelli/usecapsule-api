# Redis Configuration Usage Guide

This document provides comprehensive examples of how to use the Redis configuration modules in your NestJS microservices.

## Environment Variables

Set up the following environment variables:

```bash
# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=7120
REDIS_PASSWORD=your_redis_password
REDIS_USERNAME=your_redis_username

# Service-specific database numbers
AUTH_REDIS_DB=0
BILLING_REDIS_DB=1
DEPLOY_REDIS_DB=2
MONITOR_REDIS_DB=3
GATEWAY_REDIS_DB=4

# Optional: Cluster Configuration
REDIS_CLUSTER_ENABLED=false
REDIS_CLUSTER_NODES=redis1:7000,redis2:7001,redis3:7002

# Optional: Sentinel Configuration
REDIS_SENTINEL_ENABLED=false
REDIS_SENTINEL_MASTER_NAME=mymaster
REDIS_SENTINEL_NODES=sentinel1:26379,sentinel2:26379,sentinel3:26379

# Performance Tuning
REDIS_CONNECT_TIMEOUT=10000
REDIS_MAX_RETRIES=3
REDIS_RETRY_DELAY=100
REDIS_KEEP_ALIVE=30000
```

## Basic Usage

### 1. Auth Service Configuration

```typescript
// apps/auth-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisModule } from '@usecapsule/redis';
import { AuthRedisService } from '@usecapsule/redis';

@Module({
  imports: [
    ConfigModule.forRoot(),
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: AuthRedisService.createConfigFactory('production'),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthRedisService],
})
export class AppModule {}
```

### 2. Service Implementation with Caching

```typescript
// apps/auth-service/src/modules/users/users.service.ts
import { Injectable } from '@nestjs/common';
import { Cache, CacheEvict } from '@usecapsule/shared-redis';
import { RedisService } from '@usecapsule/redis';

@Injectable()
export class UsersService {
  constructor(private readonly redisService: RedisService) {}

  @Cache({
    prefix: 'user',
    ttl: 300, // 5 minutes
    keyGenerator: (id: string) => `user:${id}`,
  })
  async findById(id: string): Promise<User> {
    // This will be cached automatically
    return this.userRepository.findById(id);
  }

  @CacheEvict({
    prefix: 'user',
    keyGenerator: (user: User) => `user:${user.id}`,
  })
  async update(user: User): Promise<User> {
    // This will evict the cache after update
    return this.userRepository.update(user);
  }

  // Manual Redis operations
  async setUserSession(userId: string, sessionData: any): Promise<void> {
    await this.redisService.set(`session:${userId}`, sessionData, 3600);
  }

  async getUserSession(userId: string): Promise<any> {
    return this.redisService.get(`session:${userId}`);
  }
}
```

### 3. Rate Limiting in API Gateway

```typescript
// apps/api-gateway/src/controllers/auth.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { AuthRateLimit, PublicRateLimit } from '@usecapsule/shared-redis';

@Controller('auth')
export class AuthController {
  @AuthRateLimit({
    limit: 5,
    windowSize: 900, // 15 minutes
    blockDuration: 1800, // 30 minutes
  })
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @PublicRateLimit({
    limit: 3,
    windowSize: 3600, // 1 hour
  })
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
```

### 4. Session Management

```typescript
// apps/auth-service/src/modules/sessions/session.service.ts
import { Injectable } from '@nestjs/common';
import { SessionManager } from '@usecapsule/shared-redis';
import { RedisService } from '@usecapsule/redis';

@Injectable()
export class SessionService {
  private sessionManager: SessionManager;

  constructor(private readonly redisService: RedisService) {
    this.sessionManager = new SessionManager(redisService.getClient(), {
      keyPrefix: 'auth:session:',
      defaultTTL: 3600, // 1 hour
      rolling: true,
      maxDuration: 24 * 60 * 60, // 24 hours
    });
  }

  async createSession(userId: string, userData: any, request: any) {
    return this.sessionManager.create(userId, userData, {
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      persistent: false,
    });
  }

  async getSession(sessionId: string) {
    return this.sessionManager.get(sessionId);
  }

  async destroySession(sessionId: string) {
    return this.sessionManager.destroy(sessionId);
  }

  async destroyAllUserSessions(userId: string) {
    return this.sessionManager.destroyUserSessions(userId);
  }
}
```

### 5. Health Checks

```typescript
// apps/auth-service/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { RedisHealthService } from '@usecapsule/redis';

@Controller('health')
export class HealthController {
  constructor(private readonly redisHealthService: RedisHealthService) {}

  @Get()
  async check() {
    const redisHealth = await this.redisHealthService.check();

    return {
      status: redisHealth.status,
      timestamp: new Date().toISOString(),
      services: {
        redis: redisHealth,
        // other services...
      },
    };
  }

  @Get('detailed')
  async checkDetailed() {
    const redisHealth = await this.redisHealthService.checkDetailed();
    const redisStats = await this.redisHealthService.getStats();

    return {
      status: redisHealth.status,
      timestamp: new Date().toISOString(),
      services: {
        redis: {
          ...redisHealth,
          stats: redisStats,
        },
      },
    };
  }
}
```

## Advanced Usage

### 1. Global Interceptors and Guards

```typescript
// apps/api-gateway/src/app.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { CacheInterceptor, RateLimitGuard } from '@usecapsule/shared-redis';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
  ],
})
export class AppModule {}
```

### 2. Connection Monitoring

```typescript
// apps/monitor-service/src/redis-monitor.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisConnectionUtils } from '@usecapsule/shared-redis';
import { RedisService } from '@usecapsule/redis';

@Injectable()
export class RedisMonitorService implements OnModuleInit, OnModuleDestroy {
  private connectionUtils: RedisConnectionUtils;

  constructor(private readonly redisService: RedisService) {
    this.connectionUtils = new RedisConnectionUtils(redisService.getClient());
  }

  onModuleInit() {
    // Start monitoring Redis connection
    this.connectionUtils.startMonitoring((health) => {
      if (!health.healthy) {
        console.error('Redis connection unhealthy:', health.error);
        // Send alert, log to monitoring system, etc.
      }
    }, 30000); // Check every 30 seconds
  }

  onModuleDestroy() {
    this.connectionUtils.destroy();
  }

  async getConnectionStats() {
    return {
      health: await this.connectionUtils.checkHealth(),
      uptime: this.connectionUtils.getUptimeStats(),
      test: await this.connectionUtils.testConnection(),
    };
  }
}
```

### 3. Service-Specific Configurations

```typescript
// apps/billing-service/src/app.module.ts
import { Module } from '@nestjs/common';
import { BillingRedisService } from '@usecapsule/redis';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (billingRedisService: BillingRedisService) => {
        // Get optimized settings for billing workload
        return billingRedisService.getOptimizedSettings();
      },
      inject: [BillingRedisService],
    }),
  ],
  providers: [BillingRedisService],
})
export class AppModule {}
```

### 4. Custom Cache Strategies

```typescript
// apps/billing-service/src/payment.service.ts
@Injectable()
export class PaymentService {
  constructor(private readonly redisService: RedisService) {}

  @Cache({
    prefix: 'payment',
    ttl: 600, // 10 minutes
    condition: (amount: number) => amount > 100, // Only cache large payments
    cacheNull: false, // Don't cache null results
  })
  async getPaymentDetails(paymentId: string): Promise<Payment | null> {
    return this.paymentRepository.findById(paymentId);
  }

  @CachePut({
    prefix: 'payment',
    keyGenerator: (payment: Payment) => `payment:${payment.id}`,
    ttl: 3600,
  })
  async createPayment(paymentData: CreatePaymentDto): Promise<Payment> {
    // This will cache the result after creation
    return this.paymentRepository.create(paymentData);
  }
}
```

## Testing

### Redis Service Testing

```typescript
// test/redis.service.spec.ts
import { Test } from '@nestjs/testing';
import { RedisService, RedisModule } from '@usecapsule/redis';

describe('RedisService', () => {
  let service: RedisService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        RedisModule.forRoot({
          host: 'localhost',
          port: 6379,
          database: 15, // Use a test database
        }),
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should set and get values', async () => {
    await service.set('test:key', { value: 'test' }, 60);
    const result = await service.get('test:key');
    expect(result).toEqual({ value: 'test' });
  });

  it('should handle TTL correctly', async () => {
    await service.set('test:ttl', 'value', 1);
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const result = await service.get('test:ttl');
    expect(result).toBeNull();
  });
});
```

## Best Practices

1. **Use service-specific databases**: Each microservice should use its own Redis database number
2. **Configure appropriate TTLs**: Set reasonable cache expiration times based on data volatility
3. **Monitor memory usage**: Keep track of Redis memory usage and configure eviction policies
4. **Use compression for large values**: Enable compression for values larger than 1KB
5. **Implement proper error handling**: Always handle Redis connection errors gracefully
6. **Use health checks**: Implement comprehensive health checks for monitoring
7. **Test thoroughly**: Test Redis operations in your unit and integration tests
8. **Use rate limiting judiciously**: Apply rate limiting to protect against abuse
9. **Cache strategically**: Cache frequently accessed, expensive-to-compute data
10. **Clean up expired data**: Implement cleanup mechanisms for expired sessions and cache entries

## Troubleshooting

### Common Issues

1. **Connection timeouts**: Increase `REDIS_CONNECT_TIMEOUT` or check network connectivity
2. **Memory issues**: Monitor Redis memory usage and configure appropriate eviction policies
3. **Cache misses**: Verify cache key generation and TTL settings
4. **Rate limit false positives**: Adjust rate limit thresholds and key generation logic
5. **Session management issues**: Check session TTL and cleanup mechanisms

### Debugging

Enable Redis logging to troubleshoot issues:

```typescript
// Enable debug logging
const redisService = new RedisService(redisClient);
redisService.getClient().on('error', (err) => {
  console.error('Redis error:', err);
});

redisService.getClient().on('connect', () => {
  console.log('Redis connected');
});
```
