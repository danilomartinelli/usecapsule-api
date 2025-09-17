import type { z } from 'zod';

/**
 * Base interface for all database entity schemas
 */
export interface DatabaseEntity {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Common database query result types
 */
export interface QueryMetadata {
  readonly rowCount: number;
  readonly command: string;
  readonly oid?: number;
}

/**
 * Pagination parameters for database queries
 */
export interface PaginationParams {
  readonly limit: number;
  readonly offset: number;
  readonly orderBy?: string;
  readonly orderDirection?: 'ASC' | 'DESC';
}

/**
 * Paginated query result
 */
export interface PaginatedResult<T> {
  readonly data: readonly T[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly pagination: PaginationParams;
}

/**
 * Database health check result
 */
export interface DatabaseHealthResult {
  readonly isHealthy: boolean;
  readonly connectionCount: number;
  readonly poolSize: number;
  readonly responseTime: number;
  readonly lastChecked: Date;
  readonly error?: string;
}

/**
 * Database migration status
 */
export interface MigrationStatus {
  readonly version: string;
  readonly appliedAt: Date;
  readonly description: string;
  readonly checksum: string;
}

/**
 * Service-specific database schema validation
 */
export interface ServiceSchemaValidation {
  readonly service: string;
  readonly schemaVersion: string;
  readonly isValid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

/**
 * Audit log entry for database operations
 */
export interface AuditLogEntry extends DatabaseEntity {
  readonly userId?: string;
  readonly service: string;
  readonly operation: 'CREATE' | 'UPDATE' | 'DELETE' | 'READ';
  readonly tableName: string;
  readonly recordId: string;
  readonly changes?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Database transaction context
 */
export interface TransactionContext {
  readonly transactionId: string;
  readonly startedAt: Date;
  readonly userId?: string;
  readonly service: string;
  readonly isolationLevel:
    | 'READ_COMMITTED'
    | 'REPEATABLE_READ'
    | 'SERIALIZABLE';
}

/**
 * Type-safe query builder helper for Zod schemas
 */
export type TypedQuery<T extends z.ZodTypeAny> = {
  readonly schema: T;
  readonly sql: string;
  readonly parameters: readonly unknown[];
};

/**
 * Common database error types
 */
export enum DatabaseErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  QUERY_TIMEOUT = 'QUERY_TIMEOUT',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  DUPLICATE_KEY = 'DUPLICATE_KEY',
  NOT_FOUND = 'NOT_FOUND',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
}

/**
 * Structured database error with context
 */
export interface DatabaseError {
  readonly type: DatabaseErrorType;
  readonly message: string;
  readonly service: string;
  readonly operation?: string;
  readonly query?: string;
  readonly parameters?: readonly unknown[];
  readonly originalError?: Error;
  readonly context?: Record<string, unknown>;
}
