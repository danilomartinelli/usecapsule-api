import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics for long-running soak test
const healthCheckFailures = new Counter('health_check_failures');
const healthCheckDuration = new Trend('health_check_duration');
const memoryLeakIndicator = new Trend('response_size');
const systemDegradation = new Rate('system_degraded');

// Soak test configuration - runs for extended period with moderate load
export const options = {
  stages: [
    { duration: '2m', target: 5 },   // Gentle ramp up
    { duration: '10m', target: 5 },  // Maintain load for extended period
    { duration: '1m', target: 0 },   // Ramp down
  ],
  thresholds: {
    // Stricter thresholds for soak test - should maintain performance over time
    'health_check_failures': ['count<10'],
    'health_check_duration': ['avg<1500', 'p(95)<3000'],
    'http_req_failed': ['rate<0.05'],
    'http_req_duration': ['p(90)<2000'],
    
    // Monitor for system degradation
    'system_degraded': ['rate<0.1'],
    
    // Check for potential memory leaks via response size growth
    'response_size': ['p(95)<50000'], // Responses shouldn't grow significantly
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
let baselineResponseSize = 0;
let testStartTime = Date.now();

export default function () {
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/health`, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-soak-test',
    },
    timeout: '10s',
  });
  
  const duration = Date.now() - startTime;
  const responseSize = response.body ? response.body.length : 0;
  
  healthCheckDuration.add(duration);
  memoryLeakIndicator.add(responseSize);

  // Track baseline response size
  if (baselineResponseSize === 0 && response.status === 200) {
    baselineResponseSize = responseSize;
  }

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time stable': (r) => r.timings.duration < 5000,
    'response size stable': (r) => {
      if (baselineResponseSize === 0) return true;
      return Math.abs(responseSize - baselineResponseSize) < baselineResponseSize * 0.5; // Within 50%
    },
  });

  if (!success) {
    healthCheckFailures.add(1);
  }

  // Parse and analyze response
  if (response.status === 200) {
    try {
      const healthData = JSON.parse(response.body);
      
      // Monitor system degradation over time
      const isDegraded = healthData.status === 'degraded' || healthData.status === 'unhealthy';
      systemDegradation.add(isDegraded ? 1 : 0);

      // Periodic detailed logging
      const testRunningTime = Date.now() - testStartTime;
      if (testRunningTime % 60000 < 2000) { // Every minute (with 2s tolerance)
        const healthyServices = Object.values(healthData.services || {})
          .filter(s => s?.status === 'healthy').length;
        const totalServices = Object.keys(healthData.services || {}).length;
        
        console.log(`Soak Test - Runtime: ${Math.floor(testRunningTime/60000)}m, ` +
                   `System: ${healthData.status}, ` +
                   `Services: ${healthyServices}/${totalServices}, ` +
                   `Avg Duration: ${duration}ms, ` +
                   `Response Size: ${responseSize}b`);
      }

      // Detailed structure validation for soak test
      const structureValid = check(healthData, {
        'services structure intact': (data) => {
          const services = data.services || {};
          const expectedServices = ['auth-service', 'billing-service', 'deploy-service', 'monitor-service'];
          return expectedServices.every(svc => services[svc] && services[svc].service === svc);
        },
        'timestamps are fresh': (data) => {
          const timestamp = new Date(data.timestamp).getTime();
          return Math.abs(Date.now() - timestamp) < 30000; // Within 30 seconds
        },
        'no memory leak indicators': (data) => {
          // Check that response doesn't contain growing arrays or objects
          const responseStr = JSON.stringify(data);
          return responseStr.length < 10000; // Response shouldn't be too large
        },
      });

      if (!structureValid) {
        console.warn('Structure validation failed during soak test');
      }

    } catch (e) {
      console.error('Response parsing failed in soak test:', e);
      healthCheckFailures.add(1);
    }
  }

  // Test ready endpoint occasionally to ensure it remains responsive
  if (Math.random() < 0.1) { // 10% of requests
    const readyResponse = http.get(`${BASE_URL}/health/ready`, { timeout: '2s' });
    
    check(readyResponse, {
      'ready endpoint still responsive': (r) => r.status === 200,
      'ready endpoint fast': (r) => r.timings.duration < 500,
    });
  }

  // Consistent sleep pattern for soak test
  sleep(5); // 5 second intervals for sustained load
}

export function setup() {
  console.log('Starting health check soak test...');
  console.log('This test runs for an extended period to detect memory leaks and performance degradation');
  
  testStartTime = Date.now();
  
  // Initial health check
  const response = http.get(`${BASE_URL}/health`, { timeout: '10s' });
  if (response.status !== 200) {
    console.error('Service not ready for soak testing!');
    return null;
  }

  // Record initial response characteristics
  baselineResponseSize = response.body ? response.body.length : 0;
  console.log(`Baseline response size: ${baselineResponseSize} bytes`);
  
  return { 
    baseUrl: BASE_URL,
    startTime: testStartTime,
    baselineSize: baselineResponseSize
  };
}

export function teardown(data) {
  const totalRunTime = Date.now() - data.startTime;
  console.log(`Soak test completed after ${Math.floor(totalRunTime/60000)} minutes`);
  console.log('Review metrics for signs of memory leaks or performance degradation');
  
  // Final health check
  const finalResponse = http.get(`${BASE_URL}/health`);
  if (finalResponse.status === 200) {
    const finalSize = finalResponse.body ? finalResponse.body.length : 0;
    console.log(`Final response size: ${finalSize} bytes (baseline: ${data.baselineSize})`);
    
    if (finalSize > data.baselineSize * 1.5) {
      console.warn('Potential memory leak detected - response size increased significantly');
    }
  }
}