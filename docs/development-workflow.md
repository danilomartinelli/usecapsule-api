# Development Workflow

This guide covers common development tasks and workflows for working with the Capsule platform.

## Table of Contents
- [Development Setup](#development-setup)
- [Daily Development Tasks](#daily-development-tasks)
- [Working with Nx](#working-with-nx)
- [Testing Workflows](#testing-workflows)
- [Code Quality](#code-quality)
- [Creating New Features](#creating-new-features)
- [Debugging](#debugging)
- [Git Workflow](#git-workflow)

## Development Setup

### Initial Setup Checklist

1. ✅ Clone repository
2. ✅ Install dependencies: `npm install`
3. ✅ Start Docker services: `npm run docker:up`
4. ✅ Verify services: `docker-compose ps`
5. ✅ Start development servers: `npx nx serve api-gateway` and `npx nx serve portal`
6. ✅ Access applications: http://localhost:4200 (Portal), http://localhost:3000/api (API)

### Daily Startup Routine

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
npm install

# 3. Start Docker services (if not running)
npm run docker:up

# 4. Start development servers
npx nx run-many --target=serve --all

# Or start specific services
npx nx serve api-gateway  # Terminal 1
npx nx serve portal       # Terminal 2
```

## Daily Development Tasks

### Running Services

#### Start All Services
```bash
npx nx run-many --target=serve --all
```

#### Start Specific Service
```bash
npx nx serve api-gateway   # Backend API
npx nx serve portal        # Frontend
npx nx serve service-auth  # Auth service
```

#### Watch Mode with Auto-Restart
Services automatically restart on file changes when using `serve` command.

### Building Projects

#### Build Everything
```bash
npx nx run-many --target=build --all
```

#### Build Specific Project
```bash
npx nx build api-gateway
npx nx build portal
```

#### Production Build
```bash
npx nx build api-gateway --configuration=production
npx nx build portal --configuration=production
```

### Running Tests

#### Test Everything
```bash
npx nx run-many --target=test --all
```

#### Test Specific Project
```bash
npx nx test api-gateway
npx nx test portal
npx nx test contexts-auth
```

#### Test in Watch Mode
```bash
npx nx test api-gateway --watch
```

#### Test with Coverage
```bash
npx nx test api-gateway --coverage
```

#### E2E Tests
```bash
npx nx e2e portal-e2e
npx nx e2e api-gateway-e2e
```

## Working with Nx

### Understanding the Dependency Graph

View project dependencies:
```bash
npx nx graph
```
This opens an interactive visualization of all projects and their dependencies.

### Affected Commands

Run tasks only for projects affected by your changes:

```bash
# See what's affected
npx nx affected:graph

# Test affected projects
npx nx affected:test

# Build affected projects
npx nx affected:build

# Lint affected projects
npx nx affected:lint
```

### Nx Generators

#### Generate a New Library
```bash
# Shared library
npx nx g @nx/js:lib my-lib --directory=libs/shared

# UI component library
npx nx g @nx/react:lib my-ui-lib --directory=libs/ui

# Context library
npx nx g @nx/js:lib my-context --directory=libs/contexts
```

#### Generate Backend Components
```bash
# New NestJS module
npx nx g @nx/nest:module users --project=api-gateway

# New NestJS service
npx nx g @nx/nest:service users --project=api-gateway

# New NestJS controller
npx nx g @nx/nest:controller users --project=api-gateway

# All three at once (module, service, controller)
npx nx g @nx/nest:resource users --project=api-gateway
```

#### Generate Frontend Components
```bash
# New React component
npx nx g @nx/react:component Button --project=portal

# New React hook
npx nx g @nx/react:hook useAuth --project=portal

# New React page component
npx nx g @nx/react:component HomePage --project=portal --directory=pages
```

### Nx Cache

Nx caches build and test results to speed up subsequent runs.

#### Clear Cache
```bash
npx nx reset
```

#### Skip Cache
```bash
npx nx build api-gateway --skip-nx-cache
```

## Testing Workflows

### Unit Testing Strategy

1. **Write tests alongside code**: Place `.spec.ts` files next to the source files
2. **Follow AAA pattern**: Arrange, Act, Assert
3. **Mock external dependencies**: Use Jest mocks for external services
4. **Test business logic**: Focus on use cases and domain logic

### Testing Commands

```bash
# Run all tests
npm run validate

# Run tests for a specific file
npx nx test api-gateway --testPathPattern=app.service.spec.ts

# Run tests matching a pattern
npx nx test api-gateway --testNamePattern="should create"

# Debug tests
npx nx test api-gateway --detectOpenHandles --runInBand
```

### E2E Testing

```bash
# Run portal e2e tests (Playwright)
npx nx e2e portal-e2e

# Run API e2e tests (Jest)
npx nx e2e api-gateway-e2e

# Run e2e tests in headed mode (see browser)
npx nx e2e portal-e2e --headed
```

## Code Quality

### Linting

```bash
# Lint all projects
npx nx run-many --target=lint --all

# Lint specific project
npx nx lint api-gateway

# Auto-fix lint issues
npx nx lint api-gateway --fix
```

### Formatting

```bash
# Format all files
npx nx format:write

# Check formatting without changing files
npx nx format:check
```

### Type Checking

```bash
# Type check specific project
npx nx typecheck api-gateway
npx nx typecheck portal
```

## Creating New Features

### Backend Feature (NestJS)

1. **Generate the resource**:
```bash
npx nx g @nx/nest:resource products --project=api-gateway
```

2. **Implement the service**:
```typescript
// apps/api-gateway/src/app/products/products.service.ts
@Injectable()
export class ProductsService {
  async findAll() {
    // Implementation
  }
}
```

3. **Add DTOs**:
```typescript
// libs/shared/dto/src/lib/product.dto.ts
export class CreateProductDto {
  name: string;
  price: number;
}
```

4. **Write tests**:
```bash
npx nx test api-gateway --testPathPattern=products
```

### Frontend Feature (React)

1. **Create a new component**:
```bash
npx nx g @nx/react:component ProductList --project=portal
```

2. **Add to routing**:
```typescript
// apps/portal/app/routes.tsx
route('products', './routes/products.tsx'),
```

3. **Implement the component**:
```tsx
// apps/portal/app/routes/products.tsx
export function Products() {
  return <ProductList />;
}
```

4. **Test the component**:
```bash
npx nx test portal --testPathPattern=ProductList
```

### Shared Library Feature

1. **Create shared types**:
```typescript
// libs/shared/types/src/lib/product.types.ts
export interface Product {
  id: string;
  name: string;
  price: number;
}
```

2. **Export from index**:
```typescript
// libs/shared/types/src/index.ts
export * from './lib/product.types';
```

3. **Use in both frontend and backend**:
```typescript
import { Product } from '@usecapsule/shared-types';
```

## Debugging

### Backend Debugging (NestJS)

1. **Add debugger statement**:
```typescript
debugger; // Breakpoint
```

2. **Start in debug mode**:
```bash
npx nx serve api-gateway --inspect
```

3. **Attach debugger**:
   - VS Code: Use "Attach to Node Process" configuration
   - Chrome DevTools: Open `chrome://inspect`

### Frontend Debugging (React)

1. **Use browser DevTools**
2. **Add console.log or debugger statements**
3. **React DevTools extension** for component inspection

### Debugging Tests

```bash
# Debug Jest tests
node --inspect-brk ./node_modules/.bin/jest --runInBand

# Debug specific test file
npx nx test api-gateway --testPathPattern=app.service --runInBand --detectOpenHandles
```

## Git Workflow

### Branch Naming Convention

```bash
feature/description    # New features
bugfix/description    # Bug fixes
hotfix/description    # Urgent production fixes
refactor/description  # Code refactoring
docs/description      # Documentation updates
```

### Commit Messages

Follow conventional commits:
```bash
feat: add user authentication
fix: resolve memory leak in product service
docs: update API documentation
refactor: simplify product controller logic
test: add unit tests for auth service
chore: update dependencies
```

### Typical Development Flow

1. **Create feature branch**:
```bash
git checkout -b feature/add-products-api
```

2. **Make changes and test**:
```bash
# Make your changes
npx nx affected:test
npx nx affected:lint
```

3. **Commit changes**:
```bash
git add .
git commit -m "feat: add products API endpoints"
```

4. **Push and create PR**:
```bash
git push origin feature/add-products-api
# Create PR on GitHub/GitLab
```

### Pre-commit Checks

Run these before committing:
```bash
# Test affected projects
npx nx affected:test --base=main

# Lint affected projects
npx nx affected:lint --base=main

# Check formatting
npx nx format:check

# Type check
npx nx affected --target=typecheck --base=main
```

## Docker Management

### View Service Logs
```bash
# All services
npm run docker:logs

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Access Service Shells
```bash
# PostgreSQL
docker-compose exec postgres psql -U usecapsule -d usecapsule_dev

# Redis CLI
docker-compose exec redis redis-cli -a usecapsule_dev_password

# RabbitMQ
docker-compose exec rabbitmq rabbitmqctl status
```

### Reset Everything
```bash
# Stop and remove all containers and volumes
npm run docker:reset
```

## Performance Tips

### Speed Up Development

1. **Use Nx affected commands**: Only run what changed
2. **Leverage Nx cache**: Don't skip cache unless necessary
3. **Run services individually**: Only run what you're working on
4. **Use watch mode**: Auto-restart on changes
5. **Parallelize tasks**: Use `--parallel` flag when possible

### Memory Management

If running out of memory:
```bash
# Increase Node memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Run fewer services simultaneously
npx nx serve api-gateway  # Only what you need
```

## Troubleshooting Common Issues

### Module Not Found
```bash
# Clear cache and reinstall
npx nx reset
rm -rf node_modules
npm install
```

### Type Errors After Adding New Library
```bash
# Restart TypeScript service in your IDE
# Or restart your IDE completely
```

### Docker Services Not Starting
```bash
# Reset Docker services
npm run docker:reset

# Check port availability
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
```

### Tests Failing Unexpectedly
```bash
# Clear Jest cache
npx jest --clearCache

# Run tests in band (sequentially)
npx nx test api-gateway --runInBand
```

## IDE Setup

### VS Code Recommended Extensions

- Nx Console
- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Jest Runner
- Docker
- Tailwind CSS IntelliSense

### VS Code Settings

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.preferences.importModuleSpecifier": "non-relative"
}
```

## Continuous Integration

### Local CI Simulation

Before pushing, simulate CI locally:
```bash
# Run all CI checks
npx nx affected --target=lint --base=main
npx nx affected --target=test --base=main
npx nx affected --target=build --base=main
npx nx affected --target=e2e --base=main
```

This ensures your PR will pass CI checks.