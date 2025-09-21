import { SetMetadata } from '@nestjs/common';

/**
 * Cache configuration options for the @Cache decorator
 */
export interface CacheOptions {
  /** Cache key prefix */
  prefix?: string;
  /** Time to live in seconds */
  ttl?: number;
  /** Function to generate cache key from method arguments */
  keyGenerator?: (...args: unknown[]) => string;
  /** Condition to determine if caching should be applied */
  condition?: (...args: unknown[]) => boolean;
  /** Whether to cache null/undefined results */
  cacheNull?: boolean;
  /** Cache implementation to use */
  store?: string;
  /** Serialize function for cache values */
  serialize?: (value: unknown) => string;
  /** Deserialize function for cache values */
  deserialize?: (value: string) => unknown;
}

/**
 * Metadata key for cache configuration
 */
export const CACHE_METADATA_KEY = Symbol('cache_metadata');

/**
 * Method decorator that enables caching for the decorated method.
 *
 * This decorator marks a method for caching and stores configuration metadata
 * that will be processed by the CacheInterceptor.
 *
 * @param options - Cache configuration options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   @Cache({
 *     prefix: 'user',
 *     ttl: 300,
 *     keyGenerator: (id: string) => `user:${id}`
 *   })
 *   async findById(id: string): Promise<User> {
 *     return this.userRepository.findById(id);
 *   }
 *
 *   @Cache({
 *     prefix: 'users',
 *     ttl: 60,
 *     condition: (limit: number) => limit <= 100
 *   })
 *   async findMany(limit: number): Promise<User[]> {
 *     return this.userRepository.findMany(limit);
 *   }
 * }
 * ```
 */
export function Cache(options: CacheOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    descriptor: PropertyDescriptor,
  ) => {
    if (!propertyKey) {
      throw new Error('Property key is required for Cache decorator');
    }
    const defaultOptions: Required<CacheOptions> = {
      prefix: '',
      ttl: 300, // 5 minutes default
      keyGenerator: (...args: unknown[]) => {
        const className = target.constructor.name;
        const methodName = String(propertyKey);
        const argsKey = args.length > 0 ? JSON.stringify(args) : 'no-args';
        return `${className}:${methodName}:${argsKey}`;
      },
      condition: () => true,
      cacheNull: false,
      store: 'default',
      serialize: (value: unknown) => JSON.stringify(value),
      deserialize: (value: string) => JSON.parse(value),
    };

    const finalOptions: Required<CacheOptions> = {
      ...defaultOptions,
      ...options,
      keyGenerator: options.keyGenerator || defaultOptions.keyGenerator,
      condition: options.condition || defaultOptions.condition,
      serialize: options.serialize || defaultOptions.serialize,
      deserialize: options.deserialize || defaultOptions.deserialize,
    };

    SetMetadata(CACHE_METADATA_KEY, finalOptions)(
      target,
      propertyKey,
      descriptor,
    );
    return descriptor;
  };
}

/**
 * Method decorator that evicts cache entries after the method execution.
 *
 * @param options - Cache eviction options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   @CacheEvict({
 *     prefix: 'user',
 *     keyGenerator: (user: User) => `user:${user.id}`
 *   })
 *   async update(user: User): Promise<User> {
 *     return this.userRepository.update(user);
 *   }
 *
 *   @CacheEvict({
 *     prefix: 'user',
 *     allEntries: true
 *   })
 *   async deleteAll(): Promise<void> {
 *     await this.userRepository.deleteAll();
 *   }
 * }
 * ```
 */
export interface CacheEvictOptions
  extends Omit<CacheOptions, 'ttl' | 'cacheNull'> {
  /** Whether to evict all entries with the given prefix */
  allEntries?: boolean;
  /** Whether to evict before or after method execution */
  beforeInvocation?: boolean;
}

/**
 * Metadata key for cache eviction configuration
 */
export const CACHE_EVICT_METADATA_KEY = Symbol('cache_evict_metadata');

/**
 * Method decorator that evicts cache entries.
 */
export function CacheEvict(options: CacheEvictOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    descriptor: PropertyDescriptor,
  ) => {
    if (!propertyKey) {
      throw new Error('Property key is required for CacheEvict decorator');
    }
    const defaultOptions: Required<CacheEvictOptions> = {
      prefix: '',
      keyGenerator: (...args: unknown[]) => {
        const className = target.constructor.name;
        const methodName = String(propertyKey);
        const argsKey = args.length > 0 ? JSON.stringify(args) : 'no-args';
        return `${className}:${methodName}:${argsKey}`;
      },
      condition: () => true,
      store: 'default',
      serialize: (value: unknown) => JSON.stringify(value),
      deserialize: (value: string) => JSON.parse(value),
      allEntries: false,
      beforeInvocation: false,
    };

    const finalOptions: Required<CacheEvictOptions> = {
      ...defaultOptions,
      ...options,
      keyGenerator: options.keyGenerator || defaultOptions.keyGenerator,
      condition: options.condition || defaultOptions.condition,
      serialize: options.serialize || defaultOptions.serialize,
      deserialize: options.deserialize || defaultOptions.deserialize,
    };

    SetMetadata(CACHE_EVICT_METADATA_KEY, finalOptions)(
      target,
      propertyKey,
      descriptor,
    );
    return descriptor;
  };
}

/**
 * Method decorator that updates cache entries after method execution.
 *
 * @param options - Cache update options
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class UserService {
 *   @CachePut({
 *     prefix: 'user',
 *     keyGenerator: (user: User) => `user:${user.id}`,
 *     ttl: 600
 *   })
 *   async create(user: User): Promise<User> {
 *     return this.userRepository.create(user);
 *   }
 * }
 * ```
 */
export type CachePutOptions = CacheOptions;

/**
 * Metadata key for cache put configuration
 */
export const CACHE_PUT_METADATA_KEY = Symbol('cache_put_metadata');

/**
 * Method decorator that puts the result into cache after method execution.
 */
export function CachePut(options: CachePutOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    descriptor: PropertyDescriptor,
  ) => {
    if (!propertyKey) {
      throw new Error('Property key is required for CachePut decorator');
    }
    const defaultOptions: Required<CachePutOptions> = {
      prefix: '',
      ttl: 300, // 5 minutes default
      keyGenerator: (...args: unknown[]) => {
        const className = target.constructor.name;
        const methodName = String(propertyKey);
        const argsKey = args.length > 0 ? JSON.stringify(args) : 'no-args';
        return `${className}:${methodName}:${argsKey}`;
      },
      condition: () => true,
      cacheNull: false,
      store: 'default',
      serialize: (value: unknown) => JSON.stringify(value),
      deserialize: (value: string) => JSON.parse(value),
    };

    const finalOptions: Required<CachePutOptions> = {
      ...defaultOptions,
      ...options,
      keyGenerator: options.keyGenerator || defaultOptions.keyGenerator,
      condition: options.condition || defaultOptions.condition,
      serialize: options.serialize || defaultOptions.serialize,
      deserialize: options.deserialize || defaultOptions.deserialize,
    };

    SetMetadata(CACHE_PUT_METADATA_KEY, finalOptions)(
      target,
      propertyKey,
      descriptor,
    );
    return descriptor;
  };
}

/**
 * Class decorator that applies caching configuration to all methods in a class.
 *
 * @param options - Default cache configuration for all methods
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @Cacheable({
 *   prefix: 'user-service',
 *   ttl: 300
 * })
 * @Injectable()
 * export class UserService {
 *   // All methods will inherit the default cache configuration
 *   async findById(id: string): Promise<User> {
 *     return this.userRepository.findById(id);
 *   }
 *
 *   @Cache({ ttl: 600 }) // Override TTL for this method
 *   async findAll(): Promise<User[]> {
 *     return this.userRepository.findAll();
 *   }
 * }
 * ```
 */
export interface CacheableOptions extends CacheOptions {
  /** Whether to enable caching by default for all methods */
  enabled?: boolean;
}

/**
 * Metadata key for class-level cache configuration
 */
export const CACHEABLE_METADATA_KEY = Symbol('cacheable_metadata');

/**
 * Class decorator that applies default caching configuration to all methods.
 */
export function Cacheable(options: CacheableOptions = {}): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any) => {
    const defaultOptions: Required<CacheableOptions> = {
      prefix: target.name.toLowerCase(),
      ttl: 300,
      keyGenerator: (...args: unknown[]) => JSON.stringify(args),
      condition: () => true,
      cacheNull: false,
      store: 'default',
      serialize: (value: unknown) => JSON.stringify(value),
      deserialize: (value: string) => JSON.parse(value),
      enabled: true,
    };

    const finalOptions: Required<CacheableOptions> = {
      ...defaultOptions,
      ...options,
      prefix: options.prefix || defaultOptions.prefix,
      keyGenerator: options.keyGenerator || defaultOptions.keyGenerator,
      condition: options.condition || defaultOptions.condition,
      serialize: options.serialize || defaultOptions.serialize,
      deserialize: options.deserialize || defaultOptions.deserialize,
    };

    SetMetadata(CACHEABLE_METADATA_KEY, finalOptions)(target);
    return target;
  };
}
