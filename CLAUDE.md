# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **Capsule** platform - a deployment and cloud-native application management platform built as an Nx monorepo with multiple applications and shared libraries. The project uses TypeScript throughout, with NestJS for backend services and React with React Router for frontend applications.

## Technology Stack

### Core Technologies
- **Monorepo Tool**: Nx (v21.4.1) with workspace configuration
- **Backend**: NestJS (v11) with Express
- **Frontend**: React (v19) with React Router (v7.2) and Vite
- **Styling**: Tailwind CSS (v4) with Vite plugin
- **Language**: TypeScript (v5.8.2)
- **Package Manager**: npm with workspaces
- **Testing**: Jest for unit tests, Playwright for E2E tests

### Architecture Patterns
- **Domain-Driven Design (DDD)**: Bounded contexts in `libs/contexts/`
- **Hexagonal Architecture**: Backend services with ports & adapters
- **Feature-Sliced Design (FSD)**: Frontend applications organization
- **BFF Pattern**: API Gateway acts as Backend for Frontend

## Key Commands

### Development
```bash
# Start all services (parallel execution)
npx nx run-many --target=serve --all

# Start specific services
npx nx serve api-gateway    # Backend API (port 3000)
npx nx serve portal         # React frontend (port 4200)
npx nx serve service-auth   # Auth microservice

# Development with Docker infrastructure
npm run docker:up          # Start Docker services (PostgreSQL, Redis)
npm run docker:logs        # View Docker logs
npm run docker:reset       # Reset Docker volumes and restart
```

### Building & Production
```bash
# Build all projects
npm run build:all
npx nx run-many --target=build --all

# Build for production
npm run build:prod
npx nx run-many --target=build --all --configuration=production

# Build specific service
npx nx build api-gateway
npx nx build portal --configuration=production
```

### Testing
```bash
# Run all tests
npm run validate
npx nx run-many --target=test --all

# Run affected tests (based on git changes)
npm run affected:test
npx nx affected:test --base=main

# Run specific tests
npx nx test api-gateway
npx nx test portal --coverage

# E2E tests
npx nx e2e portal-e2e
npx nx e2e api-gateway-e2e

# Run tests for a single file
npx nx test api-gateway --testPathPattern=app.service.spec.ts
```

### Code Quality
```bash
# Lint all projects
npm run affected:lint
npx nx run-many --target=lint --all

# Lint specific project
npx nx lint api-gateway
npx nx lint portal

# Format code
npx nx format:write

# Type checking
npx nx typecheck api-gateway
npx nx typecheck portal
```

### Nx-Specific Commands
```bash
# View dependency graph
npm run graph
npx nx graph

# Show affected projects
npx nx affected:graph --base=main

# Clean Nx cache
npm run clean
npx nx reset

# Generate new components/services
npx nx g @nx/nest:module <module-name> --project=api-gateway
npx nx g @nx/nest:service <service-name> --project=api-gateway
npx nx g @nx/react:component <component-name> --project=portal
```

## Project Structure

```
apps/
├── api-gateway/       # Main NestJS BFF API (port 3000, prefix: /api)
├── portal/            # React + Vite admin dashboard (port 4200)
├── service-auth/      # NestJS authentication microservice
├── portal-e2e/        # Playwright E2E tests for portal
└── api-gateway-e2e/   # Jest E2E tests for API

libs/
├── contexts/          # DDD Bounded Contexts (Backend)
│   └── auth/         # Authentication context
├── shared/           # Shared utilities (Full-stack)
│   ├── dto/         # Data Transfer Objects
│   └── types/       # TypeScript type definitions
└── ui/              # Frontend component library
    └── react/       # React UI components with Tailwind
```

## Important Configuration Files

- **nx.json**: Nx workspace configuration with plugins and target defaults
- **tsconfig.base.json**: Base TypeScript configuration with path mappings
- **docker-compose.yml**: Local development infrastructure (databases, brokers)
- **package.json**: Scripts and dependencies (workspaces configuration)

### Path Aliases
The project uses TypeScript path mappings configured in `tsconfig.base.json`:
- `@acme/contexts-auth`: Maps to `libs/contexts/auth`
- `@acme/shared-dto`: Maps to `libs/shared/dto`
- `@acme/shared-types`: Maps to `libs/shared/types`
- `@acme/ui-react`: Maps to `libs/ui/react`

## Backend Services Configuration

### API Gateway (NestJS)
- **Port**: 3000
- **Global Prefix**: `/api`
- **Main Entry**: `apps/api-gateway/src/main.ts`
- **Module Structure**: Uses NestJS modules pattern
- **Testing**: Jest with separate E2E tests

### Service Auth
- **Framework**: NestJS
- **Purpose**: Authentication and authorization service
- **Structure**: Same as API Gateway

## Frontend Applications

### Portal (React)
- **Port**: 4200
- **Build Tool**: Vite with React Router plugin
- **Styling**: Tailwind CSS v4 with Vite plugin
- **Entry Points**: 
  - Client: `app/entry.client.tsx`
  - Server: `app/entry.server.tsx`
- **Routing**: React Router v7 with file-based routing

## Development Workflow

### Adding New Features
1. Generate necessary modules/components using Nx generators
2. Implement business logic following DDD patterns for backend
3. Use Feature-Sliced Design for frontend features
4. Write tests alongside implementation
5. Run affected tests before committing

### Working with Shared Libraries
- DTOs and types go in `libs/shared/`
- UI components go in `libs/ui/react/`
- Domain logic goes in `libs/contexts/`

### Deployment Notes
- The project is designed for containerized deployment
- Each service can be built into a Docker container
- Uses environment variables for configuration
- Supports multiple environments (development, staging, production)

## Testing Strategy
- **Unit Tests**: Jest for both frontend and backend
- **E2E Tests**: Playwright for frontend, Jest for API
- **Test Coverage**: Run with `--coverage` flag
- **Test Watch Mode**: Use `--watch` for development

## Common Patterns

### Backend Patterns
- Controllers handle HTTP requests
- Services contain business logic
- Modules organize related functionality
- Use dependency injection throughout

### Frontend Patterns
- React functional components with hooks
- React Router for navigation
- Tailwind CSS for styling
- Component composition over inheritance

## Performance Considerations
- Vite provides fast HMR for frontend development
- Nx caching speeds up builds and tests
- Use `nx affected` commands to only rebuild/test changed projects
- Docker services can be reset with `npm run docker:reset` if needed

## Troubleshooting

### Common Issues
1. **Port conflicts**: Check if ports 3000, 4200 are available
2. **Docker issues**: Run `npm run docker:reset` to clean state
3. **Nx cache issues**: Run `npm run clean` or `npx nx reset`
4. **Dependency issues**: Delete `node_modules` and run `npm install`

### Debug Commands
```bash
# Check Nx configuration
npx nx show projects

# Verify project configuration
npx nx show project api-gateway

# Check for circular dependencies
npx nx graph
```