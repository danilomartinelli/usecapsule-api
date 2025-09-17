import { z } from 'zod';

import { BaseEntitySchema } from './common.schemas';

/**
 * Metric schema for time-series data (TimescaleDB)
 */
export const MetricSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.coerce.date(),
  service: z.string(),
  metricName: z.string(),
  value: z.number(),
  unit: z.string(),
  tags: z.record(z.string(), z.string()).default({}),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * System metrics schema
 */
export const SystemMetricSchema = MetricSchema.extend({
  hostname: z.string(),
  instance: z.string(),
  component: z.enum(['cpu', 'memory', 'disk', 'network', 'process']),
  cpuUsage: z.number().min(0).max(100).nullable(),
  memoryUsage: z.number().min(0).max(100).nullable(),
  diskUsage: z.number().min(0).max(100).nullable(),
  networkIn: z.number().int().nonnegative().nullable(),
  networkOut: z.number().int().nonnegative().nullable(),
  processCount: z.number().int().nonnegative().nullable(),
});

/**
 * Application metrics schema
 */
export const ApplicationMetricSchema = MetricSchema.extend({
  projectId: z.string().uuid(),
  deploymentId: z.string().uuid().nullable(),
  functionName: z.string().nullable(),
  endpoint: z.string().nullable(),
  httpMethod: z
    .enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'])
    .nullable(),
  statusCode: z.number().int().nullable(),
  responseTime: z.number().nonnegative().nullable(),
  requestSize: z.number().int().nonnegative().nullable(),
  responseSize: z.number().int().nonnegative().nullable(),
  errorCount: z.number().int().nonnegative().default(0),
});

/**
 * Business metrics schema
 */
export const BusinessMetricSchema = MetricSchema.extend({
  userId: z.string().uuid().nullable(),
  organizationId: z.string().uuid().nullable(),
  eventType: z.string(),
  revenue: z.number().nullable(),
  currency: z.string().length(3).nullable(),
  conversionRate: z.number().min(0).max(1).nullable(),
  sessionId: z.string().uuid().nullable(),
  customerSegment: z.string().nullable(),
});

/**
 * Alert rule schema
 */
export const AlertRuleSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  service: z.string(),
  metricName: z.string(),
  condition: z.enum(['>', '<', '>=', '<=', '==', '!=']),
  threshold: z.number(),
  windowDuration: z.number().int().positive(),
  evaluationInterval: z.number().int().positive(),
  labels: z.record(z.string(), z.string()).default({}),
  annotations: z.record(z.string(), z.string()).default({}),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid(),
  lastEvaluatedAt: z.coerce.date().nullable(),
  lastTriggeredAt: z.coerce.date().nullable(),
});

/**
 * Alert schema
 */
export const AlertSchema = BaseEntitySchema.extend({
  ruleId: z.string().uuid(),
  status: z.enum(['firing', 'resolved']),
  severity: z.enum(['critical', 'warning', 'info']),
  summary: z.string(),
  description: z.string(),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().nullable(),
  fingerprint: z.string(),
  labels: z.record(z.string(), z.string()).default({}),
  annotations: z.record(z.string(), z.string()).default({}),
  generatorUrl: z.string().url().nullable(),
  silenceId: z.string().uuid().nullable(),
});

/**
 * Notification channel schema
 */
export const NotificationChannelSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  type: z.enum(['email', 'slack', 'webhook', 'pagerduty', 'discord']),
  configuration: z.record(z.string(), z.unknown()),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid(),
  labels: z.record(z.string(), z.string()).default({}),
  lastUsedAt: z.coerce.date().nullable(),
  lastSuccessAt: z.coerce.date().nullable(),
  lastFailureAt: z.coerce.date().nullable(),
  failureCount: z.number().int().nonnegative().default(0),
});

/**
 * Alert notification schema
 */
export const AlertNotificationSchema = BaseEntitySchema.extend({
  alertId: z.string().uuid(),
  channelId: z.string().uuid(),
  status: z.enum(['pending', 'sent', 'failed', 'retrying']),
  sentAt: z.coerce.date().nullable(),
  failedAt: z.coerce.date().nullable(),
  retryCount: z.number().int().nonnegative().default(0),
  errorMessage: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * Service health check schema
 */
export const HealthCheckSchema = BaseEntitySchema.extend({
  service: z.string(),
  endpoint: z.string().url(),
  method: z.enum(['GET', 'POST', 'HEAD']).default('GET'),
  expectedStatusCode: z.number().int().default(200),
  timeout: z.number().int().positive().default(5000),
  interval: z.number().int().positive().default(60000),
  retries: z.number().int().nonnegative().default(3),
  headers: z.record(z.string(), z.string()).default({}),
  body: z.string().nullable(),
  isActive: z.boolean().default(true),
  lastCheckedAt: z.coerce.date().nullable(),
  lastSuccessAt: z.coerce.date().nullable(),
  lastFailureAt: z.coerce.date().nullable(),
  consecutiveFailures: z.number().int().nonnegative().default(0),
  uptime: z.number().min(0).max(100).default(100),
});

/**
 * Health check result schema
 */
export const HealthCheckResultSchema = z.object({
  id: z.string().uuid(),
  healthCheckId: z.string().uuid(),
  timestamp: z.coerce.date(),
  status: z.enum(['up', 'down', 'degraded']),
  responseTime: z.number().nonnegative(),
  statusCode: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  responseSize: z.number().int().nonnegative().nullable(),
  certificateExpiry: z.coerce.date().nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
});

/**
 * SLA (Service Level Agreement) schema
 */
export const SlaSchema = BaseEntitySchema.extend({
  name: z.string().min(1).max(100),
  service: z.string(),
  targetUptime: z.number().min(0).max(100),
  targetResponseTime: z.number().positive(),
  windowDuration: z.enum(['hour', 'day', 'week', 'month']),
  notificationChannels: z.array(z.string().uuid()),
  isActive: z.boolean().default(true),
  createdBy: z.string().uuid(),
  currentUptime: z.number().min(0).max(100).default(100),
  currentResponseTime: z.number().positive().default(0),
  lastCalculatedAt: z.coerce.date().nullable(),
});

/**
 * Performance baseline schema
 */
export const PerformanceBaselineSchema = BaseEntitySchema.extend({
  service: z.string(),
  metricName: z.string(),
  aggregationType: z.enum(['avg', 'p50', 'p95', 'p99', 'min', 'max']),
  baseline: z.number(),
  tolerance: z.number().positive(),
  windowDuration: z.number().int().positive(),
  calculatedAt: z.coerce.date(),
  sampleSize: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
  isActive: z.boolean().default(true),
});

// Type exports
export type Metric = z.infer<typeof MetricSchema>;
export type SystemMetric = z.infer<typeof SystemMetricSchema>;
export type ApplicationMetric = z.infer<typeof ApplicationMetricSchema>;
export type BusinessMetric = z.infer<typeof BusinessMetricSchema>;
export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type NotificationChannel = z.infer<typeof NotificationChannelSchema>;
export type AlertNotification = z.infer<typeof AlertNotificationSchema>;
export type HealthCheck = z.infer<typeof HealthCheckSchema>;
export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;
export type Sla = z.infer<typeof SlaSchema>;
export type PerformanceBaseline = z.infer<typeof PerformanceBaselineSchema>;
