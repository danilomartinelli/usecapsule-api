import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { ZodError } from 'zod';
import type { ZodSchema } from 'zod';

/**
 * Validation pipe using Zod schemas for robust input validation.
 *
 * This pipe validates input data against Zod schemas and provides
 * detailed error messages for validation failures. It's designed
 * to work with the existing DDD architecture and provide consistent
 * error handling across all microservices.
 *
 * @example
 * ```typescript
 * const loginSchema = z.object({
 *   email: z.string().email('Invalid email format'),
 *   password: z.string().min(8, 'Password must be at least 8 characters'),
 * });
 *
 * @Controller('auth')
 * export class AuthController {
 *   @Post('login')
 *   async login(@Body(new ZodValidationPipe(loginSchema)) dto: LoginDto) {
 *     return this.authService.login(dto);
 *   }
 * }
 * ```
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    try {
      const parsedValue = this.schema.parse(value);
      return parsedValue;
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.errors.map((err) => {
          const path = err.path.join('.');
          return `${path}: ${err.message}`;
        });

        throw new BadRequestException({
          message: 'Validation failed',
          statusCode: 400,
          errors: errorMessages,
          timestamp: new Date().toISOString(),
          path: metadata.type,
        });
      }
      throw new BadRequestException('Invalid input data');
    }
  }
}

/**
 * Creates a validation pipe for a specific Zod schema.
 * Helper function to create validation pipes in a more readable way.
 *
 * @param schema - The Zod schema to validate against
 * @returns A new ZodValidationPipe instance
 *
 * @example
 * ```typescript
 * const registerSchema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 *   firstName: z.string().min(1),
 *   lastName: z.string().min(1),
 * });
 *
 * @Post('register')
 * async register(@Body(createValidationPipe(registerSchema)) dto: RegisterDto) {
 *   return this.authService.register(dto);
 * }
 * ```
 */
export function createValidationPipe(schema: ZodSchema): ZodValidationPipe {
  return new ZodValidationPipe(schema);
}

/**
 * Decorator that applies Zod validation to method parameters.
 * More convenient way to apply validation without explicit pipe usage.
 *
 * @param schema - The Zod schema to validate against
 * @returns Parameter decorator
 *
 * @example
 * ```typescript
 * const userIdSchema = z.string().uuid('Invalid user ID format');
 *
 * @Controller('users')
 * export class UsersController {
 *   @Get(':id')
 *   async getUser(@ValidateWith(userIdSchema) @Param('id') id: string) {
 *     return this.usersService.findById(id);
 *   }
 * }
 * ```
 */
export function ValidateWith(_schema: ZodSchema): ParameterDecorator {
  return (_target: unknown, _propertyKey: string | symbol | undefined, _parameterIndex: number) => {
    // This would require a custom interceptor to work properly
    // For now, it's better to use the pipe directly
    throw new Error('ValidateWith decorator is not yet implemented. Use ZodValidationPipe directly.');
  };
}