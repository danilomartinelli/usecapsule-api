/**
 * RabbitMQ Message Patterns and Constants
 *
 * This file contains all shared message patterns, routing keys, and metadata symbols
 * used across the Capsule Platform microservices for consistent messaging.
 *
 * @fileoverview Centralized RabbitMQ routing key and exchange constants
 * @module @usecapsule/messaging/constants
 */

// ============================================================================
// Exchange Constants
// ============================================================================

/**
 * RabbitMQ exchange names used across the platform.
 * These exchanges handle different types of message routing patterns.
 */
export const EXCHANGES = {
  /**
   * Direct exchange for command/query operations (RPC pattern).
   * Routes messages using exact routing key matches.
   */
  COMMANDS: 'capsule.commands',

  /**
   * Topic exchange for event-driven communication.
   * Routes messages using pattern matching with wildcards.
   */
  EVENTS: 'capsule.events',

  /**
   * Dead letter exchange for failed message handling.
   * Handles message failures and retry scenarios.
   */
  DEAD_LETTER: 'dlx',
} as const;

// ============================================================================
// Service Routing Keys
// ============================================================================

/**
 * Authentication service routing keys for command operations.
 * All auth service commands use the capsule.commands exchange.
 */
export const AUTH_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'auth.health',
  STATUS: 'auth.status',

  // Authentication Operations
  LOGIN: 'auth.login',
  LOGOUT: 'auth.logout',
  REGISTER: 'auth.register',

  // Token Management
  VALIDATE_TOKEN: 'auth.validate-token',
  REFRESH_TOKEN: 'auth.refresh-token',

  // Account Management
  RESET_PASSWORD: 'auth.reset-password',
  UPDATE_PROFILE: 'auth.update-profile',
  GET_USER: 'auth.get-user',
  DELETE_USER: 'auth.delete-user',

  // Permissions
  CHECK_PERMISSIONS: 'auth.check-permissions',
  UPDATE_PERMISSIONS: 'auth.update-permissions',
} as const;

/**
 * Billing service routing keys for command operations.
 * All billing service commands use the capsule.commands exchange.
 */
export const BILLING_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'billing.health',
  STATUS: 'billing.status',

  // Subscription Management
  CREATE_SUBSCRIPTION: 'billing.create-subscription',
  CANCEL_SUBSCRIPTION: 'billing.cancel-subscription',
  UPDATE_SUBSCRIPTION: 'billing.update-subscription',
  GET_SUBSCRIPTION: 'billing.get-subscription',

  // Payment Processing
  PROCESS_PAYMENT: 'billing.process-payment',
  CHARGE: 'billing.charge',
  REFUND: 'billing.refund',

  // Payment Methods
  UPDATE_PAYMENT_METHOD: 'billing.update-payment-method',
  DELETE_PAYMENT_METHOD: 'billing.delete-payment-method',

  // Invoicing
  GET_INVOICE: 'billing.get-invoice',
  CREATE_INVOICE: 'billing.create-invoice',

  // Webhooks
  WEBHOOK_STRIPE: 'billing.webhook-stripe',
  WEBHOOK_PAYPAL: 'billing.webhook-paypal',
} as const;

/**
 * Deploy service routing keys for command operations.
 * All deploy service commands use the capsule.commands exchange.
 */
export const DEPLOY_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'deploy.health',
  STATUS: 'deploy.status',

  // Deployment Lifecycle
  CREATE: 'deploy.create',
  UPDATE: 'deploy.update',
  DELETE: 'deploy.delete',
  START: 'deploy.start',
  STOP: 'deploy.stop',
  RESTART: 'deploy.restart',

  // Deployment Management
  GET_DEPLOYMENT: 'deploy.get-deployment',
  LIST_DEPLOYMENTS: 'deploy.list-deployments',
  GET_DEPLOYMENT_STATUS: 'deploy.get-status',

  // Scaling
  SCALE: 'deploy.scale',
  AUTO_SCALE: 'deploy.auto-scale',

  // Version Management
  ROLLBACK: 'deploy.rollback',
  PROMOTE: 'deploy.promote',

  // Build Operations
  BUILD_IMAGE: 'deploy.build-image',
  PUSH_IMAGE: 'deploy.push-image',
} as const;

/**
 * Monitor service routing keys for command operations.
 * All monitor service commands use the capsule.commands exchange.
 */
export const MONITOR_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'monitor.health',
  STATUS: 'monitor.status',

  // Metrics Collection
  COLLECT_METRICS: 'monitor.collect-metrics',
  GET_METRICS: 'monitor.get-metrics',
  TRACK: 'monitor.track',

  // Alerting
  CREATE_ALERT: 'monitor.create-alert',
  UPDATE_ALERT: 'monitor.update-alert',
  DELETE_ALERT: 'monitor.delete-alert',
  TRIGGER_ALERT: 'monitor.trigger-alert',

  // Service Health
  GET_SERVICE_HEALTH: 'monitor.get-service-health',
  CHECK_ALL_SERVICES: 'monitor.check-all-services',

  // Performance Monitoring
  PERFORMANCE_REPORT: 'monitor.performance-report',
  RESOURCE_USAGE: 'monitor.resource-usage',
} as const;

// ============================================================================
// Event Routing Keys
// ============================================================================

/**
 * Event routing keys for event-driven communication.
 * All events use the capsule.events topic exchange with pattern matching.
 */
export const EVENT_ROUTING_KEYS = {
  // User Events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',

  // Subscription Events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',

  // Payment Events
  PAYMENT_PROCESSED: 'payment.processed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_DISPUTED: 'payment.disputed',

  // Deployment Events
  DEPLOYMENT_STARTED: 'deployment.started',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',
  DEPLOYMENT_ROLLED_BACK: 'deployment.rolled-back',

  // Monitoring Events
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_RESOLVED: 'alert.resolved',
  METRICS_COLLECTED: 'metrics.collected',
  SERVICE_DOWN: 'service.down',
  SERVICE_UP: 'service.up',

  // Error Events
  ERROR_OCCURRED: 'error.occurred',
  CRITICAL_ERROR: 'error.critical',

  // Batch Operations
  BATCH_STARTED: 'batch.started',
  BATCH_COMPLETED: 'batch.completed',
  BATCH_FAILED: 'batch.failed',
} as const;

// ============================================================================
// Pattern Matching Routing Keys
// ============================================================================

/**
 * Wildcard routing key patterns for subscribing to multiple related messages.
 * Used primarily with topic exchanges for broad event subscriptions.
 */
export const ROUTING_KEY_PATTERNS = {
  // Service-specific patterns
  AUTH_ALL: 'auth.*',
  BILLING_ALL: 'billing.*',
  DEPLOY_ALL: 'deploy.*',
  MONITOR_ALL: 'monitor.*',

  // Health check patterns
  ALL_HEALTH: '*.health',
  ALL_STATUS: '*.status',

  // Event patterns
  USER_EVENTS: 'user.*',
  PAYMENT_EVENTS: 'payment.*',
  DEPLOYMENT_EVENTS: 'deployment.*',
  ALERT_EVENTS: 'alert.*',
  ERROR_EVENTS: 'error.*',

  // Cross-cutting patterns
  ALL_EVENTS: '*.*',
  CRITICAL_EVENTS: '*.critical',
  BATCH_EVENTS: 'batch.*',
} as const;

// ============================================================================
// Legacy Pattern Support (Deprecated - Use Routing Keys Instead)
// ============================================================================

/**
 * @deprecated Use specific routing key constants instead
 * Legacy message patterns - kept for backward compatibility only
 */
export const MESSAGE_PATTERNS = {
  HEALTH_CHECK: 'health.check',
  SERVICE_STATUS: 'service.status',
} as const;

/**
 * @deprecated Use AUTH_ROUTING_KEYS instead
 * Legacy auth patterns - kept for backward compatibility only
 */
export const AUTH_PATTERNS = {
  LOGIN: AUTH_ROUTING_KEYS.LOGIN,
  LOGOUT: AUTH_ROUTING_KEYS.LOGOUT,
  REGISTER: AUTH_ROUTING_KEYS.REGISTER,
  VALIDATE_TOKEN: AUTH_ROUTING_KEYS.VALIDATE_TOKEN,
  REFRESH_TOKEN: AUTH_ROUTING_KEYS.REFRESH_TOKEN,
  RESET_PASSWORD: AUTH_ROUTING_KEYS.RESET_PASSWORD,
  UPDATE_PROFILE: AUTH_ROUTING_KEYS.UPDATE_PROFILE,
} as const;

/**
 * @deprecated Use BILLING_ROUTING_KEYS instead
 * Legacy billing patterns - kept for backward compatibility only
 */
export const BILLING_PATTERNS = {
  CREATE_SUBSCRIPTION: BILLING_ROUTING_KEYS.CREATE_SUBSCRIPTION,
  CANCEL_SUBSCRIPTION: BILLING_ROUTING_KEYS.CANCEL_SUBSCRIPTION,
  UPDATE_PAYMENT_METHOD: BILLING_ROUTING_KEYS.UPDATE_PAYMENT_METHOD,
  PROCESS_PAYMENT: BILLING_ROUTING_KEYS.PROCESS_PAYMENT,
  GET_INVOICE: BILLING_ROUTING_KEYS.GET_INVOICE,
  WEBHOOK_STRIPE: BILLING_ROUTING_KEYS.WEBHOOK_STRIPE,
} as const;

/**
 * @deprecated Use DEPLOY_ROUTING_KEYS instead
 * Legacy deploy patterns - kept for backward compatibility only
 */
export const DEPLOY_PATTERNS = {
  CREATE_DEPLOYMENT: DEPLOY_ROUTING_KEYS.CREATE,
  UPDATE_DEPLOYMENT: DEPLOY_ROUTING_KEYS.UPDATE,
  DELETE_DEPLOYMENT: DEPLOY_ROUTING_KEYS.DELETE,
  GET_DEPLOYMENT_STATUS: DEPLOY_ROUTING_KEYS.GET_DEPLOYMENT_STATUS,
  SCALE_DEPLOYMENT: DEPLOY_ROUTING_KEYS.SCALE,
  ROLLBACK_DEPLOYMENT: DEPLOY_ROUTING_KEYS.ROLLBACK,
} as const;

/**
 * @deprecated Use MONITOR_ROUTING_KEYS instead
 * Legacy monitor patterns - kept for backward compatibility only
 */
export const MONITOR_PATTERNS = {
  COLLECT_METRICS: MONITOR_ROUTING_KEYS.COLLECT_METRICS,
  GET_METRICS: MONITOR_ROUTING_KEYS.GET_METRICS,
  CREATE_ALERT: MONITOR_ROUTING_KEYS.CREATE_ALERT,
  UPDATE_ALERT: MONITOR_ROUTING_KEYS.UPDATE_ALERT,
  GET_SERVICE_HEALTH: MONITOR_ROUTING_KEYS.GET_SERVICE_HEALTH,
} as const;

/**
 * @deprecated Use ROUTING_KEY_PATTERNS instead
 * Legacy routing keys - kept for backward compatibility only
 */
export const ROUTING_KEYS = {
  AUTH: ROUTING_KEY_PATTERNS.AUTH_ALL,
  BILLING: ROUTING_KEY_PATTERNS.BILLING_ALL,
  DEPLOY: ROUTING_KEY_PATTERNS.DEPLOY_ALL,
  MONITOR: ROUTING_KEY_PATTERNS.MONITOR_ALL,
  HEALTH: ROUTING_KEY_PATTERNS.ALL_HEALTH,
} as const;

// ============================================================================
// Message Metadata
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
 * Used for RabbitMQ message priority handling.
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 100,
  HIGH = 200,
  CRITICAL = 255,
}

/**
 * Service names used throughout the platform.
 * These should match the actual microservice names.
 */
export enum ServiceName {
  AUTH = 'auth-service',
  BILLING = 'billing-service',
  DEPLOY = 'deploy-service',
  MONITOR = 'monitor-service',
  API_GATEWAY = 'api-gateway',
}

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Union type of all exchange names.
 */
export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];

/**
 * Union type of all command routing keys (for RPC operations).
 */
export type CommandRoutingKey =
  | (typeof AUTH_ROUTING_KEYS)[keyof typeof AUTH_ROUTING_KEYS]
  | (typeof BILLING_ROUTING_KEYS)[keyof typeof BILLING_ROUTING_KEYS]
  | (typeof DEPLOY_ROUTING_KEYS)[keyof typeof DEPLOY_ROUTING_KEYS]
  | (typeof MONITOR_ROUTING_KEYS)[keyof typeof MONITOR_ROUTING_KEYS];

/**
 * Union type of all event routing keys.
 */
export type EventRoutingKey =
  (typeof EVENT_ROUTING_KEYS)[keyof typeof EVENT_ROUTING_KEYS];

/**
 * Union type of all routing key patterns (for subscriptions).
 */
export type RoutingKeyPattern =
  (typeof ROUTING_KEY_PATTERNS)[keyof typeof ROUTING_KEY_PATTERNS];

/**
 * Union type of all possible routing keys.
 */
export type AnyRoutingKey =
  | CommandRoutingKey
  | EventRoutingKey
  | RoutingKeyPattern;

/**
 * Service health routing keys - commonly used pattern.
 */
export type HealthRoutingKey =
  | typeof AUTH_ROUTING_KEYS.HEALTH
  | typeof BILLING_ROUTING_KEYS.HEALTH
  | typeof DEPLOY_ROUTING_KEYS.HEALTH
  | typeof MONITOR_ROUTING_KEYS.HEALTH;

/**
 * @deprecated Use specific routing key types instead
 * Legacy union types - kept for backward compatibility only
 */
export type AllMessagePatterns =
  | (typeof MESSAGE_PATTERNS)[keyof typeof MESSAGE_PATTERNS]
  | (typeof AUTH_PATTERNS)[keyof typeof AUTH_PATTERNS]
  | (typeof BILLING_PATTERNS)[keyof typeof BILLING_PATTERNS]
  | (typeof DEPLOY_PATTERNS)[keyof typeof DEPLOY_PATTERNS]
  | (typeof MONITOR_PATTERNS)[keyof typeof MONITOR_PATTERNS];

/**
 * @deprecated Use AnyRoutingKey instead
 * Legacy routing key type - kept for backward compatibility only
 */
export type AllRoutingKeys = AnyRoutingKey;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extracts service name from a routing key.
 * @param routingKey - The routing key to parse (e.g., 'auth.health')
 * @returns The service name portion (e.g., 'auth')
 */
export function getServiceFromRoutingKey(routingKey: string): string {
  return routingKey.split('.')[0];
}

/**
 * Extracts action from a routing key.
 * @param routingKey - The routing key to parse (e.g., 'auth.health')
 * @returns The action portion (e.g., 'health')
 */
export function getActionFromRoutingKey(routingKey: string): string {
  const parts = routingKey.split('.');
  return parts.slice(1).join('.');
}

/**
 * Validates if a routing key follows the expected pattern.
 * @param routingKey - The routing key to validate
 * @returns True if the routing key is valid
 */
export function isValidRoutingKey(routingKey: string): boolean {
  // Basic validation: should have at least one dot and valid characters
  return /^[a-z][a-z0-9-]*\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/.test(
    routingKey,
  );
}

/**
 * Checks if a routing key is a health check key.
 * @param routingKey - The routing key to check
 * @returns True if it's a health check routing key
 */
export function isHealthCheckRoutingKey(
  routingKey: string,
): routingKey is HealthRoutingKey {
  return routingKey.endsWith('.health');
}

/**
 * Gets the appropriate exchange for a routing key.
 * @param routingKey - The routing key
 * @returns The exchange name to use
 */
export function getExchangeForRoutingKey(
  routingKey: CommandRoutingKey | EventRoutingKey,
): ExchangeName {
  // Events typically use patterns like 'entity.action' (user.created, payment.processed)
  // Commands typically use patterns like 'service.action' (auth.login, billing.charge)
  const parts = routingKey.split('.');
  const firstPart = parts[0];

  // Check if it's a service command
  if (['auth', 'billing', 'deploy', 'monitor'].includes(firstPart)) {
    return EXCHANGES.COMMANDS;
  }

  // Otherwise it's likely an event
  return EXCHANGES.EVENTS;
}

/**
 * Type guard to check if a string is a valid command routing key.
 * @param key - The string to check
 * @returns True if it's a valid command routing key
 */
export function isCommandRoutingKey(key: string): key is CommandRoutingKey {
  const allCommandKeys = [
    ...Object.values(AUTH_ROUTING_KEYS),
    ...Object.values(BILLING_ROUTING_KEYS),
    ...Object.values(DEPLOY_ROUTING_KEYS),
    ...Object.values(MONITOR_ROUTING_KEYS),
  ];
  return allCommandKeys.includes(key as CommandRoutingKey);
}

/**
 * Type guard to check if a string is a valid event routing key.
 * @param key - The string to check
 * @returns True if it's a valid event routing key
 */
export function isEventRoutingKey(key: string): key is EventRoutingKey {
  return Object.values(EVENT_ROUTING_KEYS).includes(key as EventRoutingKey);
}
