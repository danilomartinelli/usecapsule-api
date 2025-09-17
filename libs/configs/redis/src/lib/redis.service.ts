import { Injectable, Inject, Logger } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import type { Redis, Cluster } from 'ioredis';

import {
  closeRedisClient,
  testRedisConnection,
  getRedisInfo,
} from './redis-client.factory';
import { REDIS_CLIENT } from './redis.constants';

/**
 * Injectable Redis service providing high-level Redis operations.
 *
 * This service wraps the Redis client and provides a convenient interface
 * for common Redis operations with proper error handling and logging.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   constructor(private readonly redisService: RedisService) {}
 *
 *   async cacheUser(user: User): Promise<void> {
 *     await this.redisService.set(`user:${user.id}`, user, 3600);
 *   }
 *
 *   async getUser(id: string): Promise<User | null> {
 *     return this.redisService.get(`user:${id}`);
 *   }
 * }
 * ```
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly client: Redis | Cluster) {}

  /**
   * Gets the underlying Redis client instance.
   * Use this for advanced operations not covered by this service.
   *
   * @returns Redis client instance
   */
  getClient(): Redis | Cluster {
    return this.client;
  }

  /**
   * Sets a key-value pair in Redis with optional TTL.
   *
   * @param key - Redis key
   * @param value - Value to store (will be JSON stringified)
   * @param ttlSeconds - Time to live in seconds (optional)
   * @returns Promise that resolves when the operation completes
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Gets a value from Redis and parses it as JSON.
   *
   * @param key - Redis key
   * @returns Promise that resolves to the parsed value or null if not found
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Gets multiple values from Redis in a single operation.
   *
   * @param keys - Array of Redis keys
   * @returns Promise that resolves to an array of parsed values (null for missing keys)
   */
  async mget<T = unknown>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mget(...keys);

      return values.map((value) => {
        if (value === null) {
          return null;
        }

        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error(`Failed to mget keys ${keys.join(', ')}:`, error);
      throw error;
    }
  }

  /**
   * Deletes one or more keys from Redis.
   *
   * @param keys - Key or array of keys to delete
   * @returns Promise that resolves to the number of keys deleted
   */
  async del(keys: string | string[]): Promise<number> {
    try {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      return await this.client.del(...keysArray);
    } catch (error) {
      this.logger.error(
        `Failed to delete keys ${Array.isArray(keys) ? keys.join(', ') : keys}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Checks if a key exists in Redis.
   *
   * @param key - Redis key
   * @returns Promise that resolves to true if the key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Sets a TTL (time to live) for a key.
   *
   * @param key - Redis key
   * @param ttlSeconds - Time to live in seconds
   * @returns Promise that resolves to true if TTL was set
   */
  async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to set TTL for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Gets the TTL (time to live) of a key.
   *
   * @param key - Redis key
   * @returns Promise that resolves to TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
   */
  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      this.logger.error(`Failed to get TTL for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Increments a numeric value in Redis.
   *
   * @param key - Redis key
   * @param amount - Amount to increment by (default: 1)
   * @returns Promise that resolves to the new value
   */
  async incr(key: string, amount = 1): Promise<number> {
    try {
      if (amount === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrby(key, amount);
      }
    } catch (error) {
      this.logger.error(`Failed to increment key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Decrements a numeric value in Redis.
   *
   * @param key - Redis key
   * @param amount - Amount to decrement by (default: 1)
   * @returns Promise that resolves to the new value
   */
  async decr(key: string, amount = 1): Promise<number> {
    try {
      if (amount === 1) {
        return await this.client.decr(key);
      } else {
        return await this.client.decrby(key, amount);
      }
    } catch (error) {
      this.logger.error(`Failed to decrement key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Sets a value only if the key doesn't exist.
   *
   * @param key - Redis key
   * @param value - Value to store
   * @param ttlSeconds - Optional TTL in seconds
   * @returns Promise that resolves to true if the key was set
   */
  async setnx(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<boolean> {
    try {
      const serializedValue = JSON.stringify(value);

      if (ttlSeconds) {
        const result = await this.client.set(
          key,
          serializedValue,
          'EX',
          ttlSeconds,
          'NX',
        );
        return result === 'OK';
      } else {
        const result = await this.client.setnx(key, serializedValue);
        return result === 1;
      }
    } catch (error) {
      this.logger.error(`Failed to setnx key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Gets keys matching a pattern.
   * WARNING: Use with caution on large datasets as this can be slow.
   *
   * @param pattern - Redis key pattern (e.g., "user:*")
   * @returns Promise that resolves to an array of matching keys
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await this.client.keys(pattern);
    } catch (error) {
      this.logger.error(`Failed to get keys with pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Scans for keys matching a pattern (safer alternative to KEYS).
   *
   * @param pattern - Redis key pattern
   * @param count - Number of keys to return per iteration
   * @returns AsyncGenerator that yields matching keys
   */
  async *scan(pattern: string, count = 10): AsyncGenerator<string[]> {
    try {
      let cursor = '0';

      do {
        const [newCursor, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          count,
        );
        cursor = newCursor;

        if (keys.length > 0) {
          yield keys;
        }
      } while (cursor !== '0');
    } catch (error) {
      this.logger.error(`Failed to scan keys with pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Executes multiple Redis commands in a pipeline for better performance.
   *
   * @param commands - Function that receives a pipeline and adds commands to it
   * @returns Promise that resolves to an array of command results
   */
  async pipeline<T = unknown>(
    commands: (pipeline: ReturnType<Redis['pipeline']>) => void,
  ): Promise<T[]> {
    try {
      const pipeline = this.client.pipeline();
      commands(pipeline);
      const results = await pipeline.exec();

      if (!results) {
        return [];
      }

      return results.map(([error, result]) => {
        if (error) {
          throw error;
        }
        return result as T;
      });
    } catch (error) {
      this.logger.error('Failed to execute pipeline:', error);
      throw error;
    }
  }

  /**
   * Executes Redis commands in a transaction (MULTI/EXEC).
   *
   * @param commands - Function that receives a transaction and adds commands to it
   * @returns Promise that resolves to an array of command results
   */
  async transaction<T = unknown>(
    commands: (transaction: ReturnType<Redis['multi']>) => void,
  ): Promise<T[]> {
    try {
      const transaction = this.client.multi();
      commands(transaction);
      const results = await transaction.exec();

      if (!results) {
        throw new Error('Transaction failed');
      }

      return results.map(([error, result]) => {
        if (error) {
          throw error;
        }
        return result as T;
      });
    } catch (error) {
      this.logger.error('Failed to execute transaction:', error);
      throw error;
    }
  }

  /**
   * Tests the Redis connection.
   *
   * @param timeout - Test timeout in milliseconds
   * @returns Promise that resolves to connection status
   */
  async ping(
    timeout?: number,
  ): Promise<{ connected: boolean; latency?: number; error?: Error }> {
    return testRedisConnection(this.client, timeout);
  }

  /**
   * Gets Redis server information.
   *
   * @returns Promise that resolves to server info
   */
  async info() {
    return getRedisInfo(this.client);
  }

  /**
   * Flushes all keys from the current database.
   * WARNING: This will delete all data in the current database!
   *
   * @returns Promise that resolves when the operation completes
   */
  async flushdb(): Promise<void> {
    try {
      await this.client.flushdb();
      this.logger.warn('Redis database flushed');
    } catch (error) {
      this.logger.error('Failed to flush database:', error);
      throw error;
    }
  }

  /**
   * Publishes a message to a Redis channel.
   *
   * @param channel - Redis channel name
   * @param message - Message to publish
   * @returns Promise that resolves to the number of clients that received the message
   */
  async publish(channel: string, message: unknown): Promise<number> {
    try {
      const serializedMessage = JSON.stringify(message);
      return await this.client.publish(channel, serializedMessage);
    } catch (error) {
      this.logger.error(`Failed to publish to channel ${channel}:`, error);
      throw error;
    }
  }

  /**
   * Subscribes to Redis channels.
   *
   * @param channels - Channel names to subscribe to
   * @param callback - Callback function for received messages
   * @returns Promise that resolves when subscription is established
   */
  async subscribe(
    channels: string | string[],
    callback: (channel: string, message: unknown) => void,
  ): Promise<void> {
    try {
      const channelsArray = Array.isArray(channels) ? channels : [channels];

      this.client.on('message', (channel: string, message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          callback(channel, parsedMessage);
        } catch {
          callback(channel, message);
        }
      });

      await this.client.subscribe(...channelsArray);
    } catch (error) {
      this.logger.error(`Failed to subscribe to channels:`, error);
      throw error;
    }
  }

  /**
   * Unsubscribes from Redis channels.
   *
   * @param channels - Channel names to unsubscribe from (optional, unsubscribes from all if not provided)
   * @returns Promise that resolves when unsubscription is complete
   */
  async unsubscribe(channels?: string | string[]): Promise<void> {
    try {
      if (channels) {
        const channelsArray = Array.isArray(channels) ? channels : [channels];
        await this.client.unsubscribe(...channelsArray);
      } else {
        await this.client.unsubscribe();
      }
    } catch (error) {
      this.logger.error('Failed to unsubscribe from channels:', error);
      throw error;
    }
  }

  /**
   * Cleanup method called when the module is destroyed.
   */
  async onModuleDestroy(): Promise<void> {
    try {
      await closeRedisClient(this.client);
      this.logger.log('Redis client connection closed');
    } catch (error) {
      this.logger.error('Error closing Redis client:', error);
    }
  }
}
