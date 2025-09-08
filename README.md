# Capsule

Capsule is a cloud-native application deployment platform that simplifies
infrastructure management for development teams. Built on Kubernetes with a
developer-first approach, it enables automated deployments with zero vendor
lock-in.

## Key Features

- **Smart Deploy** - Automatic framework detection and optimized deployment
  configuration
- **Complete Observability** - Built-in metrics, logging, and distributed
  tracing
- **Preview Environments** - Automatic environments for every pull request
- **Managed Services** - Production-ready databases and message brokers with
  one click
- **No Lock-in** - Export to Kubernetes/Terraform at any time
- **Team Collaboration** - Role-based access control and Git-integrated
  workflows

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Docker and Docker Compose
- Nx CLI (`npm install -g nx@latest`)

### Installation

1. Clone the repository:

```bash
git clone git@github.com:danilomartinelli/usecapsule-api.git
cd usecapsule-api
```

2. Install dependencies:

```bash
npm install
```

3. Start infrastructure services:

```bash
npm run docker:up
```

4. Run database migrations:

```bash
# Run migrations for auth service
npm run migrate:auth

# Check migration status
npm run migrate:auth:info
```

5. Verify setup:

```bash
npm run setup
```

## Development

### Start Development Servers

```bash
# Start all services in development mode
nx run-many --target=serve --all

# Or start specific services

# API Gateway
nx serve api-gateway

# Microservices (Coming Soon)
nx serve auth-service
nx serve notification-service
nx serve deployment-service
# ...
```

### Available Services

- **API Gateway** - http://localhost:3000 (Main API endpoint)
- **Auth Service** - RabbitMQ microservice (no direct HTTP access)
- **Web Applications** - Hosted in separate repository (connects to API
  Gateway)

## Available Tools

- **Auth PostgreSQL** - localhost:5432 (Auth service database)
- **Redis** - localhost:6379 (Cache)
- **RabbitMQ** - localhost:5673 (AMQP), localhost:15673 (Management UI)
- **Vault** - http://localhost:8200 (Secrets management)

### Build

```bash
# Build all applications
npm run build:all

# Build for production
npm run build:prod

# Build affected projects only
npm run affected:build
```


### Database Migrations

The project uses **Flyway** for database migrations with **Slonik** for
type-safe queries.

```bash
# Auth Service Migrations
npm run migrate:auth              # Run pending migrations
npm run migrate:auth:info        # Check migration status  
npm run migrate:auth:validate    # Validate migration files

# Future services (when implemented)
npm run migrate:project          # Project service migrations
npm run migrate:deploy           # Deploy service migrations
```

#### Creating New Migrations

1. Create SQL file in `infrastructure/migrations/[service]/`:
```bash
# Example: infrastructure/migrations/auth-service/V002__add_user_roles.sql
```

2. Follow naming convention: `V{version}__{description}.sql`

3. Run migration: `npm run migrate:auth`

### Code Quality

```bash
# Run linting
npm run affected:lint

# Validate entire codebase
npm run validate

# View dependency graph
npm run graph
```

## Project Structure

```text
@usecapsule/source/
├── apps/                      # Application projects
│   ├── api-gateway/          # Main API Backend for Frontend
│   └── *-service/            # Microservices (auth, notification, deployment, etc.)
├── libs/                     # Shared libraries
│   └── shared/              # Shared utilities and types
│       ├── dto/            # Data transfer objects
│       └── types/          # TypeScript type definitions
├── infrastructure/          # Infrastructure configurations
│   ├── docker/             # Docker configurations  
│   ├── flyway/             # Flyway migration configs
│   └── migrations/         # Database migration files
│       └── auth-service/   # Auth service migrations
├── public/                 # Public Assets
├── compose.yml             # Local development services
├── nx.json                 # Nx workspace configuration
└── package.json           # Root package configuration
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run docker:up` | Start all Docker services |
| `npm run docker:down` | Stop all Docker services |
| `npm run docker:reset` | Reset and restart Docker services |
| `npm run docker:logs` | View Docker service logs |
| `npm run migrate:auth` | Run auth service database migrations |
| `npm run migrate:auth:info` | Check auth service migration status |
| `npm run migrate:auth:validate` | Validate auth service migrations |
| `npm run build:all` | Build all applications |
| `npm run build:prod` | Build all applications for production |
| `npm run affected:build` | Build only affected projects |
| `npm run affected:lint` | Lint only affected projects |
| `npm run validate` | Run linting for all projects |
| `npm run graph` | View project dependency graph |
| `npm run clean` | Clear Nx cache |

## Technology Stack

- **Monorepo**: Nx 21.4
- **Backend**: NestJS 11, Node.js 20+
- **Frontend**: Web applications in separate repository
- **Language**: TypeScript 5.8
- **Database**: PostgreSQL 15 with Slonik (type-safe queries)
- **Migrations**: Flyway (Docker-based)
- **Cache**: Redis 7
- **Message Queue**: RabbitMQ 3
- **Secrets**: HashiCorp Vault
- **Build Tools**: Webpack, SWC

## Environment Variables

Each service uses environment variables for configuration. Create `.env` files
in the respective app directories:

```bash
# apps/api-gateway/.env
PORT=3000
REDIS_URL=redis://:usecapsule_dev_password@localhost:6379
RABBITMQ_URL=amqp://usecapsule:usecapsule_dev_password@localhost:5673

# apps/auth-service/.env (Microservice - no PORT needed)
JWT_SECRET=your-jwt-secret
AUTH_DB_HOST=localhost
AUTH_DB_PORT=5432
AUTH_DB_USER=usecapsule_auth
AUTH_DB_PASSWORD=usecapsule_dev_password
AUTH_DB_NAME=usecapsule_auth
RABBITMQ_URL=amqp://usecapsule:usecapsule_dev_password@localhost:5673
```

## Docker Services

The `compose.yml` provides the following services for local development:

- **Auth PostgreSQL**: Auth service database (port 5432)
- **Redis**: Caching and session storage (port 6379)
- **RabbitMQ**: Message broker (ports 5673, 15673)
- **Vault**: Secrets management (port 8200)

Default credentials for development:

- Auth Database: `usecapsule_auth` / `usecapsule_dev_password`
- RabbitMQ: `usecapsule` / `usecapsule_dev_password`
- Redis: `usecapsule_dev_password`
- Vault Token: `usecapsule-dev-token`

**⚠️ Important**: These credentials are for development only. Never use them
in production.

## Contributing

We welcome contributions! Please follow these guidelines:

1. **Fork the repository** and create your branch from `main`
2. **Update documentation** as needed
3. **Submit a pull request** with a clear description

### Development Workflow

1. Create a feature branch:

```bash
git checkout -b feature/your-feature-name
```

2. Make your changes and commit:

```bash
git add .
git commit -m "feat: add new feature"
```

3. Run validation:

```bash
npm run validate
```

4. Push and create a pull request:

```bash
git push origin feature/your-feature-name
```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

## Documentation

For detailed documentation, see:

- [Product Requirements Document](./docs/PRD.md) - Complete product
  specification
- [Knowledge Base](./docs/KNOWLEDGE.md) - API endpoints and usage
- _Architecture Guide_ - System architecture details (coming soon)

## Support

- **Issues**: [GitHub Issues](https://github.com/danilomartinelli/usecapsule-api/issues)
- **Discussions**: [GitHub Discussions](https://github.com/danilomartinelli/usecapsule-api/discussions)
- **Security**: Report security vulnerabilities to security@usecapsule.com

## Roadmap

### Phase 1: MVP Foundation (Q1 2025)

- [ ] Nx monorepo setup
- [ ] Docker infrastructure
- [ ] Basic authentication service
- [ ] Container deployment engine
- [ ] React portal with dashboard
- [ ] Real-time log streaming

### Phase 2: Developer Experience (Q2 2025)

- [ ] Preview environments
- [ ] Advanced deployment strategies
- [ ] Cost tracking engine
- [ ] Team collaboration features

### Phase 3: Production Ready (Q3 2025)

- [ ] Managed database services
- [ ] Infrastructure export tools
- [ ] Enterprise security features
- [ ] Multi-region support

## License

This project is licensed under the MIT License.

---

**Capsule** - Deploy with confidence, scale without limits.
