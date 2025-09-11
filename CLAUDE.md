# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Capsule Platform monorepo built with Nx 21.5.1 and npm. It implements Domain-Driven Design (DDD) with Hexagonal Architecture using NestJS. The architecture employs an API Gateway pattern where all external HTTP traffic flows through a single gateway, which then communicates with internal microservices via RabbitMQ message queues.

## Project Structure

```text
apps/
├── api-gateway/          # HTTP entry point (port 3000)
├── auth-service/         # Authentication bounded context
├── billing-service/      # Billing and subscription management
├── deploy-service/       # Deployment orchestration
└── monitor-service/      # Metrics and observability
```

## Common Development Commands

### Nx Workspace Commands

```bash
# View workspace structure and dependencies
nx graph

# Build specific app
nx build api-gateway
nx build auth-service

# Run in development mode
nx serve api-gateway
nx serve auth-service --watch

# Run tests
nx test auth-service
nx test auth-service --watch
nx test auth-service --coverage

# Lint code
nx lint auth-service
nx lint --all

# Type check
nx typecheck auth-service
```

### Development Workflow

```bash
# Install dependencies
npm install

# Start development environment
npm run dev                    # Start all services
npm run serve:gateway         # Start API Gateway only

# Testing
npm run test                  # Run all tests
npm run test:affected         # Test only changed code
npm run test:e2e             # End-to-end tests
npm run test:coverage        # Generate coverage report

# Code quality
npm run lint                 # Lint all projects
npm run lint:affected        # Lint only changed code
npm run format              # Format with Prettier
```

### Infrastructure Commands

```bash
# Docker infrastructure
npm run infrastructure:up    # Start databases, RabbitMQ
npm run infrastructure:down  # Stop all containers
npm run infrastructure:reset # Reset all data

# Database management
npm run db:migrate:all       # Run all migrations
npm run db:migrate:auth      # Run auth service migrations
npm run db:seed:all         # Seed test data
npm run db:reset:all        # Drop and recreate databases
```

## Architecture Principles

### 1. Microservices with Message Queues

- Services communicate only via RabbitMQ, never direct HTTP
- API Gateway is the single HTTP entry point
- Each service has its own database

### 2. Domain-Driven Design

- Each app represents a bounded context
- Business logic stays in domain entities
- CQRS for command/query separation

### 3. Development Guidelines

- Use Nx generators for consistent code structure
- Follow NestJS conventions and decorators
- Write tests at unit, integration, and e2e levels
- Keep services focused on single business capabilities

## Nx Development Guidelines

### Working with Nx MCP Server

When using Claude Code with this Nx workspace:

1. **Understanding the workspace**: Use `nx_workspace` tool to gain understanding of workspace architecture
2. **Configuration questions**: Use `nx_docs` tool for up-to-date Nx configuration best practices instead of assumptions
3. **Project graph errors**: Use `nx_workspace` tool to get any errors
4. **Visualizing dependencies**: Use `nx_visualize_graph` tool to demonstrate task dependencies

### Generation Workflow

When generating new code:

1. Learn about workspace using `nx_workspace` and `nx_project_details` tools
2. Get available generators with `nx_generators` tool
3. Check `nx_available_plugins` for additional plugins if needed
4. Get generator details with `nx_generator_schema` tool
5. Use `nx_docs` for generator-specific documentation
6. Open generator UI with `nx_run_generator` tool
7. Read results with generator log tools

### Task Management

For running tests, builds, lint, and other tasks:

1. Check current tasks with `nx_current_running_tasks_details`
2. Get task output with `nx_current_running_task_output`
3. Use `nx run <taskId>` to rerun tasks in proper Nx context
4. Don't rerun continuous tasks that are already running

### CI Pipeline Debugging

For CI pipeline errors:

1. Get CIPE details with `nx_cloud_cipe_details`
2. Get specific task logs with `nx_cloud_fix_cipe_failure`
3. Fix identified problems and rerun the failing task

## Quick Architecture Reference

```text
External Clients → API Gateway (HTTP) → RabbitMQ → Microservices
                      ↓
              - auth-service
              - billing-service
              - deploy-service
              - monitor-service
```

### Key Architecture Points

- **API Gateway**: Single HTTP entry point (port 3000)
- **Microservices**: Communicate only via RabbitMQ, no direct HTTP
- **Database per Service**: Each service owns its data completely
- **Message Patterns**: Request/Response (RPC) and Event-driven (Pub/Sub)
- **Domain Focus**: Each service represents a business capability

### Service Structure Pattern

```text
apps/[service-name]/
├── src/
│   ├── main.ts              # RabbitMQ microservice bootstrap
│   ├── app.module.ts        # Service configuration
│   └── modules/             # Domain modules (aggregates)
│       └── [aggregate]/
│           ├── commands/    # Write operations
│           ├── queries/     # Read operations
│           ├── domain/      # Business entities
│           ├── database/    # Infrastructure adapters
│           └── message-handlers/ # RabbitMQ handlers
```

## RabbitMQ Architecture

### Message Queue Architecture Overview

The platform uses RabbitMQ as the central nervous system for all inter-service communication. This exchange-first architecture ensures decoupled, reliable messaging between microservices:

```text
API Gateway → capsule.commands → [auth.*|billing.*|deploy.*|monitor.*] → Service Queues
Services → capsule.events → [*.created|*.updated|*.deleted] → Event Subscribers
Health Checks → capsule.commands → [service.health] → Service Health Responses
Failed Messages → dlx (Dead Letter Exchange) → dlq → Manual Recovery
```

### Exchange-Based Routing Architecture

The system uses a sophisticated exchange-based routing system defined in `/devtools/infra/rabbitmq/definitions.json`:

#### Core Exchanges

1. **`capsule.commands`** (Direct Exchange)
   - **Purpose**: RPC-style service commands with routing keys
   - **Type**: Direct (exact routing key matching)
   - **Routing**: `{service}.{action}` patterns
   - **Examples**: `auth.register`, `billing.charge`, `deploy.create`

2. **`capsule.events`** (Topic Exchange)
   - **Purpose**: Domain events for pub/sub patterns
   - **Type**: Topic (wildcard routing key matching)
   - **Routing**: `{context}.{event}` patterns
   - **Examples**: `user.created`, `payment.processed`, `deployment.completed`

3. **`dlx`** (Dead Letter Exchange)
   - **Purpose**: Failed message collection and manual recovery
   - **Type**: Fanout (broadcasts to all bound queues)
   - **Auto-configured**: All queues have DLQ policy applied

#### Service Queues with TTL

All service queues are configured with 6-hour message TTL (21,600,000ms):

- **`auth_queue`** - Authentication service messages
- **`billing_queue`** - Billing and subscription management
- **`deploy_queue`** - Deployment orchestration messages
- **`monitor_queue`** - Metrics and observability data
- **`dlq`** - Dead letter queue for failed messages

#### Exchange Bindings and Routing

```text
capsule.commands Exchange Bindings:
├── auth.*     → auth_queue     (auth.register, auth.login, auth.health)
├── billing.*  → billing_queue  (billing.charge, billing.cancel, billing.health)
├── deploy.*   → deploy_queue   (deploy.create, deploy.status, deploy.health)
└── monitor.*  → monitor_queue  (monitor.metrics, monitor.alert, monitor.health)

dlx Exchange Bindings:
└── "" (empty) → dlq           (all failed messages)
```

### Message Patterns and Usage

#### 1. RPC Commands (Request/Response)

Used for operations requiring immediate responses:

```typescript
// Service Handler (e.g., auth-service)
@Controller()
export class AuthController {
  @MessagePattern('auth.register')
  async registerUser(@Payload() dto: RegisterUserDto): Promise<User> {
    return this.authService.register(dto);
  }

  @MessagePattern('health.check')
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }
}

// API Gateway Client
export class AuthGatewayService {
  async registerUser(userData: RegisterUserDto): Promise<User> {
    return this.rabbitMQService.send('auth.register', userData);
  }

  async checkAuthHealth(): Promise<HealthCheckResponse> {
    return this.rabbitMQService.sendHealthCheck('auth.health');
  }
}
```

#### 2. Event Publishing (Fire-and-Forget)

Used for domain events that multiple services may consume:

```typescript
// Event Publisher
@Injectable()
export class UserEventPublisher {
  async publishUserCreated(user: User): Promise<void> {
    this.rabbitMQService.emit('user.created', {
      userId: user.id,
      email: user.email,
      timestamp: new Date().toISOString(),
    });
  }
}

// Event Subscriber (in billing-service)
@Controller()
export class UserEventHandler {
  @EventPattern('user.created')
  async onUserCreated(@Payload() event: UserCreatedEvent): Promise<void> {
    await this.billingService.createCustomerProfile(event.userId);
  }
}
```

#### 3. Health Check Pattern

Specialized health checking with routing key targeting:

```typescript
// Health Check Implementation
export class RabbitMQService {
  async sendHealthCheck(routingKey: string): Promise<HealthCheckResponse> {
    // Routes to specific service queue via exchange binding
    return this.client
      .send('health.check', { routingKey })
      .pipe(
        timeout(5000),
        retry(1),
        catchError(() =>
          of({
            status: HealthStatus.UNHEALTHY,
            service: routingKey.split('.')[0],
            timestamp: new Date().toISOString(),
          }),
        ),
      )
      .toPromise();
  }
}
```

### Message Routing and Delivery

#### Routing Key Conventions

1. **Service Commands**: `{service}.{action}`
   - `auth.register`, `auth.login`, `auth.logout`
   - `billing.charge`, `billing.refund`, `billing.subscribe`
   - `deploy.create`, `deploy.scale`, `deploy.delete`
   - `monitor.track`, `monitor.alert`, `monitor.report`

2. **Domain Events**: `{entity}.{event}`
   - `user.created`, `user.updated`, `user.deleted`
   - `payment.processed`, `payment.failed`, `payment.refunded`
   - `deployment.started`, `deployment.completed`, `deployment.failed`

3. **Health Checks**: `{service}.health`
   - `auth.health`, `billing.health`, `deploy.health`, `monitor.health`

#### Message Processing Flow

```text
1. API Gateway receives HTTP request
2. Gateway validates and transforms request
3. Gateway publishes to capsule.commands with routing key
4. Exchange routes to appropriate service queue
5. Service processes message and responds
6. Service may emit domain events to capsule.events
7. Other services consume relevant events
```

### Advanced Configuration

#### Custom Message Patterns

The platform provides enhanced decorators for complex messaging:

```typescript
// Priority Messages
@PriorityMessagePattern('auth.urgent-verification', 255)
async handleUrgentVerification(@Payload() data: VerificationDto): Promise<void> {
  // High-priority message processing
}

// Temporary Messages with Expiration
@TemporaryMessagePattern('auth.temp-session', 300000) // 5 minutes
async handleTempSession(@Payload() data: SessionDto): Promise<void> {
  // Temporary session handling
}

// Retry Policies
@DatabaseRetry(3, 1500) // 3 retries with 1.5s base delay
@RabbitMQMessagePattern('billing.process-payment')
async processPayment(@Payload() dto: PaymentDto): Promise<PaymentResult> {
  return this.billingService.processPayment(dto);
}
```

#### Service Module Configuration

```typescript
// Complete service configuration example
@Module({
  imports: [
    RabbitMQModule.forMicroservice({
      queue: 'auth_queue',
      connection: {
        urls: [process.env.RABBITMQ_URL],
      },
      globalRetryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
        maxRetryDelay: 30000,
      },
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
    }),
  ],
})
export class AppModule {}
```

### Dead Letter Queue (DLQ) Handling

Automatic failure recovery system:

#### DLQ Policy Configuration

```json
{
  "name": "dlq-policy",
  "pattern": "^(?!.*\.dlq$).*",
  "definition": {
    "dead-letter-exchange": "dlx",
    "dead-letter-routing-key": "dlq"
  }
}
```

#### Failure Flow Process

1. **Message Processing Fails**: Service handler throws unhandled exception
2. **Retry Logic**: Automatic retry up to 3 times with exponential backoff
3. **DLQ Routing**: After retry exhaustion, message sent to `dlx` exchange
4. **Dead Letter Storage**: Message stored in `dlq` with failure metadata
5. **Manual Recovery**: Operations team investigates via Management UI
6. **Reprocessing**: Messages can be manually requeued or fixed and resubmitted

#### DLQ Monitoring

```bash
# Access RabbitMQ Management UI
open http://localhost:7020
# Login: usecapsule / usecapsule_dev_password

# Check DLQ messages via CLI
docker exec rabbitmq_dev rabbitmqctl list_queues name messages

# Inspect specific DLQ message
# Use Management UI -> Queues -> dlq -> Get Messages
```

## Important Development Notes

### URLs and Endpoints

- **API Gateway**: <http://localhost:3000>
- **API Documentation**: <http://localhost:3000/api/documentation>
- **Health Check**: <http://localhost:3000/health>
- **RabbitMQ Management UI**: <http://localhost:7020> (usecapsule/usecapsule_dev_password)
- **RabbitMQ AMQP**: `amqp://usecapsule:usecapsule_dev_password@localhost:7010/`

### RabbitMQ Management and Debugging

#### RabbitMQ Management UI Features

Access the management interface at <http://localhost:7020> for:

1. **Queue Monitoring**
   - Message counts and rates
   - Consumer information
   - Queue bindings and routing

2. **Exchange Visualization**
   - Exchange types and bindings
   - Message routing topology
   - Publisher and consumer connections

3. **Dead Letter Queue Inspection**
   - Failed message details
   - Error stack traces
   - Message requeue capabilities

4. **Performance Metrics**
   - Message throughput
   - Connection statistics
   - Node health and memory usage

#### Debugging Message Routing Issues

```bash
# Check queue status
docker exec rabbitmq_dev rabbitmqctl list_queues name messages consumers

# Inspect exchange bindings
docker exec rabbitmq_dev rabbitmqctl list_bindings

# Monitor real-time message flow
docker exec rabbitmq_dev rabbitmqctl list_exchanges name type

# Check connection status
docker exec rabbitmq_dev rabbitmqctl list_connections

# View detailed queue information
docker exec rabbitmq_dev rabbitmqctl list_queues name messages_ready messages_unacknowledged
```

#### Common RabbitMQ Troubleshooting

1. **Messages Not Being Consumed**

   ```bash
   # Check if service is connected to queue
   docker logs auth_service_container

   # Verify queue bindings
   # Management UI -> Exchanges -> capsule.commands -> Bindings
   ```

2. **Health Checks Failing**

   ```bash
   # Test health check routing
   curl -X GET http://localhost:3000/health

   # Check specific service health
   # Management UI -> Queues -> auth_queue -> Publish Message
   # Pattern: health.check, Payload: {"routingKey": "auth.health"}
   ```

3. **Dead Letter Queue Messages**

   ```bash
   # Inspect failed messages
   # Management UI -> Queues -> dlq -> Get Messages

   # Check DLQ policy application
   docker exec rabbitmq_dev rabbitmqctl list_policies
   ```

4. **Message TTL Expiration**
   ```bash
   # Check message TTL settings (6 hours = 21,600,000ms)
   # Management UI -> Queues -> [queue_name] -> Features -> TTL
   ```

#### Testing Message Patterns

```bash
# Test direct command routing
# Management UI -> Exchanges -> capsule.commands -> Publish Message
# Routing Key: auth.register
# Payload: {"email": "test@example.com", "password": "password"}

# Test event publishing
# Management UI -> Exchanges -> capsule.events -> Publish Message
# Routing Key: user.created
# Payload: {"userId": "123", "email": "test@example.com"}

# Test health check routing
# Management UI -> Exchanges -> capsule.commands -> Publish Message
# Routing Key: auth.health
# Payload: {"routingKey": "auth.health"}
```

### Creating New Services

When adding a new bounded context:

1. **Generate Service Structure**

   ```bash
   nx g @nx/nest:app [service-name]
   ```

2. **Configure RabbitMQ Microservice Bootstrap**

   ```typescript
   // apps/[service-name]/src/main.ts
   const app = await NestFactory.createMicroservice<MicroserviceOptions>(
     AppModule,
     {
       transport: Transport.RMQ,
       options: {
         urls: [rabbitUrl],
         queue: `${serviceName}_queue`,
         queueOptions: { durable: true },
       },
     },
   );
   ```

3. **Add Message Handlers**

   ```typescript
   // Service controller
   @Controller()
   export class ServiceController {
     @MessagePattern(`${serviceName}.action`)
     async handleAction(@Payload() dto: ActionDto): Promise<ActionResult> {
       return this.service.performAction(dto);
     }

     @MessagePattern('health.check')
     healthCheck(): HealthCheckResponse {
       return this.appService.getHealthStatus();
     }
   }
   ```

4. **Update RabbitMQ Infrastructure**

   ```json
   // devtools/infra/rabbitmq/definitions.json
   {
     "queues": [
       {
         "name": "[service-name]_queue",
         "vhost": "/",
         "durable": true,
         "auto_delete": false,
         "arguments": { "x-message-ttl": 21600000 }
       }
     ],
     "bindings": [
       {
         "source": "capsule.commands",
         "destination": "[service-name]_queue",
         "destination_type": "queue",
         "routing_key": "[service-name].*"
       }
     ]
   }
   ```

5. **Add Database Configuration**

   ```yaml
   # compose.yml
   [service-name]-db:
     container_name: [service-name]_db_dev
     image: postgres:15
     environment:
       POSTGRES_USER: [service-name]_user
       POSTGRES_PASSWORD: [service-name]_pass
       POSTGRES_DB: [service-name]_service_db
     ports:
       - '711X:5432'  # Use next available port
   ```

6. **Register with API Gateway**
   ```typescript
   // apps/api-gateway/src/modules/[domain]/[domain].service.ts
   @Injectable()
   export class DomainService {
     async performAction(dto: ActionDto): Promise<ActionResult> {
       return this.rabbitMQService.send(`${serviceName}.action`, dto);
     }
   }
   ```

### Testing Guidelines

- Unit tests: `*.spec.ts` files next to source code
- Integration tests: `*.integration.spec.ts` with test databases
- E2E tests: In dedicated e2e projects
- Each service uses isolated test databases
- Run `npm run test:affected` to test only changed code
