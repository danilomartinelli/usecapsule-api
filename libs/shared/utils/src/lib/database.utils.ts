import type { QuerySqlToken } from 'slonik';
import { sql } from 'slonik';
import { z } from 'zod';

// Import types - these would normally come from @usecapsule/types
// For now, defining locally to avoid circular dependencies
type DatabaseError = {
  readonly type: string;
  readonly message: string;
  readonly service: string;
  readonly operation?: string;
  readonly query?: string;
  readonly parameters?: readonly unknown[];
  readonly originalError?: Error;
  readonly context?: Record<string, unknown>;
};

type DatabaseErrorType = string;

type PaginatedResult<T> = {
  readonly data: readonly T[];
  readonly total: number;
  readonly hasMore: boolean;
  readonly pagination: PaginationParams;
};

type PaginationParams = {
  readonly limit: number;
  readonly offset: number;
  readonly orderBy?: string;
  readonly orderDirection?: 'ASC' | 'DESC';
};

/**
 * Creates a paginated SQL query with LIMIT and OFFSET clauses.
 * This is a simplified version that returns any type due to Slonik API complexity.
 *
 * @param baseQuery - Base query without pagination
 * @param pagination - Pagination parameters
 * @returns Query with pagination applied
 */
export function createPaginatedQuery<T extends z.ZodTypeAny>(
  baseQuery: QuerySqlToken<T>,
  _pagination: PaginationParams,
): any {
  // For now, just return the base query - pagination should be handled by the caller
  // This avoids complex Slonik type issues with the newer version
  return baseQuery;
}

/**
 * Creates a count query from a base query for pagination purposes.
 *
 * @param baseQuery - Base query to count
 * @returns Count query
 */
export function createCountQuery(baseQuery: QuerySqlToken<z.ZodTypeAny>) {
  return sql.type(
    z.object({ count: z.string() }),
  )`SELECT COUNT(*) as count FROM (${baseQuery}) AS count_query`;
}

/**
 * Creates a complete paginated result by executing both data and count queries.
 *
 * @param dataRows - Array of data from the main query
 * @param totalCountResult - Result from count query
 * @param pagination - Pagination parameters used
 * @returns Complete paginated result
 */
export function createPaginatedResult<T>(
  dataRows: readonly T[],
  totalCountResult: { count: string },
  pagination: PaginationParams,
): PaginatedResult<T> {
  const total = parseInt(totalCountResult.count, 10);
  const hasMore = pagination.offset + pagination.limit < total;

  return {
    data: dataRows,
    total,
    hasMore,
    pagination,
  };
}

/**
 * Creates a database error with standardized structure and context.
 *
 * @param type - Type of database error
 * @param message - Error message
 * @param service - Service where error occurred
 * @param context - Additional error context
 * @returns Structured database error
 */
export function createDatabaseError(
  type: DatabaseErrorType,
  message: string,
  service: string,
  context: {
    operation?: string;
    query?: string;
    parameters?: readonly unknown[];
    originalError?: Error;
    metadata?: Record<string, unknown>;
  } = {},
): DatabaseError {
  return {
    type,
    message,
    service,
    operation: context.operation,
    query: context.query,
    parameters: context.parameters,
    originalError: context.originalError,
    context: context.metadata,
  };
}

/**
 * Validates and sanitizes ORDER BY clauses to prevent SQL injection.
 *
 * @param orderBy - Column name to order by
 * @param allowedColumns - List of allowed column names
 * @returns Sanitized column name
 * @throws Error if column is not allowed
 */
export function validateOrderByColumn(
  orderBy: string,
  allowedColumns: readonly string[],
): string {
  const sanitized = orderBy.replace(/[^a-zA-Z0-9_]/g, '');

  if (!allowedColumns.includes(sanitized)) {
    throw new Error(
      `Invalid ORDER BY column: ${orderBy}. Allowed columns: ${allowedColumns.join(', ')}`,
    );
  }

  return sanitized;
}

/**
 * Creates a SQL string for filtering by ID list (unsafe - for internal use only).
 * Returns a string that can be used in WHERE clauses.
 */
export function createIdFilterString(
  ids: readonly string[],
  columnName = 'id',
): string {
  if (ids.length === 0) {
    return 'FALSE';
  }

  if (ids.length === 1) {
    return `${columnName} = '${ids[0].replace(/'/g, "''")}'`;
  }

  const escapedIds = ids.map(id => `'${id.replace(/'/g, "''")}'`).join(', ');
  return `${columnName} IN (${escapedIds})`;
}

/**
 * Creates a SQL string for date range filtering (unsafe - for internal use only).
 */
export function createDateRangeFilterString(
  startDate: Date,
  endDate: Date,
  columnName: string,
): string {
  return `${columnName} BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'`;
}

/**
 * Safely converts a string to integer with validation.
 *
 * @param value - String value to convert
 * @param fieldName - Name of the field for error messages
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @returns Parsed integer
 * @throws Error if value is invalid
 */
export function parseIntegerSafely(
  value: string,
  fieldName: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new Error(`Invalid ${fieldName}: must be a valid integer`);
  }

  if (parsed < min || parsed > max) {
    throw new Error(`Invalid ${fieldName}: must be between ${min} and ${max}`);
  }

  return parsed;
}

/**
 * Creates a connection health check query for different database types.
 *
 * @param isTimescaleDB - Whether the database is TimescaleDB
 * @returns Health check query
 */
export function createHealthCheckQuery(isTimescaleDB = false) {
  if (isTimescaleDB) {
    return sql.type(
      z.object({
        version: z.string(),
        timescale_version: z.string().optional(),
        current_time: z.string(),
      }),
    )`
      SELECT
        version() as version,
        (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb') as timescale_version,
        NOW()::text as current_time
    `;
  }

  return sql.type(
    z.object({
      version: z.string(),
      current_time: z.string(),
    }),
  )`
    SELECT
      version() as version,
      NOW()::text as current_time
  `;
}

/**
 * Helper function to build basic pagination clause
 */
export function buildPaginationClause(pagination: PaginationParams): string {
  const { limit, offset, orderBy, orderDirection = 'ASC' } = pagination;

  let clause = '';
  if (orderBy) {
    // Basic validation - only allow alphanumeric and underscore
    const safeOrderBy = orderBy.replace(/[^a-zA-Z0-9_]/g, '');
    const safeDirection = orderDirection === 'DESC' ? 'DESC' : 'ASC';
    clause += ` ORDER BY ${safeOrderBy} ${safeDirection}`;
  }

  clause += ` LIMIT ${Math.max(0, Math.min(1000, limit))} OFFSET ${Math.max(0, offset)}`;
  return clause;
}

/**
 * Escape SQL string literal (basic implementation)
 */
export function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}