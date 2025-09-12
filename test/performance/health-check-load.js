import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const healthCheckFailureRate = new Rate('health_check_failures');
const healthCheckDuration = new Trend('health_check_duration', true);
const serviceHealthyRate = new Rate('services_healthy');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 20 }, // Ramp up to 20 users
    { duration: '3m', target: 20 }, // Stay at 20 users
    { duration: '1m', target: 0 }, // Ramp down
  ],
  thresholds: {
    // Health check should succeed at least 95% of the time
    health_check_failures: ['rate<0.05'],

    // Average response time should be under 2 seconds
    health_check_duration: ['avg<2000'],

    // 95th percentile should be under 5 seconds
    health_check_duration: ['p(95)<5000'],

    // Most services should be healthy most of the time
    services_healthy: ['rate>0.8'],

    // HTTP error rate should be low
    http_req_failed: ['rate<0.1'],

    // Request duration targets
    http_req_duration: ['med<1000', 'p(95)<3000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test the main health check endpoint
  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/health`, {
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'k6-health-check-test',
    },
    timeout: '10s',
  });

  const duration = Date.now() - startTime;
  healthCheckDuration.add(duration);

  // Check response status
  const statusOk = check(response, {
    'status is 200': (r) => r.status === 200,
    'has valid content-type': (r) =>
      r.headers['Content-Type']?.includes('application/json'),
    'response time < 10s': (r) => r.timings.duration < 10000,
  });

  if (!statusOk) {
    healthCheckFailureRate.add(1);
  } else {
    healthCheckFailureRate.add(0);
  }

  // Parse and validate response body
  let healthData;
  try {
    healthData = JSON.parse(response.body);
  } catch (e) {
    console.error('Failed to parse health check response:', e);
    healthCheckFailureRate.add(1);
    return;
  }

  // Validate response structure
  const structureValid = check(healthData, {
    'has status field': (data) => data.status !== undefined,
    'has services field': (data) => data.services !== undefined,
    'has timestamp field': (data) => data.timestamp !== undefined,
    'status is valid': (data) =>
      ['healthy', 'degraded', 'unhealthy'].includes(data.status),
    'timestamp is recent': (data) => {
      const responseTime = new Date(data.timestamp).getTime();
      const now = Date.now();
      return Math.abs(now - responseTime) < 60000; // Within 1 minute
    },
  });

  if (!structureValid) {
    healthCheckFailureRate.add(1);
    return;
  }

  // Check individual service health
  const services = healthData.services || {};
  const expectedServices = [
    'auth-service',
    'billing-service',
    'deploy-service',
    'monitor-service',
  ];

  let healthyServices = 0;
  let totalServices = expectedServices.length;

  for (const serviceName of expectedServices) {
    const serviceHealth = services[serviceName];

    const serviceValid = check(serviceHealth, {
      [`${serviceName} exists`]: (service) => service !== undefined,
      [`${serviceName} has status`]: (service) => service?.status !== undefined,
      [`${serviceName} has timestamp`]: (service) =>
        service?.timestamp !== undefined,
      [`${serviceName} has service field`]: (service) =>
        service?.service === serviceName,
    });

    if (serviceValid && serviceHealth?.status === 'healthy') {
      healthyServices++;
    }
  }

  // Record service health rate
  serviceHealthyRate.add(healthyServices / totalServices);

  // Log important metrics occasionally
  if (Math.random() < 0.1) {
    // 10% of requests
    console.log(
      `Health check - Status: ${healthData.status}, Duration: ${duration}ms, Healthy Services: ${healthyServices}/${totalServices}`,
    );
  }

  // Test the ready endpoint occasionally
  if (Math.random() < 0.2) {
    // 20% of requests
    const readyResponse = http.get(`${BASE_URL}/health/ready`, {
      timeout: '2s',
    });

    check(readyResponse, {
      'ready endpoint status is 200': (r) => r.status === 200,
      'ready endpoint responds quickly': (r) => r.timings.duration < 100,
    });
  }

  // Brief pause between requests
  sleep(Math.random() * 2 + 1); // 1-3 seconds
}

// Setup function (runs once before test)
export function setup() {
  console.log('Starting health check load test...');
  console.log(`Base URL: ${BASE_URL}`);

  // Verify the service is accessible
  const response = http.get(`${BASE_URL}/health/ready`);
  if (response.status !== 200) {
    console.error('Service is not ready for testing!');
    return null;
  }

  console.log('Service is ready, beginning load test');
  return { baseUrl: BASE_URL };
}

// Teardown function (runs once after test)
export function teardown(data) {
  console.log('Health check load test completed');
}
