# Technology Stack

This document provides a comprehensive overview of all technologies used in the Capsule platform, their purposes, and current implementation status.

## Core Technologies

### Monorepo Management

#### Nx (v21.4.1) ✅ Implemented
- **Purpose**: Monorepo orchestration and build system
- **Why chosen**: 
  - Powerful caching and incremental builds
  - Excellent TypeScript support
  - Built-in generators for code scaffolding
  - Dependency graph visualization
  - Affected commands for CI optimization
- **Configuration**: `nx.json`, `project.json` files

### Language & Runtime

#### TypeScript (v5.8.2) ✅ Implemented
- **Purpose**: Primary language for both frontend and backend
- **Why chosen**:
  - Type safety across the entire stack
  - Excellent IDE support
  - Shared types between frontend and backend
  - Modern JavaScript features
- **Configuration**: `tsconfig.base.json`, per-project `tsconfig.json`

#### Node.js (v18+) ✅ Required
- **Purpose**: JavaScript runtime for backend services
- **Why chosen**:
  - Unified language across stack
  - Large ecosystem
  - Excellent performance for I/O operations

## Backend Technologies

### Framework

#### NestJS (v11.0.0) ✅ Implemented
- **Purpose**: Backend framework for API and microservices
- **Used in**: `api-gateway`, `service-auth`
- **Why chosen**:
  - Enterprise-grade architecture
  - Excellent TypeScript support
  - Modular structure
  - Built-in dependency injection
  - Decorators for clean code
  - Microservices support
- **Features used**:
  - Controllers and Services
  - Modules
  - Dependency Injection
  - Middleware support

#### Express (v4.x) ✅ Implemented
- **Purpose**: HTTP server underlying NestJS
- **Why chosen**: De facto standard, mature, well-documented

### Testing

#### Jest (v30.0.2) ✅ Implemented
- **Purpose**: Unit and integration testing
- **Why chosen**:
  - Excellent TypeScript support
  - Fast execution
  - Snapshot testing
  - Great mocking capabilities
- **Configuration**: `jest.config.ts` in each project

### Build Tools

#### Webpack (v5.x) ✅ Implemented
- **Purpose**: Bundling NestJS applications
- **Why chosen**: Mature, configurable, NestJS default

#### SWC ✅ Implemented
- **Purpose**: Fast TypeScript/JavaScript compilation
- **Why chosen**: Significantly faster than Babel

## Frontend Technologies

### Framework

#### React (v19.0.0) ✅ Implemented
- **Purpose**: UI library for building user interfaces
- **Used in**: `portal` application
- **Why chosen**:
  - Component-based architecture
  - Large ecosystem
  - Excellent performance
  - Strong community support

#### React Router (v7.2.0) ✅ Implemented
- **Purpose**: Client-side routing
- **Why chosen**:
  - New file-based routing
  - Server-side rendering support
  - Type-safe routing

### Build & Dev Tools

#### Vite (v6.0.0) ✅ Implemented
- **Purpose**: Fast build tool and dev server
- **Why chosen**:
  - Lightning-fast HMR
  - Native ES modules
  - Optimized production builds
  - Great developer experience

### Styling

#### Tailwind CSS (v4.1.12) ✅ Implemented
- **Purpose**: Utility-first CSS framework
- **Why chosen**:
  - Rapid prototyping
  - Consistent design system
  - Small production bundles
  - Great IDE support
- **Integration**: Via Vite plugin

#### PostCSS ✅ Implemented
- **Purpose**: CSS processing
- **Why chosen**: Required for Tailwind CSS

### UI Components

#### React Aria Components (v1.11.0) ✅ Implemented
- **Purpose**: Accessible UI components
- **Why chosen**:
  - Built-in accessibility
  - Unstyled components
  - Works well with Tailwind

### Testing

#### Testing Library ✅ Implemented
- **Purpose**: React component testing
- **Packages**:
  - `@testing-library/react` (v16.1.0)
  - `@testing-library/dom` (v10.4.0)
- **Why chosen**: Focus on user behavior, not implementation

#### Playwright (v1.36.0) ✅ Implemented
- **Purpose**: End-to-end testing
- **Used in**: `portal-e2e`
- **Why chosen**:
  - Cross-browser testing
  - Fast execution
  - Great debugging tools

## Infrastructure & DevOps

### Containerization

#### Docker ✅ Implemented
- **Purpose**: Local development environment
- **Configuration**: `docker-compose.yml`
- **Services configured**:
  - PostgreSQL 15
  - Redis 7
  - RabbitMQ 3
  - HashiCorp Vault

#### Docker Compose ✅ Implemented
- **Purpose**: Multi-container orchestration for development
- **Why chosen**: Simple local development setup

### Databases

#### PostgreSQL (v15) ✅ Configured
- **Purpose**: Primary relational database
- **Why chosen**:
  - ACID compliance
  - JSON support
  - Extensions ecosystem
  - Excellent performance
- **Local access**: Port 5432
- **Credentials**: usecapsule/usecapsule_dev_password

### Caching & Pub/Sub

#### Redis (v7) ✅ Configured
- **Purpose**: Caching layer and pub/sub messaging
- **Why chosen**:
  - In-memory performance
  - Pub/sub capabilities
  - Simple to use
  - Battle-tested
- **Local access**: Port 6379

### Message Broker

#### RabbitMQ (v3) ✅ Configured
- **Purpose**: Message queue for async processing
- **Why chosen**:
  - Reliable message delivery
  - Multiple messaging patterns
  - Management UI
  - Mature ecosystem
- **Local access**: 
  - AMQP: Port 5672
  - Management UI: Port 15672

### Secrets Management

#### HashiCorp Vault (v1.15) ✅ Configured
- **Purpose**: Secure secrets storage
- **Why chosen**:
  - Industry standard
  - Dynamic secrets
  - Encryption as a service
  - Audit logging
- **Local access**: Port 8200

## Development Tools

### Code Quality

#### ESLint (v9.8.0) ✅ Implemented
- **Purpose**: JavaScript/TypeScript linting
- **Configuration**: `eslint.config.mjs`
- **Plugins**:
  - TypeScript ESLint
  - React hooks
  - Import ordering
  - JSX a11y

#### Prettier (v2.6.2) ✅ Implemented
- **Purpose**: Code formatting
- **Why chosen**: Consistent code style

### Package Management

#### npm Workspaces ✅ Implemented
- **Purpose**: Monorepo package management
- **Why chosen**:
  - Native npm feature
  - Simple configuration
  - No additional tools needed
- **Configuration**: `package.json` workspaces field

## Shared Libraries

### Internal Libraries ✅ Implemented

#### @usecapsule/contexts-auth
- **Purpose**: Authentication bounded context
- **Status**: Scaffold only
- **Location**: `libs/contexts/auth`

#### @usecapsule/shared-dto
- **Purpose**: Shared Data Transfer Objects
- **Status**: Scaffold only
- **Location**: `libs/shared/dto`

#### @usecapsule/shared-types
- **Purpose**: Shared TypeScript type definitions
- **Status**: Scaffold only
- **Location**: `libs/shared/types`

#### @usecapsule/ui-react
- **Purpose**: Shared React components
- **Status**: Basic implementation
- **Location**: `libs/ui/react`

## External Dependencies

### Utilities

#### axios (v1.6.0) ✅ Installed
- **Purpose**: HTTP client
- **Why chosen**: Feature-rich, interceptors, good TypeScript support

#### rxjs (v7.8.0) ✅ Installed
- **Purpose**: Reactive programming
- **Why chosen**: Required by NestJS, powerful for async operations

#### reflect-metadata (v0.1.13) ✅ Installed
- **Purpose**: Metadata reflection
- **Why chosen**: Required for NestJS decorators

#### tailwind-merge (v3.3.1) ✅ Installed
- **Purpose**: Merge Tailwind CSS classes
- **Why chosen**: Handles class conflicts intelligently

#### isbot (v4.4.0) ✅ Installed
- **Purpose**: Bot detection
- **Why chosen**: Server-side rendering optimization

## Version Control & Collaboration

### Git ✅ In Use
- **Purpose**: Version control
- **Branching strategy**: TBD
- **Commit conventions**: TBD

## Planned Technologies (Not Yet Implemented)

### Authentication
- **JWT**: Token-based authentication
- **OAuth 2.0**: Social login providers
- **SAML**: Enterprise SSO

### Monitoring & Observability
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **OpenTelemetry**: Distributed tracing
- **Loki**: Log aggregation

### API Documentation
- **OpenAPI/Swagger**: API specification
- **GraphQL**: Alternative API layer

### Deployment
- **Kubernetes**: Container orchestration
- **Helm**: Kubernetes package manager
- **ArgoCD**: GitOps deployment

### CI/CD
- **GitHub Actions**: Continuous integration
- **Nx Cloud**: Distributed caching and CI

## Technology Decision Records

### Why Nx Monorepo?
- **Date**: Project inception
- **Decision**: Use Nx for monorepo management
- **Reasons**:
  - Excellent support for TypeScript projects
  - Built-in generators save development time
  - Affected commands optimize CI/CD
  - Dependency graph helps understand project structure

### Why NestJS for Backend?
- **Date**: Project inception
- **Decision**: Use NestJS for all backend services
- **Reasons**:
  - Enterprise-ready architecture patterns
  - Excellent TypeScript support
  - Modular design fits microservices
  - Large ecosystem of plugins

### Why React + Vite for Frontend?
- **Date**: Project inception
- **Decision**: Use React with Vite
- **Reasons**:
  - React's maturity and ecosystem
  - Vite's superior developer experience
  - Fast HMR improves productivity
  - Native ES modules support

### Why Tailwind CSS?
- **Date**: Project inception
- **Decision**: Use Tailwind for styling
- **Reasons**:
  - Rapid prototyping
  - Consistent design system
  - Small bundle sizes with purging
  - Great developer experience

## Upgrade Path

### Short-term (Next 3 months)
- Implement database migrations (TypeORM/Prisma)
- Add API documentation (OpenAPI)
- Implement authentication (JWT/OAuth)

### Medium-term (3-6 months)
- Add monitoring stack (Prometheus/Grafana)
- Implement caching strategies
- Add message queue patterns

### Long-term (6-12 months)
- Kubernetes deployment
- Multi-region support
- GraphQL API layer
- Micro-frontend architecture