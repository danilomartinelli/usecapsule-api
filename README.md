# Capsule Platform

> **Cloud-native application deployment platform that eliminates infrastructure complexity for development teams**

Capsule transforms the way teams deploy and manage applications by providing automated deployment pipelines, comprehensive observability, and zero vendor lock-in through Infrastructure as Code export capabilities. Built on Kubernetes with a developer-first approach, Capsule reduces deployment time from weeks to minutes while maintaining enterprise-grade reliability and security.

## 🎯 Why Capsule?

Development teams spend 40-60% of their time wrestling with infrastructure instead of building features. Capsule solves this by abstracting away infrastructure complexity while maintaining the flexibility and control teams need. With Capsule, you can deploy any application with a simple git push, monitor it with built-in observability tools, and export your entire infrastructure as code whenever you need to migrate or go independent.

### Key Features

- **Universal Smart Deploy** - Automatically detects and deploys 50+ frameworks with zero configuration
- **Complete Observability** - Metrics, logging, and distributed tracing out of the box
- **Team Collaboration** - Preview environments for every pull request with automatic cleanup
- **No Lock-in** - Export to Kubernetes, Terraform, or Docker Compose at any time
- **Managed Services** - Production-ready databases and message brokers with one click

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed on your development machine:

- **Node.js** (v20 or higher) - [Download here](https://nodejs.org/)
- **npm** (v10 or higher) - Comes with Node.js
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
- **Git** - [Download here](https://git-scm.com/)

Optional but recommended:

- **Nx Console** - VS Code extension for better Nx experience
- **PostgreSQL client** - For database debugging (psql or pgAdmin)
- **RabbitMQ Management** - Access at <http://localhost:15672> when running

### Quick Start

Follow these steps to get Capsule running on your local machine in under 5 minutes:

```bash
# Clone the repository
git clone https://github.com/your-org/capsule.git
cd capsule

# Install dependencies
npm install

# Start infrastructure (databases, RabbitMQ)
npm run infrastructure:up

# Run database migrations
npm run db:migrate:all

# Start all services in development mode
npm run dev

# In another terminal, run the API Gateway
npm run serve:gateway
```

Your Capsule platform is now running! Access it at:

- **API Gateway**: <http://localhost:3000>
- **API Documentation**: <http://localhost:3000/api/documentation>
- **RabbitMQ Management**: <http://localhost:7020> (usecapsule/usecapsule_dev_password)

### Verifying Your Setup

Run the health check to ensure everything is working:

```bash
# Check all services are healthy
curl http://localhost:3000/health

# Check service health
curl http://localhost:3000/health/ready
```

## 📁 Project Structure

Capsule uses an Nx monorepo structure with Domain-Driven Design principles. Each microservice represents a bounded context with its own database and domain model:

```text
@usecapsule/source/
├── apps/                     # Microservices and applications
│   ├── api-gateway/         # HTTP entry point, routes to services
│   ├── auth-service/        # Authentication bounded context
│   ├── deploy-service/      # Deployment orchestration
│   └── monitor-service/     # Metrics and observability
│
├── libs/                    # Shared libraries
│   ├── shared/             # Cross-cutting concerns
│   │   ├── ddd/           # DDD building blocks
│   │   ├── messaging/     # Message contracts
│   │   └── types/         # TypeScript types
│   └── configs/           # Configuration modules
│
├── devtools/              # Development tools
│   ├── docker/           # Docker configurations
│   ├── k8s/             # Kubernetes manifests
│   └── scripts/         # Utility scripts
│
└── tools/                # Future SDKs and CLIs
```

For detailed architecture documentation, see [CLAUDE.md](./CLAUDE.md) - our comprehensive guide to Domain-Driven Design patterns and best practices used throughout the project.

## 🛠️ Development Workflow

### Working with Nx

Nx provides powerful tools for monorepo management. Here are the essential commands you'll use daily:

```bash
# Serve a specific application
nx serve api-gateway
nx serve auth-service --watch

# Build a specific application
nx build auth-service

# Lint a specific project
nx lint auth-service

# Generate new code
nx g @nx/nest:module user --project=auth-service
nx g @nx/nest:service user --project=auth-service

# See project dependencies
nx graph

# Run commands for all affected projects
nx affected:build
nx affected:lint
```

### Available Scripts

We've created convenient npm scripts that orchestrate common development tasks:

#### Infrastructure Management

```bash
npm run infrastructure:up      # Start Docker containers (databases, RabbitMQ)
npm run infrastructure:down    # Stop all containers
npm run infrastructure:reset   # Reset all data (careful!)
```

#### Database Management

```bash
npm run db:migrate:all        # Run all service migrations
npm run db:migrate:auth       # Run auth service migrations only
npm run db:migrate:deploy     # Run deploy service migrations only
npm run db:seed:all          # Seed all databases with test data
npm run db:reset:all         # Drop and recreate all databases
```

#### Development

```bash
npm run dev                  # Start all services in watch mode
npm run dev:gateway         # Start only API Gateway
npm run dev:services        # Start all microservices (no gateway)
npm run build              # Build all projects
npm run build:affected     # Build only changed projects
```

#### Code Quality

```bash
npm run lint              # Lint all projects
npm run lint:affected     # Lint only changed code
npm run format           # Format code with Prettier
npm run analyze          # Analyze bundle sizes
```

### Creating a New Microservice

When you need to add a new bounded context to the system, follow these steps:

```bash
# 1. Generate the new service
nx g @nx/nest:app payment-service

# 2. Create the database configuration
mkdir apps/payment-service/migrations
touch apps/payment-service/migrations/flyway.conf

# 3. Add the service to docker-compose.yml
# (Copy the pattern from auth-service)

# 4. Create the first migration
echo "CREATE TABLE payments (...);" > \
  apps/payment-service/migrations/V1__create_payments_table.sql

# 5. Add message handlers (no HTTP controllers!)
nx g @nx/nest:controller message-handlers/payment \
  --project=payment-service

# 6. Connect to RabbitMQ in main.ts
# (Copy pattern from auth-service/src/main.ts)
```

### Working with Databases

Each microservice has its own database. Here's how to interact with them during development:

```bash
# Connect to a specific service's database
docker exec -it capsule-auth-db psql -U auth_user -d auth_service_db
docker exec -it capsule-deploy-db psql -U deploy_user -d deploy_service_db

# View migration history
docker run --rm --network=host \
  -v ./apps/auth-service/migrations:/flyway/sql \
  flyway/flyway:9 info \
  -url=jdbc:postgresql://localhost:5432/auth_service_db \
  -user=auth_user -password=auth_pass

# Create a new migration
touch apps/auth-service/migrations/V$(date +%Y%m%d%H%M)__description.sql
```

## 🏗️ Architecture Overview

Capsule follows Domain-Driven Design with Hexagonal Architecture patterns:

- **API Gateway Pattern**: Single HTTP entry point that routes to microservices via RabbitMQ
- **Database per Service**: Each bounded context owns its data completely
- **CQRS**: Commands and queries separate write and read operations
- **Event-Driven**: Services communicate asynchronously through domain events
- **No Shared State**: Services never share databases or domain models

### Key Architectural Decisions

1. **Message-Only Microservices**: Services only communicate via RabbitMQ, never HTTP
2. **Flyway Migrations**: Schema versioning with forward-only migrations
3. **Domain-First Development**: Business logic lives in domain entities, not services
4. **Eventual Consistency**: Embracing async communication between bounded contexts

For deep dives into our architecture patterns, refer to [CLAUDE.md](./CLAUDE.md).

## 🔍 Code Quality

We maintain high code quality through comprehensive linting and formatting:

### Code Analysis

```bash
# Lint code for style and errors
nx lint auth-service --watch

# Format code with Prettier
nx format:write

# Type checking
nx typecheck auth-service

# Check all affected projects
nx affected:lint
```

## 🔄 CI/CD Pipeline

Our GitHub Actions pipeline ensures code quality and automates deployments:

```yaml
# On every push
- Lint affected code
- Build affected projects
- Type checking

# On PR to main
- Full lint and format check
- Build all projects
- Security scanning

# On merge to main
- Run Flyway migrations
- Deploy to staging
- Health checks
- Deploy to production (manual approval)
```

## 📊 Monitoring and Debugging

### Local Debugging

```bash
# View logs for a specific service
docker logs -f capsule-auth-service

# Access RabbitMQ Management UI
open http://localhost:7020

# Monitor database queries
docker exec capsule-auth-db psql -U auth_user -c "SELECT * FROM pg_stat_activity;"

# Debug with VS Code
# 1. Run: nx serve auth-service --inspect
# 2. Attach debugger to port 9229
```

### Performance Profiling

```bash
# Generate CPU profile
nx serve auth-service --inspect-brk
# Use Chrome DevTools to profile

# Analyze bundle size
nx build auth-service --stats-json
webpack-bundle-analyzer dist/apps/auth-service/stats.json
```

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:

### Development Process

1. **Fork and Clone**: Fork the repository and clone your fork
2. **Branch**: Create a feature branch from `main`
3. **Develop**: Make your changes following our architecture patterns
4. **Lint**: Ensure code passes linting and format checks
5. **Document**: Update documentation if you're changing architecture
6. **PR**: Submit a pull request with a clear description

### Code Style

- Follow the patterns in [CLAUDE.md](./CLAUDE.md)
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`
- Keep commits atomic and focused
- Write meaningful commit messages

### Pull Request Guidelines

- PRs should be focused and not too large
- Include documentation for new functionality
- Update documentation as needed
- Ensure CI passes before requesting review
- Link to any relevant issues

## 📚 Resources

### Documentation

- [docs/](./docs/) - Complete technical documentation and implementation guides
- [CLAUDE.md](./CLAUDE.md) - Comprehensive architecture guide
- [API Documentation](http://localhost:3000/api/documentation) - Swagger/OpenAPI specs
- [Nx Documentation](https://nx.dev) - Monorepo tooling
- [NestJS Documentation](https://nestjs.com) - Framework documentation

### Learning Resources

- [Domain-Driven Design Distilled](https://www.amazon.com/Domain-Driven-Design-Distilled-Vaughn-Vernon/dp/0134434420) - Essential DDD concepts
- [Building Microservices](https://www.amazon.com/Building-Microservices-Designing-Fine-Grained-Systems/dp/1492034029) - Microservices patterns
- [Event-Driven Architecture](https://www.youtube.com/watch?v=STKCRSUsyP0) - Understanding event-driven systems

### Tools

- [Nx Console](https://marketplace.visualstudio.com/items?itemName=nrwl.angular-console) - VS Code extension
- [Thunder Client](https://marketplace.visualstudio.com/items?itemName=rangav.vscode-thunder-client) - API testing
- [Docker Desktop](https://www.docker.com/products/docker-desktop) - Container management

## 🐛 Troubleshooting

### Common Issues

- **Services won't start**

```bash
# Check if ports are already in use
lsof -i :3000  # API Gateway
lsof -i :5432  # PostgreSQL
lsof -i :5672  # RabbitMQ

# Reset everything
npm run infrastructure:reset
npm run dev
```

- **Database connection errors**

```bash
# Ensure databases are running
docker ps

# Check migrations
npm run db:migrate:all

# View database logs
docker logs capsule-auth-db
```

- **RabbitMQ connection issues**

```bash
# Check RabbitMQ is healthy
curl -u usecapsule:usecapsule_dev_password http://localhost:7020/api/overview

# Reset RabbitMQ
docker restart rabbitmq_dev
```

- **TypeScript/Build errors**

```bash
# Clear Nx cache
nx reset

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## 📄 License

This project is proprietary software. All rights reserved.

## 🙋 Support

For questions and support:

- Create an issue in GitHub
- Check existing issues for solutions
- Reach out to the architecture team on Slack
- Review [CLAUDE.md](./CLAUDE.md) for architecture questions

---

**Ready to revolutionize how you deploy applications?** Follow the quick start guide above and you'll have Capsule running locally in minutes. For production deployments, contact the platform team for access to our cloud environments.

Built with ❤️ by the Capsule Team
