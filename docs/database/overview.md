# Database Architecture and Migrations

This document describes the database architecture, migration system, and best
practices for the Capsule platform.

## Table of Contents

- [Overview](#overview)
- [Database per Service Pattern](#database-per-service-pattern)
- [Technology Stack](#technology-stack)
- [Migration System](#migration-system)
- [Development Workflow](#development-workflow)
- [Production Guidelines](#production-guidelines)
- [Troubleshooting](#troubleshooting)

## Overview

Capsule uses a **Database per Service** pattern where each microservice has its
own dedicated database instance. This ensures complete data isolation,
independent scaling, and autonomous development cycles.

## Database per Service Pattern

### Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   Auth Service  │───▶│  Auth PostgreSQL │
└─────────────────┘    └──────────────────┘

┌─────────────────┐    ┌──────────────────┐
│ Project Service │───▶│Project PostgreSQL│  
└─────────────────┘    └──────────────────┘

┌─────────────────┐    ┌──────────────────┐
│ Deploy Service  │───▶│Deploy PostgreSQL │
└─────────────────┘    └──────────────────┘
```

### Benefits

- **Data Isolation**: Each service owns its data completely
- **Independent Scaling**: Scale databases based on service needs
- **Technology Freedom**: Different services can use different database versions or configurations
- **Fault Isolation**: Database issues in one service don't affect others
- **Independent Development**: Teams can modify schemas without coordination

### Configuration

Each service uses environment variables for database configuration:

```env
# Auth Service
AUTH_DB_HOST=localhost
AUTH_DB_PORT=5432
AUTH_DB_USER=usecapsule_auth
AUTH_DB_PASSWORD=usecapsule_dev_password
AUTH_DB_NAME=usecapsule_auth

# Project Service (when implemented)
PROJECT_DB_HOST=localhost
PROJECT_DB_PORT=5433
PROJECT_DB_USER=usecapsule_project
PROJECT_DB_PASSWORD=usecapsule_dev_password
PROJECT_DB_NAME=usecapsule_project
```

## Technology Stack

### Slonik - Type-Safe PostgreSQL Client

We use [Slonik](https://github.com/gajus/slonik) for all database operations:

**Benefits:**
- **Type Safety**: Compile-time type checking for SQL queries
- **Connection Pooling**: Automatic connection management
- **Query Building**: Safe, composable SQL query construction
- **Interceptors**: Query logging, error handling, and performance monitoring

**Example Usage:**

```typescript
// Type-safe query with automatic parameter binding
const user = await pool.one(sql.typeAlias('user')`
  SELECT id, email, name, created_at
  FROM users 
  WHERE email = ${email} AND is_active = true
`);

// Safe dynamic query building
const filters: SqlFragment[] = [];
if (isActive !== undefined) {
  filters.push(sql`is_active = ${isActive}`);
}
if (role) {
  filters.push(sql`role = ${role}`);
}

const users = await pool.many(sql.typeAlias('user')`
  SELECT id, email, name, role, created_at
  FROM users
  ${filters.length > 0 ? sql`WHERE ${sql.join(filters, sql` AND `)}` : sql``}
  ORDER BY created_at DESC
  LIMIT 50
`);
```

### Flyway - Database Migration Management

[Flyway](https://flywaydb.org/) handles all schema migrations with version control:

**Benefits:**
- **Version Control**: Track all database changes
- **Repeatable**: Consistent deployments across environments
- **Rollback Support**: Controlled rollback procedures
- **Team Collaboration**: Conflict-free schema changes
- **Environment Parity**: Same schema across dev/staging/production

## Migration System

### Directory Structure

```
infrastructure/
├── flyway/                    # Flyway configurations
│   ├── auth-service.conf     # Auth service Flyway config
│   ├── project-service.conf  # Project service Flyway config
│   └── deploy-service.conf   # Deploy service Flyway config
└── migrations/               # Migration SQL files
    ├── auth-service/
    │   ├── V001__create_users_table.sql
    │   ├── V002__add_user_roles.sql
    │   └── V003__add_user_profiles.sql
    ├── project-service/
    │   ├── V001__create_projects_table.sql
    │   └── V002__add_project_settings.sql
    └── deploy-service/
        ├── V001__create_deployments_table.sql
        └── V002__add_deployment_logs.sql
```

### Migration Naming Convention

Follow the pattern: `V{version}__{description}.sql`

- **Version**: Sequential numbers (001, 002, 003...)
- **Description**: Snake_case description of the change
- **File Extension**: Always `.sql`

Examples:
- `V001__create_users_table.sql`
- `V002__add_user_roles.sql`
- `V003__create_user_sessions_table.sql`
- `V004__add_email_verification_columns.sql`

### Migration Commands

```bash
# Run migrations for specific service
npm run migrate:auth              # Auth service
npm run migrate:project           # Project service
npm run migrate:deploy            # Deploy service

# Check migration status
npm run migrate:auth:info         # Show applied migrations
npm run migrate:auth:validate     # Validate migration files

# Future: Run all migrations
npm run migrate:all               # All services
```

### Migration Best Practices

1. **Make migrations idempotent** - They should be safe to run multiple times
2. **Test thoroughly** - Always test migrations on a copy of production data
3. **Keep migrations small** - One logical change per migration
4. **Document breaking changes** - Include rollback instructions in comments
5. **Never modify existing migrations** - Create new migrations for changes

### Example Migration File

```sql
-- V001__create_users_table.sql
-- Description: Create users table with basic authentication fields
-- Rollback: DROP TABLE users;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(is_active);
CREATE INDEX idx_users_role ON users(role);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (development only)
INSERT INTO users (email, password_hash, name, role) 
VALUES (
    'admin@usecapsule.com',
    '$2b$12$example_hash_replace_in_production',
    'System Administrator',
    'admin'
);
```

## Development Workflow

### Setting Up a New Service Database

1. **Add to docker-compose.yml:**

```yaml
project-postgres:
  image: postgres:15-alpine
  container_name: usecapsule-project-postgres
  environment:
    POSTGRES_DB: usecapsule_project
    POSTGRES_USER: usecapsule_project
    POSTGRES_PASSWORD: usecapsule_dev_password
  ports:
    - '5433:5432'
  volumes:
    - project_postgres_data:/var/lib/postgresql/data
```

2. **Create Flyway configuration:**

```bash
# infrastructure/flyway/project-service.conf
flyway.url=jdbc:postgresql://project-postgres:5432/usecapsule_project
flyway.user=usecapsule_project
flyway.password=usecapsule_dev_password
flyway.schemas=public
flyway.locations=filesystem:/flyway/sql
flyway.table=flyway_schema_history
flyway.baselineOnMigrate=true
```

3. **Add npm scripts:**

```json
{
  "migrate:project": "docker run --rm --network usecapsule-api_usecapsule-network -v $(pwd)/infrastructure/flyway:/flyway/conf -v $(pwd)/infrastructure/migrations/project-service:/flyway/sql flyway/flyway:9.22.3-alpine -configFiles=/flyway/conf/project-service.conf migrate",
  "migrate:project:info": "docker run --rm --network usecapsule-api_usecapsule-network -v $(pwd)/infrastructure/flyway:/flyway/conf -v $(pwd)/infrastructure/migrations/project-service:/flyway/sql flyway/flyway:9.22.3-alpine -configFiles=/flyway/conf/project-service.conf info"
}
```

4. **Create first migration:**

```sql
-- infrastructure/migrations/project-service/V001__create_projects_table.sql
CREATE TABLE projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    owner_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Local Development Process

1. **Start infrastructure:**
```bash
npm run docker:up
```

2. **Run migrations:**
```bash
npm run migrate:auth
npm run migrate:project  # when ready
```

3. **Verify migrations:**
```bash
npm run migrate:auth:info
```

4. **Develop with confidence** - Database schema is consistent across team

### Creating Migrations

1. **Create the SQL file:**
```bash
# Create: infrastructure/migrations/auth-service/V002__add_user_preferences.sql
```

2. **Write the migration:**
```sql
-- V002__add_user_preferences.sql
-- Description: Add user preferences table for personalization
-- Rollback: DROP TABLE user_preferences;

CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(5) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

3. **Test the migration:**
```bash
npm run migrate:auth:validate
npm run migrate:auth
npm run migrate:auth:info
```

## Production Guidelines

### Environment Configuration

```env
# Production auth-service database
AUTH_DB_HOST=auth-postgres.internal.cluster.local
AUTH_DB_PORT=5432
AUTH_DB_USER=${AUTH_DB_USER}
AUTH_DB_PASSWORD=${AUTH_DB_PASSWORD}
AUTH_DB_NAME=usecapsule_auth_prod
AUTH_DB_SCHEMA=public
```

### Migration Deployment

1. **Always backup before migrations:**
```bash
pg_dump -h $AUTH_DB_HOST -U $AUTH_DB_USER $AUTH_DB_NAME > auth_backup_$(date +%Y%m%d_%H%M%S).sql
```

2. **Run in staging first:**
```bash
npm run migrate:auth:validate
npm run migrate:auth:info
npm run migrate:auth
```

3. **Monitor during deployment:**
```bash
# Watch migration progress
kubectl logs -f deployment/flyway-migration-job

# Check database connections
kubectl exec -it auth-service-pod -- pg_isready
```

### Rollback Procedures

If a migration fails:

1. **Check migration status:**
```bash
npm run migrate:auth:info
```

2. **For minor issues - repair and retry:**
```bash
# Fix data issues manually if needed
# Then re-run
npm run migrate:auth
```

3. **For major issues - restore from backup:**
```bash
# Stop applications
kubectl scale deployment auth-service --replicas=0

# Restore database
psql -h $AUTH_DB_HOST -U $AUTH_DB_USER $AUTH_DB_NAME < auth_backup.sql

# Restart applications
kubectl scale deployment auth-service --replicas=3
```

## Troubleshooting

### Common Issues

**Migration fails with "relation already exists":**
- Solution: Check if migration was partially applied, clean up manually

**Connection refused errors:**
- Solution: Verify database is running and network connectivity

**Type errors in Slonik queries:**
- Solution: Use `sql.typeAlias('type_name')` for proper typing

### Debugging Queries

Enable query logging in development:

```typescript
// In database service configuration
const pool = await createPool(connectionString, {
  interceptors: [
    createQueryLoggingInterceptor(),
    createBenchmarkingInterceptor(),
  ],
});
```

### Performance Monitoring

Monitor key metrics:
- Connection pool utilization
- Query execution time
- Database lock waits
- Index usage

## References

- [Slonik Documentation](https://github.com/gajus/slonik)
- [Flyway Documentation](https://flywaydb.org/documentation/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [Database per Service Pattern](https://microservices.io/patterns/data/database-per-service.html)