import type { MonitorServiceSchema } from '../schemas/monitor-service.schema';
import { timeoutFactory } from './timeout.factory';

/**
 * Configuration factory for the Monitor Service.
 *
 * This factory function creates the configuration object for the Monitor Service
 * by reading from environment variables. It provides type-safe configuration
 * that will be validated against the monitorServiceSchema.
 *
 * The Monitor Service handles metrics collection, observability, alerting,
 * and performance monitoring within the DDD microservices architecture.
 *
 * @returns Monitor Service configuration object matching the schema
 *
 * @example
 * ```typescript
 * import { monitorServiceFactory, monitorServiceSchema } from '@usecapsule/parameters';
 *
 * const config = monitorServiceFactory();
 * const validatedConfig = monitorServiceSchema.parse(config);
 * ```
 */
export const monitorServiceFactory = (): MonitorServiceSchema => ({
  NODE_ENV:
    (process.env.NODE_ENV as 'test' | 'development' | 'production') ||
    'development',
  APP_ENV:
    (process.env.APP_ENV as
      | 'test'
      | 'local'
      | 'development'
      | 'staging'
      | 'production'
      | 'canary') || 'local',
  SERVICE_NAME: 'monitor-service' as const,
  RABBITMQ_URL: process.env.RABBITMQ_URL || '',
  MONITOR_DB_HOST: process.env.DB_HOST || '',
  MONITOR_DB_PORT: Number.parseInt(process.env.DB_PORT || '5432', 10),
  MONITOR_DB_NAME: process.env.DB_NAME || '',
  MONITOR_DB_USER: process.env.DB_USER || '',
  MONITOR_DB_PASSWORD: process.env.DB_PASSWORD || '',
  MONITOR_DB_SSL: process.env.DB_SSL === 'true',
  PROMETHEUS_URL: process.env.PROMETHEUS_URL || undefined,
  PROMETHEUS_PUSHGATEWAY_URL:
    process.env.PROMETHEUS_PUSHGATEWAY_URL || undefined,
  GRAFANA_URL: process.env.GRAFANA_URL || undefined,
  GRAFANA_API_TOKEN: process.env.GRAFANA_API_TOKEN || undefined,
  ALERTMANAGER_URL: process.env.ALERTMANAGER_URL || undefined,
  METRICS_COLLECTION_INTERVAL_SECONDS: Number.parseInt(
    process.env.METRICS_COLLECTION_INTERVAL_SECONDS || '60',
    10,
  ),
  METRICS_RETENTION_DAYS: Number.parseInt(
    process.env.METRICS_RETENTION_DAYS || '90',
    10,
  ),
  ALERT_CPU_THRESHOLD_PERCENT: Number.parseInt(
    process.env.ALERT_CPU_THRESHOLD_PERCENT || '80',
    10,
  ),
  ALERT_MEMORY_THRESHOLD_PERCENT: Number.parseInt(
    process.env.ALERT_MEMORY_THRESHOLD_PERCENT || '85',
    10,
  ),
  ALERT_DISK_THRESHOLD_PERCENT: Number.parseInt(
    process.env.ALERT_DISK_THRESHOLD_PERCENT || '90',
    10,
  ),
  LOG_LEVEL:
    (process.env.LOG_LEVEL as 'error' | 'warn' | 'info' | 'debug') || 'info',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number.parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_DB: Number.parseInt(process.env.REDIS_DB || '0', 10),
  ...timeoutFactory(),
});

/**
 * Type alias for the monitor service factory function.
 */
export type MonitorServiceFactory = typeof monitorServiceFactory;
