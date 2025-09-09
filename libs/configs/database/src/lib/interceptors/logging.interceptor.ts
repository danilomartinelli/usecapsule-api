import { Interceptor } from 'slonik';

import { Environment } from '@usecapsule/types';

export const loggingInterceptor = (environment: Environment): Interceptor => ({
  name: 'LoggingInterceptor',
  beforePoolConnection: (connectionContext) => {
    if (environment === 'development') {
      console.log(
        `[Database] Acquiring connection from pool ${connectionContext.poolId}`,
      );
    }

    return null;
  },
  afterPoolConnection: (connectionContext) => {
    if (environment === 'development') {
      console.log(
        `[Database] Connection acquired ${connectionContext.connectionId}`,
      );
    }

    return null;
  },
  beforePoolConnectionRelease: async (connectionContext) => {
    if (environment === 'development') {
      console.log(
        `[Database] Releasing connection ${connectionContext.connectionId}`,
      );
    }

    return null;
  },
  queryExecutionError: (_queryContext, query, error) => {
    console.error('[Database] Query execution error:', {
      query: query.sql,
      error: error.message,
    });
    throw error;
  },
});
