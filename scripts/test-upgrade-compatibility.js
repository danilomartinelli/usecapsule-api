#!/usr/bin/env node
/**
 * Automated Dependency Upgrade Testing Suite
 * Tests compatibility and performance after dependency updates
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class UpgradeTestSuite {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            phase: process.env.UPGRADE_PHASE || 'unknown',
            tests: {},
            metrics: {},
            passed: true,
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0
            }
        };
        
        this.baselineFile = path.join(process.cwd(), 'upgrade-baseline.json');
        this.baseline = this.loadBaseline();
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[34m',
            success: '\x1b[32m',
            warning: '\x1b[33m',
            error: '\x1b[31m',
            reset: '\x1b[0m'
        };

        console.log(`${colors[type]}[${new Date().toISOString()}] ${message}${colors.reset}`);
    }

    loadBaseline() {
        if (fs.existsSync(this.baselineFile)) {
            try {
                return JSON.parse(fs.readFileSync(this.baselineFile, 'utf8'));
            } catch (error) {
                this.log(`Failed to load baseline: ${error.message}`, 'warning');
            }
        }
        return null;
    }

    saveBaseline(data) {
        fs.writeFileSync(this.baselineFile, JSON.stringify(data, null, 2));
        this.log('Baseline saved', 'success');
    }

    async runCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            
            try {
                const result = execSync(command, {
                    encoding: 'utf8',
                    timeout: options.timeout || 300000, // 5 minutes default
                    ...options
                });
                
                const duration = Date.now() - startTime;
                resolve({ stdout: result, duration, exitCode: 0 });
            } catch (error) {
                const duration = Date.now() - startTime;
                resolve({
                    stdout: error.stdout || '',
                    stderr: error.stderr || error.message,
                    duration,
                    exitCode: error.status || 1
                });
            }
        });
    }

    async testLinting() {
        this.log('Running linting tests...');
        
        const result = await this.runCommand('npm run lint');
        const passed = result.exitCode === 0;
        
        this.results.tests.linting = {
            passed,
            duration: result.duration,
            output: result.stderr || result.stdout
        };
        
        if (!passed) {
            this.log('Linting failed', 'error');
            this.results.passed = false;
        } else {
            this.log('Linting passed', 'success');
        }

        return passed;
    }

    async testTypeChecking() {
        this.log('Running TypeScript type checking...');
        
        // Check if we have a typecheck script
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const hasTypecheckScript = packageJson.scripts && packageJson.scripts.typecheck;
        
        if (!hasTypecheckScript) {
            this.log('No typecheck script found, running tsc directly', 'warning');
            // Try to run TypeScript compiler directly
            const result = await this.runCommand('npx tsc --noEmit');
            const passed = result.exitCode === 0;
            
            this.results.tests.typecheck = {
                passed,
                duration: result.duration,
                output: result.stderr || result.stdout,
                method: 'tsc-direct'
            };
            
            return passed;
        }
        
        const result = await this.runCommand('npm run typecheck');
        const passed = result.exitCode === 0;
        
        this.results.tests.typecheck = {
            passed,
            duration: result.duration,
            output: result.stderr || result.stdout,
            method: 'npm-script'
        };
        
        if (!passed) {
            this.log('Type checking failed', 'error');
            this.results.passed = false;
        } else {
            this.log('Type checking passed', 'success');
        }

        return passed;
    }

    async testUnitTests() {
        this.log('Running unit tests...');
        
        const result = await this.runCommand('npm test -- --passWithNoTests');
        const passed = result.exitCode === 0;
        
        // Parse test results
        const testOutput = result.stdout + result.stderr;
        const testMatch = testOutput.match(/Tests:\s+(\d+)\s+passed(?:,\s+(\d+)\s+failed)?(?:,\s+(\d+)\s+skipped)?/);
        
        this.results.tests.unit = {
            passed,
            duration: result.duration,
            output: testOutput,
            counts: testMatch ? {
                passed: parseInt(testMatch[1]) || 0,
                failed: parseInt(testMatch[2]) || 0,
                skipped: parseInt(testMatch[3]) || 0
            } : null
        };
        
        if (!passed) {
            this.log('Unit tests failed', 'error');
            this.results.passed = false;
        } else {
            this.log('Unit tests passed', 'success');
        }

        return passed;
    }

    async testBuild() {
        this.log('Testing build process...');
        
        const result = await this.runCommand('npm run build:all');
        const passed = result.exitCode === 0;
        
        this.results.tests.build = {
            passed,
            duration: result.duration,
            output: result.stderr || result.stdout
        };
        
        if (!passed) {
            this.log('Build failed', 'error');
            this.results.passed = false;
        } else {
            this.log('Build passed', 'success');
        }

        return passed;
    }

    async measureBundleSize() {
        this.log('Measuring bundle sizes...');
        
        const distPaths = [
            'dist/apps/api-gateway',
            'dist/apps/auth-service',
            'dist/apps/billing-service',
            'dist/apps/deploy-service',
            'dist/apps/monitor-service'
        ];
        
        const bundleSizes = {};
        
        for (const distPath of distPaths) {
            if (fs.existsSync(distPath)) {
                try {
                    const stats = await this.runCommand(`du -s ${distPath}`);
                    const sizeMatch = stats.stdout.match(/^(\d+)/);
                    const serviceName = distPath.split('/').pop();
                    
                    bundleSizes[serviceName] = {
                        sizeKB: sizeMatch ? parseInt(sizeMatch[1]) : 0,
                        path: distPath
                    };
                } catch (error) {
                    this.log(`Failed to measure ${distPath}: ${error.message}`, 'warning');
                }
            }
        }
        
        this.results.metrics.bundleSize = bundleSizes;
        
        // Compare with baseline if available
        if (this.baseline && this.baseline.metrics.bundleSize) {
            const comparison = this.compareBundleSizes(this.baseline.metrics.bundleSize, bundleSizes);
            this.results.metrics.bundleSizeComparison = comparison;
            this.log(`Bundle size comparison: ${comparison.summary}`, 
                    comparison.significant ? 'warning' : 'info');
        }
        
        return bundleSizes;
    }

    compareBundleSizes(baseline, current) {
        const changes = {};
        let significantChanges = 0;
        
        for (const [service, currentData] of Object.entries(current)) {
            const baselineData = baseline[service];
            if (baselineData) {
                const change = currentData.sizeKB - baselineData.sizeKB;
                const changePercent = (change / baselineData.sizeKB) * 100;
                
                changes[service] = {
                    baseline: baselineData.sizeKB,
                    current: currentData.sizeKB,
                    change: change,
                    changePercent: changePercent.toFixed(2)
                };
                
                if (Math.abs(changePercent) > 10) { // 10% threshold
                    significantChanges++;
                }
            }
        }
        
        return {
            changes,
            significant: significantChanges > 0,
            summary: `${significantChanges} services with >10% size changes`
        };
    }

    async testPerformance() {
        this.log('Running performance tests...');
        
        // Measure cold start time
        const startTime = Date.now();
        const buildResult = await this.runCommand('npm run build:all');
        const buildTime = Date.now() - startTime;
        
        this.results.metrics.performance = {
            buildTime,
            buildSuccess: buildResult.exitCode === 0
        };
        
        // Compare with baseline
        if (this.baseline && this.baseline.metrics.performance) {
            const baselineBuildTime = this.baseline.metrics.performance.buildTime;
            const changePercent = ((buildTime - baselineBuildTime) / baselineBuildTime) * 100;
            
            this.results.metrics.performance.comparison = {
                baseline: baselineBuildTime,
                change: buildTime - baselineBuildTime,
                changePercent: changePercent.toFixed(2)
            };
            
            if (Math.abs(changePercent) > 20) { // 20% threshold for build time
                this.log(`Build time changed significantly: ${changePercent.toFixed(2)}%`, 'warning');
            }
        }
        
        return this.results.metrics.performance;
    }

    async testInfrastructure() {
        this.log('Testing infrastructure connectivity...');
        
        try {
            // Start infrastructure
            this.log('Starting infrastructure...');
            await this.runCommand('npm run infrastructure:up');
            
            // Wait for services to be ready
            this.log('Waiting for services to start...');
            await this.sleep(15000); // 15 seconds
            
            const tests = {
                gateway: await this.testHealthEndpoint('http://localhost:3000/health'),
                rabbitmq: await this.testHealthEndpoint('http://localhost:7020/api/overview')
            };
            
            this.results.tests.infrastructure = tests;
            
            // Clean up
            await this.runCommand('npm run infrastructure:down');
            
            const allPassed = Object.values(tests).every(test => test.passed);
            if (!allPassed) {
                this.results.passed = false;
            }
            
            return allPassed;
            
        } catch (error) {
            this.log(`Infrastructure test failed: ${error.message}`, 'error');
            this.results.tests.infrastructure = { 
                error: error.message,
                passed: false
            };
            this.results.passed = false;
            return false;
        }
    }

    async testHealthEndpoint(url) {
        try {
            const result = await this.runCommand(`curl -f -s --max-time 5 ${url}`, { timeout: 10000 });
            return {
                url,
                passed: result.exitCode === 0,
                response: result.stdout,
                error: result.stderr
            };
        } catch (error) {
            return {
                url,
                passed: false,
                error: error.message
            };
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async runFullSuite() {
        this.log('Starting dependency upgrade test suite...', 'info');
        
        const tests = [
            { name: 'linting', fn: () => this.testLinting() },
            { name: 'typecheck', fn: () => this.testTypeChecking() },
            { name: 'unit', fn: () => this.testUnitTests() },
            { name: 'build', fn: () => this.testBuild() }
        ];
        
        // Run core tests
        for (const test of tests) {
            this.results.summary.total++;
            try {
                const passed = await test.fn();
                if (passed) {
                    this.results.summary.passed++;
                } else {
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`Test ${test.name} threw error: ${error.message}`, 'error');
                this.results.summary.failed++;
                this.results.passed = false;
            }
        }
        
        // Measure performance and bundle sizes
        await this.measureBundleSize();
        await this.testPerformance();
        
        // Optional infrastructure test
        const skipInfra = process.env.SKIP_INFRASTRUCTURE_TEST === 'true';
        if (!skipInfra) {
            this.results.summary.total++;
            try {
                const passed = await this.testInfrastructure();
                if (passed) {
                    this.results.summary.passed++;
                } else {
                    this.results.summary.failed++;
                }
            } catch (error) {
                this.log(`Infrastructure test failed: ${error.message}`, 'error');
                this.results.summary.failed++;
                this.results.passed = false;
            }
        }
        
        return this.results;
    }

    generateReport() {
        const report = `
# Dependency Upgrade Test Report

**Timestamp**: ${this.results.timestamp}
**Phase**: ${this.results.phase}
**Overall Result**: ${this.results.passed ? '✅ PASSED' : '❌ FAILED'}

## Summary
- **Total Tests**: ${this.results.summary.total}
- **Passed**: ${this.results.summary.passed}
- **Failed**: ${this.results.summary.failed}
- **Skipped**: ${this.results.summary.skipped}

## Test Results

### Linting
${this.results.tests.linting ? 
  `- **Status**: ${this.results.tests.linting.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration**: ${this.results.tests.linting.duration}ms` : 'Not run'}

### Type Checking  
${this.results.tests.typecheck ? 
  `- **Status**: ${this.results.tests.typecheck.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration**: ${this.results.tests.typecheck.duration}ms
- **Method**: ${this.results.tests.typecheck.method}` : 'Not run'}

### Unit Tests
${this.results.tests.unit ?
  `- **Status**: ${this.results.tests.unit.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration**: ${this.results.tests.unit.duration}ms
${this.results.tests.unit.counts ? 
  `- **Tests Passed**: ${this.results.tests.unit.counts.passed}
- **Tests Failed**: ${this.results.tests.unit.counts.failed}
- **Tests Skipped**: ${this.results.tests.unit.counts.skipped}` : ''}` : 'Not run'}

### Build Process
${this.results.tests.build ?
  `- **Status**: ${this.results.tests.build.passed ? '✅ PASSED' : '❌ FAILED'}
- **Duration**: ${this.results.tests.build.duration}ms` : 'Not run'}

### Infrastructure
${this.results.tests.infrastructure ?
  `- **API Gateway**: ${this.results.tests.infrastructure.gateway?.passed ? '✅' : '❌'}
- **RabbitMQ**: ${this.results.tests.infrastructure.rabbitmq?.passed ? '✅' : '❌'}` : 'Not run'}

## Metrics

### Performance
${this.results.metrics.performance ?
  `- **Build Time**: ${this.results.metrics.performance.buildTime}ms
${this.results.metrics.performance.comparison ?
  `- **vs Baseline**: ${this.results.metrics.performance.comparison.changePercent}%` : ''}` : 'Not measured'}

### Bundle Sizes
${this.results.metrics.bundleSize ?
Object.entries(this.results.metrics.bundleSize)
  .map(([service, data]) => `- **${service}**: ${data.sizeKB} KB`)
  .join('\n') : 'Not measured'}

---
*Generated by Capsule Platform Upgrade Test Suite*
`;

        return report;
    }

    async saveResults() {
        const resultsFile = `upgrade-test-results-${Date.now()}.json`;
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
        
        const reportFile = `upgrade-test-report-${Date.now()}.md`;
        fs.writeFileSync(reportFile, this.generateReport());
        
        this.log(`Results saved to: ${resultsFile}`, 'info');
        this.log(`Report saved to: ${reportFile}`, 'info');
    }
}

// Main execution
async function main() {
    const command = process.argv[2];
    const suite = new UpgradeTestSuite();
    
    try {
        switch (command) {
            case 'baseline':
                suite.log('Creating baseline measurements...', 'info');
                const baselineResults = await suite.runFullSuite();
                suite.saveBaseline(baselineResults);
                break;
                
            case 'test':
                suite.log('Running test suite...', 'info');
                const results = await suite.runFullSuite();
                await suite.saveResults();
                
                if (results.passed) {
                    suite.log('All tests passed! ✅', 'success');
                    process.exit(0);
                } else {
                    suite.log('Some tests failed! ❌', 'error');
                    process.exit(1);
                }
                break;
                
            default:
                console.log(`Usage: ${process.argv[1]} {baseline|test}`);
                console.log('');
                console.log('  baseline  - Create baseline measurements');
                console.log('  test      - Run full test suite');
                process.exit(1);
        }
    } catch (error) {
        suite.log(`Test suite failed: ${error.message}`, 'error');
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = UpgradeTestSuite;