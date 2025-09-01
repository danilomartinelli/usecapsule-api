# Technical Architecture - Capsule Platform

This document details the technical architecture of the Capsule project, including design decisions, patterns used, and system structure.

## 🏗️ Architecture Overview

### Architectural Principles

- **Domain-Driven Design (DDD)** - Organization by bounded contexts
- **Hexagonal Architecture** - Domain isolation via ports & adapters
- **Event-Driven Architecture** - Asynchronous communication via events
- **Feature-Sliced Design (FSD)** - Scalable frontend organization
- **Nx Monorepo** - Efficient management of multiple projects

### High-Level Architecture Diagram

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Portal        │    │  API Gateway    │    │  Microserviços  │
│   (React)       │◄──►│   (NestJS)      │◄──►│   (NestJS)      │
│   - Dashboard   │    │   - BFF         │    │   - Deploy      │
│   - UI/UX       │    │   - Auth        │    │   - Billing     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Shared        │    │   Contexts      │    │   External      │
│   Libraries     │    │   (DDD)         │    │   Services      │
│   - DTOs        │    │   - Domain      │    │   - Vault       │
│   - Types       │    │   - Application │    │   - Registries  │
│   - UI          │    │   - Infrastructure│  │   - Brokers     │
└─────────────────┘    └─────────────────┘    └─────────────────┘

```

## 🏛️ Monorepo Structure

### Current Implementation Status

⚠️ **Note**: The project is in early development stage. Many features described in the vision are not yet implemented.

### Layer Organization

```
usecapsule/ (Capsule Platform)
├── apps/                    # Executable applications
│   ├── api-gateway/        # NestJS BFF API (✅ Implemented)
│   ├── portal/             # React + Vite Dashboard (✅ Implemented - Basic)
│   ├── service-auth/       # NestJS Auth Service (✅ Implemented - Scaffold)
│   ├── api-gateway-e2e/    # API E2E Tests (✅ Implemented)
│   └── portal-e2e/         # Portal E2E Tests (✅ Implemented)
├── libs/                    # Shared libraries
│   ├── contexts/           # DDD Bounded Contexts
│   │   └── auth/          # Authentication context (✅ Implemented - Basic)
│   ├── shared/             # Full-Stack shared code
│   │   ├── dto/           # Shared DTOs (✅ Implemented - Basic)
│   │   └── types/         # Shared TypeScript types (✅ Implemented - Basic)
│   └── ui/                 # Frontend components
│       └── react/         # React component library (✅ Implemented - Basic)
├── docs/                    # Project documentation
│   ├── architecture.md    # This file
│   └── core-features.md   # Platform features specification
└── docker-compose.yml      # Local development infrastructure (✅ Implemented)
```

### Dependency Rules

#### ✅ Allowed Dependencies

```
Frontend Apps → UI Libraries
Frontend Apps → Shared Libraries
Backend Apps → Context Libraries
Backend Apps → Shared Libraries
```

#### ❌ Prohibited Dependencies

```
Backend Apps → UI Libraries
Context Libraries → UI Libraries
Context Libraries → Other Context Libraries (via imports)
```

## 🎯 Bounded Contexts (DDD)

### Current Implementation

Currently, only the **Auth Context** has been scaffolded with basic structure. Other contexts (Deploy, Billing, Discovery) are planned but not yet implemented.

### Auth Context (Implemented)

**Responsibility**: User authentication and authorization management.

#### Current Structure

```
libs/contexts/auth/
├── src/
│   ├── index.ts           # Public exports
│   └── lib/
│       ├── context-auth.ts    # Basic auth context (scaffold)
│       └── context-auth.spec.ts # Tests
├── jest.config.ts
├── package.json
├── project.json           # Nx project configuration
└── tsconfig.json
```

### Planned Contexts (Not Yet Implemented)

#### Deploy Context (Planned)
**Responsibility**: Application and service lifecycle management.
- Status: 📋 Planned for future implementation
- Will handle deployments, scaling, and service orchestration

#### Billing Context (Planned)
**Responsibility**: Billing management, quotas, and usage limits.
- Status: 📋 Planned for future implementation
- Will handle usage tracking and cost management

#### Discovery Context (Planned)
**Responsibility**: Service discovery, internal DNS, and network policies.
- Status: 📋 Planned for future implementation
- Will handle service mesh and internal routing

## 🎨 Frontend Architecture

### Current Implementation

The portal application uses React with React Router v7 and Vite. Currently in basic implementation stage.

#### Current Structure
```
apps/portal/
├── app/
│   ├── app.tsx            # Main app component (basic)
│   ├── app-nav.tsx        # Navigation component
│   ├── entry.client.tsx   # Client entry point
│   ├── entry.server.tsx   # Server entry point
│   ├── root.tsx           # Root layout
│   ├── routes.tsx         # Route configuration
│   ├── routes/
│   │   └── about.tsx      # About page
│   └── styles/
│       └── index.css      # Tailwind CSS imports
├── public/
│   └── favicon.ico
├── vite.config.js         # Vite configuration
└── react-router.config.ts # React Router configuration
```

### Planned Feature-Sliced Design Structure

The following FSD structure is planned but not yet implemented:

```
apps/portal/app/           # Future structure
├── pages/                 # Route pages
├── widgets/               # Composite UI blocks
├── features/              # Business features
├── entities/              # Domain entities
└── shared/                # Shared code
```

## 🛠️ Current Technology Stack

### Backend (NestJS)
- **Framework**: NestJS v11 with Express
- **Language**: TypeScript v5.8.2
- **Testing**: Jest for unit and e2e tests
- **Build**: Webpack with SWC for transpilation

### Frontend (React)
- **Framework**: React v19 with React Router v7.2
- **Build Tool**: Vite v6
- **Styling**: Tailwind CSS v4 with Vite plugin
- **UI Library**: Custom React component library (@usecapsule/ui-react)
- **Testing**: Jest with Testing Library

### Infrastructure (Docker)
- **PostgreSQL 15**: Primary database
- **Redis 7**: Caching and pub/sub
- **RabbitMQ 3**: Message broker
- **HashiCorp Vault**: Secrets management

### Development Tools
- **Monorepo**: Nx v21.4.1
- **Package Manager**: npm with workspaces
- **Linting**: ESLint v9 with TypeScript ESLint
- **Testing**: Jest v30, Playwright for e2e
- **CI/CD**: Configured for Nx affected commands

## 🛠️ Development Tools (Planned)

### CLI Tool (Not Yet Implemented)

**Status**: 📋 Planned - The CLI tool described below is part of the future vision.

The CLI tool, custom generators, and development server are part of the planned roadmap but not yet implemented.

## 🔄 Communication Between Layers

### Current Implementation

The project currently uses a simple REST API pattern with NestJS controllers and services. Event-driven architecture is planned but not yet implemented.

### API Structure
- **API Gateway**: Runs on port 3000 with `/api` prefix
- **Auth Service**: Basic NestJS service structure (not yet functional)
- **Portal**: Communicates with API Gateway via HTTP

## 🔒 Security

### Current Security Setup

- **HashiCorp Vault**: Available in Docker Compose for secrets management
- **Environment Variables**: Currently used for configuration
- **CORS**: To be configured in NestJS
- **Authentication**: Not yet implemented

### Planned Security Features

- JWT token authentication
- Role-based access control (RBAC)
- OAuth integration
- API rate limiting

## 📊 Observability

### Current Setup

- **Logging**: NestJS built-in Logger service
- **Testing**: Jest for unit tests, Playwright for e2e tests

### Planned Observability Stack

- Prometheus for metrics collection
- Grafana for visualization
- OpenTelemetry for distributed tracing
- Structured logging with correlation IDs

## 🚀 Deployment & Infrastructure

### Local Development

The project includes a comprehensive Docker Compose setup for local development:

```yaml
# Available services in docker-compose.yml
- PostgreSQL 15: Database (port 5432)
- Redis 7: Cache and pub/sub (port 6379)  
- RabbitMQ 3: Message broker (ports 5672, 15672)
- HashiCorp Vault: Secrets management (port 8200)
```

### Production Deployment

Production deployment strategy is not yet defined. The platform will support container-based deployments with Kubernetes as the primary orchestration platform.

## 🔧 Configuration

### Current Configuration

Environment variables are used for configuration. No `.env` file exists yet - configuration must be set manually.

### Docker Services Credentials

```bash
# PostgreSQL
POSTGRES_DB=usecapsule_dev
POSTGRES_USER=usecapsule
POSTGRES_PASSWORD=usecapsule_dev_password

# Redis
REDIS_PASSWORD=usecapsule_dev_password

# RabbitMQ
RABBITMQ_DEFAULT_USER=usecapsule
RABBITMQ_DEFAULT_PASS=usecapsule_dev_password

# Vault
VAULT_DEV_ROOT_TOKEN_ID=usecapsule-dev-token
```

## 🧪 Testing

### Current Test Setup

- **Unit Tests**: Jest configured for all projects
- **E2E Tests**: 
  - Playwright for portal-e2e
  - Jest for api-gateway-e2e
- **Test Commands**:
  ```bash
  npx nx test api-gateway
  npx nx test portal
  npx nx e2e portal-e2e
  npx nx e2e api-gateway-e2e
  ```

### Test Coverage

Run tests with coverage:
```bash
npx nx test api-gateway --coverage
```

## 📚 References

- [Nx Documentation](https://nx.dev/)
- [NestJS Documentation](https://nestjs.com/)
- [React Router Documentation](https://reactrouter.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Domain-Driven Design](https://martinfowler.com/bliki/DomainDrivenDesign.html)
