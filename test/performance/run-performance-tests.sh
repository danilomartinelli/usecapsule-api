#!/bin/bash

# Performance Test Runner for Capsule Platform
# Runs various k6 performance tests against the health check endpoints

set -e

# Configuration
BASE_URL="${BASE_URL:-http://localhost:3000}"
RESULTS_DIR="test/performance/results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Create results directory
mkdir -p "$RESULTS_DIR"

echo -e "${BLUE}🚀 Starting Capsule Platform Performance Tests${NC}"
echo "Base URL: $BASE_URL"
echo "Timestamp: $TIMESTAMP"
echo "Results will be saved to: $RESULTS_DIR"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6 is not installed. Please install k6 first.${NC}"
    echo "Visit: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Check if service is running
echo -e "${YELLOW}🔍 Checking if service is available...${NC}"
if ! curl -s "$BASE_URL/health/ready" > /dev/null; then
    echo -e "${RED}❌ Service is not available at $BASE_URL${NC}"
    echo "Please start the service before running performance tests"
    exit 1
fi
echo -e "${GREEN}✅ Service is available${NC}"
echo ""

# Function to run a k6 test
run_k6_test() {
    local test_name=$1
    local test_file=$2
    local description=$3
    
    echo -e "${BLUE}📊 Running $test_name${NC}"
    echo "Description: $description"
    echo "Test file: $test_file"
    
    local result_file="$RESULTS_DIR/${test_name}_${TIMESTAMP}.json"
    local summary_file="$RESULTS_DIR/${test_name}_${TIMESTAMP}_summary.txt"
    
    # Run the test with JSON output and summary
    if k6 run \
        --env BASE_URL="$BASE_URL" \
        --out json="$result_file" \
        --summary-export="$summary_file" \
        "$test_file"; then
        echo -e "${GREEN}✅ $test_name completed successfully${NC}"
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
    
    echo "Results saved to: $result_file"
    echo "Summary saved to: $summary_file"
    echo ""
}

# Run Load Test
run_k6_test "load-test" \
    "test/performance/health-check-load.js" \
    "Tests normal operational load with gradual ramp up"

# Run Spike Test
run_k6_test "spike-test" \
    "test/performance/health-check-spike.js" \
    "Tests system behavior under sudden load spikes"

# Only run soak test if requested (it's long-running)
if [[ "${RUN_SOAK_TEST:-false}" == "true" ]]; then
    echo -e "${YELLOW}⚠️  Starting soak test - this will run for ~13 minutes${NC}"
    run_k6_test "soak-test" \
        "test/performance/health-check-soak.js" \
        "Long-running test to detect memory leaks and performance degradation"
else
    echo -e "${YELLOW}ℹ️  Skipping soak test (long-running)${NC}"
    echo "To run soak test, set RUN_SOAK_TEST=true"
    echo ""
fi

# Generate combined report
echo -e "${BLUE}📋 Generating Performance Report${NC}"

report_file="$RESULTS_DIR/performance_report_${TIMESTAMP}.md"

cat > "$report_file" << EOF
# Capsule Platform Performance Test Report

**Generated:** $(date)
**Base URL:** $BASE_URL
**Test Session:** $TIMESTAMP

## Test Summary

This report contains results from automated performance testing of the Capsule Platform health check endpoints.

### Tests Executed

1. **Load Test** - Normal operational load testing
2. **Spike Test** - Sudden load spike testing
$(if [[ "${RUN_SOAK_TEST:-false}" == "true" ]]; then echo "3. **Soak Test** - Extended duration testing"; fi)

### Key Metrics

- **Response Time**: Time taken for health check requests
- **Failure Rate**: Percentage of failed requests
- **Service Health**: Availability of individual microservices
- **System Status**: Overall platform health

### Files Generated

EOF

# List all generated files
find "$RESULTS_DIR" -name "*${TIMESTAMP}*" -type f | while read -r file; do
    echo "- $(basename "$file")" >> "$report_file"
done

cat >> "$report_file" << EOF

### Performance Thresholds

The tests use the following performance thresholds:

#### Load Test
- Health check failure rate < 5%
- Average response time < 2000ms
- 95th percentile < 5000ms
- Service healthy rate > 80%

#### Spike Test
- Total failures < 50 requests
- 90th percentile < 8000ms
- HTTP error rate < 20%

#### Soak Test (if run)
- Average response time < 1500ms
- System degradation rate < 10%
- Response size stability (no memory leaks)

### How to Analyze Results

1. Check the summary files for threshold violations
2. Review JSON files with k6 dashboard or custom analysis tools
3. Monitor for patterns in failure rates and response times
4. Verify service availability remains high throughout tests

### Recommendations

- Run load tests regularly as part of CI/CD pipeline
- Execute spike tests before major releases
- Run soak tests weekly or before critical deployments
- Monitor real-world performance against these baseline metrics

EOF

echo -e "${GREEN}✅ Performance report generated: $report_file${NC}"

# Display quick summary
echo -e "${BLUE}📊 Quick Summary${NC}"
echo "All performance test results are available in: $RESULTS_DIR"
echo ""

# Show any threshold failures
echo -e "${YELLOW}🔍 Checking for threshold violations...${NC}"
if find "$RESULTS_DIR" -name "*${TIMESTAMP}_summary.txt" -exec grep -l "✗" {} \; | head -1 > /dev/null; then
    echo -e "${RED}⚠️  Some thresholds were violated. Check the summary files for details.${NC}"
    find "$RESULTS_DIR" -name "*${TIMESTAMP}_summary.txt" -exec grep "✗" {} \;
else
    echo -e "${GREEN}✅ All performance thresholds were met${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Performance testing completed!${NC}"
echo "Review the generated files for detailed analysis."