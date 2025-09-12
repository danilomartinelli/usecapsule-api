# Health Check API Documentation

**Complete documentation for the Capsule Platform health check system, including HTTP endpoints and RabbitMQ message patterns.**

## Table of Contents

1. [Overview](#overview)
2. [HTTP Health Check Endpoints](#http-health-check-endpoints)
3. [RabbitMQ Health Check Messages](#rabbitmq-health-check-messages)
4. [Health Status Types](#health-status-types)
5. [Response Schemas](#response-schemas)
6. [Implementation Examples](#implementation-examples)
7. [Monitoring Integration](#monitoring-integration)

## Overview

The Capsule Platform implements a comprehensive health check system that operates at two levels:

1. **HTTP Level**: External health checks via the API Gateway for load balancers and monitoring systems
2. **Message Level**: Internal service health checks via RabbitMQ for service-to-service monitoring

## HTTP Health Check Endpoints

### Aggregated Health Check

**Endpoint**: `GET /health`
**Purpose**: Returns aggregated health status of all microservices
**Access**: Public (no authentication required)

```bash
curl http://localhost:3000/health
```

**Response Example**:

```json
{
  "status": "healthy",
  "services": {
    "auth-service": {
      "status": "healthy",
      "service": "auth-service",
      "timestamp": "2024-01-12T10:30:00.000Z",
      "metadata": {
        "version": "1.0.0",
        "memory": {
          "used": 245,
          "total": 512,
          "unit": "MB"
        },
        "queue": {
          "name": "auth_queue",
          "connected": true,
          "responseTime": 12
        }
      }
    },
    "billing-service": {
      "status": "healthy",
      "service": "billing-service",
      "timestamp": "2024-01-12T10:30:00.000Z",
      "metadata": {
        "version": "1.0.0",
        "memory": {
          "used": 180,
          "total": 512,
          "unit": "MB"
        }
      }
    },
    "deploy-service": {
      "status": "healthy",
      "service": "deploy-service",
      "timestamp": "2024-01-12T10:30:00.000Z",
      "metadata": {
        "version": "1.0.0",
        "memory": {
          "used": 320,
          "total": 512,
          "unit": "MB"
        }
      }
    },
    "monitor-service": {
      "status": "healthy",
      "service": "monitor-service",
      "timestamp": "2024-01-12T10:30:00.000Z",
      "metadata": {
        "version": "1.0.0",
        "memory": {
          "used": 290,
          "total": 512,
          "unit": "MB"
        },
        "database": {
          "connected": true,
          "responseTime": 8
        }
      }
    }
  },
  "timestamp": "2024-01-12T10:30:00.000Z"
}
```

### Ready/Liveness Probe

**Endpoint**: `GET /health/ready`
**Purpose**: Simple readiness check for load balancers and orchestrators
**Access**: Public

```bash
curl http://localhost:3000/health/ready
```

**Response Example**:

```json
{
  "status": "ready",
  "timestamp": "2024-01-12T10:30:00.000Z"
}
```

## RabbitMQ Health Check Messages

### Service-Specific Health Checks

Each microservice exposes a health check handler via RabbitMQ:

#### Auth Service Health Check

**Exchange**: `capsule.commands`
**Routing Key**: `auth.health`
**Pattern**: RPC (Request/Response)

**Request Payload**: `{}` (empty)

**Response**:

```json
{
  "status": "healthy",
  "service": "auth-service",
  "timestamp": "2024-01-12T10:30:00.000Z",
  "metadata": {
    "version": "1.0.0",
    "memory": {
      "used": 245,
      "total": 512,
      "unit": "MB"
    },
    "queue": {
      "name": "auth_queue",
      "connected": true,
      "responseTime": 12
    }
  }
}
```

#### Billing Service Health Check

**Routing Key**: `billing.health`

**Response**:

```json
{
  "status": "healthy",
  "service": "billing-service",
  "timestamp": "2024-01-12T10:30:00.000Z",
  "metadata": {
    "version": "1.0.0",
    "memory": {
      "used": 180,
      "total": 512,
      "unit": "MB"
    },
    "database": {
      "connected": true,
      "responseTime": 15
    }
  }
}
```

#### Deploy Service Health Check

**Routing Key**: `deploy.health`

**Response**:

```json
{
  "status": "healthy",
  "service": "deploy-service",
  "timestamp": "2024-01-12T10:30:00.000Z",
  "metadata": {
    "version": "1.0.0",
    "memory": {
      "used": 320,
      "total": 512,
      "unit": "MB"
    },
    "kubernetes": {
      "connected": true,
      "cluster": "development",
      "nodes": 3
    }
  }
}
```

#### Monitor Service Health Check

**Routing Key**: `monitor.health`

**Response**:

```json
{
  "status": "healthy",
  "service": "monitor-service",
  "timestamp": "2024-01-12T10:30:00.000Z",
  "metadata": {
    "version": "1.0.0",
    "memory": {
      "used": 290,
      "total": 512,
      "unit": "MB"
    },
    "database": {
      "connected": true,
      "responseTime": 8,
      "type": "timescaledb"
    },
    "metrics": {
      "collected": 15420,
      "lastCollection": "2024-01-12T10:29:45.000Z"
    }
  }
}
```

## Health Status Types

### Status Enumeration

```typescript
enum HealthStatus {
  HEALTHY = 'healthy',     // Service fully operational
  UNHEALTHY = 'unhealthy', // Service has critical issues
  DEGRADED = 'degraded',   // Service operational but with non-critical issues
}
```

### Status Determination Logic

```typescript
// Service-level health determination
function determineServiceHealth(checks: HealthCheck[]): HealthStatus {
  const criticalFailures = checks.filter(check =>
    check.critical && check.status === 'failed'
  );

  if (criticalFailures.length > 0) {
    return HealthStatus.UNHEALTHY;
  }

  const nonCriticalFailures = checks.filter(check =>
    !check.critical && check.status === 'failed'
  );

  if (nonCriticalFailures.length > 0) {
    return HealthStatus.DEGRADED;
  }

  return HealthStatus.HEALTHY;
}

// System-level health determination
function determineSystemHealth(serviceStatuses: HealthStatus[]): HealthStatus {
  if (serviceStatuses.includes(HealthStatus.UNHEALTHY)) {
    return HealthStatus.UNHEALTHY;
  }

  if (serviceStatuses.includes(HealthStatus.DEGRADED)) {
    return HealthStatus.DEGRADED;
  }

  return HealthStatus.HEALTHY;
}
```

## Response Schemas

### HealthCheckResponse Schema

```typescript
interface HealthCheckResponse {
  /** Current health status */
  status: HealthStatus;

  /** Service identifier */
  service?: string;

  /** ISO timestamp when check was performed */
  timestamp: string;

  /** Optional additional health metadata */
  metadata?: {
    /** Service version */
    version?: string;

    /** Error message if unhealthy */
    error?: string;

    /** Memory usage statistics */
    memory?: {
      used: number;    // MB
      total: number;   // MB
      unit: 'MB' | 'GB';
    };

    /** Database connectivity status */
    database?: {
      connected: boolean;
      responseTime?: number; // milliseconds
      type?: string;         // postgres, timescaledb, redis
    };

    /** Message queue status */
    queue?: {
      name: string;
      connected: boolean;
      responseTime?: number; // milliseconds
    };

    /** External service dependencies */
    kubernetes?: {
      connected: boolean;
      cluster?: string;
      nodes?: number;
    };

    /** Service-specific metrics */
    metrics?: {
      collected?: number;
      lastCollection?: string;
    };
  };
}
```

### AggregatedHealthResponse Schema

```typescript
interface AggregatedHealthResponse {
  /** Overall system health status */
  status: HealthStatus;

  /** Individual service health statuses */
  services: Record<string, HealthCheckResponse>;

  /** ISO timestamp when aggregated check was performed */
  timestamp: string;
}
```

### SimpleHealthResponse Schema

```typescript
interface SimpleHealthResponse {
  /** Ready status indicator */
  status: 'ready';

  /** ISO timestamp */
  timestamp: string;
}
```

## Implementation Examples

### Service Health Check Handler

```typescript
// apps/auth-service/src/app/app.controller.ts
import { Controller } from '@nestjs/common';
import { RabbitRPC } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse, HealthStatus } from '@usecapsule/types';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly databaseService: DatabaseService,
  ) {}

  @RabbitRPC({
    exchange: 'capsule.commands',
    routingKey: 'auth.health',
  })
  async healthCheck(): Promise<HealthCheckResponse> {
    const checks: HealthCheck[] = [];

    // Check database connectivity
    try {
      const dbStart = Date.now();
      await this.databaseService.ping();
      const dbResponseTime = Date.now() - dbStart;

      checks.push({
        name: 'database',
        status: 'passed',
        critical: true,
        responseTime: dbResponseTime,
      });
    } catch (error) {
      checks.push({
        name: 'database',
        status: 'failed',
        critical: true,
        error: error.message,
      });
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);

    // Flag as degraded if using > 90% of allocated memory
    if (memoryUsedMB / memoryTotalMB > 0.9) {
      checks.push({
        name: 'memory',
        status: 'failed',
        critical: false,
        message: 'High memory usage',
      });
    } else {
      checks.push({
        name: 'memory',
        status: 'passed',
        critical: false,
      });
    }

    // Determine overall health status
    const status = this.determineHealth(checks);
    const dbCheck = checks.find(c => c.name === 'database');

    return {
      status,
      service: 'auth-service',
      timestamp: new Date().toISOString(),
      metadata: {
        version: process.env.npm_package_version || '1.0.0',
        memory: {
          used: memoryUsedMB,
          total: memoryTotalMB,
          unit: 'MB',
        },
        database: {
          connected: dbCheck?.status === 'passed',
          responseTime: dbCheck?.responseTime,
        },
        queue: {
          name: 'auth_queue',
          connected: true, // RabbitMQ connection is healthy if this handler runs
        },
      },
    };
  }

  private determineHealth(checks: HealthCheck[]): HealthStatus {
    const criticalFailures = checks.filter(c => c.critical && c.status === 'failed');
    if (criticalFailures.length > 0) {
      return HealthStatus.UNHEALTHY;
    }

    const nonCriticalFailures = checks.filter(c => !c.critical && c.status === 'failed');
    if (nonCriticalFailures.length > 0) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }
}
```

### API Gateway Health Aggregation

```typescript
// apps/api-gateway/src/app/app.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type {
  AggregatedHealthResponse,
  HealthCheckResponse,
  HealthStatus,
  ServiceName
} from '@usecapsule/types';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async checkAllServicesHealth(): Promise<AggregatedHealthResponse> {
    const services: ServiceName[] = [
      'auth-service',
      'billing-service',
      'deploy-service',
      'monitor-service',
    ];

    // Check all services in parallel with individual error handling
    const healthCheckPromises = services.map(service =>
      this.checkServiceHealthSafely(service)
    );

    const healthResults = await Promise.all(healthCheckPromises);

    // Build services health map
    const servicesHealth: Record<string, HealthCheckResponse> = {};
    let overallStatus = HealthStatus.HEALTHY;

    services.forEach((service, index) => {
      const result = healthResults[index];
      servicesHealth[service] = result;

      // Determine overall system health
      if (result.status === HealthStatus.UNHEALTHY) {
        overallStatus = HealthStatus.UNHEALTHY;
      } else if (result.status === HealthStatus.DEGRADED && overallStatus === HealthStatus.HEALTHY) {
        overallStatus = HealthStatus.DEGRADED;
      }
    });

    return {
      status: overallStatus,
      services: servicesHealth,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkServiceHealthSafely(serviceName: ServiceName): Promise<HealthCheckResponse> {
    try {
      const routingKey = `${serviceName.replace('-service', '')}.health`;

      return await this.amqpConnection.request({
        exchange: 'capsule.commands',
        routingKey,
        payload: {},
        timeout: 5000,
      });

    } catch (error) {
      this.logger.error(`Health check failed for ${serviceName}:`, error);

      return {
        status: HealthStatus.UNHEALTHY,
        service: serviceName,
        timestamp: new Date().toISOString(),
        metadata: {
          error: 'Service unreachable or unresponsive',
        },
      };
    }
  }
}
```

## Monitoring Integration

### Prometheus Metrics

The health check system can be integrated with Prometheus for monitoring:

```typescript
// Health check metrics for Prometheus
@Injectable()
export class HealthMetricsService {
  private readonly healthCheckCounter = new Counter({
    name: 'capsule_health_checks_total',
    help: 'Total number of health checks performed',
    labelNames: ['service', 'status'],
  });

  private readonly healthCheckDuration = new Histogram({
    name: 'capsule_health_check_duration_seconds',
    help: 'Duration of health checks',
    labelNames: ['service'],
  });

  recordHealthCheck(service: string, status: HealthStatus, duration: number) {
    this.healthCheckCounter.inc({ service, status });
    this.healthCheckDuration.observe({ service }, duration / 1000);
  }
}
```

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: capsule-health
    rules:
      - alert: ServiceUnhealthy
        expr: capsule_health_checks_total{status="unhealthy"} > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.service }} is unhealthy"
          description: "Service {{ $labels.service }} has been reporting unhealthy status for more than 1 minute"

      - alert: ServiceDegraded
        expr: capsule_health_checks_total{status="degraded"} > 0
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Service {{ $labels.service }} is degraded"
          description: "Service {{ $labels.service }} has been reporting degraded status for more than 5 minutes"
```

### Load Balancer Integration

```nginx
# Nginx health check configuration
upstream api_gateway {
    server localhost:3000;
    server localhost:3001 backup;

    # Health check configuration
    check interval=10000 rise=2 fall=3 timeout=5000 type=http;
    check_http_send "GET /health/ready HTTP/1.0\r\n\r\n";
    check_http_expect_alive http_2xx http_3xx;
}
```

---

**Next Steps**:

- Review [Message Contracts](./message-contracts.md) for detailed payload schemas
- See [Gateway API Reference](./gateway-api.md) for HTTP endpoint documentation
- Check [Common Issues](../troubleshooting/common-issues.md) for health check troubleshooting
