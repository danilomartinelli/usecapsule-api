# webpack-cli v5 → v6 Migration Guide
*Major Version Upgrade with CLI Changes*

## Overview

**Current**: webpack-cli v5.1.4  
**Target**: webpack-cli v6.0.1  
**Risk Level**: 🟠 HIGH (Major Version)  
**Estimated Time**: 2-3 hours  
**Services Affected**: Build process, Nx webpack configs

## Breaking Changes Summary

### 1. Node.js Version Requirement
- **Minimum Node.js**: 18.12.0+ (previously 16+)
- **Recommended**: Node.js 20+

### 2. CLI Argument Changes
- Removed deprecated flags
- Updated option parsing
- New default behaviors

### 3. Plugin API Updates
- Updated webpack plugin interfaces
- New configuration validation
- Enhanced error reporting

## Pre-Migration Checklist

- [ ] Node.js version 18.12.0+ confirmed
- [ ] Current webpack builds working
- [ ] Understanding of Nx webpack integration
- [ ] Backup of current configuration

## Step-by-Step Migration

### Step 1: Verify Node.js Version

```bash
# Check current Node.js version
node --version
# Should be >= 18.12.0

# If needed, update Node.js (using nvm)
nvm install 20
nvm use 20
```

### Step 2: Update webpack-cli

```bash
# Update webpack-cli
npm install webpack-cli@^6.0.1

# Verify installation
npx webpack-cli --version
```

### Step 3: Review Nx Webpack Integration

Check how Nx uses webpack-cli in your project:

```bash
# Check for direct webpack usage
grep -r "webpack-cli" . --include="*.json" --include="*.js" --include="*.ts"

# Check Nx webpack configurations
find . -name "webpack.config.js" -o -name "webpack.*.js"
```

### Step 4: Update Webpack Configurations

#### Standard Nx Webpack Config (`apps/*/webpack.config.js`)

**Before (v5 compatible)**:
```javascript
const { composePlugins, withNx } = require('@nx/webpack');

// Old style configuration
module.exports = composePlugins(withNx(), (config) => {
  // Custom webpack config
  config.resolve.fallback = {
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify")
  };
  
  return config;
});
```

**After (v6 compatible)**:
```javascript
const { composePlugins, withNx } = require('@nx/webpack');

// v6 compatible configuration
module.exports = composePlugins(withNx(), (config, { options, context }) => {
  // Enhanced configuration with v6 context
  config.resolve = config.resolve || {};
  config.resolve.fallback = {
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify")
  };
  
  // v6 supports enhanced plugin configuration
  config.plugins = config.plugins || [];
  
  return config;
});
```

### Step 5: Update Package.json Scripts

Check if you have any direct webpack-cli usage:

```json
{
  "scripts": {
    "build:custom": "webpack --mode=production --config=custom.webpack.js",
    "analyze": "webpack-bundle-analyzer dist/main.js"
  }
}
```

**Updated for v6**:
```json
{
  "scripts": {
    "build:custom": "webpack --mode production --config custom.webpack.js",
    "analyze": "webpack-bundle-analyzer dist/main.js"
  }
}
```

### Step 6: Test Build Process

```bash
# Test individual app builds
nx build api-gateway
nx build auth-service
nx build billing-service
nx build deploy-service
nx build monitor-service

# Test all builds
npm run build:all
```

### Step 7: Update Environment-Specific Configs

If you have environment-specific webpack configs:

```javascript
// webpack.prod.js
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'production',
  optimization: {
    minimize: true,
    // v6 compatible optimization options
    usedExports: true,
    sideEffects: false
  }
});
```

## Nx-Specific Considerations

### Nx Webpack Plugin Integration

Ensure compatibility with Nx webpack plugins:

```javascript
// project.json or workspace.json
{
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "outputPath": "dist/apps/api-gateway",
        "main": "apps/api-gateway/src/main.ts",
        "tsConfig": "apps/api-gateway/tsconfig.app.json",
        "webpackConfig": "apps/api-gateway/webpack.config.js"
      }
    }
  }
}
```

### Custom Webpack Executors

If using custom webpack executors, update them:

```typescript
// tools/webpack/custom-executor.ts
import { ExecutorContext, logger } from '@nx/devkit';
import { execSync } from 'child_process';

export default async function customWebpackExecutor(
  options: any,
  context: ExecutorContext
) {
  // v6 compatible command execution
  const webpackCommand = `npx webpack --config ${options.webpackConfig} --mode ${options.mode}`;
  
  try {
    execSync(webpackCommand, { stdio: 'inherit' });
    logger.info('Build completed successfully');
    return { success: true };
  } catch (error) {
    logger.error('Build failed:', error);
    return { success: false };
  }
}
```

## Testing Strategy

### Step 1: Build Verification
```bash
# Test each service build
nx build api-gateway --verbose
nx build auth-service --verbose
nx build billing-service --verbose
nx build deploy-service --verbose
nx build monitor-service --verbose

# Check build outputs
ls -la dist/apps/*/
```

### Step 2: Bundle Analysis
```bash
# Analyze bundle sizes (if bundle analyzer is set up)
npm run analyze:api-gateway
npm run analyze:auth-service

# Or manually check sizes
du -sh dist/apps/*
```

### Step 3: Development Server Testing
```bash
# Test dev servers with new webpack-cli
nx serve api-gateway &
sleep 5
curl http://localhost:3000/health
kill %1

nx serve auth-service &
sleep 5
curl http://localhost:3001/health
kill %1
```

## Troubleshooting Common Issues

### Issue 1: "Unknown argument" Errors
**Error**: `Unknown argument: --mode=production`

**Solution**:
```bash
# Old format (might not work in v6)
webpack --mode=production

# New format (v6 compatible)
webpack --mode production
```

### Issue 2: Plugin Compatibility Issues
**Error**: `Plugin 'X' is not compatible`

**Solution**:
```javascript
// Update plugin configurations
module.exports = {
  plugins: [
    // Ensure plugins are v6 compatible
    new SomePlugin({
      // Check plugin documentation for v6 compatibility
      option1: 'value1'
    })
  ]
};
```

### Issue 3: Module Resolution Issues
**Error**: `Can't resolve module`

**Solution**:
```javascript
// Enhanced resolve configuration for v6
module.exports = {
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    // v6 enhanced fallback handling
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "path": require.resolve("path-browserify")
    }
  }
};
```

### Issue 4: TypeScript Integration Issues
**Error**: TypeScript compilation errors

**Solution**:
```javascript
// Ensure TypeScript loader compatibility
module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      }
    ]
  }
};
```

## Performance Impact

**Expected Changes**:
- **Build Speed**: Potential 5-10% improvement due to v6 optimizations
- **Bundle Size**: Similar output sizes, possibly slight improvements
- **Memory Usage**: Better memory management in v6

**Monitoring Commands**:
```bash
# Time build process
time nx build api-gateway

# Check memory usage during build
/usr/bin/time -v nx build api-gateway
```

## Verification Checklist

- [ ] webpack-cli v6 installed successfully
- [ ] All service builds complete without errors
- [ ] Bundle sizes within expected ranges
- [ ] Development servers start correctly
- [ ] Production builds work correctly
- [ ] No console errors or warnings
- [ ] Build times within acceptable ranges
- [ ] Custom webpack configurations work
- [ ] Nx integration remains functional

## Rollback Plan

If v6 causes issues:

```bash
# Rollback to v5
npm install webpack-cli@5.1.4

# Restore any configuration changes
git checkout HEAD~1 -- webpack.config.js apps/*/webpack.config.js

# Clear node_modules and reinstall
rm -rf node_modules
npm ci

# Test rollback
npm run build:all
```

## Environment-Specific Testing

### Development Environment
```bash
# Start all services in development
npm run dev:all
# Verify all services start correctly
```

### Staging Environment
```bash
# Build for staging
NODE_ENV=staging npm run build:all
# Deploy and test staging builds
```

### Production Environment
```bash
# Build for production
NODE_ENV=production npm run build:all
# Verify production optimizations
```

## Documentation Updates

After successful migration:

1. **Update Build Documentation**:
   - Update any references to webpack-cli v5
   - Document new v6 features used
   - Update troubleshooting guides

2. **Update Team Guidelines**:
   - Node.js version requirements
   - New webpack-cli command formats
   - Updated development workflow

3. **CI/CD Pipeline Updates**:
   - Ensure CI environments use Node.js 18+
   - Update build scripts if needed
   - Update deployment configurations

## Next Steps

1. **Monitor Production**: Watch for any performance regressions
2. **Team Training**: Educate team on v6 changes
3. **Documentation**: Update internal webpack guides
4. **Optimization**: Explore new v6 features for build optimization

---

**Migration Completion**: Mark as complete only after successful testing in all environments and team approval.