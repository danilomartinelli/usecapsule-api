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

## RabbitMQ Message Patterns

### Message Queue Architecture

The platform uses RabbitMQ for all inter-service communication following event-driven patterns:

```text
API Gateway → Commands → capsule.commands → Service Queues
Services → Events → capsule.events → Event Subscribers
Failed Messages → Dead Letter Exchange → Manual Recovery
```

### Exchanges and Queues

#### Core Exchanges
- **`capsule.commands`** (direct) - Service commands (RPC pattern)
- **`capsule.events`** (topic) - Domain events (Pub/Sub pattern)  
- **`dlx`** (fanout) - Dead letter exchange for failed messages

#### Service Queues
- **`auth_queue`** - Authentication service messages
- **`billing_queue`** - Billing service messages
- **`deploy_queue`** - Deployment service messages
- **`monitor_queue`** - Monitoring service messages
- **`dlq`** - Dead letter queue for failed messages

### Message Patterns Usage

#### 1. Commands (Request/Response)
```typescript
// In service handler
@RabbitMQMessagePattern('auth.register')
async registerUser(@Payload() dto: RegisterUserDto): Promise<User> {
  return this.authService.register(dto);
}

// From API Gateway
const user = await this.rabbitMQService.send('auth.register', userData);
```

#### 2. Events (Publish/Subscribe)
```typescript
// Publishing domain events
@EventPattern('user.created')
async onUserCreated(@Payload() user: User): Promise<void> {
  await this.emailService.sendWelcomeEmail(user);
}

// Emitting events
this.rabbitMQService.emit('user.created', user);
```

#### 3. Retry Policies
```typescript
// Automatic retry with exponential backoff
@DatabaseRetry(3, 1500)
@RabbitMQMessagePattern('billing.process-payment')
async processPayment(@Payload() dto: PaymentDto): Promise<PaymentResult> {
  return this.billingService.processPayment(dto);
}
```

### Using RabbitMQ Module

#### Service Configuration
```typescript
// In service app.module.ts
RabbitMQModule.forMicroservice({
  queue: 'auth_queue',
  connection: {
    urls: [process.env.RABBITMQ_URL],
  },
  globalRetryPolicy: {
    maxRetries: 3,
    exponentialBackoff: true,
  },
});
```

#### Routing Key Patterns
- **Commands**: `{service}.{action}` → `auth.register`, `billing.charge`
- **Events**: `{context}.{event}` → `user.created`, `payment.processed`
- **Queries**: `{service}.query.{entity}` → `auth.query.user`

### Dead Letter Queue Handling

Failed messages automatically go to DLQ after retry exhaustion:
1. Message fails processing
2. Retried up to 3 times with exponential backoff  
3. Sent to Dead Letter Exchange (`dlx`)
4. Routed to Dead Letter Queue (`dlq`)
5. Manual investigation and reprocessing via Management UI

## Important Development Notes

### URLs and Endpoints

- **API Gateway**: <http://localhost:3000>
- **API Documentation**: <http://localhost:3000/api/documentation>
- **RabbitMQ Management**: <http://localhost:7020> (usecapsule/usecapsule_dev_password)
- **Health Check**: <http://localhost:3000/health>

### Creating New Services

When adding a new bounded context:

1. Generate service: `nx g @nx/nest:app [service-name]`
2. Configure RabbitMQ transport in main.ts (no HTTP server)
3. Create message handlers (use @MessagePattern/@EventPattern)
4. Add service-specific database configuration
5. Update docker-compose.yml for infrastructure

### Testing Guidelines

- Unit tests: `*.spec.ts` files next to source code
- Integration tests: `*.integration.spec.ts` with test databases
- E2E tests: In dedicated e2e projects
- Each service uses isolated test databases
- Run `npm run test:affected` to test only changed code
