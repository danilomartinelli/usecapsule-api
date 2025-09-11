/**
 * RabbitMQ Message Patterns and Constants
 *
 * This file contains all shared message patterns, routing keys, and metadata symbols
 * used across the Capsule Platform microservices for consistent messaging.
 */

// ============================================================================
// Message Pattern Symbols
// ============================================================================

/**
 * Symbol for health check message pattern metadata.
 */
export const HEALTH_CHECK_PATTERN = Symbol('health.check.pattern');

/**
 * Symbol for retry policy metadata.
 */
export const RETRY_POLICY_METADATA = Symbol('rabbitmq:retry-policy');

/**
 * Symbol for message timeout metadata.
 */
export const MESSAGE_TIMEOUT_METADATA = Symbol('rabbitmq:timeout');

/**
 * Symbol for message priority metadata.
 */
export const MESSAGE_PRIORITY_METADATA = Symbol('rabbitmq:priority');

// ============================================================================
// Message Patterns
// ============================================================================

/**
 * Health check message patterns for all services.
 */
export const MESSAGE_PATTERNS = {
  HEALTH_CHECK: 'health.check',
  SERVICE_STATUS: 'service.status',
} as const;

/**
 * Authentication service message patterns.
 */
export const AUTH_PATTERNS = {
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',
  VALIDATE_TOKEN: 'auth.validate-token',
  REFRESH_TOKEN: 'auth.refresh-token',
  RESET_PASSWORD: 'auth.reset-password',
  UPDATE_PROFILE: 'auth.update-profile',
} as const;

/**
 * Billing service message patterns.
 */
export const BILLING_PATTERNS = {
  CREATE_SUBSCRIPTION: 'billing.create-subscription',
  CANCEL_SUBSCRIPTION: 'billing.cancel-subscription',
  UPDATE_PAYMENT_METHOD: 'billing.update-payment-method',
  PROCESS_PAYMENT: 'billing.process-payment',
  GET_INVOICE: 'billing.get-invoice',
  WEBHOOK_STRIPE: 'billing.webhook-stripe',
} as const;

/**
 * Deploy service message patterns.
 */
export const DEPLOY_PATTERNS = {
  CREATE_DEPLOYMENT: 'deploy.create',
  UPDATE_DEPLOYMENT: 'deploy.update',
  DELETE_DEPLOYMENT: 'deploy.delete',
  GET_DEPLOYMENT_STATUS: 'deploy.status',
  SCALE_DEPLOYMENT: 'deploy.scale',
  ROLLBACK_DEPLOYMENT: 'deploy.rollback',
} as const;

/**
 * Monitor service message patterns.
 */
export const MONITOR_PATTERNS = {
  COLLECT_METRICS: 'monitor.collect-metrics',
  GET_METRICS: 'monitor.get-metrics',
  CREATE_ALERT: 'monitor.create-alert',
  UPDATE_ALERT: 'monitor.update-alert',
  GET_SERVICE_HEALTH: 'monitor.service-health',
} as const;

// ============================================================================
// Routing Keys
// ============================================================================

/**
 * RabbitMQ routing keys for command exchange.
 */
export const ROUTING_KEYS = {
  AUTH: 'auth.*',
  BILLING: 'billing.*',
  DEPLOY: 'deploy.*',
  MONITOR: 'monitor.*',
  HEALTH: 'health.*',
} as const;

/**
 * Health check routing keys for each service.
 */
export const HEALTH_CHECK_ROUTING_KEYS = {
  AUTH: 'auth.health',
  BILLING: 'billing.health',
  DEPLOY: 'deploy.health',
  MONITOR: 'monitor.health',
} as const;

/**
 * Routing key to service name mapping for health checks.
 */
export const ROUTING_KEY_TO_SERVICE = {
  'auth.health': 'auth-service',
  'billing.health': 'billing-service',
  'deploy.health': 'deploy-service',
  'monitor.health': 'monitor-service',
} as const;

/**
 * Event routing keys for event-driven communication.
 */
export const EVENT_ROUTING_KEYS = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',
  ALERT_TRIGGERED: 'alert.triggered',
  METRICS_COLLECTED: 'metrics.collected',
} as const;

// ============================================================================
// Exchange Names
// ============================================================================

/**
 * RabbitMQ exchange names.
 */
// Note: Exchange and queue names are defined in /devtools/infra/rabbitmq/definitions.json
// and managed by RabbitMQ infrastructure. Only application-level constants are kept here.

// ============================================================================
// Message Types
// ============================================================================

/**
 * Types of messages in the system.
 */
export enum MessageType {
  COMMAND = 'command',
  QUERY = 'query',
  EVENT = 'event',
  HEALTH_CHECK = 'health_check',
}

/**
 * Message priorities (0 = lowest, 255 = highest).
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 100,
  HIGH = 200,
  CRITICAL = 255,
}

// ============================================================================
// Type Helpers
// ============================================================================

/**
 * Union type of all message patterns.
 */
export type AllMessagePatterns =
  | (typeof MESSAGE_PATTERNS)[keyof typeof MESSAGE_PATTERNS]
  | (typeof AUTH_PATTERNS)[keyof typeof AUTH_PATTERNS]
  | (typeof BILLING_PATTERNS)[keyof typeof BILLING_PATTERNS]
  | (typeof DEPLOY_PATTERNS)[keyof typeof DEPLOY_PATTERNS]
  | (typeof MONITOR_PATTERNS)[keyof typeof MONITOR_PATTERNS];

/**
 * Union type of all routing keys.
 */
export type AllRoutingKeys =
  | (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS]
  | (typeof EVENT_ROUTING_KEYS)[keyof typeof EVENT_ROUTING_KEYS];
