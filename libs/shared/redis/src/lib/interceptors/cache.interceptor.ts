import { Injectable, Logger, Inject } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from '@nestjs/core';
import type { Redis, Cluster } from 'ioredis';
import { of, tap } from 'rxjs';
import type { Observable } from 'rxjs';

import {
  CACHE_METADATA_KEY,
  CACHE_EVICT_METADATA_KEY,
  CACHE_PUT_METADATA_KEY,
  CACHEABLE_METADATA_KEY,
  type CacheOptions,
  type CacheEvictOptions,
  type CachePutOptions,
  type CacheableOptions,
} from '../decorators/cache.decorator';

/**
 * Cache interceptor that handles caching, cache eviction, and cache updates
 * based on method decorators.
 *
 * This interceptor works with the following decorators:
 * - @Cache: Caches method results
 * - @CacheEvict: Evicts cache entries
 * - @CachePut: Updates cache entries
 * - @Cacheable: Class-level default cache configuration
 *
 * @example
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_INTERCEPTOR,
 *       useClass: CacheInterceptor,
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CacheInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis | Cluster,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const handler = context.getHandler();
    const classTarget = context.getClass();

    // Get metadata from decorators
    const cacheMetadata = this.reflector.get<Required<CacheOptions>>(
      CACHE_METADATA_KEY,
      handler,
    );
    const cacheEvictMetadata = this.reflector.get<Required<CacheEvictOptions>>(
      CACHE_EVICT_METADATA_KEY,
      handler,
    );
    const cachePutMetadata = this.reflector.get<Required<CachePutOptions>>(
      CACHE_PUT_METADATA_KEY,
      handler,
    );
    const cacheableMetadata = this.reflector.get<Required<CacheableOptions>>(
      CACHEABLE_METADATA_KEY,
      classTarget,
    );

    // Extract method arguments
    const args = context.getArgs();
    const [request] = args;

    // Create context for key generation
    const keyContext = {
      request,
      args,
      user: request?.user,
      ip: request?.ip,
    };

    // Handle cache eviction before method execution
    if (cacheEvictMetadata?.beforeInvocation) {
      await this.handleCacheEviction(cacheEvictMetadata, keyContext);
    }

    // Handle caching
    if (
      cacheMetadata ||
      (cacheableMetadata?.enabled && !cacheEvictMetadata && !cachePutMetadata)
    ) {
      const effectiveOptions =
        cacheMetadata ||
        this.createDefaultCacheOptions(
          cacheableMetadata,
          handler as (...args: unknown[]) => unknown,
        );

      if (effectiveOptions.condition(...args)) {
        const cacheKey = this.generateCacheKey(effectiveOptions, keyContext);

        try {
          // Try to get from cache
          const cachedResult = await this.getFromCache(
            cacheKey,
            effectiveOptions,
          );
          if (cachedResult !== null) {
            this.logger.debug(`Cache hit for key: ${cacheKey}`);
            return of(cachedResult);
          }

          this.logger.debug(`Cache miss for key: ${cacheKey}`);
        } catch (error) {
          this.logger.warn(`Cache get error for key ${cacheKey}:`, error);
        }

        // Execute method and cache result
        return next.handle().pipe(
          tap(async (result) => {
            if (result !== null || effectiveOptions.cacheNull) {
              try {
                await this.setToCache(cacheKey, result, effectiveOptions);
                this.logger.debug(`Cached result for key: ${cacheKey}`);
              } catch (error) {
                this.logger.warn(`Cache set error for key ${cacheKey}:`, error);
              }
            }
          }),
        );
      }
    }

    // Execute method without caching
    return next.handle().pipe(
      tap(async (result) => {
        // Handle cache eviction after method execution
        if (cacheEvictMetadata && !cacheEvictMetadata.beforeInvocation) {
          await this.handleCacheEviction(cacheEvictMetadata, keyContext);
        }

        // Handle cache put
        if (cachePutMetadata) {
          if (cachePutMetadata.condition(...args)) {
            const cacheKey = this.generateCacheKey(
              cachePutMetadata,
              keyContext,
            );
            if (result !== null || cachePutMetadata.cacheNull) {
              try {
                await this.setToCache(cacheKey, result, cachePutMetadata);
                this.logger.debug(`Cache put for key: ${cacheKey}`);
              } catch (error) {
                this.logger.warn(`Cache put error for key ${cacheKey}:`, error);
              }
            }
          }
        }
      }),
    );
  }

  /**
   * Generates a cache key based on the configuration and context.
   */
  private generateCacheKey(
    options:
      | Required<CacheOptions>
      | Required<CacheEvictOptions>
      | Required<CachePutOptions>,
    context: {
      request?: unknown;
      args: unknown[];
      user?: unknown;
      ip?: string;
    },
  ): string {
    const baseKey = options.keyGenerator(...context.args);
    return options.prefix ? `${options.prefix}:${baseKey}` : baseKey;
  }

  /**
   * Gets a value from the cache.
   */
  private async getFromCache(
    key: string,
    options: Required<CacheOptions>,
  ): Promise<unknown | null> {
    const value = await this.redisClient.get(key);
    if (value === null) {
      return null;
    }

    return options.deserialize(value);
  }

  /**
   * Sets a value to the cache.
   */
  private async setToCache(
    key: string,
    value: unknown,
    options: Required<CacheOptions> | Required<CachePutOptions>,
  ): Promise<void> {
    const serializedValue = options.serialize(value);

    if (options.ttl > 0) {
      await this.redisClient.setex(key, options.ttl, serializedValue);
    } else {
      await this.redisClient.set(key, serializedValue);
    }
  }

  /**
   * Handles cache eviction based on the configuration.
   */
  private async handleCacheEviction(
    options: Required<CacheEvictOptions>,
    context: {
      request?: unknown;
      args: unknown[];
      user?: unknown;
      ip?: string;
    },
  ): Promise<void> {
    if (!options.condition(...context.args)) {
      return;
    }

    try {
      if (options.allEntries) {
        // Evict all entries with the prefix
        const pattern = options.prefix ? `${options.prefix}:*` : '*';
        await this.evictByPattern(pattern);
        this.logger.debug(`Evicted all entries with pattern: ${pattern}`);
      } else {
        // Evict specific key
        const cacheKey = this.generateCacheKey(options, context);
        await this.redisClient.del(cacheKey);
        this.logger.debug(`Evicted cache key: ${cacheKey}`);
      }
    } catch (error) {
      this.logger.warn('Cache eviction error:', error);
    }
  }

  /**
   * Evicts cache entries by pattern.
   */
  private async evictByPattern(pattern: string): Promise<void> {
    // Handle both Redis and Cluster instances
    if ('scanStream' in this.redisClient) {
      // Redis instance has scanStream
      const stream = (this.redisClient as Redis).scanStream({
        match: pattern,
        count: 100,
      });

      const keysToDelete: string[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (keys: string[]) => {
          keysToDelete.push(...keys);
        });

        stream.on('end', async () => {
          try {
            if (keysToDelete.length > 0) {
              // Delete keys in batches to avoid blocking Redis
              const batchSize = 100;
              for (let i = 0; i < keysToDelete.length; i += batchSize) {
                const batch = keysToDelete.slice(i, i + batchSize);
                await this.redisClient.del(...batch);
              }
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        });

        stream.on('error', reject);
      });
    } else {
      // Cluster instance - use alternative approach
      const keys = await this.redisClient.keys(pattern);
      if (keys.length > 0) {
        // Delete keys in batches to avoid blocking Redis
        const batchSize = 100;
        for (let i = 0; i < keys.length; i += batchSize) {
          const batch = keys.slice(i, i + batchSize);
          await this.redisClient.del(...batch);
        }
      }
    }
  }

  /**
   * Creates default cache options from cacheable metadata.
   */
  private createDefaultCacheOptions(
    cacheableOptions: Required<CacheableOptions>,
    handler: (...args: unknown[]) => unknown,
  ): Required<CacheOptions> {
    return {
      prefix: cacheableOptions.prefix,
      ttl: cacheableOptions.ttl,
      keyGenerator: (...args: unknown[]) => {
        const methodName = handler.name;
        const argsKey = args.length > 0 ? JSON.stringify(args) : 'no-args';
        return `${methodName}:${argsKey}`;
      },
      condition: cacheableOptions.condition,
      cacheNull: cacheableOptions.cacheNull,
      store: cacheableOptions.store,
      serialize: cacheableOptions.serialize,
      deserialize: cacheableOptions.deserialize,
    };
  }
}
