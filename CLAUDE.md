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

## Important Development Notes

### URLs and Endpoints

- **API Gateway**: <http://localhost:3000>
- **API Documentation**: <http://localhost:3000/api/documentation>
- **RabbitMQ Management**: <http://localhost:15672> (admin/admin)
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
