import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base authentication exception class for all auth-related errors.
 * Provides consistent error structure and messaging across the auth service.
 */
export abstract class AuthException extends HttpException {
  constructor(
    message: string,
    statusCode: HttpStatus,
    public readonly errorCode: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(
      {
        message,
        statusCode,
        errorCode,
        details,
        timestamp: new Date().toISOString(),
        service: 'auth-service',
      },
      statusCode
    );
  }
}

/**
 * Exception thrown when user credentials are invalid.
 * Used for login failures, wrong passwords, etc.
 */
export class InvalidCredentialsException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Invalid email or password',
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_CREDENTIALS',
      details
    );
  }
}

/**
 * Exception thrown when a user account is locked due to too many failed attempts.
 */
export class AccountLockedException extends AuthException {
  constructor(lockedUntil?: Date, details?: Record<string, unknown>) {
    const message = lockedUntil
      ? `Account is locked until ${lockedUntil.toISOString()}`
      : 'Account is locked due to too many failed login attempts';

    super(
      message,
      HttpStatus.FORBIDDEN,
      'AUTH_ACCOUNT_LOCKED',
      { lockedUntil, ...details }
    );
  }
}

/**
 * Exception thrown when a user is not active/enabled.
 */
export class AccountInactiveException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Account is inactive or disabled',
      HttpStatus.FORBIDDEN,
      'AUTH_ACCOUNT_INACTIVE',
      details
    );
  }
}

/**
 * Exception thrown when email verification is required but not completed.
 */
export class EmailNotVerifiedException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Email address must be verified before accessing this resource',
      HttpStatus.FORBIDDEN,
      'AUTH_EMAIL_NOT_VERIFIED',
      details
    );
  }
}

/**
 * Exception thrown when a user tries to register with an email that already exists.
 */
export class EmailAlreadyExistsException extends AuthException {
  constructor(email: string, details?: Record<string, unknown>) {
    super(
      'An account with this email address already exists',
      HttpStatus.CONFLICT,
      'AUTH_EMAIL_EXISTS',
      { email, ...details }
    );
  }
}

/**
 * Exception thrown when a JWT token is invalid, expired, or malformed.
 */
export class InvalidTokenException extends AuthException {
  constructor(reason?: string, details?: Record<string, unknown>) {
    const message = reason ? `Invalid token: ${reason}` : 'Invalid or expired token';
    super(
      message,
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_TOKEN',
      { reason, ...details }
    );
  }
}

/**
 * Exception thrown when a refresh token is invalid or expired.
 */
export class InvalidRefreshTokenException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Invalid or expired refresh token',
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_REFRESH_TOKEN',
      details
    );
  }
}

/**
 * Exception thrown when two-factor authentication is required but not provided.
 */
export class TwoFactorRequiredException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Two-factor authentication is required',
      HttpStatus.FORBIDDEN,
      'AUTH_TWO_FACTOR_REQUIRED',
      details
    );
  }
}

/**
 * Exception thrown when two-factor authentication code is invalid.
 */
export class InvalidTwoFactorCodeException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Invalid two-factor authentication code',
      HttpStatus.UNAUTHORIZED,
      'AUTH_INVALID_TWO_FACTOR_CODE',
      details
    );
  }
}

/**
 * Exception thrown when password reset token is invalid or expired.
 */
export class InvalidPasswordResetTokenException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Invalid or expired password reset token',
      HttpStatus.BAD_REQUEST,
      'AUTH_INVALID_PASSWORD_RESET_TOKEN',
      details
    );
  }
}

/**
 * Exception thrown when email verification token is invalid or expired.
 */
export class InvalidEmailVerificationTokenException extends AuthException {
  constructor(details?: Record<string, unknown>) {
    super(
      'Invalid or expired email verification token',
      HttpStatus.BAD_REQUEST,
      'AUTH_INVALID_EMAIL_VERIFICATION_TOKEN',
      details
    );
  }
}

/**
 * Exception thrown when user has insufficient permissions for an operation.
 */
export class InsufficientPermissionsException extends AuthException {
  constructor(requiredPermissions?: string[], details?: Record<string, unknown>) {
    const message = requiredPermissions?.length
      ? `Insufficient permissions. Required: ${requiredPermissions.join(', ')}`
      : 'Insufficient permissions for this operation';

    super(
      message,
      HttpStatus.FORBIDDEN,
      'AUTH_INSUFFICIENT_PERMISSIONS',
      { requiredPermissions, ...details }
    );
  }
}