# Phase 3: Major Dependency Updates

## Manual Steps Required

### 1. webpack-cli v5 → v6
```bash
npm install webpack-cli@^6.0.1
# Review webpack configs in apps/*/webpack.config.js
# Test build process thoroughly
```

### 2. @types/node v22 → v24
```bash
npm install --save-dev @types/node@^24.0.0
# Review TypeScript errors
# Update Node.js types usage
```

### 3. Zod v3 → v4 Migration
```bash
# In affected packages (libs/configs/*)
cd libs/configs/database && npm install zod@^4.1.8
cd libs/configs/parameters && npm install zod@^4.1.8

# Run migration codemod
npx @zod/codemod v3-to-v4 ./libs/configs/
```

### 4. dotenv v16 → v17
```bash
npm install dotenv@^17.2.2
# Review configuration loading
# Test environment variable parsing
```

## Testing Checklist
- [ ] TypeScript compilation
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Build process works
- [ ] Services start correctly
- [ ] Database migrations work
- [ ] RabbitMQ connectivity
- [ ] API endpoints functional

