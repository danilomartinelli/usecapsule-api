# Capsule Platform Database Infrastructure Deployment Runbook

## Overview

This runbook provides comprehensive instructions for deploying and managing the Capsule Platform database infrastructure in production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Deployment](#initial-deployment)
3. [Environment Management](#environment-management)
4. [Backup and Recovery](#backup-and-recovery)
5. [Monitoring and Alerting](#monitoring-and-alerting)
6. [Security Management](#security-management)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Procedures](#emergency-procedures)

## Prerequisites

### Required Tools

- `kubectl` v1.28+ configured for your cluster
- `kustomize` v5.0+ (or `kubectl` with kustomize support)
- `helm` v3.10+ (for monitoring stack)
- `docker` for local image building
- `aws-cli` or cloud provider CLI for backup management

### Access Requirements

- Kubernetes cluster admin access for staging/production
- Container registry push/pull permissions
- Cloud storage access for backups
- Monitoring system admin access

### Environment Setup

```bash
# Set up environment variables
export KUBECONFIG=/path/to/your/kubeconfig
export ENVIRONMENT=production  # or staging
export NAMESPACE=capsule-${ENVIRONMENT}
```

## Initial Deployment

### Step 1: Cluster Preparation

```bash
# Create namespace
kubectl apply -f deploy/k8s/namespace.yaml

# Verify cluster readiness
kubectl get nodes
kubectl get storageclass
```

### Step 2: SSL Certificates Setup

```bash
# For production, use proper certificates
kubectl create secret tls postgres-ssl-certs \
  --cert=path/to/server.crt \
  --key=path/to/server.key \
  --namespace=${NAMESPACE}

# For staging, create self-signed certificates
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout server.key -out server.crt \
  -subj "/CN=postgres.${NAMESPACE}.svc.cluster.local"

kubectl create secret generic postgres-ssl-certs \
  --from-file=server.crt=server.crt \
  --from-file=server.key=server.key \
  --from-file=ca.crt=server.crt \
  --namespace=${NAMESPACE}
```

### Step 3: Secrets Management

```bash
# Generate strong passwords
export POSTGRES_AUTH_PASSWORD=$(openssl rand -base64 32)
export POSTGRES_BILLING_PASSWORD=$(openssl rand -base64 32)
export POSTGRES_DEPLOY_PASSWORD=$(openssl rand -base64 32)
export TIMESCALEDB_MONITOR_PASSWORD=$(openssl rand -base64 32)
export REDIS_PASSWORD=$(openssl rand -base64 32)

# Create database secrets
kubectl create secret generic postgres-auth-secret \
  --from-literal=username=auth_user \
  --from-literal=password=${POSTGRES_AUTH_PASSWORD} \
  --from-literal=monitoring-password=$(openssl rand -base64 16) \
  --from-literal=backup-password=$(openssl rand -base64 16) \
  --from-literal=replication-password=$(openssl rand -base64 16) \
  --from-literal=healthcheck-password=$(openssl rand -base64 16) \
  --namespace=${NAMESPACE}

# Repeat for other services...
```

### Step 4: Deploy Infrastructure

```bash
# Deploy using kustomize
kubectl apply -k deploy/k8s/overlays/${ENVIRONMENT}

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l component=database \
  --timeout=600s --namespace=${NAMESPACE}

# Verify deployment
kubectl get pods,pvc,svc --namespace=${NAMESPACE}
```

### Step 5: Run Initial Migrations

```bash
# Create migration ConfigMaps
kubectl create configmap auth-migration-scripts \
  --from-file=apps/auth-service/migrations/ \
  --namespace=${NAMESPACE}

kubectl create configmap billing-migration-scripts \
  --from-file=apps/billing-service/migrations/ \
  --namespace=${NAMESPACE}

kubectl create configmap deploy-migration-scripts \
  --from-file=apps/deploy-service/migrations/ \
  --namespace=${NAMESPACE}

kubectl create configmap monitor-migration-scripts \
  --from-file=apps/monitor-service/migrations/ \
  --namespace=${NAMESPACE}

# Run migrations
kubectl apply -f deploy/k8s/base/flyway-migrations.yaml --namespace=${NAMESPACE}

# Monitor migration progress
kubectl logs -f job/flyway-auth-migration --namespace=${NAMESPACE}
```

## Environment Management

### Staging Environment

```bash
# Deploy to staging
kubectl apply -k deploy/k8s/overlays/staging

# Scale down for cost optimization
kubectl scale statefulset postgres-auth --replicas=1 --namespace=capsule-staging
kubectl scale statefulset postgres-billing --replicas=1 --namespace=capsule-staging
```

### Production Environment

```bash
# Deploy to production with high availability
kubectl apply -k deploy/k8s/overlays/production

# Verify production-specific configurations
kubectl get pdb --namespace=capsule-production
kubectl get networkpolicy --namespace=capsule-production
```

### Configuration Updates

```bash
# Update configuration without downtime
kubectl patch configmap environment-config \
  --patch='{"data":{"new_setting":"new_value"}}' \
  --namespace=${NAMESPACE}

# Rolling restart to pick up changes
kubectl rollout restart statefulset postgres-auth --namespace=${NAMESPACE}
```

## Backup and Recovery

### Automated Backups

Backups run automatically via CronJobs:

- **PostgreSQL databases**: Daily at 2 AM UTC
- **TimescaleDB**: Daily at 3 AM UTC
- **Retention**: 30 days in production, 7 days in staging

### Manual Backup

```bash
# Create immediate backup
kubectl create job manual-backup-auth \
  --from=cronjob/postgres-backup-auth \
  --namespace=${NAMESPACE}

# Monitor backup progress
kubectl logs -f job/manual-backup-auth --namespace=${NAMESPACE}
```

### Database Restore

```bash
# Restore from latest backup
kubectl create job restore-auth-$(date +%s) \
  --image=postgres:15-alpine \
  --namespace=${NAMESPACE} \
  -- /bin/sh -c "
    export RESTORE_TARGET=auth
    export BACKUP_FILE_URL=s3://capsule-database-backups/postgres/auth/latest.sql
    /restore-script.sh
  "
```

### Point-in-Time Recovery

```bash
# PITR to specific time
kubectl create job pitr-billing-$(date +%s) \
  --image=postgres:15-alpine \
  --namespace=${NAMESPACE} \
  -- /bin/sh -c "
    export PITR_TARGET=billing
    export RECOVERY_TIME=2023-12-01T14:30:00Z
    /pitr-script.sh
  "
```

## Monitoring and Alerting

### Access Monitoring

```bash
# Port forward to Grafana
kubectl port-forward svc/grafana 3000:3000 --namespace=${NAMESPACE}
# Access: http://localhost:3000

# Port forward to Prometheus
kubectl port-forward svc/prometheus 9090:9090 --namespace=${NAMESPACE}
# Access: http://localhost:9090
```

### Key Metrics to Monitor

1. **Database Health**
   - Connection count
   - Query performance
   - Disk usage
   - Memory utilization

2. **Backup Status**
   - Last successful backup time
   - Backup size trends
   - Failed backup alerts

3. **Security Events**
   - Failed authentication attempts
   - Unusual connection patterns
   - SSL certificate expiration

### Alert Configuration

Critical alerts are configured for:

- Database downtime (immediate)
- High connection usage (>80%)
- Disk space critical (>90%)
- Backup failures
- SSL certificate expiration (30 days)

## Security Management

### Certificate Rotation

```bash
# Generate new certificates
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout new-server.key -out new-server.crt \
  -subj "/CN=postgres.${NAMESPACE}.svc.cluster.local"

# Update secret
kubectl create secret generic postgres-ssl-certs-new \
  --from-file=server.crt=new-server.crt \
  --from-file=server.key=new-server.key \
  --from-file=ca.crt=new-server.crt \
  --namespace=${NAMESPACE}

# Rolling update databases
kubectl patch statefulset postgres-auth \
  --patch='{"spec":{"template":{"spec":{"volumes":[{"name":"postgres-ssl","secret":{"secretName":"postgres-ssl-certs-new"}}]}}}}' \
  --namespace=${NAMESPACE}
```

### Password Rotation

```bash
# Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# Update secret
kubectl patch secret postgres-auth-secret \
  --patch="{\"data\":{\"password\":\"$(echo -n $NEW_PASSWORD | base64)\"}}" \
  --namespace=${NAMESPACE}

# Update database
kubectl exec statefulset/postgres-auth --namespace=${NAMESPACE} -- \
  psql -c "ALTER USER auth_user PASSWORD '$NEW_PASSWORD';"
```

### Security Scanning

```bash
# Run manual security scan
gh workflow run security-scanning.yml

# Check scan results
gh run list --workflow=security-scanning.yml
```

## Troubleshooting

### Common Issues

#### Database Connection Failures

```bash
# Check pod status
kubectl get pods -l component=database --namespace=${NAMESPACE}

# Check logs
kubectl logs postgres-auth-0 --namespace=${NAMESPACE}

# Test connectivity
kubectl run test-db --rm -i --restart=Never \
  --image=postgres:15-alpine --namespace=${NAMESPACE} \
  -- psql -h postgres-auth -U auth_user -d auth_service_db -c "SELECT 1;"
```

#### Migration Failures

```bash
# Check migration job status
kubectl get jobs -l component=migration --namespace=${NAMESPACE}

# View migration logs
kubectl logs job/flyway-auth-migration --namespace=${NAMESPACE}

# Manual migration repair
kubectl exec deployment/flyway-auth --namespace=${NAMESPACE} -- \
  flyway repair -url=jdbc:postgresql://postgres-auth:5432/auth_service_db
```

#### Storage Issues

```bash
# Check PVC status
kubectl get pvc --namespace=${NAMESPACE}

# Check storage class
kubectl get storageclass

# Expand volume (if supported)
kubectl patch pvc postgres-data-postgres-auth-0 \
  --patch='{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}' \
  --namespace=${NAMESPACE}
```

### Performance Issues

```bash
# Check resource usage
kubectl top pods --namespace=${NAMESPACE}

# Analyze slow queries
kubectl exec postgres-auth-0 --namespace=${NAMESPACE} -- \
  psql -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check connection pools
kubectl exec postgres-auth-0 --namespace=${NAMESPACE} -- \
  psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
```

## Emergency Procedures

### Database Failover

```bash
# Check primary status
kubectl exec postgres-auth-0 --namespace=${NAMESPACE} -- \
  psql -c "SELECT pg_is_in_recovery();"

# Promote standby (if configured)
kubectl exec postgres-auth-1 --namespace=${NAMESPACE} -- \
  pg_ctl promote -D /var/lib/postgresql/data
```

### Emergency Maintenance

```bash
# Put database in maintenance mode
kubectl scale statefulset postgres-auth --replicas=0 --namespace=${NAMESPACE}

# Perform maintenance
# ...

# Bring database back online
kubectl scale statefulset postgres-auth --replicas=1 --namespace=${NAMESPACE}
```

### Disaster Recovery

```bash
# Full environment restore
kubectl delete namespace ${NAMESPACE}
kubectl apply -f deploy/k8s/namespace.yaml

# Restore from backup
kubectl apply -k deploy/k8s/overlays/${ENVIRONMENT}
# Wait for pods to be ready
# Run restore jobs for each database
```

### Contact Information

- **Platform Team**: platform@capsule.dev
- **Security Team**: security@capsule.dev
- **On-Call**: +1-XXX-XXX-XXXX
- **Slack**: #platform-alerts

### References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [Redis Documentation](https://redis.io/documentation)
- [Flyway Documentation](https://flywaydb.org/documentation/)

---

**Last Updated**: December 2023
**Version**: 1.0.0
**Reviewed By**: Platform Engineering Team
