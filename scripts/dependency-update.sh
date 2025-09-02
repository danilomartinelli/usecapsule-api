#!/bin/bash

# Dependency Update Script for Capsule API
# Usage: ./scripts/dependency-update.sh [safe|minor|major|all]

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🔄 Capsule API Dependency Update Script"
echo "========================================"

# Backup current state
echo -e "${YELLOW}📦 Creating backup of package files...${NC}"
cp package.json package.json.backup
cp package-lock.json package-lock.json.backup

# Function to restore backups
restore_backup() {
    echo -e "${RED}❌ Update failed, restoring backups...${NC}"
    mv package.json.backup package.json
    mv package-lock.json.backup package-lock.json
    npm ci
    exit 1
}

# Set trap to restore on error
trap restore_backup ERR

# Update based on argument
MODE=${1:-safe}

case $MODE in
    safe)
        echo -e "${GREEN}✅ Running safe updates (patches only)...${NC}"
        npm update
        npm audit fix
        ;;
    
    minor)
        echo -e "${YELLOW}📦 Updating to latest minor versions...${NC}"
        # TypeScript ecosystem
        npm install --save-dev typescript@^5.9.2
        npm install --save-dev typescript-eslint@^8.42.0
        npm install --save-dev @types/node@^20.19.9
        npm install --save-dev ts-node@^10.9.2
        
        # Other minor updates
        npm install --save-dev eslint-plugin-import@^2.32.0
        npm install --save-dev jiti@^2.5.1
        ;;
    
    major)
        echo -e "${YELLOW}⚠️  Updating major versions (may have breaking changes)...${NC}"
        read -p "Have you reviewed the breaking changes? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # SWC updates
            npm install --save-dev @swc/core@^1.13.5
            npm install --save-dev @swc/cli@^0.7.8
            npm install --save-dev @swc-node/register@^1.11.1
            
            # Prettier 3.x
            npm install --save-dev prettier@^3.6.2
            
            # Webpack CLI 6.x
            npm install --save-dev webpack-cli@^6.0.1
            
            # Reflect metadata
            npm install reflect-metadata@^0.2.2
        else
            echo "Skipping major updates"
        fi
        ;;
    
    all)
        echo -e "${RED}🚨 Updating ALL packages to latest versions...${NC}"
        read -p "This may break your application. Continue? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm update --save
            npm update --save-dev
            npm audit fix --force
        else
            echo "Update cancelled"
            rm package.json.backup package-lock.json.backup
            exit 0
        fi
        ;;
    
    *)
        echo "Usage: $0 [safe|minor|major|all]"
        echo "  safe  - Only patch updates and security fixes (default)"
        echo "  minor - Update to latest minor versions"
        echo "  major - Update major versions (with confirmation)"
        echo "  all   - Update everything to latest (dangerous)"
        rm package.json.backup package-lock.json.backup
        exit 1
        ;;
esac

# Run security audit
echo -e "${YELLOW}🔒 Running security audit...${NC}"
npm audit

# Run tests
echo -e "${YELLOW}🧪 Running tests to verify updates...${NC}"
npm run validate || {
    echo -e "${RED}❌ Tests failed after update${NC}"
    restore_backup
}

# Check build
echo -e "${YELLOW}🏗️  Checking build...${NC}"
npm run build:all || {
    echo -e "${RED}❌ Build failed after update${NC}"
    restore_backup
}

# Success - remove backups
echo -e "${GREEN}✅ Updates completed successfully!${NC}"
rm package.json.backup package-lock.json.backup

# Show summary
echo ""
echo "📊 Update Summary:"
echo "=================="
npm outdated || echo "All packages are up to date!"

echo ""
echo -e "${GREEN}✨ Don't forget to:${NC}"
echo "  1. Review the changes: git diff package*.json"
echo "  2. Test your application thoroughly"
echo "  3. Commit the updates: git add package*.json && git commit -m 'chore(deps): update dependencies'"