import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  DatabasePool,
  DatabaseTransactionConnection,
  QueryResult,
  QuerySqlToken,
  sql,
} from 'slonik';
import { z } from 'zod';

import { DATABASE_POOL } from './database.constants';

/**
 * Generic query handler type for Slonik pool methods
 */
type PoolQueryMethod<T> = (query: QuerySqlToken<z.ZodType>) => Promise<T>;

/**
 * Transaction handler function type
 */
type TransactionHandler<T> = (
  connection: DatabaseTransactionConnection,
) => Promise<T>;

/**
 * Database service providing a convenient wrapper around Slonik database pool.
 *
 * This service provides:
 * - Typed database operations using Zod schemas
 * - Transaction management with retry support
 * - Automatic connection pool cleanup on module destruction
 * - Comprehensive query methods for different result types
 *
 * @example
 * ```typescript
 * @Injectable()
 * class UserRepository {
 *   constructor(private readonly db: DatabaseService) {}
 *
 *   async findUser(id: string) {
 *     return this.db.maybeOne(sql.type(UserSchema)`
 *       SELECT * FROM users WHERE id = ${id}
 *     `);
 *   }
 * }
 * ```
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(@Inject(DATABASE_POOL) private readonly pool: DatabasePool) {}

  /**
   * Returns the underlying Slonik database pool instance.
   *
   * Use this method when you need direct access to the pool,
   * for example when implementing custom query logic or
   * working with advanced Slonik features.
   *
   * @returns The Slonik DatabasePool instance
   */
  getPool(): DatabasePool {
    return this.pool;
  }

  /**
   * Returns the Slonik SQL tagged template function.
   *
   * This is a convenience method to access the `sql` function
   * without needing to import it separately.
   *
   * @returns The Slonik sql function
   */
  getSql() {
    return sql;
  }

  /**
   * Lifecycle hook called when the module is being destroyed.
   * Properly closes the database pool to prevent connection leaks.
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing database pool...');
    try {
      await this.pool.end();
      this.logger.log('Database pool closed successfully');
    } catch (error) {
      this.logger.error('Error closing database pool', error);
      throw error;
    }
  }

  /**
   * Executes a function within a database transaction.
   *
   * The transaction is automatically committed if the handler completes successfully,
   * or rolled back if an error is thrown. Supports configurable retry logic.
   *
   * @param handler - Function to execute within the transaction
   * @param transactionRetryLimit - Maximum number of retry attempts
   * @returns Promise resolving to the handler's return value
   *
   * @example
   * ```typescript
   * await this.db.transaction(async (trx) => {
   *   await trx.query(sql`INSERT INTO users ...`);
   *   await trx.query(sql`INSERT INTO profiles ...`);
   * });
   * ```
   */
  async transaction<T>(
    handler: TransactionHandler<T>,
    transactionRetryLimit?: number,
  ): Promise<T> {
    return this.pool.transaction(handler, transactionRetryLimit);
  }

  // Query execution methods with improved type safety

  /**
   * Checks if a query returns any rows.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to boolean indicating if rows exist
   */
  async exists(query: QuerySqlToken<z.ZodType>): Promise<boolean> {
    return this.executePoolMethod(this.pool.exists.bind(this.pool), query);
  }

  /**
   * Executes a query expecting exactly one row and returns the first column.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to the first column of the first row
   * @throws {Error} If query returns zero or more than one row
   */
  async oneFirst<T>(query: QuerySqlToken<z.ZodType>): Promise<T> {
    return this.executePoolMethod(this.pool.oneFirst.bind(this.pool), query);
  }

  /**
   * Executes a query expecting zero or one row and returns the first column.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to the first column or null if no rows
   * @throws {Error} If query returns more than one row
   */
  async maybeOneFirst<T>(query: QuerySqlToken<z.ZodType>): Promise<T | null> {
    return this.executePoolMethod(
      this.pool.maybeOneFirst.bind(this.pool),
      query,
    );
  }

  /**
   * Executes a query expecting at least one row and returns all rows.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to readonly array of all rows
   * @throws {Error} If query returns zero rows
   */
  async many<T extends z.ZodType>(
    query: QuerySqlToken<T>,
  ): Promise<readonly T[]> {
    return this.executePoolMethod<T[]>(
      this.pool.many.bind(this.pool) as PoolQueryMethod<T[]>,
      query,
    );
  }

  /**
   * Executes a query expecting at least one row and returns the first column of all rows.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to readonly array of first columns
   * @throws {Error} If query returns zero rows
   */
  async manyFirst<T extends z.ZodType>(
    query: QuerySqlToken<z.ZodType>,
  ): Promise<readonly T[]> {
    return this.executePoolMethod<T[]>(
      this.pool.manyFirst.bind(this.pool) as PoolQueryMethod<T[]>,
      query,
    );
  }

  /**
   * Executes a query expecting exactly one row.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to the single row
   * @throws {Error} If query returns zero or more than one row
   */
  async one<T extends z.ZodType>(query: QuerySqlToken<T>): Promise<T> {
    return this.executePoolMethod(
      this.pool.one.bind(this.pool) as PoolQueryMethod<T>,
      query,
    );
  }

  /**
   * Executes a query expecting zero or one row.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to the row or null if no rows
   * @throws {Error} If query returns more than one row
   */
  async maybeOne<T extends z.ZodType>(
    query: QuerySqlToken<T>,
  ): Promise<T | null> {
    return this.executePoolMethod(
      this.pool.maybeOne.bind(this.pool) as PoolQueryMethod<T>,
      query,
    );
  }

  /**
   * Executes a query and returns zero or more rows.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to readonly array of rows (may be empty)
   */
  async any<T extends z.ZodType>(
    query: QuerySqlToken<T>,
  ): Promise<readonly T[]> {
    return this.executePoolMethod(
      this.pool.any.bind(this.pool) as PoolQueryMethod<T[]>,
      query,
    );
  }

  /**
   * Executes a query and returns the first column of zero or more rows.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to readonly array of first columns (may be empty)
   */
  async anyFirst<T>(query: QuerySqlToken<z.ZodType>): Promise<readonly T[]> {
    return this.executePoolMethod(this.pool.anyFirst.bind(this.pool), query);
  }

  /**
   * Executes a raw query and returns the full QueryResult.
   *
   * Use this method when you need access to metadata like rowCount,
   * or when working with complex queries that don't fit other methods.
   *
   * @param query - SQL query with Zod schema validation
   * @returns Promise resolving to QueryResult with rows and metadata
   */
  async query<T extends z.ZodType>(
    query: QuerySqlToken<T>,
  ): Promise<QueryResult<z.infer<T>>> {
    return this.executePoolMethod(
      this.pool.query.bind(this.pool) as PoolQueryMethod<
        QueryResult<z.infer<T>>
      >,
      query,
    );
  }

  /**
   * Executes a pool method with error handling and logging.
   * This helper reduces code duplication across query methods.
   *
   * @param method - The pool method to execute
   * @param query - The SQL query to execute
   * @returns Promise resolving to the method's result
   */
  private async executePoolMethod<T>(
    method: PoolQueryMethod<T>,
    query: QuerySqlToken<z.ZodType>,
  ): Promise<T> {
    try {
      return await method(query);
    } catch (error) {
      this.logger.error('Database query execution failed', {
        error: error instanceof Error ? error.message : String(error),
        query: query.sql,
      });
      throw error;
    }
  }
}
