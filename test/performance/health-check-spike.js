import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const healthCheckFailures = new Counter('health_check_failures');
const healthCheckDuration = new Trend('health_check_duration');
const concurrentRequests = new Counter('concurrent_requests');

// Spike test configuration - simulates sudden load spikes
export const options = {
  stages: [
    { duration: '30s', target: 1 },   // Baseline
    { duration: '10s', target: 50 },  // Spike to 50 users quickly
    { duration: '30s', target: 50 },  // Stay at spike level
    { duration: '10s', target: 1 },   // Drop back to baseline
    { duration: '30s', target: 1 },   // Baseline recovery
    { duration: '10s', target: 100 }, // Larger spike
    { duration: '20s', target: 100 }, // Stay at larger spike
    { duration: '20s', target: 0 },   // Ramp down
  ],
  thresholds: {
    // Allow higher failure rate during spikes
    'health_check_failures': ['count<50'],
    
    // Response time should still be reasonable
    'health_check_duration': ['p(90)<8000'],
    
    // HTTP errors should be manageable
    'http_req_failed': ['rate<0.2'],
    
    // Most requests should complete within reasonable time
    'http_req_duration': ['p(95)<10000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  concurrentRequests.add(1);
  
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/health`, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-spike-test',
    },
    timeout: '15s', // Longer timeout for spike conditions
  });
  
  const duration = Date.now() - startTime;
  healthCheckDuration.add(duration);

  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response time acceptable': (r) => r.timings.duration < 15000,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  if (!success) {
    healthCheckFailures.add(1);
    console.warn(`Health check failed - Status: ${response.status}, Duration: ${duration}ms`);
  }

  // Validate response structure when successful
  if (response.status === 200) {
    try {
      const healthData = JSON.parse(response.body);
      
      const validStructure = check(healthData, {
        'has required fields': (data) => 
          data.status && data.services && data.timestamp,
        'services object not empty': (data) => 
          Object.keys(data.services || {}).length > 0,
      });

      if (!validStructure) {
        healthCheckFailures.add(1);
      }

      // Log system status during high load
      if (Math.random() < 0.05) { // 5% of requests
        const healthyCount = Object.values(healthData.services || {})
          .filter(s => s?.status === 'healthy').length;
        const totalCount = Object.keys(healthData.services || {}).length;
        
        console.log(`Spike test - System: ${healthData.status}, Services: ${healthyCount}/${totalCount} healthy, Duration: ${duration}ms, VUs: ${__VU}`);
      }
    } catch (e) {
      healthCheckFailures.add(1);
      console.error('Failed to parse response during spike test:', e);
    }
  }

  // Variable sleep to simulate different user behaviors
  const sleepTime = Math.random() * 3; // 0-3 seconds
  sleep(sleepTime);
}

export function setup() {
  console.log('Starting health check spike test...');
  console.log('This test simulates sudden load spikes to verify system resilience');
  
  // Verify service availability
  const response = http.get(`${BASE_URL}/health/ready`, { timeout: '5s' });
  if (response.status !== 200) {
    console.error('Service not ready for spike testing!');
    return null;
  }
  
  return { baseUrl: BASE_URL };
}

export function teardown(data) {
  console.log('Spike test completed');
  console.log('Check the results to verify the system handled load spikes gracefully');
}