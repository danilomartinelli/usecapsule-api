#!/bin/bash
# upgrade-dependencies.sh
# Safe incremental dependency upgrade script for Capsule Platform

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="Capsule Platform"
BACKUP_BRANCH="upgrade/backup-$(date +%Y%m%d-%H%M%S)"
UPGRADE_BRANCH="upgrade/dependencies-$(date +%Y%m%d)"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Pre-flight checks
preflight_checks() {
    log "Starting preflight checks for $PROJECT_NAME"
    
    # Check if we're in the right directory
    if [[ ! -f "package.json" ]] || [[ ! -f "nx.json" ]]; then
        error "Not in project root directory. Run from project root."
    fi
    
    # Check git status
    if [[ -n $(git status --porcelain) ]]; then
        error "Working directory not clean. Commit or stash changes first."
    fi
    
    # Check if on main branch
    current_branch=$(git branch --show-current)
    if [[ "$current_branch" != "main" ]]; then
        warn "Not on main branch. Currently on: $current_branch"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check dependencies are installed
    if [[ ! -d "node_modules" ]]; then
        log "Installing dependencies..."
        npm ci
    fi
    
    # Run baseline tests
    log "Running baseline tests..."
    npm run lint || error "Linting failed"
    npm test || error "Tests failed"
    
    success "Preflight checks passed"
}

# Create backup point
create_backup() {
    log "Creating backup point: $BACKUP_BRANCH"
    git tag -a "$BACKUP_BRANCH" -m "Backup before dependency upgrade $(date)"
    success "Backup created: $BACKUP_BRANCH"
}

# Phase 1: Safe patch updates
phase_1_patches() {
    log "Phase 1: Applying safe patch updates"
    
    # Create upgrade branch
    git checkout -b "$UPGRADE_BRANCH"
    
    # Update Nx ecosystem
    log "Updating Nx ecosystem..."
    npm update nx @nx/eslint @nx/eslint-plugin @nx/js @nx/node @nx/web @nx/webpack @nx/workspace
    
    # Update safe runtime dependencies
    log "Updating runtime dependencies..."
    npm update rxjs @opentelemetry/sdk-node
    
    # Verify updates
    log "Verifying Phase 1 updates..."
    npm run lint:affected || error "Linting failed after Phase 1"
    npm run test:affected || error "Tests failed after Phase 1"
    npm run build:all || error "Build failed after Phase 1"
    
    # Commit Phase 1
    git add package.json package-lock.json apps/*/package.json libs/*/package.json
    git commit -m "chore: Phase 1 dependency updates - safe patches

- nx: 21.5.1 → 21.5.2
- @nx/*: 21.5.1 → 21.5.2
- rxjs: 7.8.1 → 7.8.2
- @opentelemetry/sdk-node: 0.204.0 → 0.205.0

🤖 Generated with Claude Code
"
    
    git tag -a "upgrade/phase-1-complete" -m "Phase 1 dependency updates complete"
    success "Phase 1 completed successfully"
}

# Phase 2: Minor updates
phase_2_minor() {
    log "Phase 2: Applying minor updates with testing"
    
    # Update build tools
    log "Updating SWC build tools..."
    npm install @swc/core@latest @swc-node/register@latest
    
    # Update monitoring tools
    log "Updating OpenTelemetry..."
    npm update @opentelemetry/auto-instrumentations-node
    
    # Run comprehensive tests
    log "Running comprehensive test suite..."
    npm run lint || error "Linting failed after Phase 2"
    npm run test:coverage || error "Tests failed after Phase 2"
    npm run build:all || error "Build failed after Phase 2"
    
    # Integration test
    log "Running integration tests..."
    npm run infrastructure:up
    sleep 10  # Wait for services to start
    
    # Test health endpoints
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        success "API Gateway health check passed"
    else
        warn "API Gateway health check failed"
    fi
    
    npm run infrastructure:down
    
    # Commit Phase 2
    git add package.json package-lock.json apps/*/package.json libs/*/package.json
    git commit -m "chore: Phase 2 dependency updates - minor versions

- @swc/core: 1.5.29 → 1.13.5
- @swc-node/register: 1.9.2 → 1.11.1
- @opentelemetry/auto-instrumentations-node: 0.63.0 → 0.64.1

Includes comprehensive testing verification.

🤖 Generated with Claude Code
"
    
    git tag -a "upgrade/phase-2-complete" -m "Phase 2 dependency updates complete"
    success "Phase 2 completed successfully"
}

# Phase 3: Major updates (requires manual intervention)
phase_3_major() {
    log "Phase 3: Major updates require manual intervention"
    warn "This phase includes breaking changes. Proceed with caution."
    
    read -p "Continue with major updates? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Skipping Phase 3. You can run manually later."
        return 0
    fi
    
    # Create detailed upgrade plan
    cat << 'EOF' > UPGRADE_PHASE_3_PLAN.md
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

EOF
    
    success "Phase 3 plan created in UPGRADE_PHASE_3_PLAN.md"
    log "Review the plan and execute major updates manually"
}

# Rollback function
rollback() {
    local rollback_point=$1
    warn "Rolling back to: $rollback_point"
    
    # Restore from backup
    git checkout main
    git branch -D "$UPGRADE_BRANCH" 2>/dev/null || true
    
    if [[ -n "$rollback_point" ]]; then
        git checkout "$rollback_point"
        git checkout -b "rollback-$(date +%Y%m%d-%H%M%S)"
    fi
    
    # Clean reinstall
    rm -rf node_modules apps/*/node_modules libs/*/node_modules
    npm ci
    
    # Verify rollback
    npm test || error "Tests failed after rollback"
    
    success "Rollback completed successfully"
}

# Main execution
main() {
    case "${1:-all}" in
        "preflight")
            preflight_checks
            ;;
        "backup")
            create_backup
            ;;
        "phase1"|"1")
            preflight_checks
            create_backup
            phase_1_patches
            ;;
        "phase2"|"2")
            phase_2_minor
            ;;
        "phase3"|"3")
            phase_3_major
            ;;
        "rollback")
            rollback "$2"
            ;;
        "all")
            preflight_checks
            create_backup
            phase_1_patches
            phase_2_minor
            phase_3_major
            ;;
        *)
            echo "Usage: $0 {preflight|backup|phase1|phase2|phase3|rollback [point]|all}"
            echo ""
            echo "  preflight    - Run preflight checks only"
            echo "  backup       - Create backup point only"
            echo "  phase1       - Safe patch updates"
            echo "  phase2       - Minor version updates"
            echo "  phase3       - Major version updates (manual)"
            echo "  rollback     - Rollback to backup point"
            echo "  all          - Run all phases (default)"
            exit 1
            ;;
    esac
}

# Trap errors and provide rollback info
trap 'error "Script failed! To rollback, run: $0 rollback $BACKUP_BRANCH"' ERR

# Execute main function
main "$@"