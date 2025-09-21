import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { AuthException } from '../exceptions/auth.exceptions';

/**
 * Global exception filter that handles all unhandled exceptions.
 *
 * This filter provides consistent error responses across all microservices
 * and ensures proper logging and error formatting. It handles both known
 * exceptions (HttpException, AuthException) and unknown errors.
 *
 * @example
 * ```typescript
 * @Module({
 *   providers: [
 *     {
 *       provide: APP_FILTER,
 *       useClass: GlobalExceptionFilter,
 *     },
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    let status: HttpStatus;
    let errorResponse: Record<string, unknown>;

    if (exception instanceof AuthException) {
      // Handle custom auth exceptions
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as Record<string, unknown>;

      errorResponse = {
        statusCode: status,
        message: exceptionResponse.message,
        errorCode: exceptionResponse.errorCode,
        details: exceptionResponse.details,
        timestamp: exceptionResponse.timestamp,
        service: exceptionResponse.service,
        path: request.url,
        method: request.method,
      };

      this.logger.warn(
        `Auth exception: ${exceptionResponse.errorCode} - ${exceptionResponse.message}`,
        {
          errorCode: exceptionResponse.errorCode,
          path: request.url,
          method: request.method,
          details: exceptionResponse.details,
        }
      );
    } else if (exception instanceof HttpException) {
      // Handle NestJS HTTP exceptions
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      errorResponse = {
        statusCode: status,
        message: typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message || 'Internal server error',
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(typeof exceptionResponse === 'object' ? exceptionResponse : {}),
      };

      this.logger.warn(
        `HTTP exception: ${status} - ${errorResponse.message}`,
        {
          statusCode: status,
          path: request.url,
          method: request.method,
        }
      );
    } else {
      // Handle unknown exceptions
      status = HttpStatus.INTERNAL_SERVER_ERROR;

      errorResponse = {
        statusCode: status,
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
      };

      this.logger.error(
        'Unhandled exception occurred',
        exception instanceof Error ? exception.stack : exception,
        {
          path: request.url,
          method: request.method,
          exception: exception instanceof Error ? {
            name: exception.name,
            message: exception.message,
            stack: exception.stack,
          } : exception,
        }
      );
    }

    response.status(status).json(errorResponse);
  }
}

/**
 * Validation exception filter specifically for handling validation errors.
 *
 * This filter provides more detailed error responses for validation failures,
 * making it easier for clients to understand what went wrong.
 */
@Catch(HttpException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();

    if (status === HttpStatus.BAD_REQUEST) {
      const exceptionResponse = exception.getResponse() as Record<string, unknown>;

      // Check if it's a validation error
      if (exceptionResponse.errors && Array.isArray(exceptionResponse.errors)) {
        const errorResponse = {
          statusCode: status,
          message: 'Validation failed',
          errors: exceptionResponse.errors,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
        };

        this.logger.warn(
          `Validation failed on ${request.method} ${request.url}`,
          {
            errors: exceptionResponse.errors,
            body: request.body,
          }
        );

        response.status(status).json(errorResponse);
        return;
      }
    }

    // If not a validation error, fall back to default handling
    const errorResponse = {
      statusCode: status,
      message: exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    response.status(status).json(errorResponse);
  }
}