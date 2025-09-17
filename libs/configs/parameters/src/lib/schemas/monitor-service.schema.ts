import { z } from 'zod';

import { timeoutConfigSchema } from './timeout.schema';

/**
 * Zod schema for Monitor Service environment variables validation.
 *
 * This schema validates all required and optional environment variables
 * for the Monitor Service in the DDD microservices architecture. The Monitor Service
 * handles metrics collection, observability, alerting, and performance monitoring.
 *
 * @example
 * ```typescript
 * import { monitorServiceSchema, type MonitorServiceSchema } from './monitor-service.schema';
 *
 * // Parse and validate environment variables
 * const config: MonitorServiceSchema = monitorServiceSchema.parse(process.env);
 *
 * // Safe parsing with error handling
 * const result = monitorServiceSchema.safeParse(process.env);
 * if (!result.success) {
 *   console.error('Invalid environment configuration:', result.error);
 *   process.exit(1);
 * }
 * ```
 */
export const monitorServiceSchema = z
  .object({
    /**
     * Application environment mode.
     * Determines the runtime behavior and feature flags.
     *
     * @default 'development'
     */
    NODE_ENV: z
      .enum(['test', 'development', 'production'])
      .default('development')
      .describe('Application environment mode'),

    /**
     * Application deployment environment.
     * Used for environment-specific configurations and feature toggles.
     *
     * @default 'local'
     */
    APP_ENV: z
      .enum(['test', 'local', 'development', 'staging', 'production', 'canary'])
      .default('local')
      .describe('Application deployment environment'),

    /**
     * Service name identifier for the Monitor Service.
     * Must be 'monitor-service' to ensure proper service identification.
     */
    SERVICE_NAME: z
      .literal('monitor-service')
      .describe('Service name identifier'),

    /**
     * RabbitMQ connection URL.
     * Used for receiving monitoring requests from the API Gateway
     * and communicating with other microservices.
     *
     * @example 'amqp://user:password@localhost:5672'
     */
    RABBITMQ_URL: z
      .string()
      .url()
      .startsWith('amqp')
      .describe('RabbitMQ connection URL for inter-service communication'),

    /**
     * Database host for the Monitor Service.
     * PostgreSQL server hostname or IP address for monitoring-specific data.
     */
    MONITOR_DB_HOST: z
      .string()
      .min(1)
      .describe('Database host for Monitor Service'),

    /**
     * Database port for the Monitor Service.
     * PostgreSQL server port number.
     *
     * @default 5432
     */
    MONITOR_DB_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(5432)
      .describe('Database port for Monitor Service'),

    /**
     * Database name for the Monitor Service.
     * PostgreSQL database name containing monitoring-related tables.
     */
    MONITOR_DB_NAME: z
      .string()
      .min(1)
      .describe('Database name for Monitor Service'),

    /**
     * Database username for the Monitor Service.
     * PostgreSQL user with appropriate permissions for monitoring database operations.
     */
    MONITOR_DB_USER: z
      .string()
      .min(1)
      .describe('Database username for Monitor Service'),

    /**
     * Database password for the Monitor Service.
     * PostgreSQL user password for secure database connections.
     */
    MONITOR_DB_PASSWORD: z
      .string()
      .min(1)
      .describe('Database password for Monitor Service'),

    /**
     * Enable SSL for database connections.
     * Controls whether database connections use SSL encryption.
     *
     * @default false
     */
    MONITOR_DB_SSL: z
      .boolean()
      .default(false)
      .describe('Enable SSL for database connections'),

    /**
     * Prometheus endpoint URL.
     * URL where Prometheus server is accessible for scraping metrics.
     * Optional - metrics collection is disabled if not provided.
     *
     * @example 'http://localhost:9090'
     */
    PROMETHEUS_URL: z
      .string()
      .url()
      .optional()
      .describe('Prometheus server URL for metrics collection'),

    /**
     * Prometheus pushgateway URL.
     * URL for pushing metrics to Prometheus pushgateway.
     * Optional - push metrics are disabled if not provided.
     *
     * @example 'http://localhost:9091'
     */
    PROMETHEUS_PUSHGATEWAY_URL: z
      .string()
      .url()
      .optional()
      .describe('Prometheus pushgateway URL for pushing metrics'),

    /**
     * Grafana dashboard URL.
     * URL where Grafana dashboards are accessible.
     * Optional - dashboard integration is disabled if not provided.
     *
     * @example 'http://localhost:3000'
     */
    GRAFANA_URL: z
      .string()
      .url()
      .optional()
      .describe('Grafana dashboard URL for visualization'),

    /**
     * Grafana API token.
     * API token for authenticating with Grafana API.
     * Optional - API integration is disabled if not provided.
     */
    GRAFANA_API_TOKEN: z
      .string()
      .min(1)
      .optional()
      .describe('Grafana API token for dashboard management'),

    /**
     * Alertmanager URL.
     * URL where Alertmanager is accessible for sending alerts.
     * Optional - alerting is disabled if not provided.
     *
     * @example 'http://localhost:9093'
     */
    ALERTMANAGER_URL: z
      .string()
      .url()
      .optional()
      .describe('Alertmanager URL for sending alerts'),

    /**
     * Metrics collection interval in seconds.
     * How often to collect and process metrics data.
     *
     * @default 60
     * @minimum 10
     * @maximum 3600
     */
    METRICS_COLLECTION_INTERVAL_SECONDS: z
      .number()
      .int()
      .min(10, 'Collection interval must be at least 10 seconds')
      .max(3600, 'Collection interval cannot exceed 1 hour')
      .default(60)
      .describe('Metrics collection interval in seconds'),

    /**
     * Metrics retention period in days.
     * How long to retain metrics data before cleanup.
     *
     * @default 90
     * @minimum 1
     * @maximum 365
     */
    METRICS_RETENTION_DAYS: z
      .number()
      .int()
      .min(1, 'Retention period must be at least 1 day')
      .max(365, 'Retention period cannot exceed 365 days')
      .default(90)
      .describe('Metrics data retention period in days'),

    /**
     * Alert threshold for CPU usage percentage.
     * CPU usage percentage that triggers alerts.
     *
     * @default 80
     * @minimum 1
     * @maximum 99
     */
    ALERT_CPU_THRESHOLD_PERCENT: z
      .number()
      .int()
      .min(1, 'CPU threshold must be at least 1%')
      .max(99, 'CPU threshold cannot exceed 99%')
      .default(80)
      .describe('CPU usage alert threshold percentage'),

    /**
     * Alert threshold for memory usage percentage.
     * Memory usage percentage that triggers alerts.
     *
     * @default 85
     * @minimum 1
     * @maximum 99
     */
    ALERT_MEMORY_THRESHOLD_PERCENT: z
      .number()
      .int()
      .min(1, 'Memory threshold must be at least 1%')
      .max(99, 'Memory threshold cannot exceed 99%')
      .default(85)
      .describe('Memory usage alert threshold percentage'),

    /**
     * Alert threshold for disk usage percentage.
     * Disk usage percentage that triggers alerts.
     *
     * @default 90
     * @minimum 1
     * @maximum 99
     */
    ALERT_DISK_THRESHOLD_PERCENT: z
      .number()
      .int()
      .min(1, 'Disk threshold must be at least 1%')
      .max(99, 'Disk threshold cannot exceed 99%')
      .default(90)
      .describe('Disk usage alert threshold percentage'),

    /**
     * Logging level for the Monitor Service.
     * Determines which log messages are output.
     *
     * @default 'info'
     */
    LOG_LEVEL: z
      .enum(['error', 'warn', 'info', 'debug'])
      .default('info')
      .describe('Application logging level'),

    /**
     * Redis server hostname or IP address.
     * Used for caching and session storage.
     *
     * @default 'localhost'
     */
    REDIS_HOST: z
      .string()
      .min(1)
      .default('localhost')
      .describe('Redis server hostname or IP address'),

    /**
     * Redis server port number.
     * The port on which Redis server is listening.
     *
     * @default 6379
     */
    REDIS_PORT: z
      .number()
      .int()
      .positive()
      .max(65535)
      .default(6379)
      .describe('Redis server port number'),

    /**
     * Redis password for authentication.
     * Required if Redis server has authentication enabled.
     */
    REDIS_PASSWORD: z
      .string()
      .min(1)
      .optional()
      .describe('Redis password for authentication'),

    /**
     * Redis database number to use.
     * Redis supports multiple databases (0-15 by default).
     *
     * @default 0
     */
    REDIS_DB: z
      .number()
      .int()
      .min(0)
      .max(15)
      .default(0)
      .describe('Redis database number to use'),
  })
  // Merge with timeout configuration schema
  .merge(timeoutConfigSchema)
  .strict(); // Reject undefined environment variables

/**
 * TypeScript type inferred from the Monitor Service schema.
 * Use this type for type-safe access to validated configuration.
 *
 * @example
 * ```typescript
 * function createMonitorService(config: MonitorServiceSchema) {
 *   const prometheusConfig = {
 *     url: config.PROMETHEUS_URL,
 *     pushgatewayUrl: config.PROMETHEUS_PUSHGATEWAY_URL,
 *     collectionInterval: config.METRICS_COLLECTION_INTERVAL_SECONDS,
 *   };
 *
 *   const alertConfig = {
 *     alertmanagerUrl: config.ALERTMANAGER_URL,
 *     thresholds: {
 *       cpu: config.ALERT_CPU_THRESHOLD_PERCENT,
 *       memory: config.ALERT_MEMORY_THRESHOLD_PERCENT,
 *       disk: config.ALERT_DISK_THRESHOLD_PERCENT,
 *     },
 *   };
 *
 *   const dbConfig = {
 *     host: config.MONITOR_DB_HOST,
 *     port: config.MONITOR_DB_PORT,
 *     database: config.MONITOR_DB_NAME,
 *     username: config.MONITOR_DB_USER,
 *     password: config.MONITOR_DB_PASSWORD,
 *     ssl: config.MONITOR_DB_SSL,
 *   };
 * }
 * ```
 */
export type MonitorServiceSchema = z.infer<typeof monitorServiceSchema>;

/**
 * Input type for the Monitor Service schema before validation.
 * Useful for testing and when working with raw environment variables.
 */
export type MonitorServiceInput = z.input<typeof monitorServiceSchema>;
