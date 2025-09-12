# Zod v3 → v4 Migration Guide
*Critical: Breaking Changes Require Manual Review*

## Overview

**Current**: Zod v3.25.76  
**Target**: Zod v4.1.8  
**Risk Level**: 🟠 HIGH (Breaking Changes)  
**Estimated Time**: 2-4 hours  
**Services Affected**: `libs/configs/database`, `libs/configs/parameters`

## Breaking Changes Summary

### 1. API Method Renames
- `.refinement()` → `.refine()`
- `.superRefine()` signature changes
- `.transform()` callback signature changes

### 2. TypeScript Integration Changes
- Stricter type inference
- Updated utility types
- Enhanced error type definitions

### 3. Error Handling Updates
- New error format structure
- Updated error codes
- Enhanced error messages

## Pre-Migration Checklist

- [ ] All tests passing with Zod v3
- [ ] Code backup created
- [ ] Understanding of affected files identified
- [ ] Team notified of breaking changes

## Step-by-Step Migration

### Step 1: Identify Affected Files

```bash
# Find all files using Zod
grep -r "from 'zod'" libs/configs/
grep -r "refinement\|superRefine" libs/configs/

# Expected locations:
# - libs/configs/database/src/lib/schemas/
# - libs/configs/parameters/src/lib/validators/
```

### Step 2: Update Dependencies

```bash
# Update Zod in affected packages
cd libs/configs/database
npm install zod@^4.1.8

cd ../parameters  
npm install zod@^4.1.8

# Update root package if needed
cd ../../..
npm install zod@^4.1.8
```

### Step 3: Code Transformations

#### 3a. `.refinement()` → `.refine()`

**Before (v3)**:
```typescript
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().refinement(
    (val) => val.includes('@'),
    { message: 'Must be valid email' }
  ),
  age: z.number().refinement(
    (val) => val >= 18,
    'Must be 18 or older'
  )
});
```

**After (v4)**:
```typescript
import { z } from 'zod';

const userSchema = z.object({
  email: z.string().refine(
    (val) => val.includes('@'),
    { message: 'Must be valid email' }
  ),
  age: z.number().refine(
    (val) => val >= 18,
    'Must be 18 or older'  
  )
});
```

#### 3b. `.superRefine()` Updates

**Before (v3)**:
```typescript
const configSchema = z.object({
  port: z.number(),
  host: z.string()
}).superRefine((data, ctx) => {
  if (data.port === 80 && data.host === 'localhost') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot use port 80 with localhost'
    });
  }
});
```

**After (v4)**:
```typescript
const configSchema = z.object({
  port: z.number(),
  host: z.string()
}).superRefine((data, ctx) => {
  if (data.port === 80 && data.host === 'localhost') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Cannot use port 80 with localhost',
      path: ['port'] // Enhanced path specification in v4
    });
  }
});
```

#### 3c. Error Handling Updates

**Before (v3)**:
```typescript
try {
  const result = schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle v3 error format
    const issues = error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
  }
}
```

**After (v4)**:
```typescript
try {
  const result = schema.parse(data);
} catch (error) {
  if (error instanceof z.ZodError) {
    // Handle v4 error format (largely compatible, but enhanced)
    const issues = error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code // Enhanced error codes in v4
    }));
  }
}
```

### Step 4: Automated Migration with Codemod

```bash
# Install codemod tool
npm install -g @zod/codemod

# Run automated migration
npx @zod/codemod v3-to-v4 libs/configs/database/src/
npx @zod/codemod v3-to-v4 libs/configs/parameters/src/

# Review changes
git diff libs/configs/
```

### Step 5: Manual Review Required Files

#### Database Configuration Schema (`libs/configs/database/src/lib/database-config.schema.ts`)

```typescript
import { z } from 'zod';

// v4 Compatible schema
export const DatabaseConfigSchema = z.object({
  host: z.string().min(1, 'Host is required'),
  port: z.number().int().positive(),
  database: z.string().min(1, 'Database name is required'),
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  ssl: z.boolean().optional().default(false),
  pool: z.object({
    min: z.number().int().nonnegative().default(0),
    max: z.number().int().positive().default(10),
    acquireTimeoutMillis: z.number().positive().default(60000),
    idleTimeoutMillis: z.number().positive().default(30000)
  }).optional()
}).refine((config) => {
  // Custom validation for production SSL requirement
  if (process.env.NODE_ENV === 'production' && !config.ssl) {
    return false;
  }
  return true;
}, {
  message: 'SSL is required in production environment',
  path: ['ssl']
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;
```

#### Parameters Validation (`libs/configs/parameters/src/lib/parameter-validators.ts`)

```typescript
import { z } from 'zod';

// Service parameter schemas
export const ServiceParameterSchema = z.object({
  serviceName: z.string().regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, 'Invalid service name format'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Must be semantic version'),
  environment: z.enum(['development', 'staging', 'production']),
  replicas: z.number().int().positive().max(50),
  resources: z.object({
    cpu: z.string().regex(/^\d+m$/, 'CPU must be in millicores (e.g., 500m)'),
    memory: z.string().regex(/^\d+(Mi|Gi)$/, 'Memory must be in Mi or Gi')
  }),
  ports: z.array(z.number().int().min(1024).max(65535)).min(1)
}).refine((data) => {
  // Environment-specific validation
  if (data.environment === 'production' && data.replicas < 2) {
    return false;
  }
  return true;
}, {
  message: 'Production services must have at least 2 replicas',
  path: ['replicas']
});

export type ServiceParameter = z.infer<typeof ServiceParameterSchema>;
```

### Step 6: Update Import Statements

Check for any conditional imports or dynamic imports:

```typescript
// Ensure consistent import style
import { z } from 'zod';

// For type-only imports (if used)
import type { ZodError, ZodSchema } from 'zod';
```

### Step 7: Test All Validation Logic

```bash
# Run specific tests for validation
npm test -- --testPathPattern="validation|schema|config"

# Run full test suite
npm run test:coverage

# Test specific services
nx test database --coverage
nx test parameters --coverage
```

### Step 8: Integration Testing

```bash
# Test with actual configuration files
npm run infrastructure:up

# Verify database connection with new validation
npm run db:migrate:all

# Test parameter validation in services
npm run dev:auth &
PID=$!
sleep 5
curl http://localhost:3000/health
kill $PID

npm run infrastructure:down
```

## Common Issues & Solutions

### Issue 1: Type Inference Errors
**Error**: `Type 'unknown' is not assignable to type 'T'`

**Solution**:
```typescript
// Ensure proper type assertion
const parsed = schema.parse(data) as ExpectedType;

// Or use safeParse for better error handling
const result = schema.safeParse(data);
if (result.success) {
  const typedData: ExpectedType = result.data;
}
```

### Issue 2: Custom Error Messages Not Working
**Error**: Default error messages instead of custom ones

**Solution**:
```typescript
// Ensure proper error message format in v4
z.string().refine((val) => val.length > 5, {
  message: 'String must be longer than 5 characters'
});

// Not just a string:
// z.string().refine((val) => val.length > 5, 'Too short'); // This might not work as expected
```

### Issue 3: Nested Validation Issues
**Error**: Path references in nested objects

**Solution**:
```typescript
// Use proper path specification in superRefine
.superRefine((data, ctx) => {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: 'Invalid configuration',
    path: ['nested', 'field'] // Proper path array
  });
});
```

## Verification Checklist

- [ ] All `.refinement()` calls changed to `.refine()`
- [ ] Error handling updated for v4 format
- [ ] Custom validation functions tested
- [ ] TypeScript compilation successful
- [ ] All unit tests passing
- [ ] Integration tests with real config files passing
- [ ] No runtime errors in development environment
- [ ] Database connection validation works
- [ ] Service parameter validation works

## Rollback Plan

If migration fails:

```bash
# Restore v3 dependencies
cd libs/configs/database
npm install zod@^3.25.76

cd ../parameters
npm install zod@^3.25.76

# Restore code changes
git checkout HEAD~1 -- libs/configs/

# Verify rollback
npm test
```

## Performance Impact

**Expected Changes**:
- Slightly faster validation (v4 optimizations)
- Better TypeScript inference (compile-time benefits)
- Enhanced error messages (minimal runtime impact)

**Monitoring**:
- Watch for validation performance in hot paths
- Monitor bundle size changes
- Check memory usage patterns

## Documentation Updates

After successful migration:

1. Update internal docs referencing Zod usage
2. Update code examples in README files
3. Update team knowledge base with v4 patterns
4. Create team training materials for new v4 features

---

**Migration Completion**: Mark this migration as complete only after all verification steps pass and the application runs successfully in all environments.