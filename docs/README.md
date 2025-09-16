# Capsule Platform Documentation

**Comprehensive technical documentation for the Capsule Platform - A cloud-native application deployment platform built with Domain-Driven Design and Microservices Architecture.**

## Quick Navigation

### 📋 Getting Started

- [Main README](../README.md) - Quick setup and development guide
- [Architecture Guide](../CLAUDE.md) - Comprehensive system architecture and patterns

### 🏗️ Architecture Documentation

- [System Architecture Overview](./architecture/system-overview.md) - High-level system design
- [Microservices Architecture](./architecture/microservices.md) - Service boundaries and communication
- [Data Architecture](./architecture/data-flow.md) - Database per service pattern
- [Message Queue Architecture](./architecture/message-queues.md) - RabbitMQ implementation details

### 📚 Implementation Guides

- [RabbitMQ Implementation Guide](./guides/rabbitmq-implementation.md) - Complete messaging setup
- [Service Development Guide](./guides/service-development.md) - Creating new microservices
- [Database Migration Guide](./guides/database-migrations.md) - Schema management
- [Testing Strategy Guide](./guides/testing-strategy.md) - Comprehensive testing approach

### 🔌 API Documentation

- [Gateway API Reference](./api/gateway-api.md) - HTTP endpoint documentation
- [Message Contracts](./api/message-contracts.md) - RabbitMQ message schemas
- [Health Check API](./api/health-checks.md) - Service monitoring endpoints
- [Error Handling](./api/error-handling.md) - Standard error responses

### 🛠️ Troubleshooting & Operations

- [Common Issues](./troubleshooting/common-issues.md) - Frequent problems and solutions
- [RabbitMQ Debugging](./troubleshooting/rabbitmq-debugging.md) - Message queue troubleshooting
- [Performance Monitoring](./troubleshooting/performance-monitoring.md) - System optimization
- [Deployment Issues](./troubleshooting/deployment-issues.md) - Production deployment guide

### 💡 Examples & Patterns

- [Message Handler Examples](./examples/message-handlers.md) - RabbitMQ implementation patterns
- [Domain Entity Examples](./examples/domain-entities.md) - DDD implementation patterns
- [Integration Test Examples](./examples/integration-tests.md) - Testing patterns
- [Event Sourcing Examples](./examples/event-sourcing.md) - Event-driven architecture

## Documentation Standards

### Structure Guidelines

- Each major topic has its own directory under `docs/`
- Files use descriptive names with kebab-case formatting
- Cross-references use relative links to maintain portability
- Code examples include both TypeScript and bash commands

### Content Standards

- Start with overview and context
- Include practical code examples
- Provide troubleshooting sections
- Reference actual implementation files
- Update with architecture changes

## Contributing to Documentation

When adding new features or making architectural changes:

1. **Update Relevant Guides** - Modify existing documentation
2. **Add New Examples** - Provide practical implementation examples
3. **Update Architecture Diagrams** - Keep visual representations current
4. **Cross-Reference Updates** - Ensure all links remain valid
5. **Test Examples** - Verify all code examples work with current codebase

## Recent Updates

### Latest Changes (2025-01-12)

- ✅ Successfully migrated to @golevelup/nestjs-rabbitmq
- ✅ Completed major dependency upgrades (webpack-cli 6, @types/node 24, dotenv 17, Zod 4)
- ✅ All services now 100% healthy with proper RabbitMQ integration
- ✅ Fixed all TypeScript compilation and lint issues
- ✅ Updated RabbitMQ port configurations (Management UI: 7020, AMQP: 7010)

### Architecture Status

- **Message Queue**: Fully operational with @golevelup/nestjs-rabbitmq
- **Health Checks**: All microservices responding correctly
- **Database Integration**: Prepared but commented out pending implementation
- **Error Handling**: Complete with Dead Letter Queue (DLQ) support
- **Testing Infrastructure**: Ready for comprehensive test suite

---

**Next Steps**: Review the [System Architecture Overview](./architecture/system-overview.md) to understand the platform's design philosophy, then dive into specific implementation guides based on your needs.
