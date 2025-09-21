import { SetMetadata } from '@nestjs/common';

/**
 * Rate limiting configuration options
 */
export interface RateLimitOptions {
  /** Time window in seconds */
  windowSize: number;
  /** Maximum number of requests per window */
  limit: number;
  /** Block duration in seconds after limit is exceeded */
  blockDuration?: number;
  /** Key generator function to create unique keys for rate limiting */
  keyGenerator?: (context: {
    ip?: string;
    user?: { id: string };
    req?: {
      ip?: string;
      user?: { id: string };
      body?: Record<string, unknown>;
    };
    body?: Record<string, unknown>;
  }) => string;
  /** Condition to determine if rate limiting should be applied */
  skipIf?: (context: {
    ip?: string;
    user?: { id: string };
    req?: {
      ip?: string;
      user?: { id: string };
      body?: Record<string, unknown>;
    };
    body?: Record<string, unknown>;
  }) => boolean;
  /** Include rate limit headers in response */
  headers?: boolean;
  /** Custom error message when rate limit is exceeded */
  message?: string;
  /** HTTP status code to return when rate limit is exceeded */
  statusCode?: number;
  /** Rate limit store to use */
  store?: string;
  /** Points to deduct per request (default: 1) */
  points?: number;
  /** Burst allowance for short spikes */
  burst?: number;
}

/**
 * Metadata key for rate limit configuration
 */
export const RATE_LIMIT_METADATA_KEY = Symbol('rate_limit_metadata');

/**
 * Method decorator that applies rate limiting to the decorated method.
 *
 * This decorator marks a method for rate limiting and stores configuration
 * metadata that will be processed by the RateLimitGuard.
 *
 * @param options - Rate limiting configuration
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @RateLimit({
 *     windowSize: 900, // 15 minutes
 *     limit: 5,
 *     blockDuration: 1800, // 30 minutes
 *     keyGenerator: (req) => `login:${req.ip}:${req.body.email}`,
 *     message: 'Too many login attempts'
 *   })
 *   @Post('login')
 *   async login(@Body() loginDto: LoginDto) {
 *     return this.authService.login(loginDto);
 *   }
 *
 *   @RateLimit({
 *     windowSize: 60,
 *     limit: 10,
 *     keyGenerator: (req) => `api:${req.user?.id || req.ip}`
 *   })
 *   @Get('profile')
 *   async getProfile(@Request() req) {
 *     return this.authService.getProfile(req.user.id);
 *   }
 * }
 * ```
 */
export function RateLimit(options: RateLimitOptions): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol | undefined,
    descriptor: PropertyDescriptor,
  ) => {
    if (!propertyKey) {
      throw new Error('Property key is required for RateLimit decorator');
    }
    const defaultOptions: Required<RateLimitOptions> = {
      windowSize: 60, // 1 minute
      limit: 10,
      blockDuration: 60, // 1 minute
      keyGenerator: (context: {
        ip?: string;
        user?: { id: string };
        req?: {
          ip?: string;
          user?: { id: string };
        };
      }) => {
        const ip = context.ip || context.req?.ip || 'unknown';
        const userId = context.user?.id || context.req?.user?.id;
        const className = target.constructor.name;
        const methodName = String(propertyKey);
        return userId
          ? `${className}:${methodName}:user:${userId}`
          : `${className}:${methodName}:ip:${ip}`;
      },
      skipIf: () => false,
      headers: true,
      message: 'Rate limit exceeded',
      statusCode: 429,
      store: 'default',
      points: 1,
      burst: 0,
    };

    const finalOptions: Required<RateLimitOptions> = {
      ...defaultOptions,
      ...options,
      keyGenerator: options.keyGenerator || defaultOptions.keyGenerator,
      skipIf: options.skipIf || defaultOptions.skipIf,
    };

    SetMetadata(RATE_LIMIT_METADATA_KEY, finalOptions)(
      target,
      propertyKey,
      descriptor,
    );
    return descriptor;
  };
}

/**
 * Rate limiting configuration for different scenarios
 */
export interface RateLimitScenarios {
  /** Default rate limit for all endpoints */
  default?: RateLimitOptions;
  /** Rate limit for authentication endpoints */
  auth?: RateLimitOptions;
  /** Rate limit for API endpoints */
  api?: RateLimitOptions;
  /** Rate limit for administrative operations */
  admin?: RateLimitOptions;
  /** Rate limit for public endpoints */
  public?: RateLimitOptions;
}

/**
 * Metadata key for controller-level rate limit configuration
 */
export const RATE_LIMITED_METADATA_KEY = Symbol('rate_limited_metadata');

/**
 * Class decorator that applies rate limiting configuration to all methods in a controller.
 *
 * @param scenarios - Rate limiting scenarios or default configuration
 * @returns Class decorator
 *
 * @example
 * ```typescript
 * @RateLimited({
 *   default: {
 *     windowSize: 60,
 *     limit: 100,
 *     keyGenerator: (req) => `api:${req.user?.id || req.ip}`
 *   },
 *   auth: {
 *     windowSize: 900,
 *     limit: 5,
 *     blockDuration: 1800
 *   }
 * })
 * @Controller('api')
 * export class ApiController {
 *   // Uses default rate limit
 *   @Get('data')
 *   async getData() {
 *     return this.dataService.getData();
 *   }
 *
 *   @RateLimit({ scenario: 'auth' })
 *   @Post('login')
 *   async login(@Body() loginDto: LoginDto) {
 *     return this.authService.login(loginDto);
 *   }
 * }
 * ```
 */
export function RateLimited(
  scenarios: RateLimitScenarios | RateLimitOptions,
): ClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any) => {
    // If it's a single RateLimitOptions object, treat it as default
    const finalScenarios: RateLimitScenarios =
      'windowSize' in scenarios
        ? { default: scenarios as RateLimitOptions }
        : (scenarios as RateLimitScenarios);

    SetMetadata(RATE_LIMITED_METADATA_KEY, finalScenarios)(target);
    return target;
  };
}

/**
 * Special rate limiting decorator for authentication endpoints.
 *
 * @param options - Optional rate limit overrides
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Controller('auth')
 * export class AuthController {
 *   @AuthRateLimit()
 *   @Post('login')
 *   async login(@Body() loginDto: LoginDto) {
 *     return this.authService.login(loginDto);
 *   }
 *
 *   @AuthRateLimit({ limit: 3, blockDuration: 3600 })
 *   @Post('forgot-password')
 *   async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
 *     return this.authService.forgotPassword(forgotPasswordDto);
 *   }
 * }
 * ```
 */
export function AuthRateLimit(
  options: Partial<RateLimitOptions> = {},
): MethodDecorator {
  const authDefaults: RateLimitOptions = {
    windowSize: 900, // 15 minutes
    limit: 5,
    blockDuration: 1800, // 30 minutes
    keyGenerator: (context: {
      ip?: string;
      req?: {
        ip?: string;
        body?: { email?: string };
      };
      body?: { email?: string };
    }) => {
      const ip = context.ip || context.req?.ip || 'unknown';
      const email = context.body?.email || context.req?.body?.email;
      return email ? `auth:${email}` : `auth:${ip}`;
    },
    message: 'Too many authentication attempts. Please try again later.',
    headers: true,
  };

  return RateLimit({ ...authDefaults, ...options });
}

/**
 * Rate limiting decorator for API endpoints with user-based limiting.
 *
 * @param options - Optional rate limit overrides
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Controller('api')
 * export class ApiController {
 *   @ApiRateLimit()
 *   @Get('users')
 *   async getUsers() {
 *     return this.userService.getUsers();
 *   }
 *
 *   @ApiRateLimit({ limit: 50, windowSize: 3600 })
 *   @Post('upload')
 *   async uploadFile(@UploadedFile() file: Express.Multer.File) {
 *     return this.fileService.upload(file);
 *   }
 * }
 * ```
 */
export function ApiRateLimit(
  options: Partial<RateLimitOptions> = {},
): MethodDecorator {
  const apiDefaults: RateLimitOptions = {
    windowSize: 60, // 1 minute
    limit: 100,
    blockDuration: 300, // 5 minutes
    keyGenerator: (context: {
      user?: { id: string };
      req?: {
        user?: { id: string };
        ip?: string;
      };
      ip?: string;
    }) => {
      const userId = context.user?.id || context.req?.user?.id;
      const ip = context.ip || context.req?.ip || 'unknown';
      return userId ? `api:user:${userId}` : `api:ip:${ip}`;
    },
    message: 'API rate limit exceeded. Please slow down your requests.',
    headers: true,
  };

  return RateLimit({ ...apiDefaults, ...options });
}

/**
 * Rate limiting decorator for public endpoints with IP-based limiting.
 *
 * @param options - Optional rate limit overrides
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Controller('public')
 * export class PublicController {
 *   @PublicRateLimit()
 *   @Get('health')
 *   async health() {
 *     return { status: 'ok' };
 *   }
 *
 *   @PublicRateLimit({ limit: 10, windowSize: 3600 })
 *   @Post('contact')
 *   async contact(@Body() contactDto: ContactDto) {
 *     return this.contactService.sendMessage(contactDto);
 *   }
 * }
 * ```
 */
export function PublicRateLimit(
  options: Partial<RateLimitOptions> = {},
): MethodDecorator {
  const publicDefaults: RateLimitOptions = {
    windowSize: 60, // 1 minute
    limit: 20,
    blockDuration: 60, // 1 minute
    keyGenerator: (context: { ip?: string; req?: { ip?: string } }) => {
      const ip = context.ip || context.req?.ip || 'unknown';
      return `public:${ip}`;
    },
    message: 'Too many requests. Please try again later.',
    headers: true,
  };

  return RateLimit({ ...publicDefaults, ...options });
}

/**
 * Rate limiting decorator for administrative operations with strict limits.
 *
 * @param options - Optional rate limit overrides
 * @returns Method decorator
 *
 * @example
 * ```typescript
 * @Controller('admin')
 * export class AdminController {
 *   @AdminRateLimit()
 *   @Delete('users/:id')
 *   async deleteUser(@Param('id') id: string) {
 *     return this.userService.delete(id);
 *   }
 *
 *   @AdminRateLimit({ limit: 1, windowSize: 3600 })
 *   @Post('system/reset')
 *   async systemReset() {
 *     return this.systemService.reset();
 *   }
 * }
 * ```
 */
export function AdminRateLimit(
  options: Partial<RateLimitOptions> = {},
): MethodDecorator {
  const adminDefaults: RateLimitOptions = {
    windowSize: 300, // 5 minutes
    limit: 10,
    blockDuration: 900, // 15 minutes
    keyGenerator: (context: {
      user?: { id: string };
      req?: { user?: { id: string } };
    }) => {
      const userId = context.user?.id || context.req?.user?.id || 'unknown';
      return `admin:${userId}`;
    },
    message: 'Administrative rate limit exceeded.',
    headers: true,
  };

  return RateLimit({ ...adminDefaults, ...options });
}
