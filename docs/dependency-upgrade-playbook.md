# Dependency Upgrade Playbook
*Complete Guide for Safe Dependency Management*

## Quick Reference

### 🚀 Quick Start
```bash
# Check current status
./scripts/dependency-monitor.js

# Run safe patch updates (Phase 1)
./scripts/upgrade-dependencies.sh phase1

# Emergency rollback (if needed)
./scripts/rollback-dependencies.sh emergency
```

### 📋 Daily Commands
```bash
# Monitor dependencies
npm run deps:monitor      # Check for security issues and updates
npm run deps:security     # Security audit only  
npm run deps:outdated     # Check for outdated packages
```

### 🔧 Maintenance Commands  
```bash
# Weekly maintenance
./scripts/upgrade-dependencies.sh phase1  # Safe patches

# Monthly maintenance  
./scripts/upgrade-dependencies.sh phase2  # Minor updates

# Quarterly maintenance
./scripts/upgrade-dependencies.sh phase3  # Major updates
```

## File Structure

```
docs/
├── dependency-upgrade-strategy.md     # Main strategy document
├── migrations/
│   ├── zod-v3-to-v4-migration.md    # Zod upgrade guide
│   └── webpack-cli-v5-to-v6-migration.md
└── dependency-upgrade-playbook.md    # This file

scripts/
├── upgrade-dependencies.sh           # Main upgrade script
├── rollback-dependencies.sh         # Rollback script  
├── test-upgrade-compatibility.js     # Testing suite
└── dependency-monitor.js            # Monitoring dashboard
```

## Workflow Process

### Phase 1: Safe Patches (Weekly)
**Duration**: 30 minutes  
**Risk**: 🟢 LOW  

```bash
# 1. Check current status
./scripts/dependency-monitor.js

# 2. Run preflight checks
./scripts/upgrade-dependencies.sh preflight

# 3. Execute patch updates
./scripts/upgrade-dependencies.sh phase1

# 4. Verify everything works
npm test && npm run build:all
```

### Phase 2: Minor Updates (Monthly)  
**Duration**: 2-4 hours  
**Risk**: 🟡 MODERATE

```bash
# 1. Create test baseline
./scripts/test-upgrade-compatibility.js baseline

# 2. Execute minor updates
./scripts/upgrade-dependencies.sh phase2

# 3. Run comprehensive tests
./scripts/test-upgrade-compatibility.js test

# 4. Deploy to staging for testing
npm run infrastructure:up
# ... test application ...
npm run infrastructure:down
```

### Phase 3: Major Updates (Quarterly)
**Duration**: 1-2 weeks  
**Risk**: 🟠 HIGH

```bash
# 1. Review breaking changes
cat docs/migrations/*.md

# 2. Plan upgrade strategy
./scripts/upgrade-dependencies.sh phase3

# 3. Execute migrations manually
# Follow specific migration guides

# 4. Comprehensive testing
./scripts/test-upgrade-compatibility.js test
npm run test:e2e
npm run test:integration
```

## Emergency Procedures

### Security Vulnerability Response
```bash
# 1. Check vulnerability severity  
npm audit

# 2. Fix critical/high vulnerabilities immediately
npm audit fix --force

# 3. Test and deploy
npm test && npm run build:all

# 4. If issues occur, rollback
./scripts/rollback-dependencies.sh emergency
```

### Upgrade Failure Response
```bash
# 1. Immediate rollback
./scripts/rollback-dependencies.sh emergency

# 2. Verify rollback worked
npm test && npm run build:all

# 3. Investigate failure
cat upgrade-test-results-*.json
cat rollback-*.log

# 4. Plan remediation
# Review specific migration guides
# Plan incremental approach
```

## Monitoring and Alerts

### Daily Monitoring
```bash
# Add to crontab for daily monitoring
0 9 * * * cd /path/to/project && ./scripts/dependency-monitor.js >> /var/log/dependency-monitor.log 2>&1
```

### Weekly Reports
```bash
# Generate weekly dependency report
./scripts/dependency-monitor.js report > weekly-deps-$(date +%Y%m%d).md
```

### Alert Thresholds
- **Critical Vulnerabilities**: Immediate action required
- **High Vulnerabilities**: Fix within 24 hours
- **Major Updates Available**: Plan in next sprint
- **Health Score < 70**: Investigation required

## Team Responsibilities

### Development Team
- **Daily**: Check dependency monitor output
- **Weekly**: Review and approve Phase 1 updates
- **Monthly**: Test Phase 2 updates in development
- **Quarterly**: Plan Phase 3 major updates

### DevOps Team  
- **Daily**: Monitor security alerts
- **Weekly**: Execute Phase 1 updates
- **Monthly**: Deploy Phase 2 updates to staging
- **Quarterly**: Coordinate Phase 3 rollouts

### Product Team
- **Monthly**: Review dependency update impact on roadmap
- **Quarterly**: Approve major upgrade timelines

## Testing Strategy

### Automated Testing
```bash
# Pre-upgrade baseline
./scripts/test-upgrade-compatibility.js baseline

# Post-upgrade verification
./scripts/test-upgrade-compatibility.js test

# Continuous integration
# Add to CI pipeline to run after dependency changes
```

### Manual Testing Checklist
- [ ] All services start successfully
- [ ] API endpoints respond correctly
- [ ] Database migrations work
- [ ] RabbitMQ messaging functions
- [ ] Build process completes
- [ ] No console errors in development
- [ ] Performance within acceptable ranges

### Staging Environment Testing
- [ ] Deploy to staging environment
- [ ] Run full integration test suite
- [ ] Performance testing
- [ ] Load testing (if applicable)
- [ ] User acceptance testing
- [ ] Rollback testing

## Communication Plan

### Before Major Updates
1. **Notification**: Send team notification 1 week prior
2. **Planning**: Schedule update window with minimal impact
3. **Documentation**: Review migration guides with team
4. **Backup**: Ensure rollback procedures are tested

### During Updates
1. **Progress Updates**: Regular status updates in team chat
2. **Issue Tracking**: Document any issues encountered
3. **Decision Points**: Get team approval for major changes
4. **Communication**: Keep stakeholders informed

### After Updates  
1. **Success Report**: Share completion status
2. **Issue Summary**: Document any problems resolved
3. **Lessons Learned**: Update procedures based on experience
4. **Next Steps**: Plan future update cycles

## Troubleshooting Guide

### Common Issues

#### "ERESOLVE unable to resolve dependency tree"
```bash
# Try clearing cache and reinstalling
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

#### TypeScript compilation errors after updates
```bash
# Check TypeScript version compatibility
npm list typescript
# Update TypeScript if needed
npm install typescript@latest --save-dev
```

#### Tests failing after updates
```bash
# Check for breaking changes in test frameworks
npm list jest @types/jest
# Update test configurations if needed
```

#### Build process failures
```bash
# Check webpack/build tool versions
npm list webpack webpack-cli @nx/webpack
# Review build configurations
```

### Recovery Procedures

#### Partial Upgrade Failure
1. Identify which packages were successfully updated
2. Rollback only the problematic packages
3. Test with partial updates
4. Plan individual package upgrades

#### Complete Upgrade Failure
1. Execute emergency rollback
2. Verify system stability
3. Investigate root cause
4. Plan alternative upgrade approach

#### Performance Regression
1. Compare performance metrics with baseline
2. Identify specific packages causing issues
3. Rollback problematic packages
4. Plan performance-focused updates

## Best Practices

### Planning
- **Batch Similar Updates**: Group related packages together
- **Test Incrementally**: Test each phase before proceeding
- **Schedule Appropriately**: Avoid updates before major releases
- **Document Changes**: Keep detailed records of all changes

### Execution
- **Create Backups**: Always create rollback points
- **Test Thoroughly**: Run comprehensive test suites
- **Monitor Closely**: Watch for issues during and after updates
- **Communicate Clearly**: Keep team informed of progress

### Maintenance
- **Regular Reviews**: Weekly dependency health checks
- **Security Focus**: Prioritize security updates always
- **Documentation**: Keep migration guides current
- **Tool Updates**: Keep upgrade scripts updated

## Integration with Development Workflow

### Git Workflow
```bash
# Feature branch for dependency updates
git checkout -b upgrade/dependencies-$(date +%Y%m%d)

# Commit each phase separately
git add . && git commit -m "chore: Phase 1 dependency updates"
git add . && git commit -m "chore: Phase 2 dependency updates"

# Create pull request with detailed description
gh pr create --title "Dependency Updates - $(date +%Y-%m-%d)"
```

### CI/CD Integration
```yaml
# .github/workflows/dependency-updates.yml
name: Weekly Dependency Updates
on:
  schedule:
    - cron: '0 9 * * MON'  # Monday 9 AM
  workflow_dispatch:

jobs:
  update-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: ./scripts/upgrade-dependencies.sh phase1
      - run: ./scripts/test-upgrade-compatibility.js test
      - uses: peter-evans/create-pull-request@v5
        with:
          title: 'Weekly dependency updates'
          body: 'Automated safe patch updates'
```

### Nx Integration
```bash
# Use Nx affected to test only changed projects
nx affected:test --base=HEAD~1
nx affected:build --base=HEAD~1
nx affected:lint --base=HEAD~1
```

## Metrics and KPIs

### Success Metrics
- **Update Frequency**: Weekly patches, monthly minor updates
- **Security Response Time**: < 24 hours for high/critical vulnerabilities
- **Test Coverage**: 100% test success rate after updates
- **Rollback Rate**: < 5% of updates require rollback

### Health Metrics
- **Dependency Health Score**: Target > 90/100
- **Outdated Package Count**: Target < 10% of total packages
- **Security Vulnerability Count**: Target = 0
- **Build Time Impact**: < 10% increase after updates

### Monitoring Dashboard
```bash
# Daily health check
./scripts/dependency-monitor.js | grep "Health Score"

# Weekly summary report
./scripts/dependency-monitor.js report
```

## Resources

### External Tools
- **npm audit**: Built-in security checking
- **npm outdated**: Built-in update checking  
- **Renovate**: Automated dependency updates
- **Snyk**: Advanced security scanning
- **npm-check-updates**: Interactive update tool

### Documentation
- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Semantic Versioning](https://semver.org/)
- [Node.js LTS Schedule](https://nodejs.org/en/about/releases/)

### Team Resources
- **Internal Wiki**: Link to internal dependency policies
- **Slack Channel**: #dependency-updates for discussions
- **Calendar**: Scheduled maintenance windows
- **Runbook**: Emergency response procedures

---

*This playbook should be reviewed and updated quarterly as tools and processes evolve.*