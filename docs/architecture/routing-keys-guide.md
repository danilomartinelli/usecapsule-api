# RabbitMQ Routing Keys Architecture Guide

## Overview

This document provides comprehensive guidelines for the centralized RabbitMQ routing key management system in the Capsule Platform. All routing keys are now managed through centralized constants to ensure consistency, maintainability, and type safety across the entire monorepo.

## Architecture Philosophy

### Centralized Constants Pattern

The platform uses a **centralized constants approach** where all routing keys are defined in a single source of truth:

```typescript
// Located at: libs/shared/messaging/src/lib/constants.ts
import {
  AUTH_ROUTING_KEYS,
  BILLING_ROUTING_KEYS,
  DEPLOY_ROUTING_KEYS,
  MONITOR_ROUTING_KEYS,
  EVENT_ROUTING_KEYS,
  EXCHANGES,
} from '@usecapsule/messaging/constants';
```

### Benefits of This Approach

1. **Single Source of Truth**: All routing keys defined in one location
2. **Type Safety**: TypeScript enums and const assertions prevent typos
3. **Refactoring Safety**: IDE-assisted refactoring across the entire codebase
4. **Documentation**: Self-documenting code with clear naming conventions
5. **Backward Compatibility**: Legacy patterns maintained during transition

## Exchange Architecture

### Exchange Types and Usage

The platform uses three primary exchanges:

```typescript
export const EXCHANGES = {
  // Direct exchange for RPC commands (request/response)
  COMMANDS: 'capsule.commands',

  // Topic exchange for events (fire-and-forget)
  EVENTS: 'capsule.events',

  // Dead letter exchange for failed messages
  DEAD_LETTER: 'dlx',
} as const;
```

#### Exchange Selection Rules

- **Use `EXCHANGES.COMMANDS`** for:
  - Health checks
  - Service commands requiring responses
  - RPC-style operations
  - Direct service-to-service communication

- **Use `EXCHANGES.EVENTS`** for:
  - Domain events
  - Pub/Sub patterns
  - Cross-service notifications
  - Event sourcing scenarios

## Routing Key Naming Conventions

### Command Routing Keys Format

**Pattern**: `{service}.{action}`

```typescript
// Service-specific command routing keys
AUTH_ROUTING_KEYS = {
  HEALTH: 'auth.health',
  LOGIN: 'auth.login',
  REGISTER: 'auth.register',
  // ... more actions
};
```

### Event Routing Keys Format

**Pattern**: `{entity}.{event}`

```typescript
// Domain event routing keys
EVENT_ROUTING_KEYS = {
  USER_CREATED: 'user.created',
  PAYMENT_PROCESSED: 'payment.processed',
  DEPLOYMENT_STARTED: 'deployment.started',
  // ... more events
};
```

### Pattern Matching Routing Keys

**Pattern**: `{service}.*` or `{entity}.*`

```typescript
// Wildcard patterns for subscriptions
ROUTING_KEY_PATTERNS = {
  AUTH_ALL: 'auth.*', // All auth service messages
  USER_EVENTS: 'user.*', // All user-related events
  ALL_HEALTH: '*.health', // Health checks from any service
  ALL_EVENTS: '*.*', // All events (use sparingly)
};
```

## Service-Specific Routing Keys

### Authentication Service

```typescript
export const AUTH_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'auth.health',
  STATUS: 'auth.status',

  // Authentication Operations
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',

  // Token Management
  VALIDATE_TOKEN: 'auth.validate-token',
  REFRESH_TOKEN: 'auth.refresh-token',

  // Account Management
  RESET_PASSWORD: 'auth.reset-password',
  UPDATE_PROFILE: 'auth.update-profile',
  GET_USER: 'auth.get-user',
  DELETE_USER: 'auth.delete-user',
} as const;
```

### Billing Service

```typescript
export const BILLING_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'billing.health',
  STATUS: 'billing.status',

  // Payment Processing
  PROCESS_PAYMENT: 'billing.process-payment',
  CHARGE: 'billing.charge',
  REFUND: 'billing.refund',

  // Subscription Management
  CREATE_SUBSCRIPTION: 'billing.create-subscription',
  CANCEL_SUBSCRIPTION: 'billing.cancel-subscription',
  UPDATE_SUBSCRIPTION: 'billing.update-subscription',

  // Webhooks
  WEBHOOK_STRIPE: 'billing.webhook-stripe',
  WEBHOOK_PAYPAL: 'billing.webhook-paypal',
} as const;
```

### Deploy Service

```typescript
export const DEPLOY_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'deploy.health',
  STATUS: 'deploy.status',

  // Deployment Lifecycle
  CREATE: 'deploy.create',
  UPDATE: 'deploy.update',
  DELETE: 'deploy.delete',
  START: 'deploy.start',
  STOP: 'deploy.stop',

  // Scaling Operations
  SCALE: 'deploy.scale',
  AUTO_SCALE: 'deploy.auto-scale',

  // Version Management
  ROLLBACK: 'deploy.rollback',
  PROMOTE: 'deploy.promote',
} as const;
```

### Monitor Service

```typescript
export const MONITOR_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'monitor.health',
  STATUS: 'monitor.status',

  // Metrics Collection
  COLLECT_METRICS: 'monitor.collect-metrics',
  GET_METRICS: 'monitor.get-metrics',
  TRACK: 'monitor.track',

  // Alerting
  CREATE_ALERT: 'monitor.create-alert',
  UPDATE_ALERT: 'monitor.update-alert',
  TRIGGER_ALERT: 'monitor.trigger-alert',
} as const;
```

## Event Routing Keys

### Domain Events

```typescript
export const EVENT_ROUTING_KEYS = {
  // User Lifecycle Events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',

  // Payment Events
  PAYMENT_PROCESSED: 'payment.processed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',

  // Deployment Events
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',

  // System Events
  ERROR_OCCURRED: 'error.occurred',
  ALERT_TRIGGERED: 'alert.triggered',
  SERVICE_DOWN: 'service.down',
  SERVICE_UP: 'service.up',
} as const;
```

## Usage Patterns

### Message Handlers

#### RPC Handlers (Commands)

```typescript
import { RabbitRPC } from '@usecapsule/rabbitmq';
import { EXCHANGES, AUTH_ROUTING_KEYS } from '@usecapsule/messaging/constants';

@Controller()
export class AuthController {
  @RabbitRPC({
    exchange: EXCHANGES.COMMANDS,
    routingKey: AUTH_ROUTING_KEYS.HEALTH,
  })
  healthCheck(): HealthCheckResponse {
    return this.authService.getHealthStatus();
  }

  @RabbitRPC({
    exchange: EXCHANGES.COMMANDS,
    routingKey: AUTH_ROUTING_KEYS.LOGIN,
  })
  login(@Payload() loginDto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(loginDto);
  }
}
```

#### Event Subscribers

```typescript
import { RabbitSubscribe } from '@usecapsule/rabbitmq';
import { EXCHANGES, EVENT_ROUTING_KEYS } from '@usecapsule/messaging/constants';

@Controller()
export class UserEventHandler {
  @RabbitSubscribe({
    exchange: EXCHANGES.EVENTS,
    routingKey: EVENT_ROUTING_KEYS.USER_CREATED,
  })
  onUserCreated(@Payload() event: UserCreatedEvent): void {
    this.billingService.createCustomerProfile(event.userId);
  }

  @RabbitSubscribe({
    exchange: EXCHANGES.EVENTS,
    routingKey: ROUTING_KEY_PATTERNS.USER_EVENTS, // Wildcard pattern
  })
  onAnyUserEvent(@Payload() event: any, @Ctx() context: RmqContext): void {
    const routingKey = context.getChannelRef().properties.routingKey;
    this.auditService.logUserEvent(routingKey, event);
  }
}
```

### Message Publishers

#### Command Publishing (RPC)

```typescript
import { AmqpConnection } from '@usecapsule/rabbitmq';
import { EXCHANGES, AUTH_ROUTING_KEYS } from '@usecapsule/messaging/constants';

@Injectable()
export class ApiGatewayService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async checkAuthHealth(): Promise<HealthCheckResponse> {
    return this.amqpConnection.request({
      exchange: EXCHANGES.COMMANDS,
      routingKey: AUTH_ROUTING_KEYS.HEALTH,
      payload: {},
      timeout: 5000,
    });
  }

  async registerUser(userData: RegisterUserDto): Promise<AuthResponse> {
    return this.amqpConnection.request({
      exchange: EXCHANGES.COMMANDS,
      routingKey: AUTH_ROUTING_KEYS.REGISTER,
      payload: userData,
      timeout: 10000,
    });
  }
}
```

#### Event Publishing

```typescript
import { AmqpConnection } from '@usecapsule/rabbitmq';
import { EXCHANGES, EVENT_ROUTING_KEYS } from '@usecapsule/messaging/constants';

@Injectable()
export class UserService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    const user = await this.userRepository.create(userData);

    // Publish domain event
    await this.amqpConnection.publish(
      EXCHANGES.EVENTS,
      EVENT_ROUTING_KEYS.USER_CREATED,
      {
        userId: user.id,
        email: user.email,
        createdAt: user.createdAt,
        metadata: {
          source: 'auth-service',
          version: '1.0',
        },
      },
    );

    return user;
  }
}
```

## Type Safety Features

### Type Definitions

```typescript
// Union types for compile-time validation
export type CommandRoutingKey =
  | (typeof AUTH_ROUTING_KEYS)[keyof typeof AUTH_ROUTING_KEYS]
  | (typeof BILLING_ROUTING_KEYS)[keyof typeof BILLING_ROUTING_KEYS]
  | (typeof DEPLOY_ROUTING_KEYS)[keyof typeof DEPLOY_ROUTING_KEYS]
  | (typeof MONITOR_ROUTING_KEYS)[keyof typeof MONITOR_ROUTING_KEYS];

export type EventRoutingKey =
  (typeof EVENT_ROUTING_KEYS)[keyof typeof EVENT_ROUTING_KEYS];

export type HealthRoutingKey =
  | typeof AUTH_ROUTING_KEYS.HEALTH
  | typeof BILLING_ROUTING_KEYS.HEALTH
  | typeof DEPLOY_ROUTING_KEYS.HEALTH
  | typeof MONITOR_ROUTING_KEYS.HEALTH;
```

### Utility Functions

```typescript
// Extract service name from routing key
function getServiceFromRoutingKey(routingKey: string): string {
  return routingKey.split('.')[0];
}

// Validate routing key format
function isValidRoutingKey(routingKey: string): boolean {
  return /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(
    routingKey,
  );
}

// Check if routing key is for health checks
function isHealthCheckRoutingKey(
  routingKey: string,
): routingKey is HealthRoutingKey {
  return routingKey.endsWith('.health');
}

// Get appropriate exchange for routing key
function getExchangeForRoutingKey(
  routingKey: CommandRoutingKey | EventRoutingKey,
): ExchangeName {
  const parts = routingKey.split('.');
  const firstPart = parts[0];

  // Service commands use COMMANDS exchange
  if (['auth', 'billing', 'deploy', 'monitor'].includes(firstPart)) {
    return EXCHANGES.COMMANDS;
  }

  // Domain events use EVENTS exchange
  return EXCHANGES.EVENTS;
}
```

## Testing with Constants

### Test Fixtures

```typescript
import {
  AUTH_ROUTING_KEYS,
  BILLING_ROUTING_KEYS,
  EVENT_ROUTING_KEYS,
  EXCHANGES,
} from '@usecapsule/messaging/constants';

export class MessageFixtureFactory {
  static createHealthCheckMessage(serviceName: string): MessageFixture {
    const routingKeyMap = {
      auth: AUTH_ROUTING_KEYS.HEALTH,
      billing: BILLING_ROUTING_KEYS.HEALTH,
      deploy: DEPLOY_ROUTING_KEYS.HEALTH,
      monitor: MONITOR_ROUTING_KEYS.HEALTH,
    };

    return {
      id: uuidv4(),
      content: {},
      routingKey: routingKeyMap[serviceName],
      exchange: EXCHANGES.COMMANDS,
      timestamp: new Date().toISOString(),
    };
  }

  static createUserCreatedEvent(userId: string, email: string): MessageFixture {
    return {
      id: uuidv4(),
      content: { userId, email, createdAt: new Date().toISOString() },
      routingKey: EVENT_ROUTING_KEYS.USER_CREATED,
      exchange: EXCHANGES.EVENTS,
      timestamp: new Date().toISOString(),
    };
  }
}
```

### Integration Tests

```typescript
import {
  AUTH_ROUTING_KEYS,
  BILLING_ROUTING_KEYS,
  ROUTING_KEY_PATTERNS,
  EXCHANGES,
} from '@usecapsule/messaging/constants';

describe('RabbitMQ Routing Integration', () => {
  it('should route auth commands correctly', async () => {
    const message = await rabbitMQClient.publishAndWaitForDelivery(
      EXCHANGES.COMMANDS,
      AUTH_ROUTING_KEYS.HEALTH,
      {},
    );

    expect(message.routingKey).toBe(AUTH_ROUTING_KEYS.HEALTH);
    expect(message.exchange).toBe(EXCHANGES.COMMANDS);
  });

  it('should handle wildcard subscriptions', async () => {
    const subscription = await rabbitMQClient.subscribeToPattern(
      EXCHANGES.COMMANDS,
      ROUTING_KEY_PATTERNS.ALL_HEALTH,
    );

    // This subscription will catch all *.health messages
    expect(subscription.pattern).toBe(ROUTING_KEY_PATTERNS.ALL_HEALTH);
  });
});
```

## Migration Guide

### From Hardcoded Strings

**Before:**

```typescript
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.health',
})
```

**After:**

```typescript
import { EXCHANGES, AUTH_ROUTING_KEYS } from '@usecapsule/messaging/constants';

@RabbitRPC({
  exchange: EXCHANGES.COMMANDS,
  routingKey: AUTH_ROUTING_KEYS.HEALTH,
})
```

### Legacy Support

The system maintains backward compatibility through deprecated constants:

```typescript
// These still work but are deprecated
export const AUTH_PATTERNS = {
  LOGIN: AUTH_ROUTING_KEYS.LOGIN, // maps to new constants
  LOGOUT: AUTH_ROUTING_KEYS.LOGOUT, // maps to new constants
  // ... other mappings
} as const;
```

## Best Practices

### 1. Always Use Constants

❌ **Don't:**

```typescript
routingKey: 'auth.health';
```

✅ **Do:**

```typescript
routingKey: AUTH_ROUTING_KEYS.HEALTH;
```

### 2. Import Only What You Need

❌ **Don't:**

```typescript
import * as Constants from '@usecapsule/messaging/constants';
```

✅ **Do:**

```typescript
import { AUTH_ROUTING_KEYS, EXCHANGES } from '@usecapsule/messaging/constants';
```

### 3. Use Type-Safe Patterns

✅ **Good:**

```typescript
function processHealthCheck(routingKey: HealthRoutingKey) {
  // TypeScript ensures routingKey is a valid health check key
}
```

### 4. Validate in Development

```typescript
if (process.env.NODE_ENV === 'development') {
  console.assert(
    isValidRoutingKey(AUTH_ROUTING_KEYS.HEALTH),
    'Invalid routing key format',
  );
}
```

### 5. Document New Routing Keys

When adding new routing keys:

1. Add to appropriate service constants
2. Update type definitions
3. Add to documentation
4. Create test fixtures
5. Update migration notes

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure the messaging constants library is properly imported
2. **Type Errors**: Use the provided type definitions and utility functions
3. **Routing Failures**: Verify exchange and routing key combinations
4. **Legacy Compatibility**: Use deprecated constants during migration

### Debugging Tools

```typescript
// Log routing key information
console.log('Service:', getServiceFromRoutingKey(routingKey));
console.log('Exchange:', getExchangeForRoutingKey(routingKey));
console.log('Is Health Check:', isHealthCheckRoutingKey(routingKey));

// Validate routing key format
if (!isValidRoutingKey(routingKey)) {
  throw new Error(`Invalid routing key format: ${routingKey}`);
}
```

## Future Considerations

### Planned Enhancements

1. **Code Generation**: Auto-generate routing keys from service definitions
2. **Validation Middleware**: Runtime validation of routing key usage
3. **Metrics Integration**: Track routing key usage patterns
4. **Documentation Sync**: Auto-update documentation from constants

### Deprecation Timeline

- **Phase 1** (Current): Constants available, legacy supported
- **Phase 2** (Next Quarter): Deprecation warnings for legacy patterns
- **Phase 3** (Future): Remove legacy support after full migration

## Conclusion

The centralized routing key management system provides a robust foundation for RabbitMQ messaging in the Capsule Platform. By following these guidelines, developers can ensure consistent, maintainable, and type-safe message routing throughout the application lifecycle.

For questions or suggestions regarding routing key management, please refer to the development team or create an issue in the project repository.
