# Domain-Driven Design Architecture for @golevelup/nestjs-rabbitmq Migration

## Executive Summary

This document presents a comprehensive DDD-compliant architecture for migrating the Capsule Platform from the current NestJS microservices transport layer to @golevelup/nestjs-rabbitmq. The architecture maintains strict bounded context isolation, supports both command/query (RPC) and event-driven patterns, and ensures domain logic remains pure and testable.

## Table of Contents

1. [Core Architecture Principles](#core-architecture-principles)
2. [Layered Architecture Design](#layered-architecture-design)
3. [Bounded Context Integration](#bounded-context-integration)
4. [Message Handling Patterns](#message-handling-patterns)
5. [Implementation Structure](#implementation-structure)
6. [Migration Strategy](#migration-strategy)
7. [Code Examples](#code-examples)

## Core Architecture Principles

### 1. Hexagonal Architecture Within Each Bounded Context

Each microservice implements hexagonal (ports and adapters) architecture:

```
apps/[service-name]/
├── src/
│   ├── domain/                    # Core Business Logic (Hexagon Interior)
│   │   ├── aggregates/            # Aggregate roots
│   │   ├── entities/              # Domain entities
│   │   ├── value-objects/         # Value objects
│   │   ├── domain-services/       # Domain services
│   │   ├── domain-events/         # Domain event definitions
│   │   └── repositories/          # Repository interfaces (ports)
│   │
│   ├── application/               # Application Layer
│   │   ├── commands/              # Command handlers (use cases)
│   │   ├── queries/               # Query handlers (use cases)
│   │   ├── sagas/                 # Process managers/orchestrators
│   │   ├── dtos/                  # Data transfer objects
│   │   └── ports/                 # Input/Output port interfaces
│   │
│   ├── infrastructure/            # Infrastructure Layer (Adapters)
│   │   ├── messaging/             # RabbitMQ adapters
│   │   │   ├── handlers/          # @RabbitRPC and @RabbitSubscribe handlers
│   │   │   ├── publishers/        # Event/Command publishers
│   │   │   └── mappers/           # Message to domain mappers
│   │   ├── persistence/           # Database adapters
│   │   │   ├── repositories/      # Repository implementations
│   │   │   ├── entities/          # TypeORM/Prisma entities
│   │   │   └── mappers/           # Domain to persistence mappers
│   │   └── external/              # External service adapters
│   │
│   └── presentation/              # Presentation Layer (Optional for Gateway)
│       ├── http/                  # REST controllers (API Gateway only)
│       ├── graphql/               # GraphQL resolvers (if needed)
│       └── websocket/             # WebSocket gateways (if needed)
```

### 2. Anti-Corruption Layer Pattern

Each bounded context implements an Anti-Corruption Layer (ACL) to protect its domain model from external influences:

```typescript
// libs/shared/ddd/src/lib/anti-corruption/
export abstract class AntiCorruptionLayer<TExternal, TDomain> {
  abstract toDomain(external: TExternal): TDomain;
  abstract toExternal(domain: TDomain): TExternal;
}

// Example implementation in auth-service
export class UserMessageMapper extends AntiCorruptionLayer<
  UserCreatedMessage,
  UserCreatedEvent
> {
  toDomain(message: UserCreatedMessage): UserCreatedEvent {
    return new UserCreatedEvent(
      new UserId(message.userId),
      new Email(message.email),
      new Username(message.username),
      new Date(message.timestamp),
    );
  }

  toExternal(event: UserCreatedEvent): UserCreatedMessage {
    return {
      userId: event.userId.value,
      email: event.email.value,
      username: event.username.value,
      timestamp: event.occurredAt.toISOString(),
    };
  }
}
```

### 3. Domain Event Publishing Pattern

Domain events are published through a domain-agnostic interface:

```typescript
// Domain layer - Pure, no infrastructure dependencies
export interface DomainEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishAll(events: DomainEvent[]): Promise<void>;
}

// Infrastructure layer - RabbitMQ implementation
@Injectable()
export class RabbitMQEventPublisher implements DomainEventPublisher {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publish(event: DomainEvent): Promise<void> {
    const routingKey = this.getRoutingKey(event);
    const message = this.eventMapper.toMessage(event);

    await this.amqpConnection.publish('capsule.events', routingKey, message);
  }
}
```

## Layered Architecture Design

### Domain Layer (Core Business Logic)

The domain layer remains completely pure with no infrastructure dependencies:

```typescript
// apps/auth-service/src/domain/aggregates/user/user.aggregate.ts
export class User extends AggregateRoot {
  private constructor(
    private readonly id: UserId,
    private email: Email,
    private username: Username,
    private passwordHash: PasswordHash,
    private status: UserStatus
  ) {
    super();
  }

  static create(props: CreateUserProps): Result<User> {
    // Domain validation logic
    const user = new User(...);
    user.addDomainEvent(new UserCreatedEvent(user.id, user.email, user.username));
    return Result.ok(user);
  }

  changeEmail(newEmail: Email): Result<void> {
    // Business rule validation
    if (this.status !== UserStatus.ACTIVE) {
      return Result.fail('Cannot change email for inactive user');
    }

    this.email = newEmail;
    this.addDomainEvent(new UserEmailChangedEvent(this.id, newEmail));
    return Result.ok();
  }
}
```

### Application Layer (Use Cases)

Application services orchestrate domain logic and handle cross-cutting concerns:

```typescript
// apps/auth-service/src/application/commands/register-user.command.ts
export class RegisterUserCommand {
  constructor(
    public readonly email: string,
    public readonly username: string,
    public readonly password: string,
  ) {}
}

@Injectable()
export class RegisterUserCommandHandler
  implements ICommandHandler<RegisterUserCommand>
{
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventPublisher: DomainEventPublisher,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(command: RegisterUserCommand): Promise<Result<UserDto>> {
    return this.unitOfWork.execute(async () => {
      // Check business invariants
      const existingUser = await this.userRepository.findByEmail(command.email);
      if (existingUser) {
        return Result.fail('Email already registered');
      }

      // Create domain entity
      const userResult = User.create({
        email: Email.create(command.email),
        username: Username.create(command.username),
        password: await Password.hash(command.password),
      });

      if (userResult.isFailure) {
        return Result.fail(userResult.error);
      }

      // Persist through repository
      const user = userResult.getValue();
      await this.userRepository.save(user);

      // Publish domain events
      await this.eventPublisher.publishAll(user.getUncommittedEvents());
      user.markEventsAsCommitted();

      return Result.ok(UserMapper.toDto(user));
    });
  }
}
```

### Infrastructure Layer (Adapters)

#### RabbitMQ Message Handlers

Message handlers act as adapters between RabbitMQ and application services:

```typescript
// apps/auth-service/src/infrastructure/messaging/handlers/auth.message-handler.ts
@Injectable()
export class AuthMessageHandler {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly messageMapper: AuthMessageMapper,
  ) {}

  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.register',
    queue: 'auth_queue',
    errorBehavior: MessageHandlerErrorBehavior.NACK,
    errorHandler: AuthErrorHandler,
  })
  async handleRegisterUser(
    message: RegisterUserMessage,
  ): Promise<UserResponseMessage> {
    try {
      // Map external message to application command
      const command = this.messageMapper.toRegisterCommand(message);

      // Execute command through application layer
      const result = await this.commandBus.execute(command);

      if (result.isFailure) {
        throw new BusinessRuleViolationException(result.error);
      }

      // Map domain result to external message
      return this.messageMapper.toUserResponse(result.getValue());
    } catch (error) {
      // Error handling and dead letter queue routing
      throw new MessageProcessingException(error, message);
    }
  }

  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'billing.subscription.created',
    queue: 'auth_queue_billing_events',
    createQueueIfNotExists: true,
  })
  async handleSubscriptionCreated(
    message: SubscriptionCreatedMessage,
  ): Promise<void> {
    // React to events from other bounded contexts
    const command = new UpgradeUserToPremiumCommand(message.userId);
    await this.commandBus.execute(command);
  }
}
```

#### Health Check Handlers

Health checks are infrastructure concerns, separate from domain logic:

```typescript
// apps/auth-service/src/infrastructure/messaging/handlers/health.message-handler.ts
@Injectable()
export class HealthMessageHandler {
  constructor(
    private readonly healthService: HealthCheckService,
    private readonly connection: Connection, // TypeORM/Prisma connection
  ) {}

  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.health',
    queue: 'auth_queue',
    timeout: 5000,
  })
  async handleHealthCheck(): Promise<HealthCheckResponse> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkDomainHealth(),
      this.checkMemory(),
    ]);

    return {
      status: checks.every((c) => c.healthy) ? 'healthy' : 'unhealthy',
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<HealthIndicator> {
    try {
      await this.connection.query('SELECT 1');
      return { name: 'database', healthy: true };
    } catch (error) {
      return { name: 'database', healthy: false, error: error.message };
    }
  }
}
```

## Bounded Context Integration

### 1. Context Mapping

Define explicit relationships between bounded contexts:

```typescript
// libs/shared/context-mapping/src/lib/relationships.ts
export enum ContextRelationship {
  PARTNERSHIP = 'partnership', // Mutual dependency
  SHARED_KERNEL = 'shared_kernel', // Shared domain model
  CUSTOMER_SUPPLIER = 'customer_supplier', // Upstream/downstream
  CONFORMIST = 'conformist', // Downstream conforms to upstream
  ANTICORRUPTION_LAYER = 'acl', // Downstream protects from upstream
  OPEN_HOST_SERVICE = 'ohs', // Published language
  PUBLISHED_LANGUAGE = 'pl', // Well-defined protocol
  SEPARATE_WAYS = 'separate', // No relationship
}

export const CONTEXT_MAP = {
  'auth-billing': {
    relationship: ContextRelationship.CUSTOMER_SUPPLIER,
    upstream: 'auth-service',
    downstream: 'billing-service',
    contract: 'UserEvents',
  },
  'billing-deploy': {
    relationship: ContextRelationship.ANTICORRUPTION_LAYER,
    upstream: 'billing-service',
    downstream: 'deploy-service',
    contract: 'SubscriptionEvents',
  },
};
```

### 2. Shared Kernel

Minimal shared concepts between bounded contexts:

```typescript
// libs/shared/kernel/src/lib/
export class TenantId extends ValueObject<string> {
  // Shared across all contexts for multi-tenancy
}

export class UserId extends ValueObject<string> {
  // Shared identifier for user correlation
}

export class CorrelationId extends ValueObject<string> {
  // For distributed tracing
}
```

### 3. Integration Events

Well-defined contracts for inter-context communication:

```typescript
// libs/shared/contracts/src/lib/events/
export interface IntegrationEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  occurredAt: string;
  correlationId: string;
  causationId?: string;
  metadata: Record<string, unknown>;
}

export interface UserRegisteredEvent extends IntegrationEvent {
  eventType: 'user.registered';
  payload: {
    userId: string;
    email: string;
    username: string;
    tenantId: string;
  };
}
```

## Message Handling Patterns

### 1. Command/Query Separation (CQRS)

Strict separation between commands and queries:

```typescript
// Command Handler - Modifies state
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.register',
  queue: 'auth_queue'
})
async handleRegisterCommand(message: RegisterUserMessage): Promise<CommandResult> {
  // Executes business logic and modifies state
  return this.commandBus.execute(new RegisterUserCommand(message));
}

// Query Handler - Reads state
@RabbitRPC({
  exchange: 'capsule.queries',
  routingKey: 'auth.get-user',
  queue: 'auth_queue'
})
async handleGetUserQuery(message: GetUserMessage): Promise<UserDto> {
  // Only reads, never modifies
  return this.queryBus.execute(new GetUserQuery(message.userId));
}
```

### 2. Event-Driven Communication

Publish-subscribe pattern for domain events:

```typescript
// Publisher (Auth Service)
@Injectable()
export class UserEventPublisher {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publishUserRegistered(event: UserRegisteredDomainEvent): Promise<void> {
    const integrationEvent = this.mapToIntegrationEvent(event);

    await this.amqpConnection.publish(
      'capsule.events',
      'user.registered',
      integrationEvent,
      {
        persistent: true,
        correlationId: event.correlationId
      }
    );
  }
}

// Subscriber (Billing Service)
@RabbitSubscribe({
  exchange: 'capsule.events',
  routingKey: 'user.registered',
  queue: 'billing_queue_user_events'
})
async onUserRegistered(event: UserRegisteredEvent): Promise<void> {
  // Create customer profile in billing context
  await this.commandBus.execute(
    new CreateCustomerCommand(event.payload.userId)
  );
}
```

### 3. Saga Pattern for Distributed Transactions

Long-running business processes across bounded contexts:

```typescript
// apps/api-gateway/src/application/sagas/user-onboarding.saga.ts
@Injectable()
export class UserOnboardingSaga {
  private readonly stateMachine = new SagaStateMachine<OnboardingState>();

  constructor(
    private readonly amqpConnection: AmqpConnection,
    private readonly sagaRepository: SagaRepository,
  ) {}

  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'user.registered',
  })
  async handleUserRegistered(event: UserRegisteredEvent): Promise<void> {
    const saga = await this.sagaRepository.create({
      sagaId: uuid(),
      userId: event.payload.userId,
      state: 'USER_CREATED',
    });

    // Step 1: Create billing customer
    await this.amqpConnection.publish(
      'capsule.commands',
      'billing.create-customer',
      { userId: event.payload.userId, sagaId: saga.id },
    );
  }

  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'billing.customer.created',
  })
  async handleCustomerCreated(event: CustomerCreatedEvent): Promise<void> {
    const saga = await this.sagaRepository.findById(event.sagaId);
    saga.transition('CUSTOMER_CREATED');

    // Step 2: Create default deployment
    await this.amqpConnection.publish(
      'capsule.commands',
      'deploy.create-default',
      { userId: saga.userId, sagaId: saga.id },
    );
  }

  // Compensation handlers for rollback
  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'billing.customer.creation-failed',
  })
  async compensateUserRegistration(
    event: CustomerCreationFailedEvent,
  ): Promise<void> {
    // Rollback user creation
    await this.amqpConnection.publish('capsule.commands', 'auth.delete-user', {
      userId: event.userId,
    });
  }
}
```

## Implementation Structure

### 1. Shared DDD Building Blocks Library

```typescript
// libs/shared/ddd/src/lib/core/
export abstract class AggregateRoot<T> extends Entity<T> {
  private domainEvents: DomainEvent[] = [];

  protected addDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  getUncommittedEvents(): DomainEvent[] {
    return this.domainEvents;
  }

  markEventsAsCommitted(): void {
    this.domainEvents = [];
  }
}

export abstract class ValueObject<T> {
  protected readonly value: T;

  protected constructor(value: T) {
    this.value = Object.freeze(value);
  }

  equals(vo?: ValueObject<T>): boolean {
    if (vo === null || vo === undefined) {
      return false;
    }
    return JSON.stringify(this.value) === JSON.stringify(vo.value);
  }
}

export interface DomainEvent {
  aggregateId: string;
  eventVersion: number;
  occurredAt: Date;
}

export interface Repository<T extends AggregateRoot<any>> {
  findById(id: string): Promise<T | null>;
  save(aggregate: T): Promise<void>;
  delete(aggregate: T): Promise<void>;
}
```

### 2. RabbitMQ Configuration Module

```typescript
// libs/configs/rabbitmq-golevelup/src/lib/rabbitmq.module.ts
@Module({})
export class RabbitMQModule {
  static forRoot(options: RabbitMQModuleOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      imports: [
        RabbitMQCoreModule.forRoot(RabbitMQCoreModule, {
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
            {
              name: 'capsule.queries',
              type: 'direct',
              options: { durable: true },
            },
            {
              name: 'dlx',
              type: 'fanout',
              options: { durable: true },
            },
          ],
          uri: options.uri,
          connectionInitOptions: {
            wait: true,
            timeout: 10000,
          },
          enableControllerDiscovery: true,
          // Global error handling
          defaultRpcErrorBehavior: MessageHandlerErrorBehavior.NACK,
          defaultSubscribeErrorBehavior: MessageHandlerErrorBehavior.NACK,
          // Dead letter configuration
          defaultRpcOptions: {
            queueOptions: {
              durable: true,
              arguments: {
                'x-dead-letter-exchange': 'dlx',
                'x-message-ttl': 21600000, // 6 hours
              },
            },
          },
        }),
      ],
      providers: [DomainEventPublisher, CommandBus, QueryBus, EventBus],
      exports: [
        RabbitMQCoreModule,
        DomainEventPublisher,
        CommandBus,
        QueryBus,
        EventBus,
      ],
    };
  }

  static forMicroservice(options: MicroserviceOptions): DynamicModule {
    return this.forRoot({
      uri: options.uri,
      serviceName: options.serviceName,
      queue: options.queue,
    });
  }
}
```

### 3. Service Bootstrap Configuration

```typescript
// apps/auth-service/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // No need for createMicroservice - @golevelup handles everything
  app.connectMicroservice<MicroserviceOptions>({
    strategy: new RabbitMQServer({
      urls: [process.env.RABBITMQ_URL],
      queue: 'auth_queue',
      noAck: false,
      queueOptions: {
        durable: true,
      },
    }),
  });

  await app.startAllMicroservices();
  await app.listen(3001); // Optional HTTP port for health checks
}
```

### 4. Module Organization

```typescript
// apps/auth-service/src/app/app.module.ts
@Module({
  imports: [
    // Domain Module
    AuthDomainModule,

    // Application Module
    AuthApplicationModule,

    // Infrastructure Modules
    RabbitMQModule.forMicroservice({
      uri: process.env.RABBITMQ_URL,
      serviceName: 'auth-service',
      queue: 'auth_queue',
    }),
    TypeOrmModule.forRoot(databaseConfig),

    // Shared Modules
    DddModule,
    LoggingModule,
    MetricsModule,
  ],
})
export class AppModule {}

// apps/auth-service/src/domain/auth-domain.module.ts
@Module({
  providers: [
    // Domain Services
    UserDomainService,
    PasswordHashingService,

    // Domain Event Handlers
    UserEventHandler,
  ],
  exports: [UserDomainService, PasswordHashingService],
})
export class AuthDomainModule {}

// apps/auth-service/src/application/auth-application.module.ts
@Module({
  imports: [AuthDomainModule],
  providers: [
    // Command Handlers
    RegisterUserCommandHandler,
    UpdateUserCommandHandler,
    DeleteUserCommandHandler,

    // Query Handlers
    GetUserQueryHandler,
    FindUsersQueryHandler,

    // Application Services
    UserApplicationService,

    // Sagas
    UserLifecycleSaga,
  ],
  exports: [CommandBus, QueryBus, EventBus],
})
export class AuthApplicationModule {}

// apps/auth-service/src/infrastructure/auth-infrastructure.module.ts
@Module({
  imports: [AuthApplicationModule, TypeOrmModule.forFeature([UserEntity])],
  providers: [
    // Message Handlers
    AuthMessageHandler,
    HealthMessageHandler,

    // Repository Implementations
    {
      provide: USER_REPOSITORY,
      useClass: TypeOrmUserRepository,
    },

    // Event Publishers
    UserEventPublisher,

    // External Service Adapters
    EmailServiceAdapter,
    NotificationServiceAdapter,
  ],
  exports: [USER_REPOSITORY],
})
export class AuthInfrastructureModule {}
```

## Migration Strategy

### Phase 1: Infrastructure Setup (Week 1)

1. **Install @golevelup/nestjs-rabbitmq**

   ```bash
   npm install @golevelup/nestjs-rabbitmq amqplib
   npm install --save-dev @types/amqplib
   ```

2. **Create shared DDD library**

   ```bash
   nx g @nx/nest:library shared/ddd
   nx g @nx/nest:library shared/contracts
   nx g @nx/nest:library configs/rabbitmq-golevelup
   ```

3. **Set up RabbitMQ configuration module**

### Phase 2: Pilot Service Migration (Week 2)

1. **Select pilot service (recommend auth-service)**
2. **Restructure to hexagonal architecture**
3. **Implement message handlers with @RabbitRPC**
4. **Add comprehensive tests**

### Phase 3: Gateway Integration (Week 3)

1. **Migrate API Gateway to use AmqpConnection**
2. **Implement saga orchestration**
3. **Add circuit breakers and resilience patterns**

### Phase 4: Remaining Services (Weeks 4-5)

1. **Migrate billing-service**
2. **Migrate deploy-service**
3. **Migrate monitor-service**
4. **Integration testing**

### Phase 5: Cleanup and Optimization (Week 6)

1. **Remove old RabbitMQ transport code**
2. **Performance tuning**
3. **Documentation updates**
4. **Production deployment**

## Code Examples

### Example 1: Complete Auth Service Message Handler

```typescript
// apps/auth-service/src/infrastructure/messaging/handlers/auth.message-handler.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  RabbitRPC,
  RabbitSubscribe,
  AmqpConnection,
} from '@golevelup/nestjs-rabbitmq';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  RegisterUserMessage,
  UserResponseMessage,
  LoginMessage,
  LoginResponseMessage,
  ValidateTokenMessage,
  TokenValidationResponse,
} from '@usecapsule/contracts';
import {
  RegisterUserCommand,
  LoginCommand,
  ValidateTokenQuery,
} from '../../../application';
import { AuthMessageMapper } from '../mappers/auth-message.mapper';

@Injectable()
export class AuthMessageHandler {
  private readonly logger = new Logger(AuthMessageHandler.name);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly messageMapper: AuthMessageMapper,
    private readonly amqpConnection: AmqpConnection,
  ) {}

  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.register',
    queue: 'auth_queue',
    errorBehavior: MessageHandlerErrorBehavior.NACK,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'dlx',
        'x-message-ttl': 21600000,
      },
    },
  })
  async handleRegisterUser(
    message: RegisterUserMessage,
  ): Promise<UserResponseMessage> {
    this.logger.log(`Processing user registration for email: ${message.email}`);

    try {
      const command = this.messageMapper.toRegisterCommand(message);
      const result = await this.commandBus.execute(command);

      if (result.isFailure) {
        this.logger.error(`Registration failed: ${result.error}`);
        throw new BusinessRuleViolationException(result.error);
      }

      const response = this.messageMapper.toUserResponse(result.getValue());

      // Publish integration event
      await this.publishUserRegisteredEvent(response);

      return response;
    } catch (error) {
      this.logger.error(
        `Error processing registration: ${error.message}`,
        error.stack,
      );
      throw new MessageProcessingException(error, message);
    }
  }

  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.login',
    queue: 'auth_queue',
  })
  async handleLogin(message: LoginMessage): Promise<LoginResponseMessage> {
    this.logger.log(`Processing login for email: ${message.email}`);

    const command = new LoginCommand(message.email, message.password);
    const result = await this.commandBus.execute(command);

    if (result.isFailure) {
      throw new AuthenticationException(result.error);
    }

    return this.messageMapper.toLoginResponse(result.getValue());
  }

  @RabbitRPC({
    exchange: 'capsule.queries',
    routingKey: 'auth.validate-token',
    queue: 'auth_queue',
  })
  async handleValidateToken(
    message: ValidateTokenMessage,
  ): Promise<TokenValidationResponse> {
    const query = new ValidateTokenQuery(message.token);
    const result = await this.queryBus.execute(query);

    return {
      valid: result.isValid,
      userId: result.userId,
      permissions: result.permissions,
      expiresAt: result.expiresAt,
    };
  }

  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'billing.subscription.cancelled',
    queue: 'auth_queue_billing_events',
    createQueueIfNotExists: true,
  })
  async handleSubscriptionCancelled(
    event: SubscriptionCancelledEvent,
  ): Promise<void> {
    this.logger.log(
      `Processing subscription cancellation for user: ${event.userId}`,
    );

    const command = new DowngradeUserCommand(event.userId);
    await this.commandBus.execute(command);
  }

  private async publishUserRegisteredEvent(
    user: UserResponseMessage,
  ): Promise<void> {
    await this.amqpConnection.publish('capsule.events', 'user.registered', {
      eventId: uuid(),
      eventType: 'user.registered',
      aggregateId: user.id,
      occurredAt: new Date().toISOString(),
      correlationId: this.getCorrelationId(),
      payload: {
        userId: user.id,
        email: user.email,
        username: user.username,
        tenantId: user.tenantId,
      },
    });
  }
}
```

### Example 2: API Gateway with @golevelup

```typescript
// apps/api-gateway/src/infrastructure/messaging/services/gateway-messaging.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { timeout, retry, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class GatewayMessagingService {
  private readonly logger = new Logger(GatewayMessagingService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async sendCommand<T, R>(
    routingKey: string,
    payload: T,
    options?: SendOptions,
  ): Promise<R> {
    try {
      const response = await this.amqpConnection.request<R>({
        exchange: 'capsule.commands',
        routingKey,
        payload,
        timeout: options?.timeout || 10000,
        correlationId: options?.correlationId || uuid(),
      });

      return response;
    } catch (error) {
      this.logger.error(`Command failed: ${routingKey}`, error);

      if (options?.fallback) {
        return options.fallback();
      }

      throw new ServiceUnavailableException(
        `Service handling ${routingKey} is unavailable`,
      );
    }
  }

  async executeQuery<T, R>(routingKey: string, payload: T): Promise<R> {
    return this.amqpConnection.request<R>({
      exchange: 'capsule.queries',
      routingKey,
      payload,
      timeout: 5000,
    });
  }

  async publishEvent(
    routingKey: string,
    event: IntegrationEvent,
  ): Promise<void> {
    await this.amqpConnection.publish('capsule.events', routingKey, event, {
      persistent: true,
      correlationId: event.correlationId,
    });
  }

  async executeHealthCheck(service: string): Promise<HealthCheckResponse> {
    try {
      return await this.amqpConnection.request<HealthCheckResponse>({
        exchange: 'capsule.commands',
        routingKey: `${service}.health`,
        payload: {},
        timeout: 3000,
      });
    } catch (error) {
      return {
        status: 'unhealthy',
        service,
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
```

### Example 3: Unit of Work Pattern

```typescript
// libs/shared/ddd/src/lib/patterns/unit-of-work.ts
export interface UnitOfWork {
  execute<T>(work: () => Promise<T>): Promise<T>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  private queryRunner: QueryRunner;

  constructor(private readonly connection: Connection) {}

  async execute<T>(work: () => Promise<T>): Promise<T> {
    this.queryRunner = this.connection.createQueryRunner();
    await this.queryRunner.connect();
    await this.queryRunner.startTransaction();

    try {
      const result = await work();
      await this.queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await this.queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await this.queryRunner.release();
    }
  }

  async commit(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.commitTransaction();
    }
  }

  async rollback(): Promise<void> {
    if (this.queryRunner) {
      await this.queryRunner.rollbackTransaction();
    }
  }
}
```

## Testing Strategy

### 1. Domain Layer Testing

```typescript
// apps/auth-service/src/domain/aggregates/user/user.aggregate.spec.ts
describe('User Aggregate', () => {
  describe('create', () => {
    it('should create a valid user and emit UserCreatedEvent', () => {
      const result = User.create({
        email: Email.create('test@example.com'),
        username: Username.create('testuser'),
        password: Password.hash('SecurePass123!'),
      });

      expect(result.isSuccess).toBe(true);

      const user = result.getValue();
      const events = user.getUncommittedEvents();

      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(UserCreatedEvent);
    });

    it('should fail with invalid email', () => {
      const result = User.create({
        email: Email.create('invalid-email'),
        username: Username.create('testuser'),
        password: Password.hash('SecurePass123!'),
      });

      expect(result.isFailure).toBe(true);
      expect(result.error).toContain('Invalid email format');
    });
  });
});
```

### 2. Application Layer Testing

```typescript
// apps/auth-service/src/application/commands/register-user.command.spec.ts
describe('RegisterUserCommandHandler', () => {
  let handler: RegisterUserCommandHandler;
  let userRepository: MockType<UserRepository>;
  let eventPublisher: MockType<DomainEventPublisher>;
  let unitOfWork: MockType<UnitOfWork>;

  beforeEach(() => {
    const module = Test.createTestingModule({
      providers: [
        RegisterUserCommandHandler,
        {
          provide: USER_REPOSITORY,
          useFactory: mockRepositoryFactory,
        },
        {
          provide: DOMAIN_EVENT_PUBLISHER,
          useFactory: mockEventPublisherFactory,
        },
        {
          provide: UNIT_OF_WORK,
          useFactory: mockUnitOfWorkFactory,
        },
      ],
    }).compile();

    handler = module.get(RegisterUserCommandHandler);
    userRepository = module.get(USER_REPOSITORY);
    eventPublisher = module.get(DOMAIN_EVENT_PUBLISHER);
    unitOfWork = module.get(UNIT_OF_WORK);
  });

  it('should register a new user successfully', async () => {
    userRepository.findByEmail.mockResolvedValue(null);
    unitOfWork.execute.mockImplementation(async (work) => work());

    const command = new RegisterUserCommand(
      'test@example.com',
      'testuser',
      'SecurePass123!',
    );

    const result = await handler.execute(command);

    expect(result.isSuccess).toBe(true);
    expect(userRepository.save).toHaveBeenCalled();
    expect(eventPublisher.publishAll).toHaveBeenCalled();
  });
});
```

### 3. Infrastructure Layer Testing

```typescript
// apps/auth-service/src/infrastructure/messaging/handlers/auth.message-handler.spec.ts
describe('AuthMessageHandler', () => {
  let handler: AuthMessageHandler;
  let amqpConnection: AmqpConnection;

  beforeEach(() => {
    const module = Test.createTestingModule({
      imports: [
        RabbitMQModule.forTest({
          exchanges: [
            { name: 'capsule.commands', type: 'direct' },
            { name: 'capsule.events', type: 'topic' },
          ],
        }),
      ],
      providers: [AuthMessageHandler, CommandBus, QueryBus],
    }).compile();

    handler = module.get(AuthMessageHandler);
    amqpConnection = module.get(AmqpConnection);
  });

  it('should handle user registration message', async () => {
    const message: RegisterUserMessage = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!',
    };

    const response = await handler.handleRegisterUser(message);

    expect(response).toBeDefined();
    expect(response.email).toBe(message.email);
    expect(amqpConnection.publish).toHaveBeenCalledWith(
      'capsule.events',
      'user.registered',
      expect.any(Object),
    );
  });
});
```

## Monitoring and Observability

### 1. Message Tracing

```typescript
@Injectable()
export class MessageTracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const message = context.switchToRpc().getData();
    const correlationId = message.correlationId || uuid();

    // Set correlation ID in async context
    AsyncLocalStorage.run({ correlationId }, () => {
      Logger.log(`[${correlationId}] Processing message`);
    });

    return next.handle().pipe(
      tap(() =>
        Logger.log(`[${correlationId}] Message processed successfully`),
      ),
      catchError((error) => {
        Logger.error(`[${correlationId}] Message processing failed`, error);
        throw error;
      }),
    );
  }
}
```

### 2. Metrics Collection

```typescript
@Injectable()
export class MessageMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const routingKey = context.switchToRpc().getContext().routingKey;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.metricsService.recordMessageProcessed(
          routingKey,
          duration,
          'success',
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.metricsService.recordMessageProcessed(
          routingKey,
          duration,
          'failure',
        );
        throw error;
      }),
    );
  }
}
```

## Conclusion

This DDD-compliant architecture for @golevelup/nestjs-rabbitmq migration provides:

1. **Clean separation of concerns** through hexagonal architecture
2. **Domain purity** with no infrastructure dependencies in business logic
3. **Bounded context isolation** with explicit integration contracts
4. **Flexible messaging patterns** supporting RPC, events, and sagas
5. **Testability** at all layers with proper abstractions
6. **Scalability** through event-driven architecture
7. **Resilience** with circuit breakers, retries, and dead letter queues
8. **Observability** with comprehensive logging, tracing, and metrics

The architecture maintains the integrity of your Domain-Driven Design while leveraging the full power of @golevelup/nestjs-rabbitmq for reliable, scalable microservice communication.
