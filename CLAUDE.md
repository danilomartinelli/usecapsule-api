# CLAUDE.md - Domain-Driven Design Architecture Guide

## Overview

This document serves as the authoritative architectural guide for implementing Domain-Driven Design (DDD) with Hexagonal Architecture in an Nx monorepo using NestJS. The architecture employs an API Gateway pattern where all external HTTP traffic flows through a single gateway, which then communicates with internal microservices via RabbitMQ message queues. Each microservice represents a bounded context with its own domain model, never exposing HTTP endpoints directly.

## Core Principles

### 1. Domain-Centric Architecture

The domain model is the heart of the application. All design decisions flow from the domain outward, not from technical concerns inward. Business logic remains pure and framework-agnostic.

### 2. Hexagonal Architecture with Message-Driven Communication

Each service follows the ports and adapters pattern internally, while all inter-service communication happens through message queues:

- **Domain Core**: Pure business logic with no external dependencies
- **Application Layer**: Use cases orchestrated through CQRS commands and queries
- **Infrastructure Layer**: Adapters for databases and message brokers
- **No HTTP Layer in Microservices**: Services only listen to RabbitMQ, never HTTP

### 3. API Gateway as Single Entry Point

The API Gateway is the only component exposing HTTP endpoints. It handles all cross-cutting concerns and proxies requests to appropriate microservices via RabbitMQ.

### 4. Bounded Contexts

Each microservice represents a bounded context with clear boundaries and its own ubiquitous language. Services communicate through well-defined message contracts, never sharing domain models directly.

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────┐
│              External Clients (Web, Mobile, SDKs)           │
│                   REST API / GraphQL / WebSocket            │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Gateway (NestJS)                      │
│        Authentication, Routing, Rate Limiting, Swagger      │
│              Public/Private/Token-based Routes              │
└─────────────────────────────────────────────────────────────┘
                                │
                          [RabbitMQ Bus]
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│  Auth Service    │ │ Deploy Service   │ │ Monitor Service  │
│    (NestJS)      │ │    (NestJS)      │ │    (NestJS)      │
│  [RabbitMQ Only] │ │  [RabbitMQ Only] │ │  [RabbitMQ Only] │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Project Structure

```text
@your-org/source/
├── apps/                           # Applications
│   ├── api-gateway/               # Single HTTP entry point
│   │   ├── src/
│   │   │   ├── main.ts           # HTTP server initialization
│   │   │   ├── app.module.ts     # Gateway module configuration
│   │   │   ├── config/           # Gateway-specific configs
│   │   │   │   ├── swagger.config.ts
│   │   │   │   └── security.config.ts
│   │   │   ├── middleware/       # HTTP middleware
│   │   │   │   ├── auth.middleware.ts
│   │   │   │   └── rate-limit.middleware.ts
│   │   │   └── proxies/          # Service proxy modules
│   │   │       ├── auth.proxy.module.ts
│   │   │       ├── auth.proxy.controller.ts
│   │   │       ├── deploy.proxy.module.ts
│   │   │       └── deploy.proxy.controller.ts
│   │   └── project.json
│   │
│   ├── auth-service/              # Auth Bounded Context (No HTTP)
│   │   ├── src/
│   │   │   ├── main.ts           # RabbitMQ microservice bootstrap
│   │   │   ├── app.module.ts     # Service module configuration
│   │   │   └── modules/
│   │   │       └── user/         # User Aggregate Module
│   │   │           ├── commands/
│   │   │           │   ├── create-user/
│   │   │           │   │   ├── create-user.command.ts
│   │   │           │   │   └── create-user.handler.ts
│   │   │           │   └── update-user/
│   │   │           │       ├── update-user.command.ts
│   │   │           │       └── update-user.handler.ts
│   │   │           ├── queries/
│   │   │           │   └── find-user/
│   │   │           │       ├── find-user.query.ts
│   │   │           │       └── find-user.handler.ts
│   │   │           ├── domain/
│   │   │           │   ├── user.entity.ts
│   │   │           │   ├── user.repository.ts
│   │   │           │   └── value-objects/
│   │   │           ├── database/
│   │   │           │   ├── user.repository.impl.ts
│   │   │           │   └── user.schema.ts
│   │   │           ├── message-handlers/
│   │   │           │   └── user.message-handler.ts
│   │   │           └── user.module.ts
│   │   └── project.json
│   │
│   └── [other-services]/          # Other Bounded Contexts
│
├── libs/                          # Shared Libraries
│   ├── shared/                   # Cross-cutting concerns
│   │   ├── messaging/           # Message contracts
│   │   │   ├── commands/       # Command definitions
│   │   │   ├── events/        # Event definitions
│   │   │   └── patterns/      # Message patterns
│   │   ├── ddd/               # DDD building blocks
│   │   ├── exceptions/        # Custom exceptions
│   │   └── types/            # TypeScript types
│   │
│   └── configs/                # Configuration modules
│       ├── rabbitmq/
│       └── database/
│
├── devtools/                   # Development tools
│   ├── docker/
│   ├── k8s/
│   └── scripts/
│
└── tools/                      # SDKs and CLIs
    ├── sdk-js/
    └── cli/
```

## API Gateway Pattern Implementation

The API Gateway serves as the single HTTP entry point for all external communication. It translates HTTP requests into RabbitMQ messages and vice versa.

### Gateway Proxy Module Structure

```typescript
// apps/api-gateway/src/proxies/auth.proxy.module.ts
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'AUTH_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://localhost:5672'],
          queue: 'auth_queue',
          queueOptions: { durable: true },
        },
      },
    ]),
  ],
  controllers: [AuthProxyController],
})
export class AuthProxyModule {}
```

### Gateway Proxy Controller

```typescript
// apps/api-gateway/src/proxies/auth.proxy.controller.ts
@Controller('api/v1/users')
@ApiTags('Users')
export class AuthProxyController {
  constructor(
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  async createUser(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    // Gateway handles HTTP concerns (validation, transformation)
    const command = {
      pattern: 'user.create',
      data: dto,
    };

    // Proxy to auth-service via RabbitMQ
    const result = await this.authClient
      .send(command.pattern, command.data)
      .toPromise();

    // Transform response for HTTP client
    return this.transformToHttpResponse(result);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get user by ID' })
  async getUser(@Param('id') id: string): Promise<UserResponseDto> {
    const query = {
      pattern: 'user.findById',
      data: { userId: id },
    };

    return this.authClient
      .send(query.pattern, query.data)
      .toPromise();
  }

  private transformToHttpResponse(result: any): UserResponseDto {
    // Handle service response transformation
    // This is where you map internal responses to external DTOs
    return {
      id: result.id,
      email: result.email,
      name: result.name,
      createdAt: result.createdAt,
    };
  }
}
```

### Gateway Main Configuration

```typescript
// apps/api-gateway/src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS configuration
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  });

  // Global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Capsule API')
    .setDescription('Cloud-native deployment platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/documentation', app, document);

  // Health checks
  app.use('/health', (req, res) => {
    res.status(200).send({ status: 'ok' });
  });

  await app.listen(3000);
  console.log('API Gateway listening on http://localhost:3000');
}
```

## Microservice Pattern Implementation

Microservices never expose HTTP endpoints. They only communicate via RabbitMQ, processing messages and executing domain logic.

### Service Bootstrap (No HTTP Server)

```typescript
// apps/auth-service/src/main.ts
async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://localhost:5672'],
        queue: 'auth_queue',
        queueOptions: {
          durable: true,
        },
        // Important: No HTTP server is created
      },
    },
  );

  await app.listen();
  console.log('Auth Service is listening for RabbitMQ messages');
}

bootstrap();
```

### Message Handler in Service

```typescript
// apps/auth-service/src/modules/user/message-handlers/user.message-handler.ts
@Controller()
export class UserMessageHandler {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @MessagePattern('user.create')
  async handleCreateUser(data: CreateUserDto): Promise<any> {
    // Convert external DTO to internal command
    const command = new CreateUserCommand(
      data.email,
      data.name,
      data.password,
    );

    try {
      // Execute command through CQRS
      const userId = await this.commandBus.execute(command);

      // Return success response
      return {
        success: true,
        userId,
        message: 'User created successfully',
      };
    } catch (error) {
      // Handle domain exceptions
      if (error instanceof EmailAlreadyExistsException) {
        return {
          success: false,
          error: 'EMAIL_ALREADY_EXISTS',
          message: error.message,
        };
      }
      throw error;
    }
  }

  @MessagePattern('user.findById')
  async handleFindUser(data: { userId: string }): Promise<any> {
    const query = new FindUserQuery(data.userId);
    const user = await this.queryBus.execute(query);

    if (!user) {
      throw new RpcException('User not found');
    }

    // Return user data (will be serialized for transport)
    return UserMapper.toResponse(user);
  }

  @EventPattern('user.delete.requested')
  async handleDeleteRequest(data: { userId: string }): Promise<void> {
    // Handle async events (no response expected)
    const command = new DeleteUserCommand(data.userId);
    await this.commandBus.execute(command);
  }
}
```

## Module Structure Within Services

Each aggregate within a bounded context follows this structure, but without HTTP controllers:

```text
user/                              # Aggregate Root Module
├── commands/                      # Command Handlers (Write Operations)
│   ├── create-user/
│   │   ├── create-user.command.ts
│   │   └── create-user.handler.ts
│   └── update-user/
│       ├── update-user.command.ts
│       └── update-user.handler.ts
│
├── queries/                       # Query Handlers (Read Operations)
│   ├── find-user/
│   │   ├── find-user.query.ts
│   │   └── find-user.handler.ts
│   └── find-users/
│       ├── find-users.query.ts
│       └── find-users.handler.ts
│
├── domain/                        # Domain Layer
│   ├── user.entity.ts           # Aggregate Root
│   ├── user.repository.ts       # Repository Interface (Port)
│   ├── user.factory.ts          # Entity Factory
│   ├── value-objects/           # Value Objects
│   └── events/                  # Domain Events
│
├── database/                      # Infrastructure Layer
│   ├── user.repository.impl.ts  # Repository Implementation
│   ├── user.mapper.ts           # Entity-Model Mapping
│   └── user.schema.ts           # Database Schema
│
├── message-handlers/             # Message Queue Handlers
│   └── user.message-handler.ts  # RabbitMQ message handlers
│
└── user.module.ts                # Module Definition
```

## CQRS Implementation in Services

Commands and queries are internal to each service, orchestrating domain logic:

### Command Handler (Internal to Service)

```typescript
// apps/auth-service/src/modules/user/commands/create-user/create-user.handler.ts
@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateUserCommand): Promise<string> {
    // Domain logic execution
    const email = new Email(command.email);

    // Check business rules
    const emailExists = await this.userRepository.existsByEmail(email);
    if (emailExists) {
      throw new EmailAlreadyExistsException(email.value);
    }

    // Create aggregate
    const user = User.create({
      email,
      name: command.name,
      password: await Password.create(command.password),
    });

    // Persist
    await this.userRepository.save(user);

    // Publish domain events for other services
    user.getUncommittedEvents().forEach(event => {
      this.eventBus.publish(event);
    });

    return user.id;
  }
}
```

### Query Handler (Internal to Service)

```typescript
// apps/auth-service/src/modules/user/queries/find-user/find-user.handler.ts
@QueryHandler(FindUserQuery)
export class FindUserHandler implements IQueryHandler<FindUserQuery> {
  constructor(
    @InjectRepository(UserReadModel)
    private readonly readModel: Repository<UserReadModel>,
  ) {}

  async execute(query: FindUserQuery): Promise<UserReadModel | null> {
    const user = await this.readModel.findOne({
      where: { id: query.userId },
    });

    return user;
  }
}
```

## Inter-Service Communication Patterns

Services communicate through RabbitMQ using different patterns:

### Request-Response Pattern (RPC)

Used when the API Gateway needs a synchronous response:

```typescript
// API Gateway sends request
const user = await this.authClient
  .send('user.findById', { userId: '123' })
  .toPromise();

// Auth Service responds
@MessagePattern('user.findById')
async handleFindUser(data: { userId: string }) {
  // Process and return response
  return userData;
}
```

### Event Pattern (Pub/Sub)

Used for asynchronous, event-driven communication:

```typescript
// Auth Service publishes event
@EventHandler(UserCreatedDomainEvent)
export class UserCreatedEventHandler {
  constructor(@Inject('EVENT_BUS') private client: ClientProxy) {}

  handle(event: UserCreatedDomainEvent) {
    // Publish integration event to other services
    this.client.emit('user.created', {
      userId: event.userId,
      email: event.email,
      occurredOn: event.occurredOn,
    });
  }
}

// Deploy Service subscribes to event
@EventPattern('user.created')
async handleUserCreated(data: UserCreatedIntegrationEvent) {
  // React to user creation in different bounded context
  await this.initializeUserWorkspace(data.userId);
}
```

### Saga Pattern for Distributed Transactions

For complex workflows spanning multiple services:

```typescript
// Deployment Saga orchestrating across services
export class DeploymentSaga {
  @Saga()
  deployment = (events$: Observable<any>) => {
    return events$.pipe(
      ofType(DeploymentRequestedEvent),
      mergeMap(event =>
        // Step 1: Validate resources
        this.authClient.send('resource.validate', event.payload).pipe(
          // Step 2: Provision infrastructure
          mergeMap(() => this.deployClient.send('infra.provision', event.payload)),
          // Step 3: Deploy application
          mergeMap(() => this.deployClient.send('app.deploy', event.payload)),
          // Handle failures with compensation
          catchError(error => {
            return of(new DeploymentFailedEvent(event.deploymentId, error));
          }),
        )
      ),
    );
  }
}
```

## Message Contract Definitions

Define clear contracts for service communication:

```typescript
// libs/shared/messaging/commands/user.commands.ts
export namespace UserCommands {
  export class CreateUser {
    readonly pattern = 'user.create';
    constructor(
      public readonly email: string,
      public readonly name: string,
      public readonly password: string,
    ) {}
  }

  export class UpdateUser {
    readonly pattern = 'user.update';
    constructor(
      public readonly userId: string,
      public readonly updates: Partial<UserData>,
    ) {}
  }
}

// libs/shared/messaging/events/user.events.ts
export namespace UserEvents {
  export class UserCreated {
    readonly pattern = 'user.created';
    constructor(
      public readonly userId: string,
      public readonly email: string,
      public readonly name: string,
      public readonly occurredOn: Date,
    ) {}
  }
}
```

## Security Implementation

### API Gateway Security Layer

All security checks happen at the gateway level:

```typescript
// apps/api-gateway/src/middleware/auth.middleware.ts
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject('AUTH_SERVICE') private authClient: ClientProxy,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const token = this.extractToken(req);

    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      // Validate token with auth service
      const user = await this.authClient
        .send('auth.validateToken', { token })
        .toPromise();

      // Attach user to request
      req['user'] = user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

// apps/api-gateway/src/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject('AUTH_SERVICE') private authClient: ClientProxy,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Check permissions with auth service
    const hasPermission = await this.authClient
      .send('auth.checkPermissions', {
        userId: user.id,
        requiredRoles,
      })
      .toPromise();

    return hasPermission;
  }
}
```

## Testing Strategy

### Testing with Database Isolation

Each service's tests use their own isolated database instance, preventing test interference and ensuring true unit boundary testing.

### Unit Tests for Domain Logic

Domain entities and value objects are tested without any database dependency:

```typescript
// apps/auth-service/src/modules/user/domain/user.entity.spec.ts
describe('User Entity', () => {
  it('should change email when valid', () => {
    const user = new User({
      email: new Email('old@example.com'),
      name: 'John Doe',
      password: Password.fromHash('hashed_password'),
    });

    const newEmail = new Email('new@example.com');
    user.changeEmail(newEmail);

    expect(user.email.equals(newEmail)).toBe(true);
    expect(user.getUncommittedEvents()).toContainEqual(
      expect.objectContaining({
        constructor: { name: 'UserEmailChangedEvent' },
        email: 'new@example.com',
      })
    );
  });

  it('should not allow invalid email', () => {
    const user = User.create({
      email: new Email('valid@example.com'),
      name: 'John',
      password: Password.fromHash('hash'),
    });

    expect(() => {
      user.changeEmail(new Email('invalid-email'));
    }).toThrow(InvalidEmailException);
  });
});
```

### Integration Tests with Test Databases

Each service uses a separate test database for integration testing:

```typescript
// apps/auth-service/src/modules/user/database/user.repository.spec.ts
describe('UserRepository Integration', () => {
  let repository: UserRepositoryImpl;
  let dataSource: DataSource;

  beforeAll(async () => {
    // Create isolated test database for auth service
    dataSource = await createTestDataSource({
      database: `auth_test_${process.pid}`,  // Unique DB per test process
    });

    // Run migrations
    await runFlyway({
      url: dataSource.options.url,
      locations: ['apps/auth-service/migrations'],
      clean: true,  // Clean before each test suite
    });

    const module = await Test.createTestingModule({
      providers: [UserRepositoryImpl],
      imports: [
        TypeOrmModule.forRoot(dataSource.options),
        TypeOrmModule.forFeature([UserEntity, UserEventEntity]),
      ],
    }).compile();

    repository = module.get<UserRepositoryImpl>(UserRepositoryImpl);
  });

  afterAll(async () => {
    await dataSource.destroy();
    // Drop test database
    await dropTestDatabase(`auth_test_${process.pid}`);
  });

  afterEach(async () => {
    // Clean data between tests, but keep schema
    await dataSource.query('TRUNCATE TABLE users CASCADE');
    await dataSource.query('TRUNCATE TABLE user_events CASCADE');
  });

  it('should persist and retrieve user with events', async () => {
    const user = User.create({
      email: new Email('test@example.com'),
      name: 'Test User',
      password: await Password.create('SecurePass123!'),
    });

    await repository.save(user);

    const retrieved = await repository.findById(user.id);
    expect(retrieved).toBeDefined();
    expect(retrieved.email.value).toBe('test@example.com');

    // Verify events were stored
    const events = await dataSource
      .getRepository(UserEventEntity)
      .find({ where: { aggregateId: user.id } });

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('UserCreatedEvent');
  });

  it('should enforce unique email constraint', async () => {
    const email = new Email('duplicate@example.com');

    const user1 = User.create({
      email,
      name: 'User 1',
      password: await Password.create('Pass123!'),
    });

    await repository.save(user1);

    const user2 = User.create({
      email,
      name: 'User 2',
      password: await Password.create('Pass456!'),
    });

    await expect(repository.save(user2)).rejects.toThrow();
  });
});
```

### Testing Message Handlers

Test message handlers with mocked dependencies:

```typescript
// apps/auth-service/src/modules/user/message-handlers/user.message-handler.spec.ts
describe('UserMessageHandler', () => {
  let handler: UserMessageHandler;
  let commandBus: CommandBus;
  let queryBus: QueryBus;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UserMessageHandler,
        {
          provide: CommandBus,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: QueryBus,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    handler = module.get<UserMessageHandler>(UserMessageHandler);
    commandBus = module.get<CommandBus>(CommandBus);
    queryBus = module.get<QueryBus>(QueryBus);
  });

  describe('handleCreateUser', () => {
    it('should execute CreateUserCommand and return success', async () => {
      const dto = {
        email: 'test@example.com',
        name: 'Test User',
        password: 'SecurePass123!',
      };

      jest.spyOn(commandBus, 'execute').mockResolvedValue('user-123');

      const result = await handler.handleCreateUser(dto);

      expect(commandBus.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email,
          name: dto.name,
          password: dto.password,
        })
      );
      expect(result).toEqual({
        success: true,
        userId: 'user-123',
        message: 'User created successfully',
      });
    });

    it('should handle domain exceptions gracefully', async () => {
      const dto = {
        email: 'existing@example.com',
        name: 'Test',
        password: 'Pass123!',
      };

      jest.spyOn(commandBus, 'execute')
        .mockRejectedValue(new EmailAlreadyExistsException(dto.email));

      const result = await handler.handleCreateUser(dto);

      expect(result).toEqual({
        success: false,
        error: 'EMAIL_ALREADY_EXISTS',
        message: expect.stringContaining('already exists'),
      });
    });
  });
});
```

### End-to-End Testing with Multiple Databases

Test complete flows across services with their respective databases:

```typescript
// e2e/user-registration.e2e-spec.ts
describe('User Registration E2E', () => {
  let app: INestApplication;
  let authDb: DataSource;
  let deployDb: DataSource;

  beforeAll(async () => {
    // Start test databases
    authDb = await createTestDataSource({
      database: 'auth_e2e_test',
      port: 5432,
    });

    deployDb = await createTestDataSource({
      database: 'deploy_e2e_test',
      port: 5433,
    });

    // Run migrations for each service
    await runFlyway({
      url: authDb.options.url,
      locations: ['apps/auth-service/migrations'],
    });

    await runFlyway({
      url: deployDb.options.url,
      locations: ['apps/deploy-service/migrations'],
    });

    // Start services with test databases
    const moduleRef = await Test.createTestingModule({
      imports: [ApiGatewayModule],
    })
    .overrideProvider('AUTH_SERVICE_CONFIG')
    .useValue({ database: authDb.options })
    .overrideProvider('DEPLOY_SERVICE_CONFIG')
    .useValue({ database: deployDb.options })
    .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await authDb.destroy();
    await deployDb.destroy();
  });

  it('should register user and create default project', async () => {
    // Register user through API Gateway
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({
        email: 'e2e@test.com',
        name: 'E2E Test User',
        password: 'TestPass123!',
      })
      .expect(201);

    const userId = registerResponse.body.id;

    // Verify user exists in auth database
    const userInAuthDb = await authDb
      .getRepository('users')
      .findOne({ where: { id: userId } });

    expect(userInAuthDb).toBeDefined();
    expect(userInAuthDb.email).toBe('e2e@test.com');

    // Wait for eventual consistency
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify default project was created in deploy database
    const projectInDeployDb = await deployDb
      .getRepository('projects')
      .findOne({ where: { created_by_user_id: userId } });

    expect(projectInDeployDb).toBeDefined();
    expect(projectInDeployDb.name).toBe('Default Project');
  });
});
```

### Test Utilities for Database Management

```typescript
// libs/shared/testing/database.utils.ts
export async function createTestDataSource(options: Partial<DataSourceOptions>) {
  const defaultOptions: DataSourceOptions = {
    type: 'postgres',
    host: process.env.TEST_DB_HOST || 'localhost',
    port: options.port || 5432,
    username: 'test_user',
    password: 'test_pass',
    synchronize: false,
    logging: false,
    ...options,
  };

  // Create database if it doesn't exist
  const adminConnection = new DataSource({
    ...defaultOptions,
    database: 'postgres',
  });

  await adminConnection.initialize();
  await adminConnection.query(
    `CREATE DATABASE IF NOT EXISTS "${options.database}"`
  );
  await adminConnection.destroy();

  // Connect to test database
  const dataSource = new DataSource({
    ...defaultOptions,
    database: options.database,
  });

  await dataSource.initialize();
  return dataSource;
}

export async function runFlyway(options: {
  url: string;
  locations: string[];
  clean?: boolean;
}) {
  const flyway = new Flyway({
    url: options.url,
    locations: options.locations,
    cleanDisabled: false,
  });

  if (options.clean) {
    await flyway.clean();
  }

  await flyway.migrate();
}

export async function dropTestDatabase(database: string) {
  const adminConnection = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'test_user',
    password: 'test_pass',
    database: 'postgres',
  });

  await adminConnection.initialize();

  // Terminate connections to the test database
  await adminConnection.query(`
    SELECT pg_terminate_backend(pg_stat_activity.pid)
    FROM pg_stat_activity
    WHERE pg_stat_activity.datname = '${database}'
      AND pid <> pg_backend_pid()
  `);

  await adminConnection.query(`DROP DATABASE IF EXISTS "${database}"`);
  await adminConnection.destroy();
}
```

## Configuration Management

### Environment-Specific Configuration

```typescript
// libs/configs/rabbitmq/rabbitmq.config.ts
export const getRabbitMQConfig = (): ClientProviderOptions => {
  const env = process.env.NODE_ENV || 'development';

  const configs = {
    development: {
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://localhost:5672'],
        queue: process.env.QUEUE_NAME,
        queueOptions: {
          durable: true,
        },
      },
    },
    production: {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: process.env.QUEUE_NAME,
        queueOptions: {
          durable: true,
          arguments: {
            'x-message-ttl': 30000,
            'x-max-length': 1000,
          },
        },
      },
    },
  };

  return configs[env];
};
```

## Deployment Considerations

### Docker Configuration

Each service has its own Dockerfile:

```dockerfile
# apps/api-gateway/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:api-gateway

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist/apps/api-gateway ./
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "main.js"]
```

```dockerfile
# apps/auth-service/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build:auth-service

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist/apps/auth-service ./
COPY --from=builder /app/node_modules ./node_modules
# No EXPOSE needed - only RabbitMQ communication
CMD ["node", "main.js"]
```

### Docker Compose for Development

```yaml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3.12-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

  postgres:
    image: postgres:15
    environment:
      POSTGRES_USER: capsule
      POSTGRES_PASSWORD: capsule
      POSTGRES_DB: capsule
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  api-gateway:
    build:
      context: .
      dockerfile: apps/api-gateway/Dockerfile
    ports:
      - "3000:3000"
    environment:
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672
    depends_on:
      - rabbitmq
    restart: unless-stopped

  auth-service:
    build:
      context: .
      dockerfile: apps/auth-service/Dockerfile
    environment:
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672
      DATABASE_URL: postgresql://capsule:capsule@postgres:5432/capsule
    depends_on:
      - rabbitmq
      - postgres
    restart: unless-stopped

volumes:
  rabbitmq_data:
  postgres_data:
```

## Monitoring and Observability

### Distributed Tracing

Track requests across services:

```typescript
// API Gateway initiates trace
@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const traceId = request.headers['x-trace-id'] || generateTraceId();

    // Attach trace ID to all service calls
    return next.handle().pipe(
      tap(() => {
        // Log trace for monitoring
        Logger.log({
          traceId,
          service: 'api-gateway',
          path: request.path,
          method: request.method,
          duration: Date.now() - request.startTime,
        });
      }),
    );
  }
}

// Pass trace ID through RabbitMQ
const metadata = { traceId };
this.authClient.send({ cmd: 'user.create' }, { data: dto, metadata });
```

### Health Checks

Monitor service health:

```typescript
// API Gateway health aggregation
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    @Inject('AUTH_SERVICE') private authClient: ClientProxy,
    @Inject('DEPLOY_SERVICE') private deployClient: ClientProxy,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Check RabbitMQ connection
      () => this.microserviceHealthIndicator.pingCheck(
        'auth-service',
        { transport: Transport.RMQ, timeout: 300 }
      ),
      // Check database
      () => this.database.pingCheck('database'),
    ]);
  }
}
```

## Common Patterns and Solutions

### Pattern: API Composition

When the gateway needs data from multiple services:

```typescript
// apps/api-gateway/src/proxies/composite.controller.ts
@Controller('api/v1/dashboard')
export class DashboardController {
  constructor(
    @Inject('AUTH_SERVICE') private authClient: ClientProxy,
    @Inject('DEPLOY_SERVICE') private deployClient: ClientProxy,
    @Inject('MONITOR_SERVICE') private monitorClient: ClientProxy,
  ) {}

  @Get('overview')
  async getDashboardOverview(@CurrentUser() user: User) {
    // Parallel calls to multiple services
    const [userProfile, deployments, metrics] = await Promise.all([
      this.authClient.send('user.getProfile', { userId: user.id }).toPromise(),
      this.deployClient.send('deployments.recent', { userId: user.id }).toPromise(),
      this.monitorClient.send('metrics.summary', { userId: user.id }).toPromise(),
    ]);

    // Compose response
    return {
      user: userProfile,
      recentDeployments: deployments,
      systemMetrics: metrics,
      timestamp: new Date(),
    };
  }
}
```

### Pattern: Circuit Breaker

Protect against service failures:

```typescript
// apps/api-gateway/src/common/circuit-breaker.ts
@Injectable()
export class CircuitBreakerInterceptor implements NestInterceptor {
  private readonly circuitBreakers = new Map<string, CircuitBreaker>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const serviceName = this.getServiceName(context);
    const breaker = this.getOrCreateBreaker(serviceName);

    return from(breaker.fire(() => next.handle().toPromise())).pipe(
      catchError(error => {
        if (error.code === 'CIRCUIT_OPEN') {
          // Return cached or default response
          return of(this.getFallbackResponse(serviceName));
        }
        throw error;
      }),
    );
  }
}
```

## Migration Path

### From Monolith to Microservices

If starting with a modular monolith, here's the migration path:

1. **Start with Modular Monolith**: All modules in single deployment
2. **Introduce Message Bus**: Add RabbitMQ, keep modules in same process
3. **Extract First Service**: Move auth module to separate service
4. **Add API Gateway**: Route traffic through gateway
5. **Extract Remaining Services**: One by one, maintaining backwards compatibility

```typescript
// Stage 1: Modular Monolith
@Module({
  imports: [
    AuthModule,      // Direct module import
    DeployModule,    // Direct module import
    MonitorModule,   // Direct module import
  ],
})
export class AppModule {}

// Stage 2: Message Bus Introduction
@Module({
  imports: [
    AuthModule,      // Still local but uses CommandBus
    DeployModule,    // Still local but uses CommandBus
    RabbitMQModule,  // Added for future
  ],
})
export class AppModule {}

// Stage 3: First Service Extraction
@Module({
  imports: [
    AuthProxyModule,  // Proxy to external auth-service
    DeployModule,     // Still local
    MonitorModule,    // Still local
  ],
})
export class ApiGatewayModule {}
```

## Anti-Patterns to Avoid

### ❌ Direct HTTP Communication Between Services

Services should never call each other via HTTP:

```typescript
// BAD - Service making HTTP call to another service
@Injectable()
export class DeployService {
  async deployApp(userId: string) {
    // Don't do this!
    const user = await this.httpService
      .get(`http://auth-service:3000/users/${userId}`)
      .toPromise();
  }
}

// GOOD - Use message queue
@Injectable()
export class DeployService {
  constructor(@Inject('AUTH_SERVICE') private authClient: ClientProxy) {}

  async deployApp(userId: string) {
    const user = await this.authClient
      .send('user.findById', { userId })
      .toPromise();
  }
}
```

### ❌ Exposing Domain Models Through Messages

Don't send domain entities through RabbitMQ:

```typescript
// BAD - Sending domain entity
@MessagePattern('user.get')
async getUser(id: string): Promise<User> {
  const user = await this.userRepository.findById(id);
  return user; // Domain entity with methods won't serialize properly
}

// GOOD - Send DTOs
@MessagePattern('user.get')
async getUser(id: string): Promise<UserResponseDto> {
  const user = await this.userRepository.findById(id);
  return UserMapper.toResponse(user); // Plain object
}
```

### ❌ Synchronous Chains of Service Calls

Avoid long chains of synchronous service calls:

```typescript
// BAD - Long synchronous chain
async createProject(dto: CreateProjectDto) {
  const user = await this.authClient.send('user.get', { id: dto.userId }).toPromise();
  const billing = await this.billingClient.send('billing.check', { userId: user.id }).toPromise();
  const resources = await this.resourceClient.send('resources.allocate', { billing }).toPromise();
  const project = await this.projectClient.send('project.create', { resources }).toPromise();
  return project;
}

// GOOD - Use events and eventual consistency
async createProject(dto: CreateProjectDto) {
  // Create project in pending state
  const project = await this.createPendingProject(dto);

  // Emit event for other services to react
  this.eventBus.emit('project.creation.requested', {
    projectId: project.id,
    userId: dto.userId,
  });

  return project; // Return immediately, other services handle asynchronously
}
```

## Conclusion

The key principles to remember:

1. **API Gateway is the only HTTP entry point** - All external traffic flows through it
2. **Services communicate only through RabbitMQ** - No direct HTTP between services
3. **CQRS is internal to each service** - Commands and queries organize domain logic
4. **Domain models stay within bounded contexts** - Use DTOs for external communication
5. **Embrace asynchronous communication** - Use events for loose coupling
