import { Inject } from '@nestjs/common';
import type { DatabasePool, QuerySqlToken } from 'slonik';
import { sql } from 'slonik';
import { z } from 'zod';

import { DATABASE_POOL } from '../database.constants';

/**
 * Configuration options for repository initialization
 */
export interface RepositoryOptions<T extends z.ZodType> {
  readonly tableName: string;
  readonly schema: T;
}

/**
 * Data filtering options for queries
 */
export interface QueryOptions {
  readonly limit?: number;
  readonly offset?: number;
  readonly orderBy?: string;
  readonly orderDirection?: 'ASC' | 'DESC';
}

/**
 * Where clause condition for filtering
 */
export interface WhereCondition {
  readonly [key: string]: unknown;
}

/**
 * Type representing data to be inserted/updated (excluding computed fields)
 */
type EntityData<T extends z.ZodType> = Partial<z.infer<T>>;

/**
 * Type guard to check if a value is a valid ValueExpression
 */
type SafeValueExpression = string | number | boolean | null | bigint | Buffer;

/**
 * Helper type to ensure database query results are properly typed
 */
type DatabaseQueryResult<T extends z.ZodType> = z.infer<T>;

/**
 * Abstract base repository providing common CRUD operations with type safety.
 *
 * This repository provides:
 * - Type-safe database operations using Zod schemas
 * - Common CRUD patterns with consistent error handling
 * - Flexible querying with pagination and filtering
 * - Optimized SQL generation with proper escaping
 * - Transaction support through the database pool
 *
 * @template T - Zod schema type for the entity
 *
 * @example
 * ```typescript
 * const UserSchema = z.object({
 *   id: z.string().uuid(),
 *   name: z.string(),
 *   email: z.string().email(),
 *   created_at: z.date(),
 *   updated_at: z.date(),
 * });
 *
 * @Injectable()
 * class UserRepository extends BaseRepository<typeof UserSchema> {
 *   protected tableName = 'users';
 *   protected schema = UserSchema;
 * }
 * ```
 */
export abstract class BaseRepository<T extends z.ZodType> {
  protected abstract readonly tableName: string;
  protected abstract readonly schema: T;

  constructor(@Inject(DATABASE_POOL) protected readonly pool: DatabasePool) {}

  /**
   * Finds a single entity by its ID.
   *
   * @param id - The entity ID to search for
   * @returns Promise resolving to the entity or null if not found
   *
   * @example
   * ```typescript
   * const user = await userRepository.findById('123e4567-e89b-12d3-a456-426614174000');
   * ```
   */
  async findById(id: string): Promise<DatabaseQueryResult<T> | null> {
    const query = sql.type(this.schema)`
      SELECT * FROM ${sql.identifier([this.tableName])}
      WHERE id = ${id}
    `;

    const result = await this.pool.maybeOne(query);
    return result ? this.validateAndTransform(result) : null;
  }

  /**
   * Finds all entities with optional pagination and ordering.
   *
   * @param options - Query options including pagination and ordering
   * @returns Promise resolving to array of entities
   *
   * @example
   * ```typescript
   * const users = await userRepository.findAll({
   *   limit: 20,
   *   offset: 0,
   *   orderBy: 'created_at',
   *   orderDirection: 'DESC'
   * });
   * ```
   */
  async findAll(options: QueryOptions = {}): Promise<DatabaseQueryResult<T>[]> {
    const query = this.buildSelectQuery(options);
    const results = await this.pool.any(query);
    return results.map((result) => this.validateAndTransform(result));
  }

  /**
   * Creates a new entity in the database.
   *
   * @param data - Partial entity data to insert
   * @returns Promise resolving to the created entity
   *
   * @example
   * ```typescript
   * const newUser = await userRepository.create({
   *   name: 'John Doe',
   *   email: 'john@example.com'
   * });
   * ```
   */
  async create(data: EntityData<T>): Promise<DatabaseQueryResult<T>> {
    const cleanData = this.filterUndefinedValues(data);
    const query = this.buildInsertQuery(cleanData);

    const result = await this.pool.one(query);
    return this.validateAndTransform(result);
  }

  /**
   * Updates an existing entity by ID.
   *
   * @param id - The entity ID to update
   * @param data - Partial entity data to update
   * @returns Promise resolving to updated entity or null if not found
   *
   * @example
   * ```typescript
   * const updatedUser = await userRepository.update('123', {
   *   name: 'Jane Doe'
   * });
   * ```
   */
  async update(
    id: string,
    data: EntityData<T>,
  ): Promise<DatabaseQueryResult<T> | null> {
    const cleanData = this.filterUndefinedValues(data);

    if (Object.keys(cleanData).length === 0) {
      return this.findById(id);
    }

    const query = this.buildUpdateQuery(id, cleanData);
    const result = await this.pool.maybeOne(query);
    return result ? this.validateAndTransform(result) : null;
  }

  /**
   * Deletes an entity by ID.
   *
   * @param id - The entity ID to delete
   * @returns Promise resolving to true if deleted, false if not found
   *
   * @example
   * ```typescript
   * const wasDeleted = await userRepository.delete('123');
   * ```
   */
  async delete(id: string): Promise<boolean> {
    const query = sql.type(this.schema)`
      DELETE FROM ${sql.identifier([this.tableName])}
      WHERE id = ${id}
    `;

    const result = await this.pool.query(query);
    return result.rowCount > 0;
  }

  /**
   * Checks if an entity exists by ID.
   *
   * @param id - The entity ID to check
   * @returns Promise resolving to true if exists, false otherwise
   *
   * @example
   * ```typescript
   * const userExists = await userRepository.exists('123');
   * ```
   */
  async exists(id: string): Promise<boolean> {
    const query = sql.type(this.schema)`
      SELECT 1 FROM ${sql.identifier([this.tableName])}
      WHERE id = ${id}
    `;

    return this.pool.exists(query);
  }

  /**
   * Counts entities matching optional where conditions.
   *
   * @param where - Optional conditions to filter count
   * @returns Promise resolving to the count of matching entities
   *
   * @example
   * ```typescript
   * const activeUsers = await userRepository.count({ status: 'active' });
   * const totalUsers = await userRepository.count();
   * ```
   */
  async count(where?: WhereCondition): Promise<number> {
    const query = this.buildCountQuery(where);
    const result = await this.pool.oneFirst(query);
    return Number(result);
  }

  /**
   * Finds entities matching the provided where conditions.
   *
   * @param where - Conditions to filter entities
   * @param options - Additional query options
   * @returns Promise resolving to array of matching entities
   *
   * @example
   * ```typescript
   * const activeUsers = await userRepository.findWhere(
   *   { status: 'active' },
   *   { limit: 10, orderBy: 'name' }
   * );
   * ```
   */
  async findWhere(
    where: WhereCondition,
    options: QueryOptions = {},
  ): Promise<DatabaseQueryResult<T>[]> {
    const query = this.buildSelectQuery(options, where);
    const results = await this.pool.any(query);
    return results.map((result) => this.validateAndTransform(result));
  }

  // Private helper methods for query building

  /**
   * Builds a SELECT query with optional filtering, pagination, and ordering.
   */
  private buildSelectQuery(
    options: QueryOptions,
    where?: WhereCondition,
  ): QuerySqlToken<T> {
    let query = sql.type(this.schema)`
      SELECT * FROM ${sql.identifier([this.tableName])}
    `;

    if (where && Object.keys(where).length > 0) {
      const whereClause = this.buildWhereClause(where);
      query = sql.type(this.schema)`${query} WHERE ${whereClause}`;
    }

    if (options.orderBy) {
      const direction = options.orderDirection || 'ASC';
      query = sql.type(this.schema)`
        ${query} ORDER BY ${sql.identifier([options.orderBy])} ${sql.fragment`${direction}`}
      `;
    }

    if (options.limit) {
      query = sql.type(this.schema)`${query} LIMIT ${options.limit}`;

      if (options.offset) {
        query = sql.type(this.schema)`${query} OFFSET ${options.offset}`;
      }
    }

    return query;
  }

  /**
   * Builds an INSERT query from entity data.
   */
  private buildInsertQuery(data: Record<string, unknown>): QuerySqlToken<T> {
    const entries = Object.entries(data);
    const keys = entries.map(([key]) => key);
    const values = entries.map(([, value]) => value);

    return sql.type(this.schema)`
      INSERT INTO ${sql.identifier([this.tableName])} (${sql.join(
        keys.map((key) => sql.identifier([key])),
        sql.fragment`, `,
      )})
      VALUES (${sql.join(
        values.map((value) => this.formatValue(value)),
        sql.fragment`, `,
      )})
      RETURNING *
    `;
  }

  /**
   * Builds an UPDATE query from entity data.
   */
  private buildUpdateQuery(
    id: string,
    data: Record<string, unknown>,
  ): QuerySqlToken<T> {
    const setClause = this.buildSetClause(data);

    return sql.type(this.schema)`
      UPDATE ${sql.identifier([this.tableName])}
      SET ${setClause}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
  }

  /**
   * Builds a COUNT query with optional where conditions.
   */
  private buildCountQuery(where?: WhereCondition): QuerySqlToken<T> {
    let query = sql.type(this.schema)`
      SELECT COUNT(*) FROM ${sql.identifier([this.tableName])}
    `;

    if (where && Object.keys(where).length > 0) {
      const whereClause = this.buildWhereClause(where);
      query = sql.type(this.schema)`${query} WHERE ${whereClause}`;
    }

    return query;
  }

  /**
   * Builds a WHERE clause from conditions object.
   */
  private buildWhereClause(where: WhereCondition) {
    const conditions = Object.entries(where).map(([key, value]) =>
      value === null
        ? sql.fragment`${sql.identifier([key])} IS NULL`
        : sql.fragment`${sql.identifier([key])} = ${this.convertToValueExpression(value)}`,
    );

    return sql.join(conditions, sql.fragment` AND `);
  }

  /**
   * Builds a SET clause for UPDATE queries.
   */
  private buildSetClause(data: Record<string, unknown>) {
    const assignments = Object.entries(data).map(([key, value]) =>
      value === null
        ? sql.fragment`${sql.identifier([key])} = NULL`
        : sql.fragment`${sql.identifier([key])} = ${this.convertToValueExpression(value)}`,
    );

    return sql.join(assignments, sql.fragment`, `);
  }

  /**
   * Formats a value for SQL insertion, handling NULL values properly.
   */
  private formatValue(value: unknown) {
    return value === null
      ? sql.fragment`NULL`
      : this.convertToValueExpression(value);
  }

  /**
   * Converts a value to a valid ValueExpression for Slonik.
   * Handles type conversion and ensures compatibility with SQL parameters.
   */
  private convertToValueExpression(value: unknown): SafeValueExpression {
    if (value === null || value === undefined) {
      return null;
    }

    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return value;
    }

    // Convert Date objects to ISO strings for database storage
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle Buffer objects
    if (Buffer.isBuffer(value)) {
      return value;
    }

    // For complex objects, convert to JSON string
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    // Fallback to string representation
    return String(value);
  }

  /**
   * Validates and transforms database result using the schema.
   * Provides runtime type safety by validating against the Zod schema.
   */
  private validateAndTransform(result: unknown): DatabaseQueryResult<T> {
    try {
      return this.schema.parse(result) as DatabaseQueryResult<T>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join(', ');
        throw new Error(`Database result validation failed: ${errorMessages}`);
      }
      throw error;
    }
  }

  /**
   * Filters out undefined values from data object and ensures type safety.
   */
  private filterUndefinedValues(data: EntityData<T>): Record<string, unknown> {
    const filtered: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }

    return filtered;
  }
}
