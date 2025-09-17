# Database Configuration Library

A comprehensive TypeScript library for managing Slonik database configurations across microservices in the Capsule Platform. This library provides type-safe, environment-aware database configurations with support for PostgreSQL and TimescaleDB.

## Features

- 🏗️ **Service-Specific Configurations**: Dedicated database configurations for each microservice
- 🔒 **Type Safety**: Full TypeScript support with Zod schema validation
- 🌍 **Environment Aware**: Support for development, staging, and production environments
- 🐘 **PostgreSQL & TimescaleDB**: Optimized configurations for both database types
- 🔍 **Health Monitoring**: Built-in health check and monitoring capabilities
- 📊 **Connection Pooling**: Optimized connection pool settings per service workload
- 🛠️ **Migration Support**: Integration with Flyway and other migration tools
- 📝 **Comprehensive Logging**: Detailed logging and error handling

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Database Configuration                    │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────┐ │
│  │Auth Service │  │Billing Svc  │  │Deploy Svc   │  │Monitor│ │
│  │PostgreSQL   │  │PostgreSQL   │  │PostgreSQL   │  │TimeDB │ │
│  │Port: 7110   │  │Port: 7113   │  │Port: 7111   │  │7112  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────┘ │
├─────────────────────────────────────────────────────────────┤
│                Service Database Registry                     │
├─────────────────────────────────────────────────────────────┤
│                   Shared Utilities                          │
│            (Types, Schemas, Query Helpers)                  │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Environment Configuration

Set up environment variables for each service:

```bash
# Auth Service Database
AUTH_DB_HOST=localhost
AUTH_DB_PORT=7110
AUTH_DB_NAME=auth_service_db
AUTH_DB_USER=auth_user
AUTH_DB_PASSWORD=auth_pass
AUTH_DB_SSL=false

# Billing Service Database
BILLING_DB_HOST=localhost
BILLING_DB_PORT=7113
BILLING_DB_NAME=billing_service_db
BILLING_DB_USER=billing_user
BILLING_DB_PASSWORD=billing_pass
BILLING_DB_SSL=false

# Deploy Service Database
DEPLOY_DB_HOST=localhost
DEPLOY_DB_PORT=7111
DEPLOY_DB_NAME=deploy_service_db
DEPLOY_DB_USER=deploy_user
DEPLOY_DB_PASSWORD=deploy_pass
DEPLOY_DB_SSL=false

# Monitor Service Database (TimescaleDB)
MONITOR_DB_HOST=localhost
MONITOR_DB_PORT=7112
MONITOR_DB_NAME=monitor_service_db
MONITOR_DB_USER=monitor_user
MONITOR_DB_PASSWORD=monitor_pass
MONITOR_DB_SSL=false
```

### 2. Service Module Configuration

Configure database module in your service:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule, AuthDatabaseService } from '@usecapsule/database';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // Option 1: Using service-specific configuration service
    DatabaseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (authDbService: AuthDatabaseService) =>
        authDbService.getModuleOptions(),
      inject: [AuthDatabaseService],
    }),

    // Option 2: Using factory function directly
    // DatabaseModule.forRootAsync({
    //   imports: [ConfigModule],
    //   useFactory: AuthDatabaseService.createConfigFactory('production'),
    //   inject: [ConfigService],
    // }),
  ],
  providers: [AuthDatabaseService],
  exports: [DatabaseService, AuthDatabaseService],
})
export class AuthModule {}
```

### 3. Repository Implementation

Create type-safe repositories using the configured database service:

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService, UserSchema, type User } from '@usecapsule/database';
import { sql } from 'slonik';

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseService) {}

  async findById(id: string): Promise<User | null> {
    return this.db.maybeOne(sql.type(UserSchema)`
      SELECT * FROM users WHERE id = ${id} AND deleted_at IS NULL
    `);
  }

  async create(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<User> {
    return this.db.transaction(async (trx) => {
      return trx.one(sql.type(UserSchema)`
        INSERT INTO users (email, password_hash, first_name, last_name)
        VALUES (${userData.email}, ${userData.passwordHash}, ${userData.firstName}, ${userData.lastName})
        RETURNING *
      `);
    });
  }
}
```

## Service-Specific Configurations

### Auth Service (PostgreSQL: port 7110)

- High-frequency authentication operations
- Session validation and user management
- Optimized for quick response times

### Billing Service (PostgreSQL: port 7113)

- Financial transaction processing
- Stripe webhook integration
- High consistency and durability requirements

### Deploy Service (PostgreSQL: port 7111)

- Deployment logs and build artifacts
- Analytics and reporting queries
- High-volume read/write operations

### Monitor Service (TimescaleDB: port 7112)

- Time-series metrics data
- Real-time analytics and alerting
- High-volume data ingestion

## Building

Run `nx build database` to build the library.

## Testing

Run `nx test database` to execute the unit tests.

## Documentation

For comprehensive documentation, examples, and API reference, see the `examples/` directory in this library.

## Environment Variables Reference

| Variable              | Service | Description       | Default            |
| --------------------- | ------- | ----------------- | ------------------ |
| `AUTH_DB_HOST`        | Auth    | Database host     | localhost          |
| `AUTH_DB_PORT`        | Auth    | Database port     | 7110               |
| `AUTH_DB_NAME`        | Auth    | Database name     | auth_service_db    |
| `AUTH_DB_USER`        | Auth    | Database user     | auth_user          |
| `AUTH_DB_PASSWORD`    | Auth    | Database password | auth_pass          |
| `BILLING_DB_HOST`     | Billing | Database host     | localhost          |
| `BILLING_DB_PORT`     | Billing | Database port     | 7113               |
| `BILLING_DB_NAME`     | Billing | Database name     | billing_service_db |
| `BILLING_DB_USER`     | Billing | Database user     | billing_user       |
| `BILLING_DB_PASSWORD` | Billing | Database password | billing_pass       |
| `DEPLOY_DB_HOST`      | Deploy  | Database host     | localhost          |
| `DEPLOY_DB_PORT`      | Deploy  | Database port     | 7111               |
| `DEPLOY_DB_NAME`      | Deploy  | Database name     | deploy_service_db  |
| `DEPLOY_DB_USER`      | Deploy  | Database user     | deploy_user        |
| `DEPLOY_DB_PASSWORD`  | Deploy  | Database password | deploy_pass        |
| `MONITOR_DB_HOST`     | Monitor | Database host     | localhost          |
| `MONITOR_DB_PORT`     | Monitor | Database port     | 7112               |
| `MONITOR_DB_NAME`     | Monitor | Database name     | monitor_service_db |
| `MONITOR_DB_USER`     | Monitor | Database user     | monitor_user       |
| `MONITOR_DB_PASSWORD` | Monitor | Database password | monitor_pass       |
