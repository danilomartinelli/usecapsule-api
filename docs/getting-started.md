# Getting Started with Capsule Platform

This guide will help you set up and run the Capsule platform locally for development.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18.0.0 or higher
- **npm** v9.0.0 or higher
- **Docker** and **Docker Compose**
- **Git**

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/capsule-dev/capsule.git
cd capsule
```

### 2. Install Dependencies

```bash
npm install
```

This will install all dependencies for the monorepo, including all apps and libraries.

### 3. Start Infrastructure Services

Start the required infrastructure services using Docker Compose:

```bash
npm run docker:up
# or
docker-compose up -d
```

This starts:
- **PostgreSQL** (port 5432) - Database
- **Redis** (port 6379) - Caching and pub/sub
- **RabbitMQ** (ports 5672, 15672) - Message broker
- **HashiCorp Vault** (port 8200) - Secrets management

To verify all services are running:
```bash
docker-compose ps
```

### 4. Start the Development Servers

Run all services in parallel:
```bash
npx nx run-many --target=serve --all
```

Or start specific services individually:

```bash
# Start the API Gateway (Backend)
npx nx serve api-gateway
# Runs on http://localhost:3000/api

# Start the Portal (Frontend)
npx nx serve portal  
# Runs on http://localhost:4200

# Start the Auth Service
npx nx serve service-auth
```

### 5. Access the Applications

- **Portal (Frontend)**: http://localhost:4200
- **API Gateway**: http://localhost:3000/api
- **RabbitMQ Management**: http://localhost:15672 (user: usecapsule, password: usecapsule_dev_password)

## Project Structure Overview

```
acme/                       # Root monorepo
├── apps/                   # Applications
│   ├── api-gateway/       # NestJS BFF API
│   ├── portal/            # React dashboard
│   └── service-auth/      # Auth microservice
├── libs/                   # Shared libraries
│   ├── contexts/          # Domain contexts
│   ├── shared/            # Shared utilities
│   └── ui/               # UI components
└── docker-compose.yml     # Infrastructure
```

## Common Development Tasks

### Running Tests

```bash
# Run all tests
npx nx run-many --target=test --all

# Run tests for specific project
npx nx test api-gateway
npx nx test portal

# Run with coverage
npx nx test api-gateway --coverage

# Run e2e tests
npx nx e2e portal-e2e
```

### Linting

```bash
# Lint all projects
npx nx run-many --target=lint --all

# Lint specific project
npx nx lint api-gateway
```

### Building

```bash
# Build all projects
npx nx run-many --target=build --all

# Build specific project
npx nx build api-gateway
npx nx build portal
```

### Generating Code

Use Nx generators to create new components and services:

```bash
# Generate a new NestJS module
npx nx g @nx/nest:module <module-name> --project=api-gateway

# Generate a new React component
npx nx g @nx/react:component <component-name> --project=portal

# Generate a new library
npx nx g @nx/js:lib <lib-name> --directory=libs/shared
```

## Docker Services Management

### View logs
```bash
npm run docker:logs
# or
docker-compose logs -f
```

### Stop services
```bash
npm run docker:down
# or
docker-compose down
```

### Reset services (delete volumes)
```bash
npm run docker:reset
# or
docker-compose down -v && docker-compose up -d
```

## Environment Configuration

Currently, the project uses default configurations. To customize:

1. Create a `.env` file in the root directory
2. Add your environment variables:

```bash
# API Configuration
PORT=3000
API_PREFIX=api

# Database
DATABASE_URL=postgresql://usecapsule:usecapsule_dev_password@localhost:5432/usecapsule_dev

# Redis
REDIS_URL=redis://:usecapsule_dev_password@localhost:6379

# RabbitMQ
RABBITMQ_URL=amqp://usecapsule:usecapsule_dev_password@localhost:5672
```

## Troubleshooting

### Port Conflicts

If you get port conflict errors, ensure no other services are running on:
- Port 3000 (API Gateway)
- Port 4200 (Portal)
- Port 5432 (PostgreSQL)
- Port 6379 (Redis)
- Port 5672 (RabbitMQ)

### Docker Issues

If Docker services fail to start:
```bash
# Reset everything
npm run docker:reset

# Check Docker daemon is running
docker ps

# Check Docker Compose version
docker-compose --version
```

### Nx Cache Issues

If you experience build or test issues:
```bash
# Clear Nx cache
npx nx reset

# Clean and reinstall
rm -rf node_modules
npm install
```

### Module Resolution Issues

If TypeScript can't find modules:
1. Check `tsconfig.base.json` for path mappings
2. Ensure the library is properly exported in its `index.ts`
3. Restart your IDE/TypeScript service

## Using Nx Console

For a visual interface to run Nx commands, install the Nx Console extension:

- **VS Code**: Search for "Nx Console" in extensions
- **JetBrains IDEs**: Available in the plugin marketplace

## Next Steps

1. **Explore the codebase**: Start with `apps/api-gateway` and `apps/portal`
2. **Read the architecture**: See [architecture.md](./architecture.md)
3. **Understand the vision**: See [core-features.md](./core-features.md)
4. **Check the main README**: See [README.md](../README.md)

## Getting Help

- **Nx Documentation**: https://nx.dev
- **NestJS Documentation**: https://nestjs.com
- **React Router Documentation**: https://reactrouter.com
- **Project Issues**: https://github.com/capsule-dev/capsule/issues

## Contributing

Before contributing, please:
1. Read the contribution guidelines
2. Check existing issues and PRs
3. Follow the code style and conventions
4. Write tests for new features
5. Update documentation as needed