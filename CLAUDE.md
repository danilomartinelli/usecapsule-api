# CLAUDE.md - Capsule Platform Development Guide

> **Essential context for Claude Code when working with the Capsule Platform**

This is the primary guidance file for Claude Code development on the Capsule Platform - a cloud-native application deployment platform built with Domain-Driven Design (DDD) and Microservices Architecture using Nx 21.5.1, NestJS, and RabbitMQ messaging.

## 🚀 Quick Start for Claude Code

### Essential First Steps

1. Use `nx_workspace` tool to understand project structure
2. Use `nx_docs` tool for current Nx best practices (knowledge cutoff protection)
3. Check `nx_current_running_tasks_details` before starting new builds
4. Always run `npm run lint` and `npm run typecheck <service>` after changes

### Core Architecture Rules

- **HTTP Entry**: Only API Gateway accepts HTTP requests (port 3000)
- **Service Communication**: All microservices communicate via RabbitMQ only
- **Database Isolation**: Each service owns its database completely
- **Exchange-Based Routing**: Use @golevelup/nestjs-rabbitmq with exchanges
- **No Direct Service HTTP**: Services never call each other via HTTP

### Testing Policy

Currently, we **DO NOT** implement unit tests, integration tests, or e2e tests in this project. Please skip any testing-related suggestions or implementations.

## Project Structure

```text
apps/
├── api-gateway/          # HTTP entry point (port 3000)
├── auth-service/         # Authentication bounded context
├── billing-service/      # Billing and subscription management
├── deploy-service/       # Deployment orchestration
└── monitor-service/      # Metrics and observability
```

## 🛠️ Development Commands (Claude Code Optimized)

### Essential Nx Commands for Claude Code

```bash
# ALWAYS use these Nx tools first
nx_workspace                 # Understand project structure
nx_docs "search term"        # Get current Nx documentation
nx_current_running_tasks_details  # Check running tasks before building
nx_project_details <project>  # Get full project configuration

# Nx Workspace Operations
nx graph                     # View dependencies
nx build <project>           # Build specific project
nx serve <project> --watch   # Development mode
nx lint <project>            # Lint specific project
nx typecheck <project>       # Type checking
```

### Required Development Workflow

```bash
# 1. Start Infrastructure (one-time setup)
npm run infrastructure:up    # Start databases, RabbitMQ

# 2. Database Setup (after infrastructure)
npm run db:migrate:all       # Run all migrations

# 3. Start Development
npm run dev                  # All services
npm run serve:gateway        # API Gateway only

# 4. Code Quality (MANDATORY after changes)
npm run lint                 # Lint all projects
npm run lint:affected        # Lint only changed code
npm run typecheck <service>  # Type check specific service
npm run format              # Format with Prettier
```

### Infrastructure Management

```bash
# Docker Control
npm run infrastructure:up    # Start databases, RabbitMQ
npm run infrastructure:down  # Stop all containers
npm run infrastructure:reset # Reset all data (DESTRUCTIVE)

# Database Operations
npm run db:migrate:all       # Run all migrations
npm run db:migrate:auth      # Service-specific migrations
npm run db:seed:all         # Seed test data
npm run db:reset:all        # Drop and recreate (DESTRUCTIVE)
```

## 🏗️ Architecture Principles (Critical for Claude Code)

### 1. Microservices Communication Rules

**NEVER VIOLATE THESE:**

- ✅ API Gateway → RabbitMQ → Microservices (ONLY pattern allowed)
- ❌ Service-to-Service HTTP calls (FORBIDDEN)
- ✅ Each service has dedicated database
- ✅ Use @golevelup/nestjs-rabbitmq for all messaging

### 2. Domain-Driven Design Implementation

- **Bounded Contexts**: Each app/ directory is a complete domain
- **Entity-Centric Logic**: Business rules live in domain entities
- **CQRS Pattern**: Separate command/query operations
- **Event-Driven**: Domain events via RabbitMQ capsule.events exchange

### 3. Claude Code Development Guidelines

- **Always Check First**: Use nx_workspace before making assumptions
- **Use Nx Generators**: Generate consistent code with nx_run_generator
- **Follow NestJS Patterns**: @RabbitRPC and @RabbitSubscribe decorators
- **Service Focus**: Single business capability per service
- **Code Quality**: Run lint/typecheck after ALL changes

## 📋 Nx MCP Integration (MANDATORY USAGE)

### Critical: Always Use Nx Tools First

**Before making ANY assumptions about Nx configuration:**

```bash
# 1. ALWAYS start with workspace understanding
nx_workspace                    # Get complete workspace overview
nx_project_details <project>    # Deep dive on specific project

# 2. Get current documentation (avoids outdated knowledge)
nx_docs "your search term"      # Current Nx best practices

# 3. Check running tasks before starting new ones
nx_current_running_tasks_details # Avoid conflicts with running builds
```

### Code Generation Workflow (Use Tools)

**ALWAYS use these tools for code generation:**

```bash
# 1. Discover available generators
nx_generators                   # List all available generators
nx_available_plugins           # Check for additional plugins

# 2. Get generator specifications
nx_generator_schema <name>      # Get detailed generator options
nx_docs "<generator-name>"      # Get current documentation

# 3. Generate code with UI (PREFERRED)
nx_run_generator                # Opens interactive generator UI
```

### Task Management (Prevent Conflicts)

```bash
# Before building/testing
nx_current_running_tasks_details # Check what's already running
nx_current_running_task_output <id> # Monitor specific task output

# For CI/CD debugging
nx_cloud_cipe_details          # Get CI pipeline execution details
nx_cloud_fix_cipe_failure      # Debug specific failures
```

### Workspace Visualization

```bash
nx_visualize_graph              # Visual dependency graph
nx_workspace --filter="tag:api" # Filtered workspace view
```

## 🌐 System Architecture (Claude Code Reference)

### Communication Flow (NEVER DEVIATE)

```text
External HTTP → API Gateway (3000) → RabbitMQ Exchanges → Service Queues
                     ↓
            capsule.commands (Direct) → auth.*, billing.*, deploy.*, monitor.*
            capsule.events (Topic)   → user.created, payment.processed, etc.
            dlx (Dead Letter)        → Failed message recovery
```

### Service Endpoints & Ports

- **API Gateway**: <http://localhost:3000> (HTTP entry point)
- **API Docs**: <http://localhost:3000/api/documentation>
- **Health Check**: <http://localhost:3000/health>
- **RabbitMQ Management**: <http://localhost:7020> (usecapsule/usecapsule_dev_password)
- **RabbitMQ AMQP**: amqp://usecapsule:usecapsule_dev_password@localhost:7010

### Microservices Structure (DDD Pattern)

```text
apps/[service-name]/src/
├── main.ts                  # RabbitMQ microservice (NOT HTTP)
├── app.module.ts           # @golevelup/nestjs-rabbitmq config
└── modules/[domain]/       # Bounded context implementation
    ├── commands/           # Write operations (@RabbitRPC)
    ├── queries/            # Read operations (@RabbitRPC)
    ├── domain/             # Business entities (pure TypeScript)
    ├── database/           # Infrastructure adapters (Slonik)
    └── message-handlers/   # RabbitMQ handlers (@RabbitSubscribe)
```

## 📨 RabbitMQ Implementation (Claude Code Essentials)

### Exchange Pattern (USE THESE ONLY)

```typescript
// 1. COMMANDS (Direct Exchange) - RPC Pattern
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.register',  // {service}.{action}
})
async registerUser(@RabbitPayload() dto: RegisterUserDto): Promise<User> {
  return this.authService.register(dto);
}

// 2. EVENTS (Topic Exchange) - Pub/Sub Pattern
@RabbitSubscribe({
  exchange: 'capsule.events',
  routingKey: 'user.created',   // {entity}.{event}
})
async onUserCreated(@RabbitPayload() event: UserCreatedEvent): Promise<void> {
  await this.billingService.createCustomerProfile(event.userId);
}

// 3. PUBLISHING EVENTS
await this.amqpConnection.publish('capsule.events', 'user.created', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});
```

### Core Exchanges (AUTO-CONFIGURED)

1. **`capsule.commands`** (Direct) - Service commands: `auth.*`, `billing.*`, `deploy.*`
2. **`capsule.events`** (Topic) - Domain events: `user.created`, `payment.processed`
3. **`dlx`** (Dead Letter) - Failed message recovery with automatic retry

### Module Configuration Patterns

```typescript
// API Gateway Configuration (HTTP to RabbitMQ bridge)
RabbitMQModule.forGateway({
  uri: 'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
});

// Microservice Configuration (RabbitMQ only)
RabbitMQModule.forMicroservice({
  uri: 'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
  serviceName: 'auth-service',
});
```

### Required Health Check Pattern

```typescript
// EVERY service MUST implement this exact pattern
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.health',  // Replace 'auth' with service name
})
healthCheck(@RabbitPayload() payload?: any): HealthCheckResponse {
  return this.appService.getHealthStatus();
}
```

### Routing Key Conventions (FOLLOW EXACTLY)

```typescript
// Service Commands: {service}.{action}
'auth.register'; // User registration
'billing.charge'; // Process payment
'deploy.create'; // Create deployment
'monitor.alert'; // Send alert

// Domain Events: {entity}.{event}
'user.created'; // User was created
'payment.processed'; // Payment completed
'deployment.failed'; // Deployment failed

// Health Checks: {service}.health
'auth.health'; // Auth service health
'billing.health'; // Billing service health
```

## 🚨 Troubleshooting (Claude Code Quick Reference)

### RabbitMQ Issues

```bash
# Check RabbitMQ Management UI
open http://localhost:7020  # usecapsule/usecapsule_dev_password

# Quick RabbitMQ diagnostics
docker logs rabbitmq_dev
docker exec rabbitmq_dev rabbitmqctl list_queues name messages

# Reset RabbitMQ if needed
docker restart rabbitmq_dev
```

### Service Health Debugging

```bash
# Test API Gateway health
curl http://localhost:3000/health

# Check all service health via API Gateway
curl http://localhost:3000/health/ready

# Check specific service (via RabbitMQ Management UI)
# Go to Queues → auth_queue → Publish Message
# Routing Key: auth.health, Payload: {}
```

### Common Development Issues

1. **Port conflicts**: Use `lsof -i :3000` to check port usage
2. **Database connection**: Ensure `npm run infrastructure:up` completed successfully
3. **RabbitMQ connection**: Services won't start without RabbitMQ running
4. **TypeScript errors**: Always run `npm run typecheck <service>` after changes

## 📖 Documentation References

### Complete Documentation Structure

- **Main Guide**: [README.md](./README.md) - Quick setup and overview
- **Architecture Deep Dive**: [docs/architecture/system-overview.md](./docs/architecture/system-overview.md)
- **RabbitMQ Implementation**: [docs/guides/rabbitmq-implementation.md](./docs/guides/rabbitmq-implementation.md)
- **Message Handlers Examples**: [docs/examples/message-handlers.md](./docs/examples/message-handlers.md)
- **Troubleshooting Guide**: [docs/troubleshooting/common-issues.md](./docs/troubleshooting/common-issues.md)

### Task Master Integration

- **Task Master Guide**: [docs/guides/task-master-Integration.md](./docs/guides/task-master-Integration.md)
- **Development Workflow**: Use MCP tools for task management
- **Task Commands**: Available via `mcp__task-master-ai__*` tools in Claude Code

## ⚙️ Creating New Services (Claude Code Workflow)

### Step-by-Step Service Creation

```bash
# 1. ALWAYS use Nx generators (via nx_run_generator tool)
nx_generators                           # List available generators
nx_run_generator                        # Open generator UI
# Select @nx/nest:app and configure new service

# 2. Configure RabbitMQ microservice (NOT HTTP)
# Edit apps/[service]/src/main.ts - see existing services for pattern

# 3. Add RabbitMQ module configuration
# Edit apps/[service]/src/app.module.ts - follow auth-service pattern

# 4. Add health check handler (REQUIRED)
# Implement @RabbitRPC health check in controller

# 5. Update infrastructure
# Add database to compose.yml (follow existing pattern)
# Add RabbitMQ queue bindings if needed
```

### Required Service Structure

```typescript
// main.ts - RabbitMQ microservice bootstrap (NOT HTTP)
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

// app.module.ts - RabbitMQ configuration
RabbitMQModule.forMicroservice({
  uri: 'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
  serviceName: 'new-service',
});
```

## 🎯 Claude Code Best Practices

### Before Starting Any Task

1. **Check Running Processes**: `nx_current_running_tasks_details`
2. **Understand Workspace**: `nx_workspace` for current project state
3. **Get Documentation**: `nx_docs "topic"` for current best practices
4. **Check Project Details**: `nx_project_details <service>` for specific service info

### During Development

1. **Use Nx Generators**: Always use `nx_run_generator` for new code
2. **Follow Patterns**: Look at existing services for implementation patterns
3. **Test Incrementally**: Build and test individual services: `nx build <service>`
4. **Check Health**: Test service health via `curl http://localhost:3000/health`

### After Changes (MANDATORY)

1. **Lint**: `npm run lint` or `nx lint <service>`
2. **Type Check**: `npm run typecheck <service>`
3. **Build Test**: `nx build <service>`
4. **Health Check**: Verify services still respond to health checks

### Code Quality Rules

- **No HTTP between services**: Only RabbitMQ communication allowed
- **Health checks required**: Every service must implement health check pattern
- **Exchange-based routing**: Use capsule.commands and capsule.events only
- **Database isolation**: Each service owns its database completely

## 🔗 Quick Reference Links

### Development Endpoints

- **API Gateway**: <http://localhost:3000> (Primary HTTP entry)
- **API Documentation**: <http://localhost:3000/api/documentation> (Swagger)
- **Health Check**: <http://localhost:3000/health> (All services status)
- **RabbitMQ Management**: <http://localhost:7020> (usecapsule/usecapsule_dev_password)

### Key Configuration Values

- **RabbitMQ AMQP URI**: `amqp://usecapsule:usecapsule_dev_password@localhost:7010`
- **Command Exchange**: `capsule.commands` (Direct routing)
- **Event Exchange**: `capsule.events` (Topic routing)
- **Database Pattern**: Each service has dedicated PostgreSQL database

## 📚 Complete Documentation

### For Detailed Implementation Guides

This CLAUDE.md provides essential context for Claude Code development. For comprehensive implementation details, see:

- **[Complete Documentation Index](./docs/README.md)** - Full technical documentation
- **[System Architecture](./docs/architecture/system-overview.md)** - Detailed architecture patterns
- **[RabbitMQ Implementation](./docs/guides/rabbitmq-implementation.md)** - Complete messaging guide
- **[Service Development](./docs/guides/service-development.md)** - Creating new microservices
- **[Troubleshooting](./docs/troubleshooting/common-issues.md)** - Common issues and solutions
- **[Task Master Integration](./docs/guides/task-master-Integration.md)** - Development workflow tools

### Development Philosophy

This platform prioritizes:

1. **Domain-Driven Design** - Business logic in domain entities
2. **Message-First Architecture** - All communication via RabbitMQ
3. **Database Isolation** - Each service owns its data
4. **Health Check Monitoring** - Every service must be observable
5. **Type Safety** - TypeScript with strict checking required

---

**For Claude Code**: This file provides essential context. Always use Nx MCP tools for current documentation and avoid assumptions based on knowledge cutoff dates. Refer to detailed documentation in `docs/` directory for complete implementation guidance.
- Always run `npx nx affected -t lint typecheck build --skip-nx-cache` after changes.