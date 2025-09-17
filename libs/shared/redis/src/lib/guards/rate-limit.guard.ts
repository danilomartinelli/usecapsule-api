import {
  Injectable,
  Logger,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from '@nestjs/core';
import type { Request as ExpressRequest, Response } from 'express';
interface Request extends ExpressRequest {
  user?: { id: string };
}
import type { Redis, Cluster } from 'ioredis';

import {
  RATE_LIMIT_METADATA_KEY,
  RATE_LIMITED_METADATA_KEY,
  type RateLimitOptions,
  type RateLimitScenarios,
} from '../decorators/rate-limit.decorator';

/**
 * Rate limiting result interface
 */
interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Total number of hits in the current window */
  totalHits: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Time until the window resets (in seconds) */
  resetTime: number;
  /** Time when the limit will be lifted (for blocked requests) */
  retryAfter?: number;
}

/**
 * Rate limiting guard that enforces rate limits based on method decorators.
 *
 * This guard works with the following decorators:
 * - @RateLimit: Applies rate limiting to specific methods
 * - @RateLimited: Applies default rate limiting to all methods in a class
 * - @AuthRateLimit: Applies auth-specific rate limiting
 * - @ApiRateLimit: Applies API-specific rate limiting
 * - @PublicRateLimit: Applies public endpoint rate limiting
 * - @AdminRateLimit: Applies admin-specific rate limiting
 *
 * @example
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_GUARD,
 *       useClass: RateLimitGuard,
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject('REDIS_CLIENT') private readonly redisClient: Redis | Cluster,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const classTarget = context.getClass();

    // Get rate limit metadata from decorators
    const methodRateLimit = this.reflector.get<Required<RateLimitOptions>>(
      RATE_LIMIT_METADATA_KEY,
      handler,
    );
    const classRateLimits = this.reflector.get<RateLimitScenarios>(
      RATE_LIMITED_METADATA_KEY,
      classTarget,
    );

    // Determine which rate limit to apply
    let rateLimitOptions: Required<RateLimitOptions> | null = null;

    if (methodRateLimit) {
      rateLimitOptions = methodRateLimit;
    } else if (classRateLimits?.default) {
      rateLimitOptions = this.normalizeRateLimitOptions(
        classRateLimits.default,
      );
    }

    // If no rate limiting is configured, allow the request
    if (!rateLimitOptions) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Create context for key generation
    const keyContext = {
      req: request,
      ip: request.ip,
      user: request.user,
      body: request.body,
      params: request.params,
      query: request.query,
      headers: request.headers,
    };

    // Check if rate limiting should be skipped
    if (rateLimitOptions.skipIf(keyContext)) {
      return true;
    }

    // Generate rate limit key
    const rateLimitKey = rateLimitOptions.keyGenerator(keyContext);

    try {
      // Check rate limit
      const result = await this.checkRateLimit(rateLimitKey, rateLimitOptions);

      // Add headers if enabled
      if (rateLimitOptions.headers) {
        this.addRateLimitHeaders(response, rateLimitOptions, result);
      }

      // Log rate limit activity
      if (!result.allowed) {
        this.logger.warn(
          `Rate limit exceeded for key: ${rateLimitKey}, ` +
            `totalHits: ${result.totalHits}, limit: ${rateLimitOptions.limit}`,
        );
      } else {
        this.logger.debug(
          `Rate limit check passed for key: ${rateLimitKey}, ` +
            `totalHits: ${result.totalHits}, remaining: ${result.remaining}`,
        );
      }

      // If rate limit is exceeded, throw an exception
      if (!result.allowed) {
        throw new HttpException(
          {
            message: rateLimitOptions.message,
            statusCode: rateLimitOptions.statusCode,
            retryAfter: result.retryAfter,
          },
          rateLimitOptions.statusCode,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Rate limit check error for key ${rateLimitKey}:`,
        error,
      );
      // On Redis errors, allow the request to proceed (fail open)
      return true;
    }
  }

  /**
   * Checks the rate limit for a given key and options.
   */
  private async checkRateLimit(
    key: string,
    options: Required<RateLimitOptions>,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart =
      Math.floor(now / (options.windowSize * 1000)) *
      (options.windowSize * 1000);
    const windowKey = `${key}:${windowStart}`;
    const blockKey = `${key}:blocked`;

    // Check if the key is currently blocked
    const blockExpiry = await this.redisClient.get(blockKey);
    if (blockExpiry && parseInt(blockExpiry, 10) > now) {
      const retryAfter = Math.ceil((parseInt(blockExpiry, 10) - now) / 1000);
      return {
        allowed: false,
        totalHits: options.limit + 1,
        remaining: 0,
        resetTime: options.windowSize,
        retryAfter,
      };
    }

    // Use Lua script for atomic rate limiting
    const luaScript = `
      local window_key = KEYS[1]
      local block_key = KEYS[2]
      local limit = tonumber(ARGV[1])
      local window_size = tonumber(ARGV[2])
      local block_duration = tonumber(ARGV[3])
      local points = tonumber(ARGV[4])
      local burst = tonumber(ARGV[5])
      local now = tonumber(ARGV[6])

      -- Get current count
      local current = redis.call('GET', window_key)
      if current == false then
        current = 0
      else
        current = tonumber(current)
      end

      -- Check if within burst allowance
      local effective_limit = limit + burst

      -- Increment count
      local new_count = current + points

      if new_count <= effective_limit then
        -- Allow request
        redis.call('SET', window_key, new_count, 'EX', window_size)
        return {1, new_count, effective_limit - new_count, window_size}
      else
        -- Rate limit exceeded
        if block_duration > 0 then
          redis.call('SET', block_key, now + (block_duration * 1000), 'EX', block_duration)
        end
        return {0, new_count, 0, window_size, block_duration}
      end
    `;

    const scriptResult = (await this.redisClient.eval(
      luaScript,
      2,
      windowKey,
      blockKey,
      options.limit.toString(),
      options.windowSize.toString(),
      options.blockDuration.toString(),
      options.points.toString(),
      options.burst.toString(),
      now.toString(),
    )) as number[];

    const allowed = scriptResult[0] === 1;
    const totalHits = scriptResult[1];
    const remaining = scriptResult[2];
    const resetTime = scriptResult[3];
    const retryAfter = scriptResult[4];

    return {
      allowed,
      totalHits,
      remaining,
      resetTime,
      retryAfter: retryAfter > 0 ? retryAfter : undefined,
    };
  }

  /**
   * Adds rate limit headers to the response.
   */
  private addRateLimitHeaders(
    response: Response,
    options: Required<RateLimitOptions>,
    result: RateLimitResult,
  ): void {
    response.setHeader('X-RateLimit-Limit', options.limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
    response.setHeader(
      'X-RateLimit-Reset',
      new Date(Date.now() + result.resetTime * 1000).toISOString(),
    );
    response.setHeader('X-RateLimit-Window', options.windowSize);

    if (!result.allowed && result.retryAfter) {
      response.setHeader('Retry-After', result.retryAfter);
    }
  }

  /**
   * Normalizes rate limit options to ensure all required fields are present.
   */
  private normalizeRateLimitOptions(
    options: RateLimitOptions,
  ): Required<RateLimitOptions> {
    return {
      windowSize: options.windowSize,
      limit: options.limit,
      blockDuration: options.blockDuration || 60,
      keyGenerator:
        options.keyGenerator ||
        ((context: { ip?: string; user?: { id: string } }) => {
          const ip = context.ip || 'unknown';
          const userId = context.user?.id;
          return userId ? `default:user:${userId}` : `default:ip:${ip}`;
        }),
      skipIf: options.skipIf || (() => false),
      headers: options.headers !== false,
      message: options.message || 'Rate limit exceeded',
      statusCode: options.statusCode || HttpStatus.TOO_MANY_REQUESTS,
      store: options.store || 'default',
      points: options.points || 1,
      burst: options.burst || 0,
    };
  }
}
