import { Type } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common/interfaces';

export interface DatabaseModuleOptions {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maximumPoolSize?: number;
  minimumPoolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
  statementTimeout?: number;
  environment?: 'test' | 'development' | 'production';
}

export interface DatabaseModuleAsyncOptions {
  useFactory: (
    ...args: unknown[]
  ) => Promise<DatabaseModuleOptions> | DatabaseModuleOptions;
  inject?: Array<Type<unknown> | string | symbol>;
  imports?: ModuleMetadata['imports'];
}
