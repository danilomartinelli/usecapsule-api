# Capsule

✨ **Capsule** - Cloud-native application deployment and management platform ✨

> **Current Status**: Early Development (Pre-MVP) - Basic infrastructure scaffolding in place

[Getting Started](./docs/getting-started.md) | [Architecture](./docs/architecture.md) | [Documentation](#documentation) | Run `npx nx graph` to explore the workspace

## Quick Start

Get the platform running locally in minutes:

```bash
# Clone the repository
git clone https://github.com/capsule-dev/capsule.git
cd capsule

# Install dependencies
npm install

# Start infrastructure (PostgreSQL, Redis, RabbitMQ, Vault)
npm run docker:up

# Start development servers
npx nx serve api-gateway  # Terminal 1 - Backend API (port 3000)
npx nx serve portal       # Terminal 2 - Frontend (port 4200)
```

📖 **[Full Getting Started Guide](./docs/getting-started.md)**

## Documentation

Comprehensive documentation is available in the `docs/` folder:

| Document | Description |
|----------|-------------|
| 📚 [Getting Started](./docs/getting-started.md) | Quick start guide and local development setup |
| 🏗️ [Architecture](./docs/architecture.md) | System architecture, patterns, and technical decisions |
| 🎯 [Core Features](./docs/core-features.md) | Product vision and feature specifications |
| 💻 [Development Workflow](./docs/development-workflow.md) | Common development tasks and best practices |
| 🔧 [Technology Stack](./docs/technology-stack.md) | Detailed overview of all technologies used |
| 📡 [API Reference](./docs/api-reference.md) | API endpoints and integration guide |
| 📋 [PRD](./docs/PRD.md) | Product Requirements Document |

## Project Structure

```text
usecapsule/                 # Monorepo root
├── apps/                   # Applications
│   ├── api-gateway/       # NestJS BFF API (✅ Implemented)
│   ├── portal/            # React dashboard (✅ Basic implementation)
│   ├── service-auth/      # Auth microservice (✅ Scaffold)
│   └── [e2e tests]/       # End-to-end test suites
├── libs/                   # Shared libraries
│   ├── contexts/          # DDD bounded contexts
│   │   └── auth/         # Authentication context
│   ├── shared/           # Shared utilities
│   │   ├── dto/         # Data Transfer Objects
│   │   └── types/       # TypeScript types
│   └── ui/              # UI components
│       └── react/       # React component library
└── docker-compose.yml     # Local infrastructure

## Technology Stack

- **Monorepo**: Nx v21.4.1
- **Backend**: NestJS v11 with TypeScript
- **Frontend**: React v19 + React Router v7 + Vite
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL 15
- **Cache/Queue**: Redis 7, RabbitMQ 3
- **Testing**: Jest, Playwright

## Common Commands

```bash
# Development
npx nx serve api-gateway          # Start backend API
npx nx serve portal               # Start frontend
npx nx run-many --target=serve   # Start all services

# Testing
npx nx test api-gateway          # Run unit tests
npx nx e2e portal-e2e           # Run e2e tests
npx nx affected:test            # Test affected projects

# Building
npx nx build api-gateway        # Build for development
npx nx build portal --prod      # Build for production
npx nx affected:build           # Build affected projects

# Code Quality
npx nx lint api-gateway         # Lint specific project
npx nx format:write             # Format code
npx nx graph                    # View dependency graph
```

📖 **[Full Development Workflow Guide](./docs/development-workflow.md)**

## Current Implementation Status

⚠️ **Early Development Phase**

**✅ Implemented:**

- Basic Nx monorepo structure
- NestJS API gateway scaffold
- React portal with Tailwind CSS
- Docker infrastructure setup
- Jest and Playwright testing

**🚧 In Progress:**

- Authentication system
- Service deployment functionality
- API endpoints implementation

**📋 Planned:**

- CLI tool
- Preview environments
- Monitoring and observability
- Cost analytics

See [Core Features](./docs/core-features.md) for the complete product vision.

## Resources

- **Documentation**: [docs/](./docs/getting-started.md) Getting Started
- **Nx Graph**: Run `npx nx graph` to visualize dependencies
- **Issues**: [GitHub Issues](https://github.com/capsule-dev/capsule/issues)

### External Resources

- [Nx Documentation](https://nx.dev)
- [NestJS Documentation](https://docs.nestjs.com)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

## License

MIT
