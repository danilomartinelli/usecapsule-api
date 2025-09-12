# Message Handler Examples

**Comprehensive examples of implementing message handlers in the Capsule Platform using @golevelup/nestjs-rabbitmq.**

## Table of Contents

1. [Basic RPC Handlers](#basic-rpc-handlers)
2. [Event Subscribers](#event-subscribers)
3. [Complex Message Flows](#complex-message-flows)
4. [Error Handling Patterns](#error-handling-patterns)
5. [Testing Message Handlers](#testing-message-handlers)
6. [Performance Optimizations](#performance-optimizations)

## Basic RPC Handlers

### Simple Health Check Handler

**File**: `apps/auth-service/src/app/app.controller.ts`

```typescript
import { Controller } from '@nestjs/common';
import { RabbitRPC } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Basic health check handler - responds to 'auth.health' routing key
   */
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
        version: process.env.npm_package_version || '1.0.0',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    };
  }
}
```

### User Registration Handler

**File**: `apps/auth-service/src/modules/auth/auth.controller.ts`

```typescript
import { Controller, Logger } from '@nestjs/common';
import { RabbitRPC, RabbitPayload } from '@golevelup/nestjs-rabbitmq';
import { 
  RegisterUserDto, 
  LoginUserDto, 
  User, 
  AuthTokenResponse 
} from '@usecapsule/types';

@Controller()
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * User registration RPC handler
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.register',
  })
  async registerUser(@RabbitPayload() dto: RegisterUserDto): Promise<User> {
    this.logger.log(`Processing user registration for: ${dto.email}`);
    
    try {
      const user = await this.authService.register(dto);
      
      this.logger.log(`User registered successfully: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Registration failed for ${dto.email}:`, error);
      throw error; // Will be caught by RabbitMQ error handling
    }
  }

  /**
   * User authentication RPC handler
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.login',
  })
  async loginUser(@RabbitPayload() dto: LoginUserDto): Promise<AuthTokenResponse> {
    this.logger.log(`Processing login for: ${dto.email}`);
    
    const tokenResponse = await this.authService.authenticate(dto);
    
    this.logger.log(`Login successful for: ${dto.email}`);
    return tokenResponse;
  }

  /**
   * Token validation RPC handler
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.validate',
  })
  async validateToken(@RabbitPayload() payload: { token: string }): Promise<User | null> {
    try {
      return await this.authService.validateToken(payload.token);
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      return null; // Invalid token
    }
  }
}
```

## Event Subscribers

### User Created Event Handler

**File**: `apps/billing-service/src/modules/customer/customer.controller.ts`

```typescript
import { Controller, Logger } from '@nestjs/common';
import { RabbitSubscribe, RabbitPayload } from '@golevelup/nestjs-rabbitmq';

interface UserCreatedEvent {
  userId: string;
  email: string;
  timestamp: string;
  metadata?: {
    referralCode?: string;
    source?: string;
  };
}

@Controller()
export class CustomerController {
  private readonly logger = new Logger(CustomerController.name);

  constructor(private readonly customerService: CustomerService) {}

  /**
   * Subscribes to user creation events to create customer profiles
   */
  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'user.created',
  })
  async onUserCreated(@RabbitPayload() event: UserCreatedEvent): Promise<void> {
    this.logger.log(`Creating customer profile for user: ${event.userId}`);

    try {
      await this.customerService.createCustomerProfile({
        userId: event.userId,
        email: event.email,
        referralCode: event.metadata?.referralCode,
        source: event.metadata?.source || 'direct',
        createdAt: new Date(event.timestamp),
      });

      this.logger.log(`Customer profile created for user: ${event.userId}`);
    } catch (error) {
      this.logger.error(`Failed to create customer profile for ${event.userId}:`, error);
      // Don't throw - let it go to DLQ for manual processing
    }
  }

  /**
   * Handles user profile updates
   */
  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'user.updated',
  })
  async onUserUpdated(@RabbitPayload() event: UserUpdatedEvent): Promise<void> {
    this.logger.log(`Updating customer profile for user: ${event.userId}`);

    await this.customerService.updateCustomerFromUserData({
      userId: event.userId,
      email: event.email,
      profile: event.profile,
    });
  }
}
```

### Wildcard Event Subscribers

**File**: `apps/monitor-service/src/modules/metrics/metrics.controller.ts`

```typescript
@Controller()
export class MetricsController {
  private readonly logger = new Logger(MetricsController.name);

  constructor(private readonly metricsService: MetricsService) {}

  /**
   * Subscribes to all user-related events using wildcard routing
   */
  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'user.*', // Matches user.created, user.updated, user.deleted, etc.
  })
  async onUserEvent(@RabbitPayload() event: any, @RabbitContext() context: any): Promise<void> {
    const eventType = context.routingKey; // e.g., 'user.created'
    
    this.logger.log(`Recording user event: ${eventType}`);

    await this.metricsService.recordEvent({
      type: 'user_event',
      subtype: eventType,
      userId: event.userId,
      timestamp: new Date(event.timestamp),
      metadata: event.metadata,
    });
  }

  /**
   * Subscribes to all payment events
   */
  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'payment.*',
  })
  async onPaymentEvent(@RabbitPayload() event: PaymentEvent): Promise<void> {
    await this.metricsService.recordPaymentMetrics({
      eventType: event.type,
      amount: event.amount,
      currency: event.currency,
      customerId: event.customerId,
      timestamp: new Date(event.timestamp),
    });
  }
}
```

## Complex Message Flows

### Saga Pattern Implementation

**File**: `apps/auth-service/src/modules/registration/registration-saga.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Injectable()
export class RegistrationSaga {
  private readonly logger = new Logger(RegistrationSaga.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  /**
   * Orchestrates complete user registration flow
   */
  async executeRegistrationFlow(dto: RegisterUserDto): Promise<User> {
    const sagaId = `registration_${Date.now()}_${Math.random().toString(36)}`;
    
    this.logger.log(`Starting registration saga: ${sagaId}`);

    try {
      // Step 1: Create user account
      const user = await this.createUserAccount(dto);

      // Step 2: Publish user creation event
      await this.publishUserCreatedEvent(user, sagaId);

      // Step 3: Send welcome email (async)
      await this.triggerWelcomeEmail(user, sagaId);

      // Step 4: Set up default quotas (async)
      await this.triggerQuotaSetup(user, sagaId);

      this.logger.log(`Registration saga completed: ${sagaId}`);
      return user;

    } catch (error) {
      this.logger.error(`Registration saga failed: ${sagaId}`, error);
      
      // Publish compensation event
      await this.publishRegistrationFailed(dto, sagaId, error);
      throw error;
    }
  }

  private async publishUserCreatedEvent(user: User, sagaId: string): Promise<void> {
    await this.amqpConnection.publish('capsule.events', 'user.created', {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
      sagaId,
      metadata: {
        source: 'registration_saga',
        version: '1.0.0',
      },
    });
  }

  private async triggerWelcomeEmail(user: User, sagaId: string): Promise<void> {
    await this.amqpConnection.publish('capsule.commands', 'email.send', {
      template: 'welcome',
      to: user.email,
      variables: {
        firstName: user.profile.firstName,
        activationUrl: `${process.env.FRONTEND_URL}/activate/${user.id}`,
      },
      sagaId,
    });
  }

  private async triggerQuotaSetup(user: User, sagaId: string): Promise<void> {
    await this.amqpConnection.publish('capsule.commands', 'deploy.setup-quotas', {
      userId: user.id,
      plan: 'free',
      sagaId,
    });
  }
}
```

### Request-Response Chain

**File**: `apps/api-gateway/src/modules/deployment/deployment.service.ts`

```typescript
@Injectable()
export class DeploymentGatewayService {
  private readonly logger = new Logger(DeploymentGatewayService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  /**
   * Complex deployment flow requiring multiple service interactions
   */
  async createDeployment(dto: CreateDeploymentDto, userId: string): Promise<Deployment> {
    // Step 1: Validate user has deployment quota
    const quotaCheck = await this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: 'billing.check-quota',
      payload: { userId, resource: 'deployments' },
      timeout: 5000,
    });

    if (!quotaCheck.allowed) {
      throw new QuotaExceededException('Deployment quota exceeded');
    }

    // Step 2: Validate and build container image
    const buildResult = await this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: 'deploy.build-image',
      payload: {
        repository: dto.repository,
        branch: dto.branch,
        buildConfig: dto.buildConfig,
      },
      timeout: 300000, // 5 minutes for build
    });

    if (!buildResult.success) {
      throw new BuildFailedException(buildResult.error);
    }

    // Step 3: Create deployment
    const deployment = await this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: 'deploy.create',
      payload: {
        userId,
        imageUrl: buildResult.imageUrl,
        config: dto.deploymentConfig,
      },
      timeout: 60000,
    });

    // Step 4: Update quota usage (fire-and-forget)
    this.amqpConnection.publish('capsule.events', 'deployment.created', {
      deploymentId: deployment.id,
      userId,
      imageUrl: buildResult.imageUrl,
      timestamp: new Date().toISOString(),
    });

    return deployment;
  }
}
```

## Error Handling Patterns

### Graceful Error Handling with Fallbacks

```typescript
@Controller()
export class RobustController {
  private readonly logger = new Logger(RobustController.name);

  /**
   * Health check with comprehensive error handling
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.health',
  })
  async healthCheckWithDependencies(): Promise<HealthCheckResponse> {
    const response: HealthCheckResponse = {
      status: HealthStatus.HEALTHY,
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      metadata: {},
    };

    try {
      // Check database connectivity
      const dbHealth = await this.checkDatabaseHealth();
      response.metadata.database = dbHealth;
      
      if (!dbHealth.connected) {
        response.status = HealthStatus.DEGRADED;
      }
    } catch (error) {
      this.logger.error('Database health check failed:', error);
      response.metadata.database = {
        connected: false,
        error: error.message,
      };
      response.status = HealthStatus.DEGRADED;
    }

    try {
      // Check external API connectivity
      const externalApiHealth = await this.checkExternalApiHealth();
      response.metadata.externalApi = externalApiHealth;
      
      if (!externalApiHealth.connected) {
        response.status = HealthStatus.DEGRADED;
      }
    } catch (error) {
      this.logger.warn('External API health check failed:', error);
      response.metadata.externalApi = {
        connected: false,
        error: 'External API unreachable',
      };
      // Don't degrade status for external API failures
    }

    return response;
  }

  /**
   * User operation with retry logic and circuit breaker
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.get-user',
  })
  async getUser(@RabbitPayload() payload: { userId: string }): Promise<User | null> {
    const { userId } = payload;

    try {
      // Attempt primary data source
      return await this.userService.getUserById(userId);
      
    } catch (error) {
      this.logger.warn(`Primary user lookup failed for ${userId}:`, error);

      try {
        // Fallback to cache
        const cachedUser = await this.cacheService.getUser(userId);
        if (cachedUser) {
          this.logger.log(`Retrieved user ${userId} from cache`);
          return cachedUser;
        }
      } catch (cacheError) {
        this.logger.error(`Cache lookup failed for ${userId}:`, cacheError);
      }

      // No fallback available
      throw new UserNotFoundException(`User not found: ${userId}`);
    }
  }
}
```

### Custom Error Classes and Handling

```typescript
// Custom error classes
export class BusinessLogicException extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'BusinessLogicException';
  }
}

export class QuotaExceededException extends BusinessLogicException {
  constructor(message: string) {
    super(message, 'QUOTA_EXCEEDED');
  }
}

export class InvalidCredentialsException extends BusinessLogicException {
  constructor() {
    super('Invalid email or password', 'INVALID_CREDENTIALS');
  }
}

// Error handling in message handlers
@Controller()
export class AuthController {
  
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.login',
  })
  async login(@RabbitPayload() dto: LoginUserDto): Promise<AuthTokenResponse> {
    try {
      return await this.authService.authenticate(dto);
      
    } catch (error) {
      // Log error with context
      this.logger.error(`Login failed for ${dto.email}:`, {
        error: error.message,
        stack: error.stack,
        dto: { email: dto.email }, // Don't log password
      });

      // Transform internal errors to client-safe errors
      if (error instanceof InvalidCredentialsException) {
        throw error; // Pass through business logic errors
      }

      // Hide internal errors from clients
      throw new InternalServerErrorException('Authentication service unavailable');
    }
  }
}
```

## Testing Message Handlers

### Unit Testing RPC Handlers

**File**: `apps/auth-service/src/app/app.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthStatus } from '@usecapsule/types';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getHealthStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);
  });

  describe('healthCheck', () => {
    it('should return healthy status', () => {
      // Arrange
      const expectedResponse = {
        status: HealthStatus.HEALTHY,
        service: 'auth-service',
        timestamp: '2024-01-12T10:00:00.000Z',
        metadata: { version: '1.0.0' },
      };

      jest.spyOn(service, 'getHealthStatus').mockReturnValue(expectedResponse);

      // Act
      const result = controller.healthCheck();

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(service.getHealthStatus).toHaveBeenCalledTimes(1);
    });
  });
});
```

### Integration Testing with RabbitMQ

**File**: `apps/auth-service/src/modules/auth/auth.integration.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController Integration', () => {
  let controller: AuthController;
  let amqpConnection: AmqpConnection;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: AmqpConnection,
          useValue: {
            request: jest.fn(),
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    amqpConnection = module.get<AmqpConnection>(AmqpConnection);
  });

  describe('registerUser', () => {
    it('should register user and publish event', async () => {
      // Arrange
      const registerDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      };

      const expectedUser = {
        id: 'user-123',
        email: registerDto.email,
        profile: {
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
        },
      };

      jest.spyOn(authService, 'register').mockResolvedValue(expectedUser);
      jest.spyOn(amqpConnection, 'publish').mockResolvedValue(undefined);

      // Act
      const result = await controller.registerUser(registerDto);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        'capsule.events',
        'user.created',
        expect.objectContaining({
          userId: expectedUser.id,
          email: expectedUser.email,
        }),
      );
    });
  });
});
```

## Performance Optimizations

### Batch Processing Pattern

```typescript
@Controller()
export class BatchProcessingController {
  private readonly logger = new Logger(BatchProcessingController.name);
  private readonly batchSize = 50;
  private readonly batchTimeout = 5000; // 5 seconds

  /**
   * Processes multiple items in batches for better performance
   */
  @RabbitSubscribe({
    exchange: 'capsule.events',
    routingKey: 'metrics.batch',
  })
  async processBatchMetrics(@RabbitPayload() events: MetricEvent[]): Promise<void> {
    this.logger.log(`Processing batch of ${events.length} metric events`);

    // Process in smaller batches to avoid memory issues
    for (let i = 0; i < events.length; i += this.batchSize) {
      const batch = events.slice(i, i + this.batchSize);
      
      await Promise.all(
        batch.map(event => this.processMetricEvent(event))
      );
    }

    this.logger.log(`Completed processing ${events.length} metric events`);
  }

  private async processMetricEvent(event: MetricEvent): Promise<void> {
    // Individual event processing logic
    await this.metricsService.recordEvent(event);
  }
}
```

### Async Processing with Queues

```typescript
@Injectable()
export class AsyncTaskProcessor {
  private readonly processingQueue = new Map<string, Promise<any>>();

  /**
   * Non-blocking task processing
   */
  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'deploy.create-async',
  })
  async createDeploymentAsync(@RabbitPayload() dto: CreateDeploymentDto): Promise<{ taskId: string }> {
    const taskId = `deploy_${Date.now()}_${Math.random().toString(36)}`;
    
    // Start processing asynchronously
    const processingPromise = this.processDeploymentInBackground(dto, taskId);
    this.processingQueue.set(taskId, processingPromise);

    // Clean up completed tasks
    processingPromise.finally(() => {
      this.processingQueue.delete(taskId);
    });

    // Return immediately with task ID
    return { taskId };
  }

  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'deploy.status',
  })
  async getDeploymentStatus(@RabbitPayload() payload: { taskId: string }): Promise<TaskStatus> {
    const { taskId } = payload;
    
    if (this.processingQueue.has(taskId)) {
      return { status: 'processing', taskId };
    }

    // Check completed deployments in database
    return await this.deploymentService.getTaskStatus(taskId);
  }

  private async processDeploymentInBackground(dto: CreateDeploymentDto, taskId: string): Promise<void> {
    try {
      this.logger.log(`Starting background deployment: ${taskId}`);
      
      const deployment = await this.deploymentService.create(dto);
      
      // Publish completion event
      await this.amqpConnection.publish('capsule.events', 'deployment.completed', {
        taskId,
        deploymentId: deployment.id,
        status: 'success',
        timestamp: new Date().toISOString(),
      });
      
    } catch (error) {
      this.logger.error(`Background deployment failed: ${taskId}`, error);
      
      // Publish failure event
      await this.amqpConnection.publish('capsule.events', 'deployment.failed', {
        taskId,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
```

---

**Next Steps**:
- Review [Integration Test Examples](./integration-tests.md) for comprehensive testing patterns
- See [Domain Entity Examples](./domain-entities.md) for DDD implementation patterns
- Check [Common Issues](../troubleshooting/common-issues.md) for debugging message handlers