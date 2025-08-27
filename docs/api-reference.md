# API Reference

## Overview

The Capsule API provides programmatic access to all platform functionality. This document describes the current and planned API endpoints.

**Base URL**: `http://localhost:3000/api` (development)  
**Production URL**: TBD

## Current Implementation Status

⚠️ **Note**: The API is in early development. Currently, only basic health check endpoints are implemented.

### Implemented Endpoints

#### Health Check
```http
GET /api
```

**Response**
```json
{
  "message": "Welcome to api-gateway!"
}
```

---

## Planned API Endpoints

The following endpoints are part of the platform vision but not yet implemented:

### Authentication

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### OAuth Login
```http
GET /api/auth/oauth/{provider}
```
Providers: `github`, `google`, `gitlab`

#### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer {refresh_token}
```

### Organizations

#### List Organizations
```http
GET /api/organizations
```

#### Create Organization
```http
POST /api/organizations
Content-Type: application/json

{
  "name": "My Company",
  "slug": "my-company"
}
```

#### Get Organization
```http
GET /api/organizations/{org_id}
```

### Projects

#### List Projects
```http
GET /api/organizations/{org_id}/projects
```

#### Create Project
```http
POST /api/organizations/{org_id}/projects
Content-Type: application/json

{
  "name": "My App",
  "repository": "https://github.com/org/repo"
}
```

### Services

#### Deploy Service
```http
POST /api/services
Content-Type: application/json

{
  "name": "api-service",
  "image": "ghcr.io/org/api:v1.2.3",
  "ports": [{
    "container": 3000,
    "protocol": "http"
  }],
  "env": {
    "NODE_ENV": "production"
  },
  "resources": {
    "cpu": "500m",
    "memory": "512Mi"
  }
}
```

#### List Services
```http
GET /api/services
```

#### Get Service
```http
GET /api/services/{service_id}
```

#### Update Service
```http
PATCH /api/services/{service_id}
Content-Type: application/json

{
  "replicas": 3,
  "env": {
    "NEW_VAR": "value"
  }
}
```

#### Delete Service
```http
DELETE /api/services/{service_id}
```

#### Scale Service
```http
POST /api/services/{service_id}/scale
Content-Type: application/json

{
  "replicas": 5
}
```

#### Restart Service
```http
POST /api/services/{service_id}/restart
```

#### Rollback Service
```http
POST /api/services/{service_id}/rollback
Content-Type: application/json

{
  "deployment_id": "dep_123"
}
```

### Deployments

#### List Deployments
```http
GET /api/services/{service_id}/deployments
```

#### Get Deployment
```http
GET /api/deployments/{deployment_id}
```

#### Cancel Deployment
```http
POST /api/deployments/{deployment_id}/cancel
```

### Logs

#### Get Service Logs
```http
GET /api/services/{service_id}/logs?since=2024-01-01&limit=100
```

#### Stream Logs (WebSocket)
```
ws://localhost:3000/api/services/{service_id}/logs/stream
```

### Metrics

#### Get Service Metrics
```http
GET /api/services/{service_id}/metrics?period=1h&metrics=cpu,memory,rps
```

### Secrets

#### List Secrets
```http
GET /api/projects/{project_id}/secrets
```

#### Create Secret
```http
POST /api/projects/{project_id}/secrets
Content-Type: application/json

{
  "name": "API_KEY",
  "value": "secret_value"
}
```

#### Update Secret
```http
PUT /api/secrets/{secret_id}
Content-Type: application/json

{
  "value": "new_secret_value"
}
```

#### Delete Secret
```http
DELETE /api/secrets/{secret_id}
```

### Environment Variables

#### List Environment Variables
```http
GET /api/services/{service_id}/env
```

#### Update Environment Variables
```http
PUT /api/services/{service_id}/env
Content-Type: application/json

{
  "NODE_ENV": "production",
  "API_URL": "https://api.example.com"
}
```

### Preview Environments

#### Create Preview Environment
```http
POST /api/preview-environments
Content-Type: application/json

{
  "branch": "feature/new-feature",
  "ttl": "24h"
}
```

#### List Preview Environments
```http
GET /api/preview-environments
```

#### Delete Preview Environment
```http
DELETE /api/preview-environments/{preview_id}
```

### Billing

#### Get Current Usage
```http
GET /api/billing/usage
```

#### Get Cost Breakdown
```http
GET /api/billing/breakdown?period=month
```

#### Get Invoices
```http
GET /api/billing/invoices
```

## Common Patterns

### Pagination

All list endpoints support pagination:

```http
GET /api/services?page=2&per_page=20
```

**Response Headers**:
```
X-Total-Count: 200
X-Page: 2
X-Per-Page: 20
Link: <...?page=3>; rel="next", <...?page=1>; rel="prev"
```

### Filtering

List endpoints support filtering:

```http
GET /api/services?status=running&env=production
```

### Sorting

List endpoints support sorting:

```http
GET /api/services?sort=created_at&order=desc
```

### Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Service with ID 'svc_123' not found",
    "details": {
      "resource_type": "service",
      "resource_id": "svc_123"
    },
    "request_id": "req_abc123",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Rate Limiting

API requests are rate limited:

- **Anonymous**: 60 requests/hour
- **Authenticated**: 5000 requests/hour
- **Enterprise**: Unlimited

Rate limit information is included in response headers:

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4999
X-RateLimit-Reset: 1642089600
```

## Authentication

### API Keys

Include API key in Authorization header:

```http
Authorization: Bearer cap_live_xxxxxxxxxxxxx
```

### OAuth Tokens

Include OAuth token in Authorization header:

```http
Authorization: Bearer oauth_xxxxxxxxxxxxx
```

## Webhooks

### Webhook Events

- `deployment.started`
- `deployment.succeeded`
- `deployment.failed`
- `service.scaled`
- `service.crashed`
- `cost.threshold_exceeded`

### Webhook Payload

```json
{
  "event": "deployment.succeeded",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "deployment_id": "dep_123",
    "service_id": "svc_456",
    "image": "ghcr.io/org/api:v1.2.3"
  }
}
```

## SDKs

### TypeScript/JavaScript

```typescript
import { CapsuleClient } from '@capsule/sdk';

const client = new CapsuleClient({
  apiKey: 'cap_live_xxxxxxxxxxxxx'
});

const services = await client.services.list();
```

### Python

```python
from capsule import CapsuleClient

client = CapsuleClient(api_key='cap_live_xxxxxxxxxxxxx')
services = client.services.list()
```

### Go

```go
import "github.com/capsule-dev/capsule-go"

client := capsule.NewClient("cap_live_xxxxxxxxxxxxx")
services, err := client.Services.List()
```

## Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created
- `204 No Content`: Request succeeded with no response body
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `409 Conflict`: Resource conflict
- `422 Unprocessable Entity`: Validation error
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service temporarily unavailable

## Versioning

The API uses URL versioning. The current version is `v1`.

Future versions will be available at:
- `/api/v2`
- `/api/v3`

## Deprecation Policy

- Deprecated endpoints will be marked with `Deprecation` header
- Minimum 6 months notice before removal
- Migration guides provided for breaking changes

## Support

- **Documentation**: https://docs.capsule.dev
- **Status Page**: https://status.capsule.dev
- **Support Email**: support@capsule.dev

---

*This API reference reflects the planned functionality. Most endpoints are not yet implemented.*