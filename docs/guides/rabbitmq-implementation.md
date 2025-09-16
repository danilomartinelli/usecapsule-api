# RabbitMQ Implementation Guide

**Complete guide to the Capsule Platform's RabbitMQ messaging architecture using @golevelup/nestjs-rabbitmq for declarative, exchange-based communication.**

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Concepts](#core-concepts)
3. [Implementation Details](#implementation-details)
4. [Message Patterns](#message-patterns)
5. [Service Configuration](#service-configuration)
6. [Health Check Integration](#health-check-integration)
7. [Error Handling & Dead Letter Queues](#error-handling--dead-letter-queues)
8. [Testing & Debugging](#testing--debugging)
9. [Best Practices](#best-practices)

## Architecture Overview

The Capsule Platform uses RabbitMQ as the central nervous system for all inter-service communication, implementing an exchange-first architecture that ensures decoupled, reliable messaging.

### High-Level Message Flow

```text
┌─────────────┐    ┌─────────────────┐    ┌──────────────┐    ┌─────────────┐
│ HTTP Client │───▶│   API Gateway   │───▶│   RabbitMQ   │───▶│ Microservice│
│             │    │  (Port 3000)    │    │ capsule.     │    │  Handler    │
└─────────────┘    └─────────────────┘    │ commands     │    └─────────────┘
                                          │ Exchange     │           │
                                          └──────────────┘           │
                                                  ▲                  │
                                                  │                  ▼
                                          ┌──────────────┐    ┌─────────────┐
                                          │   RabbitMQ   │◀───│ Domain      │
                                          │ capsule.     │    │ Events      │
                                          │ events       │    └─────────────┘
                                          │ Exchange     │
                                          └──────────────┘
```

### Key Architecture Components

1. **API Gateway**: Single HTTP entry point, publishes to RabbitMQ
2. **Exchange-Based Routing**: All messages flow through named exchanges
3. **Microservice Handlers**: Services consume via @RabbitRPC decorators
4. **Event Publishing**: Domain events for cross-service communication
5. **Dead Letter Queues**: Automatic failure recovery and manual reprocessing

## Core Concepts

### Exchange Types and Purpose

#### 1. capsule.commands (Direct Exchange)

- **Purpose**: RPC-style service commands requiring responses
- **Type**: Direct (exact routing key matching)
- **Pattern**: `{service}.{action}`
- **Examples**: `auth.register`, `billing.charge`, `deploy.create`

#### 2. capsule.events (Topic Exchange)

- **Purpose**: Domain events for publish-subscribe patterns
- **Type**: Topic (wildcard routing key matching)
- **Pattern**: `{context}.{event}`
- **Examples**: `user.created`, `payment.processed`, `deployment.completed`

#### 3. dlx (Dead Letter Exchange)

- **Purpose**: Failed message collection for manual recovery
- **Type**: Fanout (broadcasts to bound queues)
- **Auto-Configuration**: Applied to all service queues

### Message Routing Keys

The platform uses consistent routing key conventions:

```typescript
// Service Commands (Request/Response)
'auth.register'; // User registration
'auth.login'; // User authentication
'auth.health'; // Service health check
'billing.charge'; // Process payment
'deploy.create'; // Create deployment
'monitor.metrics'; // Collect metrics

// Domain Events (Fire-and-Forget)
'user.created'; // New user registered
'user.updated'; // User profile changed
'payment.processed'; // Payment completed
'deployment.failed'; // Deployment error occurred
```

## Implementation Details

### Library Integration

The platform uses `@golevelup/nestjs-rabbitmq` for unified messaging:

```bash
npm install @golevelup/nestjs-rabbitmq
```

### Module Configuration

#### API Gateway Configuration (Publisher/Client)

```typescript
// libs/configs/rabbitmq/src/lib/rabbitmq.module.ts
@Module({})
export class RabbitMQModule {
  static forGateway(options: { uri: string }): DynamicModule {
    return GolevelupRabbitMQModule.forRoot({
      exchanges: [
        {
          name: 'capsule.commands',
          type: 'direct',
          options: { durable: true },
        },
        {
          name: 'capsule.events',
          type: 'topic',
          options: { durable: true },
        },
      ],
      uri: options.uri,
      enableControllerDiscovery: true,
    });
  }
}
```

#### Microservice Configuration (Consumer)

```typescript
// apps/auth-service/src/app/app.module.ts
@Module({
  imports: [
    RabbitMQModule.forMicroservice({
      uri: 'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
      serviceName: 'auth-service',
    }),
  ],
})
export class AppModule {}
```

## Message Patterns

### 1. RPC Commands (Request/Response)

**Use Case**: Operations requiring immediate responses like user registration, payments, deployments.

#### Service Handler (Microservice)

```typescript
// apps/auth-service/src/app/app.controller.ts
import { Controller } from '@nestjs/common';
import { RabbitRPC } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

@Controller()
export class AppController {
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.health',
  })
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }

  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.register',
  })
  async registerUser(
    @RabbitPayload() userData: RegisterUserDto,
  ): Promise<User> {
    return this.authService.register(userData);
  }
}
```

#### Client Usage (API Gateway)

```typescript
// apps/api-gateway/src/modules/auth/auth.service.ts
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class AuthGatewayService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async registerUser(userData: RegisterUserDto): Promise<User> {
    return this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: 'auth.register',
      payload: userData,
      timeout: 10000,
    });
  }

  async checkAuthHealth(): Promise<HealthCheckResponse> {
    return this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: 'auth.health',
      payload: {},
      timeout: 5000,
    });
  }
}
```

### 2. Event Publishing (Fire-and-Forget)

**Use Case**: Domain events that multiple services need to know about (user created, payment processed, etc.).

#### Event Publisher

```typescript
// apps/auth-service/src/modules/user/user.service.ts
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class UserService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async createUser(userData: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(userData);

    // Publish domain event
    await this.amqpConnection.publish('capsule.events', 'user.created', {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    });

    return user;
  }
}
```

#### Event Subscriber

```typescript
// apps/billing-service/src/modules/customer/customer.controller.ts
import { RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';

@Controller()
export class CustomerController {
  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'user.created',
  })
  async onUserCreated(@RabbitPayload() event: UserCreatedEvent): Promise<void> {
    await this.customerService.createCustomerProfile({
      userId: event.userId,
      email: event.email,
    });
  }
}
```

### 3. Health Check Pattern

**Use Case**: System-wide health monitoring across all microservices.

#### Aggregated Health Check (API Gateway)

```typescript
// apps/api-gateway/src/app/app.service.ts
@Injectable()
export class AppService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async checkAllServicesHealth(): Promise<AggregatedHealthResponse> {
    const services: ServiceName[] = [
      'auth-service',
      'billing-service',
      'deploy-service',
      'monitor-service',
    ];

    const healthChecks = await Promise.allSettled(
      services.map((service) => this.checkServiceHealth(service)),
    );

    const servicesHealth: Record<string, HealthCheckResponse> = {};
    let overallStatus = HealthStatus.HEALTHY;

    healthChecks.forEach((result, index) => {
      const serviceName = services[index];
      if (result.status === 'fulfilled') {
        servicesHealth[serviceName] = result.value;
        if (result.value.status === HealthStatus.UNHEALTHY) {
          overallStatus = HealthStatus.UNHEALTHY;
        }
      } else {
        servicesHealth[serviceName] = {
          status: HealthStatus.UNHEALTHY,
          service: serviceName,
          timestamp: new Date().toISOString(),
          metadata: { error: 'Service unreachable' },
        };
        overallStatus = HealthStatus.UNHEALTHY;
      }
    });

    return {
      status: overallStatus,
      services: servicesHealth,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkServiceHealth(
    serviceName: ServiceName,
  ): Promise<HealthCheckResponse> {
    return this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: `${serviceName.replace('-service', '')}.health`,
      payload: {},
      timeout: 5000,
    });
  }
}
```

## Service Configuration

### Environment Configuration

Each service requires RabbitMQ connection configuration:

```bash
# .env
RABBITMQ_URL=amqp://usecapsule:usecapsule_dev_password@localhost:7010
```

### Docker Compose Configuration

```yaml
# compose.yml
services:
  rabbitmq:
    container_name: rabbitmq_dev
    image: rabbitmq:3.13-management
    ports:
      - '7010:5672' # AMQP port
      - '7020:15672' # Management UI port
    environment:
      RABBITMQ_DEFAULT_USER: usecapsule
      RABBITMQ_DEFAULT_PASS: usecapsule_dev_password
      RABBITMQ_DEFAULT_VHOST: /
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
      - ./devtools/infra/rabbitmq/rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 30s
      timeout: 10s
      retries: 5
```

### RabbitMQ Server Configuration

```conf
# devtools/infra/rabbitmq/rabbitmq.conf
## User Settings
default_user = $(RABBITMQ_DEFAULT_USER)
default_pass = $(RABBITMQ_DEFAULT_PASS)

## Network Configuration
listeners.tcp.default = 5672
management.tcp.port = 15672

## Memory and Performance
vm_memory_high_watermark.relative = 0.6
channel_max = 2047
heartbeat = 60

## Message TTL (24 hours)
consumer_timeout = 3600000
```

## Error Handling & Dead Letter Queues

### Automatic DLQ Configuration

All queues are automatically configured with dead letter exchange policies:

```json
{
  "name": "dlq-policy",
  "pattern": "^(?!.*\\.dlq$).*",
  "definition": {
    "dead-letter-exchange": "dlx",
    "dead-letter-routing-key": "dlq"
  }
}
```

### Failure Handling Flow

1. **Message Processing Fails**: Handler throws unhandled exception
2. **Retry Logic**: Automatic retry (up to 3 times with exponential backoff)
3. **DLQ Routing**: After retry exhaustion, message sent to `dlx` exchange
4. **Dead Letter Storage**: Message stored in `dlq` queue with failure metadata
5. **Manual Recovery**: Operations team investigates and reprocesses

### DLQ Monitoring and Recovery

```bash
# Check DLQ messages
docker exec rabbitmq_dev rabbitmqctl list_queues name messages

# Access Management UI for detailed inspection
open http://localhost:7020
# Navigate to Queues -> dlq -> Get Messages
```

## Testing & Debugging

### RabbitMQ Management UI

Access at `http://localhost:7020` with credentials `usecapsule/usecapsule_dev_password`:

1. **Queue Monitoring**: Message counts, consumer information
2. **Exchange Visualization**: Routing topology and bindings
3. **Message Publishing**: Test message routing manually
4. **Performance Metrics**: Throughput and connection statistics

### CLI Debugging Commands

```bash
# Check queue status
docker exec rabbitmq_dev rabbitmqctl list_queues name messages consumers

# Inspect exchange bindings
docker exec rabbitmq_dev rabbitmqctl list_bindings

# Monitor connections
docker exec rabbitmq_dev rabbitmqctl list_connections

# View detailed queue information
docker exec rabbitmq_dev rabbitmqctl list_queues name messages_ready messages_unacknowledged
```

### Manual Message Testing

Use the Management UI to test message routing:

```bash
# Test RPC Command
# Exchange: capsule.commands
# Routing Key: auth.health
# Payload: {}

# Test Event Publishing
# Exchange: capsule.events
# Routing Key: user.created
# Payload: {"userId": "123", "email": "test@example.com"}
```

## Best Practices

### 1. Message Design Patterns

```typescript
// ✅ Good: Type-safe message contracts
interface UserCreatedEvent {
  userId: string;
  email: string;
  timestamp: string;
}

// ✅ Good: Consistent routing keys
const ROUTING_KEYS = {
  AUTH: {
    REGISTER: 'auth.register',
    LOGIN: 'auth.login',
    HEALTH: 'auth.health',
  },
  EVENTS: {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
  },
} as const;
```

### 2. Error Handling

```typescript
// ✅ Good: Graceful error handling with timeouts
async makeRequest(routingKey: string, payload: any): Promise<any> {
  try {
    return await this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey,
      payload,
      timeout: 5000, // Always set timeouts
    });
  } catch (error) {
    // Log error and return fallback
    this.logger.error(`RPC request failed: ${routingKey}`, error);
    throw new ServiceUnavailableException(`${routingKey} service unavailable`);
  }
}
```

### 3. Health Check Implementation

```typescript
// ✅ Good: Comprehensive health checks
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.health',
})
healthCheck(): HealthCheckResponse {
  return {
    status: HealthStatus.HEALTHY,
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    metadata: {
      version: process.env.npm_package_version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
      queue: {
        name: 'auth_queue',
        connected: true,
      },
    },
  };
}
```

### 4. Service Initialization

```typescript
// ✅ Good: Graceful startup with connection verification
async onModuleInit() {
  try {
    // Wait for RabbitMQ connection
    await this.amqpConnection.managedConnection.then(connection =>
      connection.waitForConnect()
    );
    this.logger.log('RabbitMQ connection established');
  } catch (error) {
    this.logger.error('Failed to connect to RabbitMQ', error);
    throw error;
  }
}
```

---

**Next Steps**:

- Review [Message Contracts](../api/message-contracts.md) for detailed payload schemas
- See [Common Issues](../troubleshooting/common-issues.md) for debugging guidance
- Check [Integration Test Examples](../examples/integration-tests.md) for testing patterns
