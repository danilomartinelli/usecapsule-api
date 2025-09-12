#!/bin/bash
# rollback-dependencies.sh
# Emergency rollback script for dependency upgrades

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }
success() { echo -e "${GREEN}✅ $1${NC}"; }

# Configuration
ROLLBACK_LOG="rollback-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR=".dependency-backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to create emergency backup
create_emergency_backup() {
    log "Creating emergency backup before rollback..."
    
    local backup_name="emergency-backup-$(date +%Y%m%d-%H%M%S)"
    
    # Backup package files
    cp package.json "$BACKUP_DIR/${backup_name}-package.json"
    cp package-lock.json "$BACKUP_DIR/${backup_name}-package-lock.json"
    
    # Backup app-specific package files
    find apps/ -name "package.json" -exec cp {} "$BACKUP_DIR/${backup_name}-{}" \;
    find libs/ -name "package.json" -exec cp {} "$BACKUP_DIR/${backup_name}-{}" \;
    
    # Create git tag
    git tag -a "$backup_name" -m "Emergency backup before rollback $(date)"
    
    success "Emergency backup created: $backup_name"
    echo "$backup_name" > "$BACKUP_DIR/latest-emergency-backup"
}

# Function to list available rollback points
list_rollback_points() {
    log "Available rollback points:"
    echo ""
    
    # Git tags for upgrade phases
    echo "🏷️  Git Tags (Upgrade Phases):"
    git tag -l "*upgrade*" --sort=-creatordate | head -10
    echo ""
    
    # Backup files
    echo "📦 File Backups:"
    ls -la "$BACKUP_DIR"/*.json 2>/dev/null | head -10 || echo "No file backups found"
    echo ""
    
    # Recent commits
    echo "🔄 Recent Commits:"
    git log --oneline --grep="dependency\|upgrade" -10
}

# Function to rollback to specific git tag
rollback_to_tag() {
    local tag=$1
    
    if [[ -z "$tag" ]]; then
        error "No tag specified for rollback"
    fi
    
    log "Rolling back to git tag: $tag"
    
    # Verify tag exists
    if ! git tag -l | grep -q "^$tag$"; then
        error "Tag '$tag' not found"
    fi
    
    # Create emergency backup
    create_emergency_backup
    
    # Checkout files from tag
    git checkout "$tag" -- package.json package-lock.json
    
    # Find and restore app/lib package files from that commit
    local tag_commit=$(git rev-list -n 1 "$tag")
    
    # Restore app package files
    for app_pkg in apps/*/package.json; do
        if git show "$tag_commit:$app_pkg" > /dev/null 2>&1; then
            git show "$tag_commit:$app_pkg" > "$app_pkg"
            log "Restored $app_pkg from $tag"
        fi
    done
    
    # Restore lib package files
    for lib_pkg in libs/*/package.json; do
        if git show "$tag_commit:$lib_pkg" > /dev/null 2>&1; then
            git show "$tag_commit:$lib_pkg" > "$lib_pkg"
            log "Restored $lib_pkg from $tag"
        fi
    done
    
    success "Files restored from tag: $tag"
}

# Function to rollback to file backup
rollback_to_backup() {
    local backup_name=$1
    
    if [[ -z "$backup_name" ]]; then
        error "No backup name specified"
    fi
    
    log "Rolling back to file backup: $backup_name"
    
    # Create emergency backup
    create_emergency_backup
    
    # Restore main package files
    if [[ -f "$BACKUP_DIR/${backup_name}-package.json" ]]; then
        cp "$BACKUP_DIR/${backup_name}-package.json" package.json
        success "Restored package.json"
    else
        error "Backup file not found: $BACKUP_DIR/${backup_name}-package.json"
    fi
    
    if [[ -f "$BACKUP_DIR/${backup_name}-package-lock.json" ]]; then
        cp "$BACKUP_DIR/${backup_name}-package-lock.json" package-lock.json
        success "Restored package-lock.json"
    fi
    
    # Restore app package files
    find "$BACKUP_DIR" -name "${backup_name}-apps-*-package.json" | while read backup_file; do
        local original_path=$(echo "$backup_file" | sed "s|$BACKUP_DIR/${backup_name}-||")
        cp "$backup_file" "$original_path"
        log "Restored $original_path"
    done
}

# Function to rollback to previous commit
rollback_to_commit() {
    local commit_hash=$1
    
    if [[ -z "$commit_hash" ]]; then
        error "No commit hash specified"
    fi
    
    log "Rolling back to commit: $commit_hash"
    
    # Verify commit exists
    if ! git cat-file -e "$commit_hash" 2>/dev/null; then
        error "Commit '$commit_hash' not found"
    fi
    
    # Create emergency backup
    create_emergency_backup
    
    # Restore package files from commit
    git checkout "$commit_hash" -- package.json package-lock.json apps/*/package.json libs/*/package.json
    
    success "Files restored from commit: $commit_hash"
}

# Function to clean install dependencies
clean_install() {
    log "Performing clean dependency installation..."
    
    # Remove node_modules
    log "Removing node_modules directories..."
    rm -rf node_modules
    find apps/ -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
    find libs/ -name node_modules -type d -exec rm -rf {} + 2>/dev/null || true
    
    # Clean npm cache
    log "Cleaning npm cache..."
    npm cache clean --force
    
    # Fresh install
    log "Installing dependencies..."
    npm ci
    
    success "Clean installation completed"
}

# Function to verify rollback
verify_rollback() {
    log "Verifying rollback..."
    
    local errors=0
    
    # Check package.json validity
    if ! node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"; then
        error "package.json is invalid"
        ((errors++))
    fi
    
    # Check if dependencies can be installed
    if ! npm ls > /dev/null 2>&1; then
        warn "Dependency tree has issues, but this might be expected"
    fi
    
    # Run basic linting
    log "Running linting check..."
    if npm run lint > /dev/null 2>&1; then
        success "Linting passed"
    else
        warn "Linting failed - may need code fixes"
        ((errors++))
    fi
    
    # Run tests
    log "Running basic tests..."
    if timeout 300 npm test > /dev/null 2>&1; then
        success "Tests passed"
    else
        warn "Tests failed - may need code fixes"
        ((errors++))
    fi
    
    if [[ $errors -eq 0 ]]; then
        success "Rollback verification passed"
        return 0
    else
        warn "Rollback verification completed with $errors issues"
        return 1
    fi
}

# Function to generate rollback report
generate_report() {
    local rollback_method=$1
    local rollback_target=$2
    
    cat > "$ROLLBACK_LOG" << EOF
# Dependency Rollback Report

**Timestamp**: $(date -u)
**Method**: $rollback_method
**Target**: $rollback_target
**User**: $(whoami)
**Working Directory**: $(pwd)

## Pre-Rollback State

**Git Status**:
$(git status --porcelain)

**Current Branch**: $(git branch --show-current)

**Package Versions Before Rollback**:
- Node.js: $(node --version)
- npm: $(npm --version)
- nx: $(npx nx --version | head -1)

## Rollback Actions

1. Emergency backup created
2. Dependencies restored from $rollback_target
3. Clean dependency installation performed
4. Verification tests executed

## Post-Rollback State

**Dependency Count**:
$(npm ls --depth=0 --json 2>/dev/null | jq -r '.dependencies | keys | length' || echo "Unknown")

**Critical Dependencies**:
- @nestjs/core: $(npm list @nestjs/core --depth=0 2>/dev/null | grep @nestjs/core || echo "Not found")
- nx: $(npm list nx --depth=0 2>/dev/null | grep nx || echo "Not found")
- typescript: $(npm list typescript --depth=0 2>/dev/null | grep typescript || echo "Not found")

## Verification Results

$(verify_rollback 2>&1)

## Next Steps

1. Review and test application functionality
2. Check for any code compatibility issues
3. Update team on rollback completion
4. Plan next upgrade attempt if needed

---
*Generated by Capsule Platform Rollback Script*
EOF

    success "Rollback report saved to: $ROLLBACK_LOG"
}

# Function for interactive rollback
interactive_rollback() {
    echo "🔄 Interactive Dependency Rollback"
    echo "=================================="
    echo ""
    
    list_rollback_points
    echo ""
    
    echo "Rollback options:"
    echo "1. Rollback to git tag (upgrade phase)"
    echo "2. Rollback to file backup"
    echo "3. Rollback to specific commit"
    echo "4. Emergency rollback (to last known good state)"
    echo "5. Cancel"
    echo ""
    
    read -p "Choose an option (1-5): " choice
    
    case $choice in
        1)
            read -p "Enter git tag name: " tag_name
            rollback_to_tag "$tag_name"
            rollback_method="git-tag"
            rollback_target="$tag_name"
            ;;
        2)
            read -p "Enter backup name: " backup_name
            rollback_to_backup "$backup_name"
            rollback_method="file-backup"
            rollback_target="$backup_name"
            ;;
        3)
            read -p "Enter commit hash: " commit_hash
            rollback_to_commit "$commit_hash"
            rollback_method="commit"
            rollback_target="$commit_hash"
            ;;
        4)
            # Find the most recent stable backup
            local latest_backup=$(cat "$BACKUP_DIR/latest-emergency-backup" 2>/dev/null || echo "")
            if [[ -n "$latest_backup" ]]; then
                rollback_to_tag "$latest_backup"
                rollback_method="emergency"
                rollback_target="$latest_backup"
            else
                error "No emergency backup found"
            fi
            ;;
        5)
            log "Rollback cancelled"
            exit 0
            ;;
        *)
            error "Invalid option"
            ;;
    esac
    
    # Perform clean install and verification
    clean_install
    
    if verify_rollback; then
        generate_report "$rollback_method" "$rollback_target"
        success "Rollback completed successfully!"
    else
        warn "Rollback completed with issues. Check the report for details."
        generate_report "$rollback_method" "$rollback_target"
    fi
}

# Main function
main() {
    case "${1:-interactive}" in
        "list"|"ls")
            list_rollback_points
            ;;
        "tag")
            rollback_to_tag "$2"
            clean_install
            verify_rollback
            generate_report "git-tag" "$2"
            ;;
        "backup")
            rollback_to_backup "$2"
            clean_install
            verify_rollback
            generate_report "file-backup" "$2"
            ;;
        "commit")
            rollback_to_commit "$2"
            clean_install
            verify_rollback
            generate_report "commit" "$2"
            ;;
        "emergency")
            local latest_backup=$(cat "$BACKUP_DIR/latest-emergency-backup" 2>/dev/null || echo "")
            if [[ -n "$latest_backup" ]]; then
                rollback_to_tag "$latest_backup"
                clean_install
                verify_rollback
                generate_report "emergency" "$latest_backup"
            else
                error "No emergency backup found"
            fi
            ;;
        "interactive"|"")
            interactive_rollback
            ;;
        *)
            echo "Usage: $0 {list|tag <tag>|backup <name>|commit <hash>|emergency|interactive}"
            echo ""
            echo "  list         - List available rollback points"
            echo "  tag <tag>    - Rollback to specific git tag"
            echo "  backup <name>- Rollback to file backup"
            echo "  commit <hash>- Rollback to specific commit"
            echo "  emergency    - Rollback to last emergency backup"
            echo "  interactive  - Interactive rollback (default)"
            echo ""
            echo "Examples:"
            echo "  $0 list"
            echo "  $0 tag upgrade/phase-1-complete"
            echo "  $0 backup pre-upgrade-20240912"
            echo "  $0 commit abc1234"
            echo "  $0 emergency"
            exit 1
            ;;
    esac
}

# Trap errors and provide guidance
trap 'error "Rollback script failed! Check $ROLLBACK_LOG for details."' ERR

# Execute main function
main "$@"