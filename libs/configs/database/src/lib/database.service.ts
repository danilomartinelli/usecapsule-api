import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import {
  DatabasePool,
  DatabaseTransactionConnection,
  QueryResult,
  QuerySqlToken,
  sql,
} from 'slonik';
import { z } from 'zod';

import { DATABASE_POOL } from './database.constants';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  constructor(@Inject(DATABASE_POOL) private readonly pool: DatabasePool) {}

  getPool(): DatabasePool {
    return this.pool;
  }

  getSql() {
    return sql;
  }

  async onModuleDestroy() {
    await this.pool.end();
  }

  async transaction<T>(
    handler: (connection: DatabaseTransactionConnection) => Promise<T>,
    transactionRetryLimit?: number,
  ): Promise<T> {
    return this.pool.transaction(handler, transactionRetryLimit);
  }

  async exists(query: QuerySqlToken<z.ZodType>): Promise<boolean> {
    return this.pool.exists(query);
  }

  async oneFirst<T>(query: QuerySqlToken<z.ZodType>): Promise<T> {
    return this.pool.oneFirst(query);
  }

  async maybeOneFirst<T>(query: QuerySqlToken<z.ZodType>): Promise<T | null> {
    return this.pool.maybeOneFirst(query);
  }

  async many<T>(query: QuerySqlToken<z.ZodType>): Promise<readonly T[]> {
    return this.pool.many(query);
  }

  async manyFirst<T>(query: QuerySqlToken<z.ZodType>): Promise<readonly T[]> {
    return this.pool.manyFirst(query);
  }

  async one<T>(query: QuerySqlToken<z.ZodType>): Promise<T> {
    return this.pool.one(query);
  }

  async maybeOne<T>(query: QuerySqlToken<z.ZodType>): Promise<T | null> {
    return this.pool.maybeOne(query);
  }

  async any<T>(query: QuerySqlToken<z.ZodType>): Promise<readonly T[]> {
    return this.pool.any(query);
  }

  async anyFirst<T>(query: QuerySqlToken<z.ZodType>): Promise<readonly T[]> {
    return this.pool.anyFirst(query);
  }

  async query<T>(
    query: QuerySqlToken<z.ZodType>,
  ): Promise<QueryResult<z.infer<T>>> {
    return this.pool.query(query);
  }
}
