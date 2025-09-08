# Capsule Platform Documentation

Welcome to the Capsule platform documentation! This comprehensive guide covers
everything you need to know about developing, deploying, and maintaining the
Capsule cloud-native application deployment platform.

## 📚 Documentation Structure

### 🏗️ [Architecture](./architecture/)

- [System Overview](./architecture/overview.md) - High-level system architecture
  and design principles
- Component diagrams and interaction patterns
- Microservices communication patterns
- Security and deployment architecture

### 🗄️ [Database](./database/)

- [Database Architecture](./database/overview.md) - Complete database setup and
  migration guide
- Database per service pattern
- Slonik type-safe queries
- Flyway migration system
- Development and production guidelines

### 👨‍💻 [Development](./development/)

- [Getting Started Guide](./development/setup.md) - Complete developer setup
- Development workflow and debugging
- Code style and contribution guidelines

### 🔌 [API Documentation](./api/)

- REST API reference and examples
- Message patterns and RabbitMQ communication
- Authentication and authorization
- Rate limiting and error handling

### 🚀 [Deployment](./deployment/)

- Docker and container configuration
- Kubernetes deployment manifests
- Environment configuration
- Monitoring and observability setup

## 🚀 Quick Start

### For Developers

1. **Set up your environment**: Follow the [Getting Started Guide](./development/setup.md)
2. **Understand the architecture**: Read the [System Overview](./architecture/overview.md)
3. **Learn the database patterns**: Check out [Database Architecture](./database/overview.md)
4. **Start contributing**: Follow our development workflow

### For DevOps/Infrastructure

1. **Review deployment architecture**: [System Overview](./architecture/overview.md)
2. **Understand database requirements**: [Database Documentation](./database/overview.md)
3. **Set up monitoring**: [Deployment Guide](./deployment/) (coming soon)

### For Product/Business

1. **Product overview**: [Product Requirements Document](./PRD.md)
2. **System capabilities**: [Architecture Overview](./architecture/overview.md)

## 🏗️ Current System Status

### ✅ Implemented

- **Infrastructure Foundation**
  - Nx monorepo with microservices architecture
  - Docker Compose for local development
  - PostgreSQL, Redis, RabbitMQ, and Vault services

- **Database System**
  - Database per service pattern with dedicated PostgreSQL instances
  - Slonik for type-safe database queries with connection pooling
  - Flyway for version-controlled database migrations
  - Complete auth-service database setup with users table

- **Auth Service**
  - NestJS microservice with RabbitMQ messaging (no HTTP endpoints)
  - User registration, login, and token validation message patterns
  - Integration with shared database library
  - Health check and monitoring capabilities

- **Shared Libraries**
  - `@usecapsule/database` - Reusable database service with Slonik
  - Type-safe configuration system for multiple services
  - Scalable foundation for additional services

### 🔧 In Development

- **API Gateway**
  - HTTP-to-RabbitMQ message translation
  - JWT authentication and authorization
  - Rate limiting and request validation

- **Additional Services**
  - Project service for application management
  - Deploy service for container orchestration
  - Monitor service for observability
  - Notification service for alerts

### 📋 Planned

- **Advanced Features**
  - Preview environments for pull requests
  - Cost tracking and optimization
  - Team collaboration and permissions
  - Infrastructure export (Kubernetes/Terraform)

## 🛠️ Technology Stack

### Backend Services

- **Framework**: NestJS 11 with TypeScript 5.8
- **Runtime**: Node.js 20+
- **Monorepo**: Nx 21.4
- **Message Queue**: RabbitMQ 3
- **Cache**: Redis 7

### Database & Persistence

- **Database**: PostgreSQL 15 (dedicated instance per service)
- **Query Builder**: Slonik (type-safe with connection pooling)
- **Migrations**: Flyway (Docker-based with version control)
- **Pattern**: Database per Service for complete data isolation

### Infrastructure & DevOps

- **Containers**: Docker with multi-stage builds
- **Orchestration**: Kubernetes (planned)
- **Secrets Management**: HashiCorp Vault
- **Development**: Docker Compose for local environment

### Monitoring & Observability

- **Metrics**: Prometheus (planned)
- **Visualization**: Grafana (planned)
- **Logging**: Structured logging with NestJS Logger
- **Tracing**: OpenTelemetry integration (planned)

## 📖 Key Concepts

### Microservices Architecture

Capsule follows a pure microservices pattern:

- **API Gateway**: Single HTTP entry point for external clients
- **Service Communication**: RabbitMQ messages only (no service-to-service HTTP)
- **Data Isolation**: Each service owns its database completely
- **Independent Deployment**: Services can be developed and deployed
  independently

### Database per Service Pattern

Each microservice has its own PostgreSQL database:

```
┌─────────────────┐    ┌──────────────────┐
│   Auth Service  │───▶│  Auth PostgreSQL │
└─────────────────┘    └──────────────────┘

┌─────────────────┐    ┌──────────────────┐
│ Project Service │───▶│Project PostgreSQL│
└─────────────────┘    └──────────────────┘
```

Benefits:

- **Complete data ownership** and isolation
- **Independent scaling** based on service needs
- **Technology flexibility** per service
- **Fault isolation** - database issues don't cascade

### Type-Safe Database Operations

Using Slonik for compile-time type safety:

```typescript
// Type-safe queries with parameter binding
const user = await pool.one(sql.typeAlias('user')`
  SELECT id, email, name, created_at
  FROM users
  WHERE email = ${email} AND is_active = true
`);

// Connection pooling and error handling built-in
const pool = await createPool(connectionString, {
  maximumPoolSize: 10,
  connectionTimeout: 5000,
  idleTimeout: 60000,
});
```

### Flyway Migration System

Version-controlled database schema management:

```bash
# Run migrations for auth service
npm run migrate:auth

# Check migration status
npm run migrate:auth:info

# Validate migration files
npm run migrate:auth:validate
```

Migration files follow semantic versioning:

- `V001__create_users_table.sql`
- `V002__add_user_preferences.sql`
- `V003__create_sessions_table.sql`

## 📝 Contributing

We welcome contributions! Here's how to get started:

1. **Read the guides**:
   - [Getting Started Guide](./development/setup.md)
   - [System Architecture](./architecture/overview.md)

2. **Set up your environment**:

   ```bash
   git clone git@github.com:danilomartinelli/usecapsule-api.git
   cd usecapsule-api
   npm install
   npm run docker:up
   npm run migrate:auth
   ```

3. **Follow our workflow**:
   - Create feature branch from `main`
   - Follow conventional commit messages
   - Update documentation as needed
   - Submit PR with clear description

4. **Code standards**:
   - TypeScript with strict type checking
   - ESLint and Prettier for code formatting
   - Structured logging and error handling

## 📞 Support & Resources

### Documentation

- **Architecture**: [System Overview](./architecture/overview.md)
- **Database**: [Complete Database Guide](./database/overview.md)
- **Development**: [Getting Started](./development/setup.md)
- **Product**: [Requirements Document](./PRD.md)

### Community

- **Issues**: [GitHub Issues](https://github.com/danilomartinelli/usecapsule-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/danilomartinelli/usecapsule-api/discussions)
- **Security**: Report security issues to <security@usecapsule.com>

### External Resources

- [NestJS Documentation](https://nestjs.com)
- [Nx Documentation](https://nx.dev)
- [Slonik Documentation](https://github.com/gajus/slonik)
- [Flyway Documentation](https://flywaydb.org/documentation/)

---

**Capsule Platform** - Deploy with confidence, scale without limits.

*Documentation last updated: September 7, 2025*
