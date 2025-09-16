# Database Infrastructure Setup - Capsule Platform

## Overview

This document describes the complete database infrastructure setup for the Capsule Platform monorepo, implemented with a microservices architecture featuring service-specific databases and comprehensive migration management.

## Architecture Design

### Service Boundaries and Databases

Each microservice maintains its own dedicated PostgreSQL database, ensuring data isolation and service autonomy:

```
┌─────────────────┬─────────────────┬──────────────┬─────────────┐
│ Service         │ Database        │ Port         │ Purpose     │
├─────────────────┼─────────────────┼──────────────┼─────────────┤
│ auth-service    │ PostgreSQL 15   │ 7110         │ Users &     │
│                 │                 │              │ Auth        │
├─────────────────┼─────────────────┼──────────────┼─────────────┤
│ billing-service │ PostgreSQL 15   │ 7113         │ Payments &  │
│                 │                 │              │ Subscr.     │
├─────────────────┼─────────────────┼──────────────┼─────────────┤
│ deploy-service  │ PostgreSQL 15   │ 7111         │ Deployments │
│                 │                 │              │ & Builds    │
├─────────────────┼─────────────────┼──────────────┼─────────────┤
│ monitor-service │ TimescaleDB     │ 7112         │ Metrics &   │
│                 │ (PostgreSQL 15) │              │ Observ.     │
├─────────────────┼─────────────────┼──────────────┼─────────────┤
│ All Services    │ Redis 7         │ 7120         │ Caching &   │
│                 │                 │              │ Sessions    │
└─────────────────┴─────────────────┴──────────────┴─────────────┘
```

### Database Technology Choices

#### PostgreSQL 15

- **Used by**: auth-service, billing-service, deploy-service
- **Rationale**: ACID compliance, JSON support, mature ecosystem
- **Extensions**: uuid-ossp, pgcrypto, citext

#### TimescaleDB (PostgreSQL 15)

- **Used by**: monitor-service
- **Rationale**: Optimized for time-series data and metrics
- **Features**: Hypertables, automatic partitioning, compression

#### Redis 7

- **Used by**: All services (shared)
- **Rationale**: High-performance caching and session storage
- **Features**: AOF persistence, memory optimization, clustering-ready

## Docker Compose Configuration

### Network Architecture

All database services run in an isolated Docker network (`capsule-platform`) ensuring:

- Secure inter-service communication
- Network-level isolation from external access
- Predictable service discovery

### Health Check Implementation

Each database service includes comprehensive health checks:

```yaml
healthcheck:
  test: ['CMD-SHELL', 'pg_isready -U ${user} -d ${database}']
  interval: 10s
  timeout: 5s
  retries: 5
  start_period: 30s
```

### Volume Management

Persistent data storage with dedicated volumes:

- `auth_db_data` - Authentication data
- `billing_db_data` - Billing and payment data
- `deploy_db_data` - Deployment configurations
- `monitor_db_data` - Metrics and monitoring data
- `redis_data` - Cache and session data

## Migration Strategy

### Flyway Integration

Each service uses Flyway for database migrations with:

- **Versioned migrations**: `V1.0.0__Description.sql` format
- **Baseline support**: Handles existing schemas gracefully
- **Validation**: Ensures migration integrity
- **Rollback safety**: Production-safe migration practices

### Migration File Structure

```
apps/
├── auth-service/migrations/
│   ├── flyway.conf
│   └── V1.0.0__Initial_setup.sql
├── billing-service/migrations/
│   ├── flyway.conf
│   └── V1.0.0__Initial_setup.sql
├── deploy-service/migrations/
│   ├── flyway.conf
│   └── V1.0.0__Initial_setup.sql
└── monitor-service/migrations/
    ├── flyway.conf
    └── V1.0.0__Initial_setup.sql
```

### NPM Commands

Comprehensive migration management through npm scripts:

#### Migration Commands

```bash
npm run db:migrate:all        # Run all service migrations
npm run db:migrate:auth       # Auth service only
npm run db:migrate:billing    # Billing service only
npm run db:migrate:deploy     # Deploy service only
npm run db:migrate:monitor    # Monitor service only
```

#### Information Commands

```bash
npm run db:info:auth          # Show auth migration status
npm run db:info:billing       # Show billing migration status
npm run db:info:deploy        # Show deploy migration status
npm run db:info:monitor       # Show monitor migration status
```

#### Validation Commands

```bash
npm run db:validate:all       # Validate all migrations
npm run db:validate:auth      # Validate auth migrations
npm run db:validate:billing   # Validate billing migrations
npm run db:validate:deploy    # Validate deploy migrations
npm run db:validate:monitor   # Validate monitor migrations
```

## Initial Schema Design

### Common Patterns

All services follow consistent schema patterns:

#### Configuration Tables

Each service includes a configuration table for:

- Schema version tracking
- Service-specific settings
- Runtime configuration
- Initialization timestamps

#### Audit Columns

Standard audit pattern with:

- `created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`
- Automatic `updated_at` trigger function

#### UUID Primary Keys

- Default to `uuid_generate_v4()` for distributed system compatibility
- Ensures globally unique identifiers across services

### Service-Specific Schema Features

#### Auth Service

- User authentication and authorization
- Session management
- OAuth integration support
- Security audit logging

#### Billing Service

- Payment processing integration
- Subscription management
- Currency support (USD, EUR, GBP, BRL)
- Financial audit trails

#### Deploy Service

- Deployment environment configurations
- Build and deployment status tracking
- Container registry integration
- Resource quota management

#### Monitor Service (TimescaleDB)

- Time-series metrics storage
- Hypertable optimization for time-based queries
- Metric definition registry
- Alert configuration and thresholds

## Environment Variables

### Database Connections

Each service requires specific environment variables:

```bash
# Auth Service
AUTH_SERVICE_DB_HOST=localhost
AUTH_SERVICE_DB_PORT=7110
AUTH_SERVICE_DB_NAME=auth_service_db
AUTH_SERVICE_DB_USER=auth_user
AUTH_SERVICE_DB_PASSWORD=auth_pass

# Billing Service
BILLING_SERVICE_DB_HOST=localhost
BILLING_SERVICE_DB_PORT=7113
BILLING_SERVICE_DB_NAME=billing_service_db
BILLING_SERVICE_DB_USER=billing_user
BILLING_SERVICE_DB_PASSWORD=billing_pass

# Deploy Service
DEPLOY_SERVICE_DB_HOST=localhost
DEPLOY_SERVICE_DB_PORT=7111
DEPLOY_SERVICE_DB_NAME=deploy_service_db
DEPLOY_SERVICE_DB_USER=deploy_user
DEPLOY_SERVICE_DB_PASSWORD=deploy_pass

# Monitor Service
MONITOR_SERVICE_DB_HOST=localhost
MONITOR_SERVICE_DB_PORT=7112
MONITOR_SERVICE_DB_NAME=monitor_service_db
MONITOR_SERVICE_DB_USER=monitor_user
MONITOR_SERVICE_DB_PASSWORD=monitor_pass

# Redis (Shared)
REDIS_HOST=localhost
REDIS_PORT=7120
REDIS_PASSWORD=""
REDIS_DB=0
```

## Development Workflow

### Setup Commands

```bash
# Start infrastructure
npm run infrastructure:up

# Run all migrations
npm run db:migrate:all

# Validate setup
npm run db:validate:all

# Start development services
npm run dev
```

### Reset Commands

```bash
# Reset all data (destructive)
npm run db:reset:all

# Reset specific service
docker compose down auth-db
docker volume rm usecapsule-services_auth_db_data
docker compose up -d auth-db
npm run db:migrate:auth
```

## Production Considerations

### Security

- Change all default passwords
- Enable SSL for database connections
- Use secret management systems
- Regular security audits

### Performance

- Monitor connection pool usage
- Implement read replicas for high-load services
- Configure appropriate buffer sizes
- Regular VACUUM and ANALYZE operations

### Backup and Recovery

- Automated daily backups
- Point-in-time recovery capability
- Cross-region backup replication
- Regular restore testing

### Monitoring

- Database performance metrics
- Connection pool monitoring
- Migration success/failure alerts
- Disk space monitoring

## Troubleshooting

### Common Issues

#### Migration Failures

```bash
# Check migration status
npm run db:info:auth

# Validate migrations
npm run db:validate:auth

# Reset if necessary (development only)
npm run db:reset:all
```

#### Connection Issues

```bash
# Check service health
docker compose ps

# Check logs
docker compose logs auth-db

# Test direct connection
docker exec -it auth_db_dev psql -U auth_user -d auth_service_db
```

#### TimescaleDB Issues

```bash
# Check hypertable status
docker exec -it monitor_db_dev psql -U monitor_user -d monitor_service_db -c "SELECT * FROM timescaledb_information.hypertables;"

# Check extension status
docker exec -it monitor_db_dev psql -U monitor_user -d monitor_service_db -c "SELECT * FROM pg_extension WHERE extname = 'timescaledb';"
```

## Next Steps

1. **Schema Evolution**: Add domain-specific tables for each service
2. **Data Seeding**: Create development and test data scripts
3. **Backup Strategy**: Implement automated backup procedures
4. **Monitoring Integration**: Connect to observability platform
5. **Performance Tuning**: Optimize for expected load patterns

## References

- [Flyway Documentation](https://flywaydb.org/documentation/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Redis Configuration](https://redis.io/documentation)
- [Microservices Data Management](https://microservices.io/patterns/data/database-per-service.html)
