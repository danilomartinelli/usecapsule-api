# Circuit Breaker Pattern Implementation Guide

This document provides comprehensive guidance for implementing and configuring the circuit breaker pattern in the Capsule Platform's RabbitMQ microservices architecture.

## Overview

The circuit breaker pattern prevents cascading failures in distributed systems by monitoring service calls and automatically "opening" when failures exceed a threshold, allowing the system to fail fast and recover gracefully.

## Architecture Integration

Our circuit breaker implementation integrates seamlessly with:

- **@golevelup/nestjs-rabbitmq**: Exchange-based messaging
- **Timeout System**: Intelligent timeout resolution
- **Health Checks**: Service monitoring and status reporting
- **Metrics Collection**: Performance monitoring and alerting

## Key Features

### 1. **Automatic Failure Detection**

- Monitors error rates and response times
- Configurable thresholds per service
- Multiple circuit breaker states (CLOSED, OPEN, HALF_OPEN)

### 2. **Intelligent Recovery**

- Exponential backoff strategies
- Service-specific recovery policies
- Manual reset capabilities

### 3. **Comprehensive Monitoring**

- Real-time metrics collection
- Alert generation and notification
- Historical trend analysis

### 4. **Service-Specific Configuration**

- Per-service timeout and threshold settings
- Operation-specific configurations
- Environment-aware scaling

## Configuration

### Environment Variables

```bash
# Global Circuit Breaker Configuration
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_MONITORING=true
CIRCUIT_BREAKER_METRICS_INTERVAL=60000
CIRCUIT_BREAKER_HEALTH_INTERVAL=30000
CIRCUIT_BREAKER_ALERT_THRESHOLD=80

# Default Circuit Breaker Settings
CIRCUIT_BREAKER_ERROR_THRESHOLD=50
CIRCUIT_BREAKER_RESET_TIMEOUT=60000
CIRCUIT_BREAKER_VOLUME_THRESHOLD=10
CIRCUIT_BREAKER_ROLLING_WINDOW=60000
CIRCUIT_BREAKER_ROLLING_BUCKETS=10
CIRCUIT_BREAKER_ENABLE_MONITORING=true

# Service-Specific Timeouts (integrated with existing timeout system)
AUTH_SERVICE_TIMEOUT=2000
BILLING_SERVICE_TIMEOUT=8000
DEPLOY_SERVICE_TIMEOUT=15000
MONITOR_SERVICE_TIMEOUT=10000
```

### Service Configuration Examples

#### API Gateway Configuration

```typescript
// apps/api-gateway/src/app/app.module.ts
import { RabbitMQModule } from '@usecapsule/rabbitmq';

@Module({
  imports: [
    RabbitMQModule.forGateway({
      uri:
        process.env.RABBITMQ_URL ||
        'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
      enableCircuitBreaker: true, // Enable circuit breaker protection
    }),
  ],
})
export class AppModule {}
```

#### Microservice Configuration

```typescript
// apps/auth-service/src/app/app.module.ts
import { RabbitMQModule } from '@usecapsule/rabbitmq';

@Module({
  imports: [
    RabbitMQModule.forMicroservice({
      uri:
        process.env.RABBITMQ_URL ||
        'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
      serviceName: 'auth-service',
      enableCircuitBreaker: true,
    }),
  ],
})
export class AppModule {}
```

## Usage Examples

### Using Circuit Breaker Aware AMQP Service

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { CircuitBreakerAwareAmqpService } from '@usecapsule/rabbitmq';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly amqpService: CircuitBreakerAwareAmqpService) {}

  async registerUser(userData: RegisterUserDto): Promise<User> {
    try {
      const response = await this.amqpService.request({
        exchange: 'capsule.commands',
        routingKey: 'auth.register',
        payload: userData,
        serviceName: 'auth-service',
      });

      this.logger.log('User registration completed', {
        success: response.fromFallback ? 'fallback' : 'service',
        circuitState: response.circuitState,
        duration: response.actualDuration,
      });

      return response.data;
    } catch (error) {
      this.logger.error('User registration failed', {
        error: error.message,
        circuitState: error.circuitBreakerResult?.circuitState,
        fromFallback: error.circuitBreakerResult?.fromFallback,
      });
      throw error;
    }
  }

  async checkAuthServiceHealth(): Promise<boolean> {
    try {
      const response = await this.amqpService.healthCheck(
        'auth-service',
        'auth.health',
      );
      return response.data.status === 'healthy' && !response.fromFallback;
    } catch (error) {
      this.logger.warn('Auth service health check failed', {
        error: error.message,
      });
      return false;
    }
  }
}
```

### Health Check Integration

```typescript
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { CircuitBreakerHealthService } from '@usecapsule/rabbitmq';

@Injectable()
export class AppHealthService extends HealthIndicator {
  constructor(
    private readonly circuitBreakerHealth: CircuitBreakerHealthService,
  ) {
    super();
  }

  async checkCircuitBreakers(): Promise<HealthIndicatorResult> {
    return this.circuitBreakerHealth.checkCircuitBreakers('circuitBreakers');
  }

  async checkAuthService(): Promise<HealthIndicatorResult> {
    const health = this.circuitBreakerHealth.getServiceHealth('auth-service');
    const isHealthy = health?.status === 'healthy';

    return this.getResult('auth-circuit-breaker', isHealthy, {
      state: health?.state,
      errorPercentage: health?.metrics.errorPercentage,
      averageResponseTime: health?.metrics.averageResponseTime,
    });
  }
}
```

### Advanced Circuit Breaker Controller

```typescript
import { Controller, Get, Post, Param } from '@nestjs/common';
import { CircuitBreakerEnhancedHealthController } from '@usecapsule/rabbitmq';

// The enhanced health controller is available for detailed monitoring
@Controller('admin')
export class AdminController {
  constructor(
    private readonly circuitBreakerController: CircuitBreakerEnhancedHealthController,
  ) {}

  @Get('circuit-breakers/status')
  getCircuitBreakerStatus() {
    return this.circuitBreakerController.getHealth();
  }

  @Get('circuit-breakers/summary')
  getCircuitBreakerSummary() {
    return this.circuitBreakerController.getSummaryReport();
  }

  @Post('circuit-breakers/reset/:serviceName')
  resetServiceCircuitBreakers(@Param('serviceName') serviceName: string) {
    return this.circuitBreakerController.resetServiceCircuitBreakers(
      serviceName,
    );
  }
}
```

## Service-Specific Configurations

### Auth Service (Critical Service)

```typescript
// Highly sensitive to failures, fast recovery
const authServiceConfig = {
  timeout: 2000, // Fast timeout for auth operations
  errorThresholdPercentage: 40, // Open at 40% error rate
  resetTimeout: 30000, // 30 second reset window
  volumeThreshold: 5, // Low volume threshold
  recoveryStrategy: {
    type: 'exponential_backoff',
    baseDelay: 500,
    maxDelay: 30000,
    multiplier: 1.5,
    maxAttempts: 3,
  },
};
```

### Billing Service (Financial Operations)

```typescript
// Conservative approach for financial operations
const billingServiceConfig = {
  timeout: 8000, // Longer timeout for complex operations
  errorThresholdPercentage: 60, // More tolerant of errors
  resetTimeout: 120000, // 2 minute reset window
  volumeThreshold: 3, // Very low threshold due to criticality
  recoveryStrategy: {
    type: 'linear_backoff',
    baseDelay: 2000,
    maxDelay: 120000,
    multiplier: 1,
    maxAttempts: 3,
  },
};
```

### Deploy Service (Long-Running Operations)

```typescript
// Very tolerant for deployment operations
const deployServiceConfig = {
  timeout: 15000, // Long timeout for deployments
  errorThresholdPercentage: 70, // Very tolerant of errors
  resetTimeout: 300000, // 5 minute reset window
  volumeThreshold: 2, // Very low threshold
  recoveryStrategy: {
    type: 'exponential_backoff',
    baseDelay: 5000,
    maxDelay: 300000,
    multiplier: 2,
    maxAttempts: 2,
  },
};
```

### Monitor Service (Non-Critical)

```typescript
// Very tolerant for monitoring operations
const monitorServiceConfig = {
  timeout: 10000,
  errorThresholdPercentage: 80, // Very tolerant
  resetTimeout: 180000, // 3 minute reset
  volumeThreshold: 5,
  recoveryStrategy: {
    type: 'immediate', // Immediate retry for monitoring
    baseDelay: 1000,
    maxDelay: 60000,
    multiplier: 1,
    maxAttempts: 10,
  },
};
```

## Monitoring and Alerting

### API Endpoints

The circuit breaker system provides comprehensive monitoring endpoints:

```bash
# Health status
GET /circuit-breaker/health
GET /circuit-breaker/health/:serviceName
GET /circuit-breaker/health/open
GET /circuit-breaker/health/degraded
GET /circuit-breaker/health/recommendations

# Metrics
GET /circuit-breaker/metrics
GET /circuit-breaker/metrics/history
GET /circuit-breaker/metrics/:serviceName/trend
GET /circuit-breaker/metrics/error-trends
GET /circuit-breaker/metrics/:serviceName/response-times

# Alerts and Management
GET /circuit-breaker/alerts
GET /circuit-breaker/summary
POST /circuit-breaker/reset/:serviceName
GET /circuit-breaker/debug
```

### Example Monitoring Dashboard

```typescript
// Custom monitoring service
@Injectable()
export class CircuitBreakerMonitoringService {
  constructor(
    private readonly metricsService: CircuitBreakerMetricsService,
    private readonly healthService: CircuitBreakerHealthService,
  ) {}

  async getSystemHealth(): Promise<SystemHealthReport> {
    const summary = this.metricsService.generateSummaryReport();
    const health = this.healthService.getAggregatedHealth();
    const alerts = this.metricsService.getAlerts(20, 'error');

    return {
      overallStatus: health.status,
      circuitBreakers: {
        total: summary.overview.totalServices,
        healthy: summary.overview.healthyServices,
        degraded: summary.overview.degradedServices,
        unhealthy: summary.overview.unhealthyServices,
        open: summary.overview.openCircuitBreakers,
      },
      criticalIssues: summary.topIssues.filter(
        (issue) => issue.severity === 'high',
      ),
      recentAlerts: alerts.slice(0, 10),
      trends: summary.trends,
      timestamp: new Date().toISOString(),
    };
  }
}
```

## Best Practices

### 1. **Configuration Guidelines**

- **Critical Services**: Lower error thresholds (30-40%), faster recovery
- **Financial Services**: Conservative thresholds (60-70%), longer reset times
- **Background Services**: Higher thresholds (70-80%), immediate recovery
- **Monitoring Services**: Very high thresholds (80-90%), many retry attempts

### 2. **Fallback Strategies**

```typescript
// Implement intelligent fallbacks
const authServiceFallback = () => {
  return {
    status: 'unhealthy',
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    error: 'Circuit breaker fallback - service temporarily unavailable',
  };
};

// For billing, queue operations for retry
const billingServiceFallback = (operation: any) => {
  queueService.addToRetryQueue('billing', operation);
  throw new Error('Billing service unavailable - operation queued for retry');
};
```

### 3. **Monitoring Integration**

- Set up alerts for circuit breaker state changes
- Monitor error rate trends across services
- Track recovery times and success rates
- Use metrics for capacity planning

### 4. **Testing Strategies**

```typescript
// Test circuit breaker behavior
describe('Circuit Breaker Integration', () => {
  it('should open circuit breaker after error threshold', async () => {
    // Simulate multiple failures
    for (let i = 0; i < 10; i++) {
      try {
        await service.failingOperation();
      } catch (error) {
        // Expected failures
      }
    }

    // Check circuit breaker state
    const health = circuitBreakerService.getHealth('test-service');
    expect(health.state).toBe(CircuitBreakerState.OPEN);
  });

  it('should use fallback when circuit breaker is open', async () => {
    // Force circuit breaker to open state
    await forceCircuitBreakerOpen('test-service');

    // Operation should use fallback
    const result = await service.protectedOperation();
    expect(result.fromFallback).toBe(true);
  });
});
```

## Troubleshooting

### Common Issues

1. **Circuit Breaker Not Opening**
   - Check error threshold configuration
   - Verify volume threshold is met
   - Review error filter configuration

2. **Excessive Fallback Usage**
   - Review service stability
   - Adjust error thresholds
   - Check timeout configurations

3. **Slow Recovery**
   - Review reset timeout settings
   - Check recovery strategy configuration
   - Monitor service health indicators

### Debug Information

```bash
# Get comprehensive debug information
curl -X GET http://localhost:3000/circuit-breaker/debug

# Check specific service health
curl -X GET http://localhost:3000/circuit-breaker/health/auth-service

# Get error trends
curl -X GET http://localhost:3000/circuit-breaker/metrics/error-trends

# Reset problematic circuit breaker
curl -X POST http://localhost:3000/circuit-breaker/reset/auth-service
```

## Integration with Existing Systems

The circuit breaker implementation integrates with existing Capsule Platform components:

- **Health Check System**: Enhanced health endpoints with circuit breaker status
- **Timeout System**: Intelligent timeout resolution based on service characteristics
- **RabbitMQ Architecture**: Seamless integration with exchange-based messaging
- **Monitoring Stack**: Metrics collection and alerting integration

This comprehensive circuit breaker implementation provides production-ready fault tolerance for your microservices architecture while maintaining compatibility with existing systems and patterns.
