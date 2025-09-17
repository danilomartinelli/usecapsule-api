import type { CommonQueryMethods, DatabasePool } from 'slonik';

import { DATABASE_POOL } from '../database.constants';

/**
 * Type representing the context object with pool properties
 */
type PoolContext = Record<string, unknown> & {
  pool?: DatabasePool | CommonQueryMethods;
  [DATABASE_POOL]?: DatabasePool | CommonQueryMethods;
};

/**
 * Database pool type that can be either DatabasePool or CommonQueryMethods
 */
type PoolType = DatabasePool | CommonQueryMethods | undefined;

/**
 * A method decorator that wraps the decorated method in a database transaction.
 *
 * The decorator automatically:
 * - Retrieves the database pool from the class instance
 * - Starts a transaction using the pool
 * - Temporarily replaces the pool with the transaction pool during method execution
 * - Restores the original pool after method completion (success or failure)
 *
 * @example
 * ```typescript
 * class UserService {
 *   constructor(private pool: DatabasePool) {}
 *
 *   @Transactional()
 *   async createUser(userData: UserData) {
 *     // This method will run within a transaction
 *     // All database operations will use the transaction pool
 *   }
 * }
 * ```
 *
 * @returns A method decorator function
 * @throws {Error} When database pool is not found in the class instance
 */
export function Transactional() {
  return function (
    _target: unknown,
    _propertyName: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (this: PoolContext, ...args: unknown[]) {
      const pool = getPoolFromContext(this);
      validatePool(pool);

      return pool.transaction(async (transactionPool) => {
        const originalPool = getPoolFromContext(this);

        // Temporarily replace pools with transaction pool
        setPoolInContext(this, transactionPool);

        try {
          return await originalMethod.apply(this, args);
        } finally {
          // Restore original pools
          setPoolInContext(this, originalPool);
        }
      });
    };

    return descriptor;
  };
}

/**
 * Extracts the database pool from the class instance context.
 * Checks both the DATABASE_POOL symbol and the 'pool' property.
 *
 * @param context - The class instance context
 * @returns The database pool if found, undefined otherwise
 */
function getPoolFromContext(context: PoolContext): PoolType {
  // First try to get pool via DATABASE_POOL symbol
  const poolFromSymbol = Object.entries(context).find(
    ([key]) => key === String(DATABASE_POOL),
  )?.[1] as PoolType;

  // Fallback to 'pool' property
  return poolFromSymbol ?? context.pool;
}

/**
 * Validates that a pool instance exists and is valid.
 *
 * @param pool - The pool to validate
 * @throws {Error} When pool is null, undefined, or invalid
 */
function validatePool(pool: PoolType): asserts pool is DatabasePool {
  if (!pool) {
    throw new Error(
      'Database pool not found. Ensure the class has access to DATABASE_POOL',
    );
  }
}

/**
 * Sets the database pool in both possible locations within the context.
 * Updates both the DATABASE_POOL symbol property and the 'pool' property.
 *
 * @param context - The class instance context
 * @param pool - The pool to set
 */
function setPoolInContext(context: PoolContext, pool: PoolType): void {
  // Set pool via DATABASE_POOL symbol
  (context as Record<string, PoolType>)[String(DATABASE_POOL)] = pool;

  // Set pool via 'pool' property
  context.pool = pool;
}
