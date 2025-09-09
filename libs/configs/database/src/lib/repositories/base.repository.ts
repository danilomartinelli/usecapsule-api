import { Inject } from '@nestjs/common';
import { DatabasePool, sql } from 'slonik';
import { z, ZodType } from 'zod';
import { DATABASE_POOL } from '../database.constants';

export interface RepositoryOptions<T extends z.ZodType> {
  tableName: string;
  schema: T;
}

export abstract class BaseRepository<T extends z.ZodType> {
  protected abstract tableName: string;
  protected abstract schema: T;

  constructor(@Inject(DATABASE_POOL) protected readonly pool: DatabasePool) {}

  async findById(id: string): Promise<T | null> {
    const result = await this.pool.maybeOne(sql.type(this.schema)`
      SELECT * FROM ${sql.identifier([this.tableName])}
      WHERE id = ${id}
    `);
    return result;
  }

  async findAll(limit?: number, offset?: number): Promise<T[]> {
    let query = sql.type(this.schema)`
      SELECT * FROM ${sql.identifier([this.tableName])}
    `;

    if (limit) {
      query = sql.type(this.schema)`
        ${query}
        LIMIT ${limit}
        ${offset ? sql.type(ZodType)`OFFSET ${offset}` : sql.type(ZodType)``}
      `;
    }

    const results = await this.pool.any(query);
    return results as T[];
  }

  async create(data: Partial<T>): Promise<T> {
    const entries = Object.entries(data).filter(
      ([, value]) => value !== undefined,
    );
    const keys = entries.map(([key]) => key);
    const values = entries.map(([, value]) => value);

    const result = await this.pool.one(sql.type(this.schema)`
      INSERT INTO ${sql.identifier([this.tableName])} (${sql.join(
        keys.map((key) => sql.identifier([key])),
        sql.literalValue(', '),
      )})
      VALUES (${sql.join(
        values.map((value) =>
          value === null ? sql.literalValue('NULL') : sql.literalValue(value),
        ),
        sql.literalValue(', '),
      )})
      RETURNING *
    `);

    return result;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const entries = Object.entries(data).filter(
      ([, value]) => value !== undefined,
    );

    if (entries.length === 0) {
      return this.findById(id);
    }

    const setClause = sql.join(
      entries.map(([key, value]) =>
        value === null
          ? sql.type(this.schema)`${sql.identifier([key])} = NULL`
          : sql.type(
              this.schema,
            )`${sql.identifier([key])} = ${sql.literalValue(value)}`,
      ),
      sql.literalValue(', '),
    );

    const result = await this.pool.maybeOne(sql.type(this.schema)`
      UPDATE ${sql.identifier([this.tableName])}
      SET ${setClause}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `);

    return result;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query(sql.type(this.schema)`
      DELETE FROM ${sql.identifier([this.tableName])}
      WHERE id = ${id}
    `);

    return result.rowCount > 0;
  }

  async exists(id: string): Promise<boolean> {
    return this.pool.exists(sql.type(this.schema)`
      SELECT 1 FROM ${sql.identifier([this.tableName])}
      WHERE id = ${id}
    `);
  }

  async count(where?: Record<string, unknown>): Promise<number> {
    let query = sql.type(
      this.schema,
    )`SELECT COUNT(*) FROM ${sql.identifier([this.tableName])}`;

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, value]) =>
        value === null
          ? sql.type(this.schema)`${sql.identifier([key])} IS NULL`
          : sql.type(
              this.schema,
            )`${sql.identifier([key])} = ${sql.literalValue(value as string)}`,
      );
      query = sql.type(
        this.schema,
      )`${query} WHERE ${sql.join(conditions, sql.literalValue(' AND '))}`;
    }

    const result = await this.pool.oneFirst(query);
    return Number(result);
  }
}
