# Developer Getting Started Guide

This guide will help you set up your development environment and get familiar with the Capsule platform codebase.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Code Style and Standards](#code-style-and-standards)
- [Debugging](#debugging)
- [Common Issues](#common-issues)

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

- **Node.js 20+** - [Download](https://nodejs.org/)
- **npm 10+** - Comes with Node.js
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/downloads)

### Recommended Tools

- **VS Code** with extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Docker
  - GitLens
- **Postman** or **Insomnia** for API testing
- **DBeaver** or **pgAdmin** for database management

### System Requirements

- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 10GB free space
- **OS**: macOS, Linux, or Windows with WSL2

## Environment Setup

### 1. Clone the Repository

```bash
git clone git@github.com:danilomartinelli/usecapsule-api.git
cd usecapsule-api
```

### 2. Install Global Dependencies

```bash
# Install Nx CLI globally
npm install -g nx@latest

# Verify installation
nx --version
node --version
npm --version
docker --version
```

### 3. Install Project Dependencies

```bash
# Install all dependencies
npm install

# This will install dependencies for all apps and libraries
```

### 4. Environment Configuration

Create environment files for each service:

```bash
# Create environment files
touch apps/api-gateway/.env
touch apps/auth-service/.env
```

**API Gateway Environment** (`apps/api-gateway/.env`):

```env
PORT=3000
NODE_ENV=development
REDIS_URL=redis://:usecapsule_dev_password@localhost:6379
RABBITMQ_URL=amqp://usecapsule:usecapsule_dev_password@localhost:5673
JWT_SECRET=development-secret-key-change-in-production
```

**Auth Service Environment** (`apps/auth-service/.env`):

```env
NODE_ENV=development
AUTH_DB_HOST=localhost
AUTH_DB_PORT=5432
AUTH_DB_USER=usecapsule_auth
AUTH_DB_PASSWORD=usecapsule_dev_password
AUTH_DB_NAME=usecapsule_auth
RABBITMQ_URL=amqp://usecapsule:usecapsule_dev_password@localhost:5673
JWT_SECRET=development-secret-key-change-in-production
JWT_EXPIRY=1h
```

## Running the Application

### 1. Start Infrastructure Services

```bash
# Start all Docker services
npm run docker:up

# Verify services are running
docker ps
```

You should see:

- `usecapsule-auth-postgres` (PostgreSQL)
- `usecapsule-redis` (Redis)
- `usecapsule-rabbitmq` (RabbitMQ)
- `usecapsule-vault` (HashiCorp Vault)

### 2. Run Database Migrations

```bash
# Run auth service migrations
npm run migrate:auth

# Check migration status
npm run migrate:auth:info
```

Expected output:

```
Schema version: 001
| Category  | Version | Description        | Type | Installed On        | State   |
| Versioned | 001     | create users table | SQL  | 2025-01-07 10:15:30 | Success |
```

### 3. Start Development Servers

```bash
# Start all services in development mode
nx run-many --target=serve --all

# Or start services individually:

# Terminal 1: Start API Gateway
nx serve api-gateway

# Terminal 2: Start Auth Service
nx serve auth-service
```

### 4. Verify Setup

```bash
# Check system status
npm run setup

# Test API Gateway health
curl http://localhost:3000/health

# Test RabbitMQ Management UI
open http://localhost:15673
# Login: usecapsule / usecapsule_dev_password
```

## Database Setup

### Understanding the Database Architecture

Each microservice has its own PostgreSQL database instance:

- **Auth Service**: `usecapsule_auth` database
- **Project Service**: `usecapsule_project` database (future)
- **Deploy Service**: `usecapsule_deploy` database (future)

### Database Commands

```bash
# Run migrations for auth service
npm run migrate:auth

# Check migration status
npm run migrate:auth:info

# Validate migration files
npm run migrate:auth:validate

# Connect to auth database
docker exec -it usecapsule-auth-postgres psql -U usecapsule_auth -d usecapsule_auth
```

### Creating New Migrations

1. **Create migration file**:

```bash
# Create file: infrastructure/migrations/auth-service/V002__add_user_preferences.sql
```

2. **Write migration**:

```sql
-- V002__add_user_preferences.sql
-- Description: Add user preferences table
-- Rollback: DROP TABLE user_preferences;

CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'light',
    language VARCHAR(5) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_user_preferences_user_id ON user_preferences(user_id);
```

3. **Run migration**:

```bash
npm run migrate:auth
```

## Development Workflow

### 1. Feature Development Process

```bash
# 1. Create feature branch
git checkout -b feature/user-profile-management

# 2. Make your changes
# - Add new endpoints
# - Create database migrations
# - Write tests
# - Update documentation

# 3. Test your changes
npm run validate

# 4. Commit with conventional commits
git add .
git commit -m "feat: add user profile management endpoints"

# 5. Push and create PR
git push origin feature/user-profile-management
```

### 2. Working with Services

**Adding a new endpoint to Auth Service**:

```typescript
// apps/auth-service/src/app/app.controller.ts
@MessagePattern('auth.get_profile')
async getProfile(@Payload() data: { userId: string }) {
  return this.appService.getProfile(data.userId);
}
```

**Adding corresponding API Gateway route**:

```typescript
// apps/api-gateway/src/auth/auth.controller.ts
@Get('profile')
@UseGuards(JwtAuthGuard)
async getProfile(@Request() req) {
  return this.authService.getProfile(req.user.id);
}
```

### 3. Database Operations

**Using Slonik in services**:

```typescript
// Type-safe database query
async findUserById(id: string) {
  const pool = this.databaseService.getPool();
  return pool.one(sql.typeAlias('user')`
    SELECT id, email, name, created_at
    FROM users
    WHERE id = ${id}
  `);
}

// Dynamic query building
async searchUsers(filters: UserFilters) {
  const conditions: SqlFragment[] = [];

  if (filters.isActive) {
    conditions.push(sql`is_active = true`);
  }

  if (filters.role) {
    conditions.push(sql`role = ${filters.role}`);
  }

  const whereClause = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  return pool.many(sql.typeAlias('user')`
    SELECT id, email, name, role
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT 50
  `);
}
```

## Testing

### Running Tests

```bash
# Run all tests
nx run-many --target=test --all

# Run tests for specific service
nx test auth-service
nx test api-gateway

# Run tests with coverage
nx test auth-service --coverage

# Run affected tests only
nx affected --target=test
```

### Writing Tests

**Unit Test Example**:

```typescript
// apps/auth-service/src/app/app.service.spec.ts
describe('AuthService', () => {
  let service: AuthService;
  let databaseService: DatabaseService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: DatabaseService,
          useValue: {
            getPool: jest.fn().mockReturnValue({
              one: jest.fn(),
              many: jest.fn(),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    databaseService = module.get<DatabaseService>(DatabaseService);
  });

  describe('login', () => {
    it('should return user and token for valid credentials', async () => {
      // Mock database response
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        password_hash: 'hashed_password',
      };

      jest.spyOn(databaseService.getPool(), 'one').mockResolvedValue(mockUser);

      const result = await service.login('test@example.com', 'password');

      expect(result.success).toBe(true);
      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
    });
  });
});
```

### Integration Tests

```typescript
// apps/auth-service/src/app/app.e2e-spec.ts
describe('Auth Service (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('should handle auth.login message', async () => {
    const result = await app
      .get(ClientProxy)
      .send('auth.login', {
        email: 'test@example.com',
        password: 'password123'
      })
      .toPromise();

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
  });
});
```

## Code Style and Standards

### ESLint and Prettier

```bash
# Run linting
nx run-many --target=lint --all

# Fix linting issues
nx run-many --target=lint --all --fix

# Format code
npx prettier --write "**/*.{ts,js,json,md}"
```

### Coding Standards

**File Naming**:

- Controllers: `auth.controller.ts`
- Services: `auth.service.ts`
- DTOs: `create-user.dto.ts`
- Tests: `auth.service.spec.ts`

**Class Naming**:

```typescript
// Controllers
export class AuthController {}

// Services
export class AuthService {}

// DTOs
export class CreateUserDto {}

// Interfaces
export interface IUserRepository {}
```

**Function Naming**:

```typescript
// Handlers for message patterns
@MessagePattern('auth.login')
async handleLogin() {}

// Service methods
async validateUser() {}
async createUser() {}
async findUserByEmail() {}
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```bash
feat: add user profile management
fix: resolve database connection timeout
docs: update API documentation
style: format auth service code
refactor: extract user validation logic
test: add integration tests for auth flow
chore: update dependencies
```

## Debugging

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Auth Service",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/apps/auth-service/src/main.ts",
      "outFiles": ["${workspaceFolder}/dist/apps/auth-service/**/*.js"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "runtimeArgs": ["-r", "ts-node/register"]
    }
  ]
}
```

### Logging Best Practices

```typescript
import { Logger } from '@nestjs/common';

export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async login(email: string, password: string) {
    this.logger.log(`Login attempt for user: ${email}`);

    try {
      const user = await this.findUserByEmail(email);
      this.logger.log(`User found: ${user.id}`);

      // ... authentication logic

      this.logger.log(`Login successful for user: ${user.id}`);
      return { success: true, user, token };
    } catch (error) {
      this.logger.error(`Login failed for user: ${email}`, error.stack);
      throw error;
    }
  }
}
```

### Database Query Debugging

Enable Slonik query logging:

```typescript
// In database service configuration
const pool = await createPool(connectionString, {
  interceptors: [
    createQueryLoggingInterceptor(),
    createBenchmarkingInterceptor(),
  ],
});
```

## Common Issues

### Port Already in Use

```bash
# Find process using port
lsof -i :5673

# Kill process
kill -9 <PID>

# Or use different ports in compose.yml
```

### Database Connection Issues

```bash
# Check if database is running
docker ps | grep postgres

# Check database logs
docker logs usecapsule-auth-postgres

# Reset database
npm run docker:reset
npm run migrate:auth
```

### RabbitMQ Connection Issues

```bash
# Check RabbitMQ status
docker logs usecapsule-rabbitmq

# Access RabbitMQ management UI
open http://localhost:15673
```

### Build Issues

```bash
# Clear Nx cache
nx reset

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild all
npm run build:all
```

### Migration Issues

```bash
# Check migration status
npm run migrate:auth:info

# Validate migration files
npm run migrate:auth:validate

# If migration fails, check logs and fix data manually
docker exec -it usecapsule-auth-postgres psql -U usecapsule_auth -d usecapsule_auth
```

## Next Steps

Once you have the development environment running:

1. **Explore the codebase** - Start with `apps/api-gateway` and `apps/auth-service`
2. **Read the architecture docs** - Understand the system design in `docs/architecture/`
3. **Try the API** - Use Postman to test endpoints
4. **Add a new feature** - Follow the development workflow
5. **Write tests** - Ensure your code is well-tested
6. **Submit a PR** - Contribute back to the project

For more detailed information, check out:

- [System Architecture Overview](../architecture/system-overview.md)
- [Database Documentation](../database/README.md)
- [API Documentation](../api/README.md)

Happy coding! 🚀
