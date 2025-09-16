# System Architecture Overview

**Comprehensive overview of the Capsule Platform's architecture, built on Domain-Driven Design principles with microservices and event-driven communication.**

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [High-Level Architecture](#high-level-architecture)
3. [Core Design Principles](#core-design-principles)
4. [Service Boundaries](#service-boundaries)
5. [Communication Patterns](#communication-patterns)
6. [Data Architecture](#data-architecture)
7. [Technology Stack](#technology-stack)
8. [Deployment Architecture](#deployment-architecture)
9. [Scalability & Performance](#scalability--performance)
10. [Security Model](#security-model)

## Executive Summary

The Capsule Platform is a cloud-native application deployment platform that eliminates infrastructure complexity for development teams. Built using **Domain-Driven Design (DDD)** with **Hexagonal Architecture**, the system employs a **microservices pattern** where all external HTTP traffic flows through a single **API Gateway**, which then communicates with internal services via **RabbitMQ message queues**.

### Key Architectural Highlights

- **Zero HTTP Communication Between Services**: All inter-service communication happens via RabbitMQ
- **Database per Service**: Each bounded context owns its data completely
- **Exchange-First Messaging**: Sophisticated routing using @golevelup/nestjs-rabbitmq
- **Event-Driven Architecture**: Domain events enable loose coupling between contexts
- **Infrastructure as Code**: Complete deployment automation with export capabilities

## High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           EXTERNAL CLIENTS                                      │
│  (Web Apps, Mobile Apps, CLI Tools, Third-party Integrations)                  │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼ HTTPS/HTTP
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY (Port 3000)                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │ • HTTP Request Validation    • Rate Limiting & Throttling              │    │
│  │ • Authentication & Authorization • Request/Response Transformation      │    │
│  │ • API Versioning            • Comprehensive Logging & Metrics          │    │
│  │ • Circuit Breaker Patterns  • Health Check Aggregation                │    │
│  └─────────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────────────────────┘
                              │
                              ▼ AMQP (Message Queue)
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         RABBITMQ MESSAGE BROKER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ capsule.commands│  │ capsule.events  │  │      dlx        │                │
│  │ (Direct)        │  │ (Topic)         │  │ (Dead Letter)   │                │
│  │ RPC Commands    │  │ Domain Events   │  │ Failed Messages │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────┬───────────────────┬───────────────────┬───────────────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  AUTH SERVICE   │  │ BILLING SERVICE │  │ DEPLOY SERVICE  │  │ MONITOR SERVICE │
│  (Port 3001)    │  │  (Port 3002)    │  │  (Port 3003)    │  │  (Port 3004)    │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
│  Authentication │  │ Subscriptions   │  │ K8s Orchestrtn  │  │ Metrics & Logs  │
│  User Management│  │ Payment Process │  │ Container Mgmt  │  │ Alerting        │
│  JWT Tokens     │  │ Invoice Generation│  │ Resource Mgmt   │  │ Performance     │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
          │                   │                   │                   │
          ▼                   ▼                   ▼                   ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    AUTH DB      │  │   BILLING DB    │  │   DEPLOY DB     │  │   MONITOR DB    │
│   PostgreSQL    │  │   PostgreSQL    │  │   PostgreSQL    │  │  TimescaleDB    │
│   Port 7110     │  │   Port 7113     │  │   Port 7111     │  │   Port 7112     │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Core Design Principles

### 1. Domain-Driven Design (DDD)

**Bounded Contexts**: Each microservice represents a distinct business domain with clear boundaries:

- **Authentication Context**: User identity, sessions, and authorization
- **Billing Context**: Subscriptions, payments, and financial operations
- **Deployment Context**: Application deployment, scaling, and infrastructure management
- **Monitoring Context**: Observability, metrics collection, and alerting

**Ubiquitous Language**: Consistent terminology across code, documentation, and business communication within each context.

### 2. Hexagonal Architecture (Ports & Adapters)

Each service implements hexagonal architecture:

```text
┌─────────────────────────────────────────┐
│              SERVICE BOUNDARY           │
│  ┌─────────────────────────────────┐    │
│  │        DOMAIN CORE              │    │
│  │  ┌─────────────────────────┐    │    │
│  │  │     BUSINESS LOGIC      │    │    │
│  │  │  • Entities             │    │    │
│  │  │  • Value Objects        │    │    │
│  │  │  • Domain Services      │    │    │
│  │  │  • Aggregates           │    │    │
│  │  └─────────────────────────┘    │    │
│  │                                 │    │
│  │  ┌─────────────────────────┐    │    │
│  │  │   APPLICATION LAYER     │    │    │
│  │  │  • Commands             │    │    │
│  │  │  • Queries              │    │    │
│  │  │  • Event Handlers       │    │    │
│  │  │  • Application Services │    │    │
│  │  └─────────────────────────┘    │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌──────────────┐  ┌──────────────┐     │
│  │   PRIMARY    │  │  SECONDARY   │     │
│  │   ADAPTERS   │  │   ADAPTERS   │     │
│  │              │  │              │     │
│  │ • RabbitMQ   │  │ • PostgreSQL │     │
│  │   Handlers   │  │   Repository │     │
│  │ • HTTP APIs  │  │ • External   │     │
│  │              │  │   APIs       │     │
│  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────┘
```

### 3. Event-Driven Architecture

**Domain Events**: Services publish events when significant business activities occur:

- `user.created` → Triggers customer profile creation in billing
- `payment.processed` → Enables deployment quota increases
- `deployment.failed` → Triggers monitoring alerts and rollback procedures

**Eventual Consistency**: Services maintain their own data and synchronize through events, accepting temporary inconsistencies for improved resilience and scalability.

## Service Boundaries

### Auth Service (Authentication Bounded Context)

**Responsibilities**:

- User registration, authentication, and profile management
- JWT token generation and validation
- Password reset and email verification flows
- Role-based access control (RBAC)

**Domain Entities**:

```typescript
class User {
  id: UserId;
  email: EmailAddress;
  hashedPassword: HashedPassword;
  profile: UserProfile;
  roles: Role[];
  createdAt: Date;
  updatedAt: Date;
}

class Session {
  id: SessionId;
  userId: UserId;
  token: JWTToken;
  expiresAt: Date;
  deviceInfo: DeviceInfo;
}
```

### Billing Service (Financial Bounded Context)

**Responsibilities**:

- Subscription management and billing cycles
- Payment processing integration (Stripe, PayPal)
- Invoice generation and delivery
- Usage tracking and quota management

**Domain Entities**:

```typescript
class Customer {
  id: CustomerId;
  userId: UserId;
  billingAddress: Address;
  paymentMethods: PaymentMethod[];
  subscriptions: Subscription[];
}

class Subscription {
  id: SubscriptionId;
  customerId: CustomerId;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriod: BillingPeriod;
}
```

### Deploy Service (Deployment Bounded Context)

**Responsibilities**:

- Application deployment orchestration
- Kubernetes resource management
- Container image building and registry management
- Environment provisioning (staging, production)

**Domain Entities**:

```typescript
class Application {
  id: ApplicationId;
  name: string;
  userId: UserId;
  repository: GitRepository;
  environments: Environment[];
  deployments: Deployment[];
}

class Deployment {
  id: DeploymentId;
  applicationId: ApplicationId;
  environment: Environment;
  status: DeploymentStatus;
  resources: KubernetesResources;
}
```

### Monitor Service (Observability Bounded Context)

**Responsibilities**:

- Metrics collection and aggregation
- Log management and analysis
- Alert configuration and notification
- Performance monitoring and reporting

**Domain Entities**:

```typescript
class MetricSeries {
  id: MetricId;
  name: string;
  labels: Record<string, string>;
  dataPoints: DataPoint[];
  retention: Duration;
}

class Alert {
  id: AlertId;
  name: string;
  condition: AlertCondition;
  actions: AlertAction[];
  status: AlertStatus;
}
```

## Communication Patterns

### 1. Synchronous Communication (RPC)

Used for operations requiring immediate responses:

```typescript
// API Gateway to Auth Service
const user = await this.amqpConnection.request({
  exchange: 'capsule.commands',
  routingKey: 'auth.register',
  payload: { email, password },
  timeout: 10000,
});
```

### 2. Asynchronous Communication (Events)

Used for domain events and cross-context notifications:

```typescript
// Auth Service publishes user creation event
await this.amqpConnection.publish('capsule.events', 'user.created', {
  userId: user.id,
  email: user.email,
  timestamp: new Date().toISOString(),
});

// Billing Service subscribes to user creation
@RabbitSubscribe({
  exchange: 'capsule.events',
  routingKey: 'user.created',
})
async onUserCreated(event: UserCreatedEvent) {
  await this.customerService.createCustomerProfile(event);
}
```

### 3. Health Check Pattern

All services implement standardized health checks:

```typescript
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
      version: '1.0.0',
      memory: { used: 245, total: 512, unit: 'MB' },
      database: { connected: true, responseTime: 12 },
    },
  };
}
```

## Data Architecture

### Database per Service Pattern

Each service owns its database completely:

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  AUTH SERVICE   │    │ BILLING SERVICE │    │ DEPLOY SERVICE  │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   AUTH DB   │ │    │ │ BILLING DB  │ │    │ │  DEPLOY DB  │ │
│ │ PostgreSQL  │ │    │ │ PostgreSQL  │ │    │ │ PostgreSQL  │ │
│ │             │ │    │ │             │ │    │ │             │ │
│ │ • Users     │ │    │ │ • Customers │ │    │ │ • Apps      │ │
│ │ • Sessions  │ │    │ │ • Payments  │ │    │ │ • Deploys   │ │
│ │ • Roles     │ │    │ │ • Invoices  │ │    │ │ • Resources │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        └─────────── No Direct Database Access ──────────┘
                      (All data shared via events)
```

### Schema Management

Each service manages its own database schema:

```bash
# Database migrations per service
apps/auth-service/migrations/
├── V1__create_users_table.sql
├── V2__add_user_roles.sql
└── V3__create_sessions_table.sql

apps/billing-service/migrations/
├── V1__create_customers_table.sql
├── V2__create_subscriptions.sql
└── V3__add_payment_methods.sql
```

### Data Consistency Strategy

**Within Service**: ACID transactions for strong consistency
**Across Services**: Eventually consistent via domain events and saga patterns

```typescript
// Saga pattern for complex workflows
class UserRegistrationSaga {
  async handle(command: RegisterUserCommand) {
    const user = await this.authService.createUser(command);

    // Publish event for other services
    await this.eventPublisher.publish('user.created', {
      userId: user.id,
      email: user.email,
    });

    // Billing service will eventually create customer profile
    // Deploy service will eventually set up default quotas
  }
}
```

## Technology Stack

### Core Framework & Runtime

- **Runtime**: Node.js 20+ with TypeScript 5.9+
- **Framework**: NestJS 11+ (Express-based)
- **Monorepo**: Nx 21.5.1 for workspace management
- **Package Management**: npm with workspaces

### Messaging & Communication

- **Message Broker**: RabbitMQ 3.13 with Management plugin
- **Client Library**: @golevelup/nestjs-rabbitmq 6.0.2
- **Exchange Pattern**: Direct (RPC) + Topic (Events) + Fanout (DLQ)

### Data & Persistence

- **Primary Database**: PostgreSQL 15 (ACID transactions)
- **Time-Series Database**: TimescaleDB (monitoring service)
- **Schema Management**: Flyway migrations
- **ORM**: TypeORM (planned) or Prisma (planned)

### Infrastructure & Operations

- **Containerization**: Docker & Docker Compose
- **Container Registry**: Private registry (planned)
- **Orchestration**: Kubernetes (production)
- **Reverse Proxy**: Nginx (production)

### Development & Quality

- **Code Quality**: ESLint 9.8+ with TypeScript-ESLint 8.40+
- **Code Formatting**: Prettier 3.6+
- **Testing**: Jest with @nestjs/testing
- **Build Tool**: Webpack 5+ with SWC compiler

## Deployment Architecture

### Development Environment

```yaml
# compose.yml
services:
  rabbitmq: # Message broker
    ports: [7010, 7020]

  # Databases (commented until implementation)
  # auth-db:       # PostgreSQL 15
  # billing-db:    # PostgreSQL 15
  # deploy-db:     # PostgreSQL 15
  # monitor-db:    # TimescaleDB
```

### Production Architecture (Planned)

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              KUBERNETES CLUSTER                                │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │   NGINX LB      │  │  API GATEWAY    │  │   RABBITMQ      │                │
│  │  (External)     │  │   (3 replicas)  │  │  (Clustered)    │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ AUTH SERVICE    │  │ BILLING SERVICE │  │ DEPLOY SERVICE  │                │
│  │ (2+ replicas)   │  │ (2+ replicas)   │  │ (2+ replicas)   │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                │
│  │ POSTGRES RDS    │  │    REDIS        │  │   MONITORING    │                │
│  │ (Multi-AZ)      │  │  (Caching)      │  │ (Prometheus)    │                │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Scalability & Performance

### Horizontal Scaling Strategies

1. **API Gateway**: Load balance multiple instances behind Nginx
2. **Microservices**: Auto-scale based on CPU/memory/queue depth metrics
3. **RabbitMQ**: Cluster nodes for high availability and throughput
4. **Databases**: Read replicas and connection pooling

### Performance Characteristics

**Target Metrics**:

- API Response Time: < 200ms (95th percentile)
- Message Processing: < 100ms average
- System Throughput: 1000+ requests/second
- Availability: 99.9% uptime

**Optimization Techniques**:

- Message queue prefetching and batching
- Database query optimization and indexing
- HTTP response caching at API Gateway
- Connection pooling and keep-alive

## Security Model

### Authentication & Authorization

```text
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│ API Gateway │───▶│Auth Service │
│             │    │             │    │             │
│ JWT Token   │    │ Validates   │    │ Issues JWT  │
│ in Header   │    │ JWT & RBAC  │    │ & Manages   │
│             │    │             │    │ Users       │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Data Protection

- **Encryption in Transit**: TLS 1.3 for all HTTP/AMQP communication
- **Encryption at Rest**: Database-level encryption for sensitive data
- **Secret Management**: Environment variables with rotation policies
- **Input Validation**: Comprehensive validation at API boundaries

### Network Security

- **Internal Communication**: Services communicate only via RabbitMQ
- **Firewall Rules**: Restrict database access to authorized services only
- **Container Security**: Non-root containers with minimal base images

---

**Next Steps**:

- Review [Microservices Architecture](./microservices.md) for detailed service design
- See [Message Queue Architecture](./message-queues.md) for RabbitMQ implementation details
- Check [RabbitMQ Implementation Guide](../guides/rabbitmq-implementation.md) for practical examples
