import { SetMetadata } from '@nestjs/common';

import type { RetryPolicy as RetryPolicyInterface } from '../interfaces';

/**
 * Metadata key for storing retry policy configuration.
 */
export const RETRY_POLICY_METADATA = 'rabbitmq:retry-policy';

/**
 * Retry policy decorator for configuring message retry behavior.
 *
 * This decorator allows you to specify retry logic for message handlers,
 * including retry count, delays, and custom retry conditions.
 *
 * @param policy - Retry policy configuration
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Controller()
 * export class UserController {
 *   @MessagePattern('user.process')
 *   @RetryPolicy({
 *     maxRetries: 5,
 *     retryDelay: 2000,
 *     exponentialBackoff: true,
 *     maxRetryDelay: 30000,
 *     retryCondition: (error) => error.name !== 'ValidationError',
 *   })
 *   async processUser(data: ProcessUserDto): Promise<void> {
 *     // This method will retry up to 5 times with exponential backoff
 *     // if it fails (except for ValidationErrors)
 *   }
 * }
 * ```
 */
export function RetryPolicy(policy: RetryPolicyInterface): MethodDecorator {
  return SetMetadata(RETRY_POLICY_METADATA, policy);
}

/**
 * Simple retry decorator with basic configuration.
 *
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @MessagePattern('user.backup')
 * @Retry(3, 1000)
 * async backupUser(userId: string): Promise<void> {
 *   // This method will retry up to 3 times with 1 second delay
 * }
 * ```
 */
export function Retry(maxRetries: number, retryDelay = 1000): MethodDecorator {
  return SetMetadata(RETRY_POLICY_METADATA, {
    maxRetries,
    retryDelay,
    exponentialBackoff: false,
  });
}

/**
 * Exponential backoff retry decorator.
 *
 * @param maxRetries - Maximum number of retry attempts
 * @param initialDelay - Initial delay in milliseconds
 * @param maxDelay - Maximum delay in milliseconds
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @MessagePattern('user.sync')
 * @ExponentialBackoffRetry(5, 1000, 30000)
 * async syncUser(userId: string): Promise<void> {
 *   // This method will retry up to 5 times with exponential backoff
 *   // starting at 1s and capping at 30s
 * }
 * ```
 */
export function ExponentialBackoffRetry(
  maxRetries: number,
  initialDelay = 1000,
  maxDelay = 30000,
): MethodDecorator {
  return SetMetadata(RETRY_POLICY_METADATA, {
    maxRetries,
    retryDelay: initialDelay,
    exponentialBackoff: true,
    maxRetryDelay: maxDelay,
  });
}

/**
 * Conditional retry decorator with custom retry condition.
 *
 * @param maxRetries - Maximum number of retry attempts
 * @param retryCondition - Function to determine if retry should happen
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @MessagePattern('user.validate')
 * @ConditionalRetry(
 *   3,
 *   (error) => error.name === 'NetworkError' || error.name === 'TimeoutError',
 *   2000
 * )
 * async validateUser(data: UserDto): Promise<void> {
 *   // This method will only retry for network or timeout errors
 * }
 * ```
 */
export function ConditionalRetry(
  maxRetries: number,
  retryCondition: (error: Error) => boolean,
  retryDelay = 1000,
): MethodDecorator {
  return SetMetadata(RETRY_POLICY_METADATA, {
    maxRetries,
    retryDelay,
    retryCondition,
    exponentialBackoff: false,
  });
}

/**
 * No retry decorator to explicitly disable retries.
 *
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @MessagePattern('user.critical')
 * @NoRetry()
 * async criticalUserOperation(data: CriticalDto): Promise<void> {
 *   // This method will never retry on failure
 * }
 * ```
 */
export function NoRetry(): MethodDecorator {
  return SetMetadata(RETRY_POLICY_METADATA, {
    maxRetries: 0,
  });
}

/**
 * Database error retry decorator for database-related operations.
 *
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @MessagePattern('user.save')
 * @DatabaseRetry(3, 1500)
 * async saveUser(user: User): Promise<void> {
 *   // This method will retry for common database errors
 * }
 * ```
 */
export function DatabaseRetry(
  maxRetries = 3,
  retryDelay = 1500,
): MethodDecorator {
  return SetMetadata(RETRY_POLICY_METADATA, {
    maxRetries,
    retryDelay,
    exponentialBackoff: true,
    maxRetryDelay: 10000,
    retryCondition: (error: Error) => {
      const retryableErrors = [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ConnectionError',
        'SequelizeConnectionError',
        'SequelizeDatabaseError',
        'MongoNetworkError',
        'MongoTimeoutError',
      ];

      return retryableErrors.some(
        (errorType) =>
          error.name.includes(errorType) || error.message.includes(errorType),
      );
    },
  });
}

/**
 * Network error retry decorator for network-related operations.
 *
 * @param maxRetries - Maximum number of retry attempts
 * @param retryDelay - Delay between retries in milliseconds
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @MessagePattern('user.fetch-external')
 * @NetworkRetry(5, 2000)
 * async fetchExternalUser(id: string): Promise<User> {
 *   // This method will retry for network errors
 * }
 * ```
 */
export function NetworkRetry(
  maxRetries = 5,
  retryDelay = 2000,
): MethodDecorator {
  return SetMetadata(RETRY_POLICY_METADATA, {
    maxRetries,
    retryDelay,
    exponentialBackoff: true,
    maxRetryDelay: 30000,
    retryCondition: (error: Error) => {
      const networkErrors = [
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED',
        'ETIMEDOUT',
        'NetworkError',
        'FetchError',
        'AxiosError',
      ];

      return networkErrors.some(
        (errorType) =>
          error.name.includes(errorType) || error.message.includes(errorType),
      );
    },
  });
}
