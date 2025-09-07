import { Injectable, Inject, OnModuleDestroy, OnApplicationBootstrap } from '@nestjs/common';
import { createPool, DatabasePool, sql } from 'slonik';
import { DatabaseConfig } from './database.config';

@Injectable()
export class DatabaseService implements OnModuleDestroy, OnApplicationBootstrap {
  private pool!: DatabasePool;

  constructor(@Inject('DATABASE_CONFIG') private readonly config: DatabaseConfig) {
    // Pool initialization moved to onApplicationBootstrap
  }

  async onApplicationBootstrap() {
    const connectionString = `postgresql://${this.config.username}:${this.config.password}@${this.config.host}:${this.config.port}/${this.config.database}`;
    this.pool = await createPool(connectionString, {
      maximumPoolSize: 10,
      connectionTimeout: 5000,
      idleTimeout: 60000,
    });
  }

  getPool(): DatabasePool {
    if (!this.pool) {
      throw new Error('Database pool not initialized. Call onApplicationBootstrap first.');
    }
    return this.pool;
  }

  get sql() {
    return sql;
  }

  async query(queryString: string, values?: any[]) {
    const pool = this.getPool();
    return pool.query(sql.unsafe`${queryString}`, values);
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }
      await this.pool.query(sql.typeAlias('void')`SELECT 1`);
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}