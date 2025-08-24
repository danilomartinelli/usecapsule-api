# Capsule

<a alt="Capsule logo" href="https://usecapsule.com.br" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/danilomartinelli/usecapsule/main/public/logo.png" width="149"></a>

✨ **Capsule** - Platform for deploying Nx monorepos to production with zero configuration ✨

[Learn more about the architecture](./docs/architecture.md) | [Core Features](./docs/core-features.md) | Run `npx nx graph` to visually explore the workspace structure.

## Workspace Structure

This monorepo contains the Capsule platform components:

```
apps/
├── api-gateway       # NestJS BFF API Gateway (Hexagonal Architecture)
├── portal           # React + Vite admin dashboard (Feature-Sliced Design)
├── dashboard        # React + Vite admin interface (Feature-Sliced Design)
├── landing-page     # React + Vite marketing site (Feature-Sliced Design)
└── [e2e tests]      # End-to-end test suites

libs/
├── contexts/        # Domain-driven design bounded contexts (Backend)
│   ├── deploy/     # Deployment domain (Hexagonal Architecture)
│   ├── billing/    # Billing domain (Hexagonal Architecture)
│   └── discovery/  # Service discovery domain (Hexagonal Architecture)
├── shared/         # Shared utilities and types (Full-stack)
│   ├── dto/        # Shared DTOs with class-validator/class-transformer
│   └── types/      # Shared TypeScript types
└── ui/            # Shared UI component library (Frontend-only)
    └── react/     # React component library
```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+

### Initial Setup

```sh
# Clone and install dependencies
git clone https://github.com/capsule-dev/capsule.git
cd capsule
npm install

# Setup environment variables
cp .env.example .env

# Start infrastructure services
docker-compose up -d

# Run database migrations
npx nx run api-gateway:migrate

# Seed development data
npx nx run workspace:seed
```

## Run Tasks

To start the development servers:

```sh
# Start all services in development mode
npx nx run-many --target=serve --all

# Or start specific services
npx nx serve api-gateway
npx nx serve portal
npx nx serve dashboard
npx nx serve landing-page
```

To build for production:

```sh
# Build all affected projects
npx nx affected:build

# Build specific service
npx nx build api-gateway

# Build with production configuration
npx nx build api-gateway --configuration=production
```

To run tests:

```sh
# Run all tests
npx nx run-many --target=test --all

# Run affected tests
npx nx affected:test

# Run e2e tests
npx nx e2e portal-e2e

# Run with coverage
npx nx test api-gateway --coverage
```

## Code Generation

### Generate a new microservice:

```sh
npx nx g @nx/nest:app service-monitoring --directory=apps
```

### Generate a new bounded context:

```sh
npx nx g @nx/js:lib monitoring --directory=libs/contexts \
  --tags="type:lib,scope:contexts,arch:hexagonal"
```

### Generate a new feature library:

```sh
npx nx g @nx/react:lib feature-dashboard --directory=libs/portal \
  --tags="type:lib,scope:features,arch:feature-sliced"
```

### Generate API resources:

```sh
# Generate a new NestJS module
npx nx g @nx/nest:module deployment --project=api-gateway

# Generate a new controller
npx nx g @nx/nest:controller deployment --project=api-gateway

# Generate a new service
npx nx g @nx/nest:service deployment --project=api-gateway
```

## Project Configuration

### Key Configuration Files

- `nx.json` - Nx workspace configuration
- `tsconfig.base.json` - TypeScript path mappings
- `.env.example` - Environment variables template
- `docker-compose.yml` - Local infrastructure setup

### Environment Variables

```sh
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/capsule

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=15m

# Services URLs (local development)
API_GATEWAY_URL=http://localhost:3000
PORTAL_URL=http://localhost:4200
DASHBOARD_URL=http://localhost:4201
LANDING_PAGE_URL=http://localhost:4202
```

## Affected Commands

Nx uses git to determine affected projects:

```sh
# Test affected projects
npx nx affected:test --base=main --head=HEAD

# Build affected projects
npx nx affected:build --base=main --head=HEAD

# Lint affected projects
npx nx affected:lint --base=main --head=HEAD

# See affected projects graph
npx nx affected:graph --base=main --head=HEAD
```

## Database Migrations

```sh
# Generate a new migration
npx nx run api-gateway:migration:generate --name=AddDeploymentTable

# Run migrations
npx nx run api-gateway:migration:run

# Revert last migration
npx nx run api-gateway:migration:revert
```

## Docker Build

```sh
# Build Docker images for all services
npx nx run-many --target=docker-build --all

# Build specific service
npx nx docker-build api-gateway

# Build and push to registry
npx nx docker-build api-gateway --push --tag=latest
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/ci.yml
- uses: nrwl/nx-set-shas@v4
- run: npm ci

- run: npx nx format:check
- run: npx nx affected -t lint test build e2e --parallel=3
```

### Nx Cloud

```sh
# Connect to Nx Cloud for distributed caching
npx nx connect-to-nx-cloud
```

## Debugging

```sh
# Debug a NestJS service
npx nx serve api-gateway --inspect

# Debug with VSCode
# Use the launch configurations in .vscode/launch.json

# View dependency graph
npx nx graph

# Reset Nx cache
npx nx reset
```

## Production Deployment

```sh
# Build all services for production
npx nx run-many --target=build --configuration=production --all

# Deploy using Capsule CLI
npx @capsule/cli deploy --env=production

# Or use docker-compose for production
docker-compose -f docker-compose.prod.yml up -d
```

## Useful Commands

```sh
# Format code
npx nx format:write

# Check circular dependencies
npx nx run-many --target=lint --all

# Update dependencies
npx nx migrate latest

# Clean workspace
npx nx reset
rm -rf node_modules
npm install
```

## Architecture Highlights

### Domain-Driven Design (DDD)

- **Bounded Contexts**: Each domain (deploy, billing, discovery) is isolated
- **Hexagonal Architecture**: Clean separation between domain, application, and infrastructure layers
- **Event-Driven**: Communication via domain events

### Feature-Sliced Design (FSD)

- **Frontend Apps**: Organized by features, widgets, entities, and shared layers
- **Scalable Structure**: Easy to add new features without affecting existing code
- **Shared UI Library**: Reusable components in `libs/ui/react`

### Shared Libraries

- **DTOs**: Use `class-validator` and `class-transformer` for validation and transformation
- **Types**: Shared TypeScript types across frontend and backend
- **Database Fields**: Kebab-case in database, camelCase in code with `@Expose` decorator

## Learn More

- [Nx Documentation](https://nx.dev)
- [NestJS Documentation](https://docs.nestjs.com)
- [React Documentation](https://react.dev)
- [Capsule Architecture Guide](./docs/architecture.md)
- [Core Features](./docs/core-features.md)
- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

MIT
