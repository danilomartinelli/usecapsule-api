# Common Issues & Troubleshooting

**Comprehensive troubleshooting guide for the most frequent issues encountered when developing and operating the Capsule Platform.**

## Table of Contents

1. [Service Startup Issues](#service-startup-issues)
2. [RabbitMQ Connection Problems](#rabbitmq-connection-problems)
3. [Database Connection Errors](#database-connection-errors)
4. [Message Routing Issues](#message-routing-issues)
5. [Health Check Failures](#health-check-failures)
6. [Build and Development Issues](#build-and-development-issues)
7. [Performance Problems](#performance-problems)
8. [Docker and Infrastructure Issues](#docker-and-infrastructure-issues)

## Service Startup Issues

### Problem: Services Won't Start

**Symptoms**:

- Services crash on startup
- Port already in use errors
- Module resolution failures

**Diagnostic Steps**:

```bash
# Check if ports are already in use
lsof -i :3000  # API Gateway
lsof -i :7010  # RabbitMQ AMQP
lsof -i :7020  # RabbitMQ Management

# Check running processes
ps aux | grep node
ps aux | grep nx
```

**Solutions**:

1. **Port Conflicts**: Kill existing processes or use different ports

```bash
# Kill specific processes
kill -9 $(lsof -ti:3000)

# Or kill all node processes (nuclear option)
killall node
```

2. **Module Dependencies**: Ensure all dependencies are installed

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Clear Nx cache
nx reset
```

3. **Environment Variables**: Verify required environment variables

```bash
# Check current environment
printenv | grep RABBITMQ
printenv | grep NODE_ENV

# Set missing variables
export RABBITMQ_URL="amqp://usecapsule:usecapsule_dev_password@localhost:7010"
```

### Problem: TypeScript Compilation Errors

**Symptoms**:

- Build fails with type errors
- Module import errors
- Missing type definitions

**Solutions**:

```bash
# Type check all projects
nx run-many --target=typecheck --all

# Rebuild types
nx build shared-types
nx build configs-rabbitmq

# Check specific service
nx typecheck auth-service --verbose
```

## RabbitMQ Connection Problems

### Problem: Cannot Connect to RabbitMQ

**Symptoms**:

- "ECONNREFUSED" errors
- Services hang during startup
- Health checks fail

**Diagnostic Steps**:

```bash
# Check RabbitMQ container status
docker ps | grep rabbitmq
docker logs rabbitmq_dev

# Test RabbitMQ connection
curl -u usecapsule:usecapsule_dev_password http://localhost:7020/api/overview

# Check if RabbitMQ is accepting connections
telnet localhost 7010
```

**Solutions**:

1. **Start RabbitMQ Container**:

```bash
# Start infrastructure
npm run infrastructure:up

# Or start RabbitMQ specifically
docker start rabbitmq_dev

# Check health
docker exec rabbitmq_dev rabbitmq-diagnostics -q ping
```

2. **Fix Connection Configuration**:

```typescript
// Verify connection string format
const RABBITMQ_URL = 'amqp://usecapsule:usecapsule_dev_password@localhost:7010';

// Check service configuration
RabbitMQModule.forMicroservice({
  uri: process.env.RABBITMQ_URL || RABBITMQ_URL,
  serviceName: 'auth-service',
})
```

3. **Reset RabbitMQ State**:

```bash
# Complete reset (loses all messages)
docker stop rabbitmq_dev
docker rm rabbitmq_dev
docker volume rm usecapsule-services_rabbitmq_data
npm run infrastructure:up
```

### Problem: Messages Not Being Consumed

**Symptoms**:

- Messages accumulate in queues
- RPC calls timeout
- Services appear healthy but unresponsive

**Diagnostic Steps**:

```bash
# Check queue status
docker exec rabbitmq_dev rabbitmqctl list_queues name messages consumers

# Inspect specific queue
# Via Management UI: http://localhost:7020 -> Queues -> [queue_name]
```

**Solutions**:

1. **Verify Message Handlers**:

```typescript
// Ensure handlers are properly decorated
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.health',
})
healthCheck(): HealthCheckResponse {
  return this.appService.getHealthStatus();
}
```

2. **Check Service Registration**:

```bash
# Verify service is consuming from queue
docker exec rabbitmq_dev rabbitmqctl list_consumers
```

3. **Restart Consuming Service**:

```bash
# Restart specific service
nx serve auth-service --watch
```

## Database Connection Errors

**Note**: Database services are currently commented out in compose.yml for development phase.

### Problem: Database Connection Refused

**Symptoms**:

- "Connection refused" to database ports
- Migration failures
- Service startup hangs on database connection

**Solutions**:

1. **Uncomment Database Services** (when ready for implementation):

```yaml
# compose.yml - uncomment database services
auth-db:
  container_name: auth_db_dev
  image: postgres:15
  environment:
    POSTGRES_USER: auth_user
    POSTGRES_PASSWORD: auth_pass
    POSTGRES_DB: auth_service_db
  ports:
    - '7110:5432'
```

2. **Database Health Checks**:

```bash
# Test database connection
docker exec auth_db_dev pg_isready -U auth_user -d auth_service_db

# Connect to database manually
docker exec -it auth_db_dev psql -U auth_user -d auth_service_db
```

## Message Routing Issues

### Problem: RPC Calls Timeout or Fail

**Symptoms**:

- Timeout errors on message requests
- "No consumers" errors
- Health checks return unhealthy status

**Diagnostic Steps**:

```bash
# Check exchange bindings
docker exec rabbitmq_dev rabbitmqctl list_bindings | grep capsule

# Monitor message flow
# Management UI -> Exchanges -> capsule.commands -> Publish Message
```

**Solutions**:

1. **Verify Routing Keys**:

```typescript
// Ensure consistent routing key patterns
const ROUTING_KEYS = {
  AUTH: {
    HEALTH: 'auth.health',
    REGISTER: 'auth.register',
    LOGIN: 'auth.login',
  },
} as const;

// Use constants in both client and handler
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: ROUTING_KEYS.AUTH.HEALTH,
})
```

2. **Test Message Routing Manually**:

```bash
# Via RabbitMQ Management UI (http://localhost:7020):
# 1. Go to Exchanges -> capsule.commands
# 2. Expand "Publish message"
# 3. Set routing key: "auth.health"
# 4. Set payload: {}
# 5. Click "Publish message"
```

3. **Increase Timeouts**:

```typescript
// Increase timeout for slow operations
const response = await this.amqpConnection.request({
  exchange: 'capsule.commands',
  routingKey: 'auth.health',
  payload: {},
  timeout: 10000, // Increase from default 5000ms
});
```

### Problem: Events Not Being Processed

**Symptoms**:

- Domain events published but not consumed
- Event subscribers not triggered
- Cross-service synchronization fails

**Solutions**:

1. **Check Event Subscribers**:

```typescript
// Ensure event handlers are properly decorated
@RabbitSubscribe({
  exchange: 'capsule.events',
  routingKey: 'user.created',
})
async onUserCreated(@RabbitPayload() event: UserCreatedEvent) {
  // Handler implementation
}
```

2. **Verify Topic Exchange Routing**:

```bash
# Check topic exchange bindings
docker exec rabbitmq_dev rabbitmqctl list_bindings | grep "capsule.events"
```

## Health Check Failures

### Problem: Services Report Unhealthy Status

**Symptoms**:

- `/health` endpoint returns unhealthy services
- Individual service health checks fail
- System appears degraded

**Diagnostic Steps**:

```bash
# Test API Gateway health check
curl http://localhost:3000/health | jq

# Test individual service health manually
# Management UI -> Exchanges -> capsule.commands
# Routing Key: auth.health, Payload: {}
```

**Solutions**:

1. **Check Service Health Implementation**:

```typescript
// Ensure health check returns proper format
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.health',
})
healthCheck(): HealthCheckResponse {
  return {
    status: HealthStatus.HEALTHY,
    service: 'auth-service',
    timestamp: new Date().toISOString(),
    metadata: {
      version: process.env.npm_package_version,
    },
  };
}
```

2. **Verify Health Check Routing**:

```typescript
// API Gateway health aggregation
private async checkServiceHealth(serviceName: string): Promise<HealthCheckResponse> {
  try {
    return await this.amqpConnection.request({
      exchange: 'capsule.commands',
      routingKey: `${serviceName.replace('-service', '')}.health`,
      payload: {},
      timeout: 5000,
    });
  } catch (error) {
    return {
      status: HealthStatus.UNHEALTHY,
      service: serviceName,
      timestamp: new Date().toISOString(),
      metadata: { error: error.message },
    };
  }
}
```

## Build and Development Issues

### Problem: Nx Build Failures

**Symptoms**:

- Build commands fail with dependency errors
- Module resolution issues
- Asset compilation failures

**Solutions**:

1. **Clear Nx Cache and Rebuild**:

```bash
# Clear all caches
nx reset
rm -rf dist/

# Rebuild all projects
nx run-many --target=build --all
```

2. **Check Project Dependencies**:

```bash
# Visualize project graph
nx graph

# Check specific project dependencies
nx show project auth-service
```

3. **Fix Import Issues**:

```typescript
// Use proper import paths from project.json
import { RabbitMQModule } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

// Not direct file paths
// import { RabbitMQModule } from '../../libs/configs/rabbitmq/src';
```

### Problem: Hot Reload Not Working

**Symptoms**:

- Changes not reflected in running services
- Need to restart services manually
- File watching not working

**Solutions**:

```bash
# Ensure watch flag is used
nx serve auth-service --watch

# Check file system watchers (macOS)
ulimit -n 10240

# Alternative: use development script
npm run dev:auth
```

## Performance Problems

### Problem: Slow Message Processing

**Symptoms**:

- High response times
- Message queue backlog
- Timeout errors under load

**Solutions**:

1. **Optimize Message Handlers**:

```typescript
// Use async/await properly
@RabbitRPC({
  exchange: 'capsule.commands',
  routingKey: 'auth.register',
})
async registerUser(@RabbitPayload() dto: RegisterUserDto): Promise<User> {
  // Avoid blocking operations
  const user = await this.authService.register(dto);

  // Publish events asynchronously (fire-and-forget)
  this.amqpConnection.publish('capsule.events', 'user.created', {
    userId: user.id,
    email: user.email,
  }).catch(error => this.logger.error('Event publish failed', error));

  return user;
}
```

2. **Configure RabbitMQ Performance**:

```conf
# rabbitmq.conf - optimize for throughput
channel_max = 2047
heartbeat = 60
collect_statistics_interval = 60000
```

3. **Monitor Queue Metrics**:

```bash
# Check queue performance
docker exec rabbitmq_dev rabbitmqctl list_queues name messages_ready messages_unacknowledged message_stats
```

## Docker and Infrastructure Issues

### Problem: Docker Containers Won't Start

**Symptoms**:

- "Port already in use" errors
- Container health checks failing
- Volume mounting issues

**Solutions**:

1. **Check Port Conflicts**:

```bash
# Find what's using ports
lsof -i :7010 # RabbitMQ AMQP
lsof -i :7020 # RabbitMQ Management

# Stop conflicting services
docker stop $(docker ps -q)
```

2. **Reset Infrastructure**:

```bash
# Nuclear option: reset everything
npm run infrastructure:down
docker system prune -f
docker volume prune -f
npm run infrastructure:up
```

3. **Check Docker Resources**:

```bash
# Verify Docker has sufficient resources
docker stats
docker system df
```

### Problem: Volume Permission Issues

**Symptoms**:

- Database fails to write to mounted volumes
- Permission denied errors in logs

**Solutions**:

```bash
# Fix volume permissions (Linux/macOS)
sudo chown -R $(whoami):$(whoami) ./data/

# Or recreate volumes
docker volume rm usecapsule-services_rabbitmq_data
npm run infrastructure:up
```

## Quick Diagnostic Commands

```bash
# System Health Check
curl http://localhost:3000/health | jq

# RabbitMQ Status
curl -u usecapsule:usecapsule_dev_password http://localhost:7020/api/overview | jq

# Container Status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Queue Status
docker exec rabbitmq_dev rabbitmqctl list_queues name messages

# Service Logs
docker logs rabbitmq_dev --tail 50
nx serve auth-service --verbose

# Process Status
ps aux | grep -E "(node|nx)" | head -10
```

## Getting Help

When you encounter issues not covered here:

1. **Check Recent Changes**: Review recent commits for potential causes
2. **Search Logs**: Look for error messages in service and container logs
3. **Verify Configuration**: Compare working configuration with current setup
4. **Test Incrementally**: Start with basic functionality and add complexity
5. **Document Issues**: Add new problems and solutions to this guide

---

**Next Steps**:

- See [RabbitMQ Debugging Guide](./rabbitmq-debugging.md) for detailed message queue troubleshooting
- Check [Performance Monitoring](./performance-monitoring.md) for system optimization techniques
- Review [Examples](../examples/) for working implementation patterns
