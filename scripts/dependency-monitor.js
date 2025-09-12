#!/usr/bin/env node
/**
 * Dependency Monitoring Dashboard
 * Monitors dependency health, security, and upgrade opportunities
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class DependencyMonitor {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            security: {},
            outdated: {},
            health: {},
            recommendations: [],
            summary: {
                totalDependencies: 0,
                outdatedCount: 0,
                vulnerabilities: 0,
                healthScore: 0
            }
        };
        
        // Ensure recommendations array is always initialized
        this.results.recommendations = [];
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            warning: '\x1b[33m',
            error: '\x1b[31m',
            reset: '\x1b[0m'
        };
        
        console.log(`${colors[type]}[${new Date().toISOString()}] ${message}${colors.reset}`);
    }

    async runCommand(command, options = {}) {
        try {
            const result = execSync(command, {
                encoding: 'utf8',
                timeout: options.timeout || 120000,
                stdio: options.silent ? 'pipe' : 'inherit',
                ...options
            });
            return { stdout: result, exitCode: 0 };
        } catch (error) {
            return {
                stdout: error.stdout || '',
                stderr: error.stderr || error.message,
                exitCode: error.status || 1
            };
        }
    }

    async checkSecurity() {
        this.log('Checking security vulnerabilities...');
        
        try {
            const result = await this.runCommand('npm audit --json', { silent: true });
            const auditData = JSON.parse(result.stdout);
            
            this.results.security = {
                vulnerabilities: auditData.vulnerabilities || {},
                metadata: auditData.metadata || {},
                advisories: auditData.advisories || {},
                summary: {
                    info: auditData.metadata?.vulnerabilities?.info || 0,
                    low: auditData.metadata?.vulnerabilities?.low || 0,
                    moderate: auditData.metadata?.vulnerabilities?.moderate || 0,
                    high: auditData.metadata?.vulnerabilities?.high || 0,
                    critical: auditData.metadata?.vulnerabilities?.critical || 0,
                    total: auditData.metadata?.vulnerabilities?.total || 0
                }
            };
            
            this.results.summary.vulnerabilities = this.results.security.summary.total;
            
            if (this.results.security.summary.total > 0) {
                this.log(`Found ${this.results.security.summary.total} vulnerabilities`, 'warning');
                
                // Initialize recommendations array if not exists
                this.results.recommendations = this.results.recommendations || [];
                
                // Generate security recommendations
                if (this.results.security.summary.critical > 0) {
                    this.results.recommendations.push({
                        priority: 'CRITICAL',
                        type: 'security',
                        message: `${this.results.security.summary.critical} critical vulnerabilities found. Update immediately!`,
                        action: 'Run npm audit fix or update affected packages'
                    });
                }
                
                if (this.results.security.summary.high > 0) {
                    this.results.recommendations.push({
                        priority: 'HIGH',
                        type: 'security',
                        message: `${this.results.security.summary.high} high-severity vulnerabilities found`,
                        action: 'Schedule security updates within 24 hours'
                    });
                }
            } else {
                this.log('No security vulnerabilities found', 'success');
            }
            
        } catch (error) {
            this.log(`Security check failed: ${error.message}`, 'error');
            this.results.security.error = error.message;
        }
    }

    async checkOutdated() {
        this.log('Checking for outdated dependencies...');
        
        try {
            const result = await this.runCommand('npm outdated --json', { silent: true });
            
            // npm outdated returns non-zero exit code when packages are outdated
            // but that's expected, so we parse the output regardless
            let outdatedData = {};
            
            if (result.stdout) {
                try {
                    outdatedData = JSON.parse(result.stdout);
                } catch (parseError) {
                    // If JSON parsing fails, try to extract from stderr
                    if (result.stderr && result.stderr.includes('{')) {
                        const jsonMatch = result.stderr.match(/(\{.*\})/s);
                        if (jsonMatch) {
                            outdatedData = JSON.parse(jsonMatch[1]);
                        }
                    }
                }
            }
            
            this.results.outdated = outdatedData;
            this.results.summary.outdatedCount = Object.keys(outdatedData).length;
            
            if (this.results.summary.outdatedCount > 0) {
                this.log(`Found ${this.results.summary.outdatedCount} outdated packages`, 'warning');
                
                // Initialize recommendations array if not exists
                this.results.recommendations = this.results.recommendations || [];
                
                // Categorize updates
                const updateCategories = this.categorizeUpdates(outdatedData);
                
                if (updateCategories.major.length > 0) {
                    this.results.recommendations.push({
                        priority: 'MEDIUM',
                        type: 'major-update',
                        message: `${updateCategories.major.length} packages have major version updates available`,
                        action: 'Review breaking changes and plan major version updates',
                        packages: updateCategories.major
                    });
                }
                
                if (updateCategories.minor.length > 0) {
                    this.results.recommendations.push({
                        priority: 'LOW',
                        type: 'minor-update',
                        message: `${updateCategories.minor.length} packages have minor version updates available`,
                        action: 'Safe to update in next maintenance window',
                        packages: updateCategories.minor
                    });
                }
                
                if (updateCategories.patch.length > 0) {
                    this.results.recommendations.push({
                        priority: 'LOW',
                        type: 'patch-update',
                        message: `${updateCategories.patch.length} packages have patch updates available`,
                        action: 'Safe to update immediately',
                        packages: updateCategories.patch
                    });
                }
            } else {
                this.log('All dependencies are up to date', 'success');
            }
            
        } catch (error) {
            this.log(`Outdated check failed: ${error.message}`, 'error');
            this.results.outdated.error = error.message;
        }
    }

    categorizeUpdates(outdatedData) {
        const categories = { major: [], minor: [], patch: [] };
        
        if (!outdatedData || typeof outdatedData !== 'object') {
            return categories;
        }
        
        for (const [packageName, info] of Object.entries(outdatedData)) {
            if (!info || typeof info !== 'object') {
                continue;
            }
            
            const updateType = this.getUpdateType(info.current, info.latest);
            
            // Ensure the update type exists in categories
            if (!categories[updateType]) {
                categories[updateType] = [];
            }
            
            categories[updateType].push({
                name: packageName,
                current: info.current,
                latest: info.latest,
                wanted: info.wanted
            });
        }
        
        return categories;
    }

    getUpdateType(current, latest) {
        try {
            if (!current || !latest) {
                return 'patch'; // Default fallback
            }
            
            const currentParts = current.split('.').map(Number);
            const latestParts = latest.split('.').map(Number);
            
            if (latestParts[0] > currentParts[0]) return 'major';
            if (latestParts[1] > currentParts[1]) return 'minor';
            if (latestParts[2] > currentParts[2]) return 'patch';
            
            return 'patch'; // Default fallback
        } catch (error) {
            return 'patch'; // Safe fallback
        }
    }

    async checkHealth() {
        this.log('Checking dependency health...');
        
        try {
            // Check for missing dependencies
            const lsResult = await this.runCommand('npm ls --json', { silent: true });
            let dependencyTree = {};
            
            try {
                dependencyTree = JSON.parse(lsResult.stdout);
            } catch (parseError) {
                this.log('Could not parse dependency tree', 'warning');
            }
            
            // Count total dependencies
            const dependencies = dependencyTree.dependencies || {};
            this.results.summary.totalDependencies = Object.keys(dependencies).length;
            
            // Check for issues
            const issues = this.analyzeHealthIssues(dependencyTree);
            
            this.results.health = {
                issues: issues,
                totalDependencies: this.results.summary.totalDependencies,
                healthScore: this.calculateHealthScore(issues)
            };
            
            this.results.summary.healthScore = this.results.health.healthScore;
            
            if (issues.length > 0) {
                this.log(`Found ${issues.length} dependency health issues`, 'warning');
                
                // Initialize recommendations array if not exists
                this.results.recommendations = this.results.recommendations || [];
                
                // Generate health recommendations
                const criticalIssues = issues.filter(issue => issue.severity === 'critical');
                if (criticalIssues.length > 0) {
                    this.results.recommendations.push({
                        priority: 'HIGH',
                        type: 'health',
                        message: `${criticalIssues.length} critical dependency issues found`,
                        action: 'Fix dependency conflicts and missing packages',
                        issues: criticalIssues
                    });
                }
            } else {
                this.log('Dependency health check passed', 'success');
            }
            
        } catch (error) {
            this.log(`Health check failed: ${error.message}`, 'error');
            this.results.health.error = error.message;
        }
    }

    analyzeHealthIssues(dependencyTree) {
        const issues = [];
        
        const checkDependencies = (deps, path = []) => {
            for (const [name, info] of Object.entries(deps || {})) {
                const currentPath = [...path, name];
                
                // Check for missing dependencies
                if (info.missing) {
                    issues.push({
                        type: 'missing',
                        severity: 'critical',
                        package: name,
                        path: currentPath.join(' > '),
                        message: `Package ${name} is missing`
                    });
                }
                
                // Check for version conflicts
                if (info.problems && info.problems.length > 0) {
                    info.problems.forEach(problem => {
                        issues.push({
                            type: 'conflict',
                            severity: 'high',
                            package: name,
                            path: currentPath.join(' > '),
                            message: problem
                        });
                    });
                }
                
                // Check for outdated peer dependencies
                if (info.peerMissing && Object.keys(info.peerMissing).length > 0) {
                    Object.keys(info.peerMissing).forEach(peerName => {
                        issues.push({
                            type: 'peer-missing',
                            severity: 'medium',
                            package: name,
                            peerPackage: peerName,
                            path: currentPath.join(' > '),
                            message: `Peer dependency ${peerName} is missing for ${name}`
                        });
                    });
                }
                
                // Recursively check nested dependencies
                if (info.dependencies) {
                    checkDependencies(info.dependencies, currentPath);
                }
            }
        };
        
        checkDependencies(dependencyTree.dependencies);
        
        return issues;
    }

    calculateHealthScore(issues) {
        let score = 100;
        
        issues.forEach(issue => {
            switch (issue.severity) {
                case 'critical':
                    score -= 20;
                    break;
                case 'high':
                    score -= 10;
                    break;
                case 'medium':
                    score -= 5;
                    break;
                case 'low':
                    score -= 1;
                    break;
            }
        });
        
        return Math.max(0, score);
    }

    async generateReport() {
        const report = `# Dependency Monitoring Report

**Generated**: ${this.results.timestamp}  
**Health Score**: ${this.results.summary.healthScore}/100 ${this.getHealthEmoji()}

## Summary

| Metric | Count | Status |
|--------|-------|--------|
| Total Dependencies | ${this.results.summary.totalDependencies} | ℹ️ |
| Outdated Packages | ${this.results.summary.outdatedCount} | ${this.results.summary.outdatedCount > 0 ? '⚠️' : '✅'} |
| Security Vulnerabilities | ${this.results.summary.vulnerabilities} | ${this.results.summary.vulnerabilities > 0 ? '🚨' : '✅'} |
| Health Issues | ${this.results.health.issues?.length || 0} | ${this.results.health.issues?.length > 0 ? '⚠️' : '✅'} |

## Security Status

${this.generateSecuritySection()}

## Outdated Dependencies

${this.generateOutdatedSection()}

## Dependency Health

${this.generateHealthSection()}

## Recommendations

${this.generateRecommendationsSection()}

## Quick Actions

### Immediate Actions (Critical)
\`\`\`bash
${this.generateCriticalActions()}
\`\`\`

### Maintenance Actions (This Week)
\`\`\`bash
${this.generateMaintenanceActions()}
\`\`\`

### Planning Actions (Next Sprint)
\`\`\`bash
${this.generatePlanningActions()}
\`\`\`

---
*Next monitoring check recommended: ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toDateString()}*
`;

        return report;
    }

    getHealthEmoji() {
        const score = this.results.summary.healthScore;
        if (score >= 90) return '🟢';
        if (score >= 70) return '🟡';
        if (score >= 50) return '🟠';
        return '🔴';
    }

    generateSecuritySection() {
        const security = this.results.security;
        
        if (security.error) {
            return `**Error**: ${security.error}`;
        }
        
        if (security.summary?.total === 0) {
            return '✅ No security vulnerabilities found';
        }
        
        const summary = security.summary;
        return `
**Vulnerability Summary**:
- Critical: ${summary.critical || 0} 🔴
- High: ${summary.high || 0} 🟠  
- Moderate: ${summary.moderate || 0} 🟡
- Low: ${summary.low || 0} 🟢
- Info: ${summary.info || 0} ℹ️

**Action Required**: ${summary.critical > 0 ? 'IMMEDIATE' : summary.high > 0 ? 'URGENT' : 'PLANNED'}
`;
    }

    generateOutdatedSection() {
        const outdated = this.results.outdated;
        
        if (outdated.error) {
            return `**Error**: ${outdated.error}`;
        }
        
        if (Object.keys(outdated).length === 0) {
            return '✅ All dependencies are up to date';
        }
        
        const categories = this.categorizeUpdates(outdated);
        
        return `
**Update Categories**:
- Major Updates: ${categories.major.length} packages
- Minor Updates: ${categories.minor.length} packages  
- Patch Updates: ${categories.patch.length} packages

**Top Priority Updates**:
${categories.major.slice(0, 5).map(pkg => 
    `- \`${pkg.name}\`: ${pkg.current} → ${pkg.latest} (major)`
).join('\n') || 'None'}
`;
    }

    generateHealthSection() {
        const health = this.results.health;
        
        if (health.error) {
            return `**Error**: ${health.error}`;
        }
        
        if (!health.issues || health.issues.length === 0) {
            return '✅ All dependency health checks passed';
        }
        
        const criticalIssues = health.issues.filter(i => i.severity === 'critical');
        const highIssues = health.issues.filter(i => i.severity === 'high');
        
        return `
**Health Issues**:
- Critical: ${criticalIssues.length}
- High: ${highIssues.length}
- Total: ${health.issues.length}

**Critical Issues**:
${criticalIssues.slice(0, 3).map(issue => 
    `- ${issue.type}: ${issue.message}`
).join('\n') || 'None'}
`;
    }

    generateRecommendationsSection() {
        if (this.results.recommendations.length === 0) {
            return '✅ No specific recommendations at this time';
        }
        
        return this.results.recommendations
            .sort((a, b) => {
                const priority = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                return priority[a.priority] - priority[b.priority];
            })
            .map(rec => `
### ${rec.priority}: ${rec.message}
**Action**: ${rec.action}
${rec.packages ? `**Affected**: ${rec.packages.slice(0, 3).map(p => p.name).join(', ')}` : ''}
`)
            .join('\n');
    }

    generateCriticalActions() {
        const actions = [];
        
        if (this.results.security.summary?.critical > 0) {
            actions.push('# Fix critical security vulnerabilities');
            actions.push('npm audit fix --force');
        }
        
        if (this.results.health.issues?.some(i => i.severity === 'critical')) {
            actions.push('# Fix missing dependencies');
            actions.push('npm install');
        }
        
        return actions.length > 0 ? actions.join('\n') : '# No critical actions required';
    }

    generateMaintenanceActions() {
        const actions = [];
        
        if (this.results.security.summary?.high > 0) {
            actions.push('# Address high-severity security issues');
            actions.push('npm audit fix');
        }
        
        const outdated = this.results.outdated;
        const categories = this.categorizeUpdates(outdated);
        
        if (categories.patch.length > 0) {
            actions.push('# Update patch versions (safe)');
            actions.push('npm update');
        }
        
        return actions.length > 0 ? actions.join('\n') : '# No maintenance actions required';
    }

    generatePlanningActions() {
        const actions = [];
        
        const outdated = this.results.outdated;
        const categories = this.categorizeUpdates(outdated);
        
        if (categories.major.length > 0) {
            actions.push('# Plan major version upgrades');
            actions.push('./scripts/upgrade-dependencies.sh phase3');
        }
        
        if (categories.minor.length > 0) {
            actions.push('# Schedule minor version updates');
            actions.push('./scripts/upgrade-dependencies.sh phase2');
        }
        
        return actions.length > 0 ? actions.join('\n') : '# No planning actions required';
    }

    async saveResults() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const resultsFile = `dependency-monitor-${timestamp}.json`;
        const reportFile = `dependency-report-${timestamp}.md`;
        
        // Save JSON results
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
        
        // Save markdown report
        const report = await this.generateReport();
        fs.writeFileSync(reportFile, report);
        
        // Save latest results
        fs.writeFileSync('dependency-monitor-latest.json', JSON.stringify(this.results, null, 2));
        fs.writeFileSync('dependency-report-latest.md', report);
        
        this.log(`Results saved to: ${resultsFile}`, 'info');
        this.log(`Report saved to: ${reportFile}`, 'info');
    }

    async run() {
        this.log('Starting dependency monitoring...', 'info');
        
        await this.checkSecurity();
        await this.checkOutdated();  
        await this.checkHealth();
        
        await this.saveResults();
        
        // Print summary to console
        console.log('\n📊 Dependency Monitoring Summary');
        console.log('================================');
        console.log(`Health Score: ${this.results.summary.healthScore}/100 ${this.getHealthEmoji()}`);
        console.log(`Total Dependencies: ${this.results.summary.totalDependencies}`);
        console.log(`Outdated Packages: ${this.results.summary.outdatedCount}`);
        console.log(`Security Vulnerabilities: ${this.results.summary.vulnerabilities}`);
        console.log(`Recommendations: ${this.results.recommendations.length}`);
        
        if (this.results.recommendations.length > 0) {
            console.log('\n🔥 Top Recommendations:');
            this.results.recommendations.slice(0, 3).forEach(rec => {
                console.log(`  ${rec.priority}: ${rec.message}`);
            });
        }
        
        console.log('\n📄 Full report saved to: dependency-report-latest.md\n');
        
        return this.results;
    }
}

// CLI Usage
async function main() {
    const command = process.argv[2];
    
    const monitor = new DependencyMonitor();
    
    try {
        switch (command) {
            case 'security':
                await monitor.checkSecurity();
                console.log(JSON.stringify(monitor.results.security, null, 2));
                break;
                
            case 'outdated':
                await monitor.checkOutdated();
                console.log(JSON.stringify(monitor.results.outdated, null, 2));
                break;
                
            case 'health':
                await monitor.checkHealth();
                console.log(JSON.stringify(monitor.results.health, null, 2));
                break;
                
            case 'report':
                await monitor.run();
                const report = await monitor.generateReport();
                console.log(report);
                break;
                
            case 'watch':
                // Run monitoring every hour
                console.log('Starting dependency watch mode...');
                setInterval(async () => {
                    await monitor.run();
                }, 60 * 60 * 1000); // 1 hour
                
                // Run once immediately
                await monitor.run();
                break;
                
            default:
                await monitor.run();
                break;
        }
    } catch (error) {
        monitor.log(`Monitoring failed: ${error.message}`, 'error');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DependencyMonitor;