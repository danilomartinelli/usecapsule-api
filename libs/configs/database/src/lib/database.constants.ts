/**
 * Database module constants for dependency injection tokens.
 *
 * These symbols ensure type-safe dependency injection for database-related
 * services throughout the application.
 */

/**
 * Injection token for the database pool instance.
 * Used to inject the configured Slonik DatabasePool into services.
 */
export const DATABASE_POOL = Symbol('DATABASE_POOL') as symbol;

/**
 * Injection token for database module options.
 * Used to inject configuration options into database providers.
 */
export const DATABASE_OPTIONS = Symbol('DATABASE_OPTIONS') as symbol;
