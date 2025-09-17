/**
 * Redis module constants for dependency injection tokens.
 *
 * These symbols ensure type-safe dependency injection for Redis-related
 * services throughout the application.
 */

/**
 * Injection token for the Redis client instance.
 * Used to inject the configured ioredis client into services.
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT') as symbol;

/**
 * Injection token for Redis module options.
 * Used to inject configuration options into Redis providers.
 */
export const REDIS_OPTIONS = Symbol('REDIS_OPTIONS') as symbol;

/**
 * Injection token for service-specific Redis clients.
 * Each service gets its own Redis client with specific database selection.
 */
export const AUTH_REDIS_CLIENT = Symbol('AUTH_REDIS_CLIENT') as symbol;
export const BILLING_REDIS_CLIENT = Symbol('BILLING_REDIS_CLIENT') as symbol;
export const DEPLOY_REDIS_CLIENT = Symbol('DEPLOY_REDIS_CLIENT') as symbol;
export const MONITOR_REDIS_CLIENT = Symbol('MONITOR_REDIS_CLIENT') as symbol;
export const GATEWAY_REDIS_CLIENT = Symbol('GATEWAY_REDIS_CLIENT') as symbol;
