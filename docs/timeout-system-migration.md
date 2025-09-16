# Timeout System Migration Guide

This guide provides a complete walkthrough for migrating from hardcoded timeouts to the new configurable per-service timeout system.

## Overview

The new timeout system provides:

- **Per-service timeout configuration** with environment variable support
- **Service tiers** (critical, standard, non-critical) for intelligent defaults
- **Environment-based scaling** for production vs development
- **Centralized timeout resolution** with fallback mechanisms
- **Debug endpoints** for troubleshooting timeout configurations

## Migration Steps

### 1. Update Dependencies

Ensure your service imports the latest `@usecapsule/parameters` and `@usecapsule/rabbitmq` libraries:

```typescript
// Your service module
import { TimeoutAwareAmqpService } from '@usecapsule/rabbitmq';
import {
  timeoutConfigSchema,
  TimeoutResolver,
  TimeoutOperation,
} from '@usecapsule/parameters';
```

### 2. Update Service Modules

#### API Gateway

Replace direct `AmqpConnection` usage with `TimeoutAwareAmqpService`:

```typescript
// Before (old way)
import { AmqpConnection } from '@usecapsule/rabbitmq';

@Injectable()
export class AppService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async callService() {
    return this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: 'auth.register',
      payload: {},
      timeout: 5000, // Hardcoded timeout
    });
  }
}

// After (new way)
import { TimeoutAwareAmqpService } from '@usecapsule/rabbitmq';

@Injectable()
export class AppService {
  constructor(private readonly amqpService: TimeoutAwareAmqpService) {}

  async callService() {
    return this.amqpService.request({
      exchange: 'capsule.commands',
      routingKey: 'auth.register',
      payload: {},
      serviceName: 'auth-service', // Service name for timeout resolution
    });
  }
}
```

#### Microservices

Microservices don't need major changes as they primarily handle incoming requests. However, if they make outbound RPC calls to other services, apply the same pattern as the API Gateway.

### 3. Environment Configuration

Add timeout configuration to your environment files:

```bash
# .env.development
RABBITMQ_DEFAULT_TIMEOUT=4000
HEALTH_CHECK_TIMEOUT=2500
AUTH_SERVICE_TIMEOUT=1800
BILLING_SERVICE_TIMEOUT=6000
ENABLE_TIMEOUT_SCALING=true
DEVELOPMENT_TIMEOUT_SCALE_FACTOR=0.8

# .env.production
RABBITMQ_DEFAULT_TIMEOUT=8000
HEALTH_CHECK_TIMEOUT=5000
AUTH_SERVICE_TIMEOUT=3000
BILLING_SERVICE_TIMEOUT=12000
ENABLE_TIMEOUT_SCALING=true
PRODUCTION_TIMEOUT_SCALE_FACTOR=1.8
```

### 4. Update Health Checks

Replace hardcoded health check calls:

```typescript
// Before
async checkHealth() {
  return this.amqpConnection.request({
    exchange: 'capsule.commands',
    routingKey: 'auth.health',
    payload: {},
    timeout: 5000,
  });
}

// After
async checkHealth() {
  return this.amqpService.healthCheck('auth-service', 'auth.health');
}
```

### 5. Service-Specific Request Patterns

#### Authentication Service Calls

```typescript
// User registration
async registerUser(userData: RegisterUserDto) {
  return this.amqpService.request({
    exchange: 'capsule.commands',
    routingKey: 'auth.register',
    payload: userData,
    serviceName: 'auth-service', // Critical tier - short timeout
    operation: TimeoutOperation.RPC_CALL,
  });
}
```

#### Billing Service Calls

```typescript
// Payment processing
async processPayment(paymentData: PaymentDto) {
  return this.amqpService.request({
    exchange: 'capsule.commands',
    routingKey: 'billing.process',
    payload: paymentData,
    serviceName: 'billing-service', // Standard tier - moderate timeout
    operation: TimeoutOperation.RPC_CALL,
  });
}
```

#### Deployment Service Calls

```typescript
// Container deployment
async deployContainer(deploymentData: DeployDto) {
  return this.amqpService.request({
    exchange: 'capsule.commands',
    routingKey: 'deploy.create',
    payload: deploymentData,
    serviceName: 'deploy-service', // Standard tier but higher specific timeout
    operation: TimeoutOperation.RPC_CALL,
  });
}
```

#### Monitor Service Calls

```typescript
// Metrics collection
async collectMetrics(metricsData: MetricsDto) {
  return this.amqpService.request({
    exchange: 'capsule.commands',
    routingKey: 'monitor.collect',
    payload: metricsData,
    serviceName: 'monitor-service', // Non-critical tier - longer timeout
    operation: TimeoutOperation.RPC_CALL,
  });
}
```

### 6. Event Publishing

Event publishing doesn't require timeouts but benefits from the service context:

```typescript
// Publishing user created event
async publishUserCreated(userData: User) {
  return this.amqpService.publish({
    exchange: 'capsule.events',
    routingKey: 'user.created',
    payload: userData,
    serviceName: 'auth-service',
    metadata: { eventType: 'user.created' },
  });
}
```

## Service Tier Configuration

The system automatically maps services to tiers:

### Critical Services (2 second default timeout)

- `auth-service`: Authentication, authorization
- Fast failure to prevent cascade failures

### Standard Services (5 second default timeout)

- `billing-service`: Payment processing (but with 8s specific timeout)
- `deploy-service`: Deployment orchestration (but with 15s specific timeout)
- Balanced timeout for business operations

### Non-Critical Services (10 second default timeout)

- `monitor-service`: Metrics and monitoring
- More tolerant of delays and higher latency

## Environment Scaling

The system applies scaling factors based on environment:

### Development/Local

- Scale factor: 0.8 (20% shorter timeouts)
- Faster feedback during development

### Production/Staging

- Scale factor: 1.5 (50% longer timeouts)
- More tolerant of network delays and load

### Test

- Scale factor: 0.5 (50% shorter timeouts)
- Fast test execution

## Debugging and Troubleshooting

### Debug Endpoint

Use the debug endpoint to verify timeout configuration:

```bash
curl http://localhost:3000/debug/timeouts
```

Example response:

```json
{
  "environment": "development",
  "scalingEnabled": true,
  "scaleFactor": 0.8,
  "services": {
    "auth-service": {
      "rpc": {
        "timeout": 1600,
        "source": "specific",
        "tier": "critical",
        "scaled": true,
        "scaleFactor": 0.8,
        "originalTimeout": 2000
      },
      "healthCheck": {
        "timeout": 2400,
        "source": "specific",
        "tier": "critical",
        "scaled": true
      }
    }
  },
  "defaults": {
    "rabbitmq": 4000,
    "healthCheck": 2400,
    "database": 8000,
    "http": 24000
  }
}
```

### Common Issues and Solutions

#### Issue: Service timeouts too short in production

**Solution**: Increase production scale factor or service-specific timeout:

```bash
# Increase global scaling
PRODUCTION_TIMEOUT_SCALE_FACTOR=2.0

# Or increase specific service timeout
BILLING_SERVICE_TIMEOUT=15000
```

#### Issue: Tests failing due to timeouts

Tests automatically use 0.5x scaling. If still failing:

```bash
# Disable scaling for tests
ENABLE_TIMEOUT_SCALING=false

# Or set NODE_ENV=test to ensure test scaling
NODE_ENV=test
```

#### Issue: Unknown service using wrong timeout

The system extracts service name from routing key. Ensure routing keys follow the pattern:

```
{service}.{action}
```

Examples:

- `auth.register` → `auth-service`
- `billing.charge` → `billing-service`
- `deploy.create` → `deploy-service`

## Testing the Migration

### Unit Tests

Test timeout resolution:

```typescript
import { TimeoutResolver, TimeoutOperation } from '@usecapsule/parameters';

describe('Timeout Resolution', () => {
  let resolver: TimeoutResolver;

  beforeEach(() => {
    const config = {
      AUTH_SERVICE_TIMEOUT: 2000,
      HEALTH_CHECK_TIMEOUT: 3000,
      ENABLE_TIMEOUT_SCALING: true,
      DEVELOPMENT_TIMEOUT_SCALE_FACTOR: 0.8,
    };
    resolver = new TimeoutResolver(config, 'development');
  });

  it('should resolve auth service timeout with scaling', () => {
    const result = resolver.resolveTimeout(
      'auth-service',
      TimeoutOperation.RPC_CALL,
    );

    expect(result.timeout).toBe(1600); // 2000 * 0.8
    expect(result.source).toBe('specific');
    expect(result.tier).toBe('critical');
    expect(result.scaled).toBe(true);
  });
});
```

### Integration Tests

Test service communication with new timeout system:

```typescript
describe('Service Communication', () => {
  it('should use correct timeout for auth service calls', async () => {
    const response = await amqpService.request({
      exchange: 'capsule.commands',
      routingKey: 'auth.health',
      serviceName: 'auth-service',
    });

    expect(response.timeout).toBeLessThan(3000); // Should use critical service timeout
    expect(response.serviceName).toBe('auth-service');
  });
});
```

## Rollback Plan

If issues arise, you can temporarily revert to hardcoded timeouts:

1. **Quick fix**: Set all timeouts to previous hardcoded values:

   ```bash
   RABBITMQ_DEFAULT_TIMEOUT=5000
   HEALTH_CHECK_TIMEOUT=5000
   AUTH_SERVICE_TIMEOUT=5000
   BILLING_SERVICE_TIMEOUT=5000
   DEPLOY_SERVICE_TIMEOUT=5000
   MONITOR_SERVICE_TIMEOUT=5000
   ENABLE_TIMEOUT_SCALING=false
   ```

2. **Full rollback**: Revert code changes and use direct `AmqpConnection` with hardcoded timeouts.

## Performance Considerations

### Timeout Tuning Guidelines

1. **Start with defaults** and adjust based on actual performance metrics
2. **Monitor timeout-related failures** in production logs
3. **Use shorter timeouts for critical path operations** (auth, security)
4. **Allow longer timeouts for background operations** (analytics, reporting)
5. **Scale timeouts based on expected load** and network conditions

### Monitoring Recommendations

1. **Track timeout distribution** across services
2. **Monitor success/failure rates** after timeout changes
3. **Alert on high timeout rates** for critical services
4. **Use the debug endpoint** to verify configuration in each environment

## Best Practices

1. **Use service names consistently** in all RPC calls for proper timeout resolution
2. **Set operation types explicitly** for different use cases (RPC_CALL vs HEALTH_CHECK)
3. **Configure environment-specific timeouts** rather than using the same values everywhere
4. **Document timeout requirements** for each service and operation type
5. **Test timeout behavior** under various network conditions and loads

## Next Steps

After successful migration:

1. **Monitor service performance** and adjust timeouts based on real-world metrics
2. **Implement timeout alerting** for operations that frequently exceed timeouts
3. **Consider circuit breaker patterns** for services with high timeout rates
4. **Document service-specific timeout requirements** for future developers

This migration provides a foundation for more sophisticated timeout management and can be extended with additional features like dynamic timeout adjustment based on service health metrics.
