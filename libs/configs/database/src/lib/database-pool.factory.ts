import { createPool, DatabasePool } from 'slonik';

import { createInterceptors } from './interceptors';
import { DatabaseModuleOptions } from './interfaces';
import { createTypeParsers } from './type-parsers';

export function createDatabasePool(
  options: DatabaseModuleOptions,
): Promise<DatabasePool> {
  const connectionString = buildConnectionString(options);

  return createPool(connectionString, {
    maximumPoolSize: options.maximumPoolSize || 10,
    minimumPoolSize: options.minimumPoolSize || 1,
    connectionTimeout: options.connectionTimeout || 30000,
    idleTimeout: options.idleTimeout || 10000,
    statementTimeout: options.statementTimeout || 30000,
    interceptors: createInterceptors(options.environment || 'development'),
    typeParsers: createTypeParsers(),
  });
}

function buildConnectionString(options: DatabaseModuleOptions): string {
  const { username, password, host, port, database, ssl } = options;
  return `postgresql://${username}:${password}@${host}:${port}/${database}${
    ssl ? '?ssl=require' : ''
  }`;
}
