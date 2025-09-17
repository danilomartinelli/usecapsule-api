import { z } from 'zod';

import { BaseEntitySchema, SoftDeletableEntitySchema } from './common.schemas';

/**
 * User entity schema for authentication service
 */
export const UserSchema = SoftDeletableEntitySchema.extend({
  email: z.string().email().max(255),
  passwordHash: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  emailVerified: z.boolean().default(false),
  emailVerifiedAt: z.coerce.date().nullable(),
  lastLoginAt: z.coerce.date().nullable(),
  failedLoginAttempts: z.number().int().nonnegative().default(0),
  lockedAt: z.coerce.date().nullable(),
  isActive: z.boolean().default(true),
  profilePictureUrl: z.string().url().nullable(),
  timezone: z.string().default('UTC'),
  locale: z.string().default('en'),
  twoFactorEnabled: z.boolean().default(false),
});

/**
 * User role schema
 */
export const UserRoleSchema = BaseEntitySchema.extend({
  userId: z.string().uuid(),
  role: z.enum(['USER', 'ADMIN', 'SUPERADMIN']),
  grantedAt: z.coerce.date(),
  grantedBy: z.string().uuid(),
  expiresAt: z.coerce.date().nullable(),
});

/**
 * Authentication session schema
 */
export const AuthSessionSchema = BaseEntitySchema.extend({
  userId: z.string().uuid(),
  sessionToken: z.string().min(1),
  deviceId: z.string().nullable(),
  deviceName: z.string().nullable(),
  ipAddress: z.string(),
  userAgent: z.string(),
  expiresAt: z.coerce.date(),
  isActive: z.boolean().default(true),
  lastActivityAt: z.coerce.date(),
});

/**
 * Email verification token schema
 */
export const EmailVerificationTokenSchema = BaseEntitySchema.extend({
  userId: z.string().uuid(),
  token: z.string().min(1),
  email: z.string().email(),
  expiresAt: z.coerce.date(),
  usedAt: z.coerce.date().nullable(),
});

/**
 * Password reset token schema
 */
export const PasswordResetTokenSchema = BaseEntitySchema.extend({
  userId: z.string().uuid(),
  token: z.string().min(1),
  expiresAt: z.coerce.date(),
  usedAt: z.coerce.date().nullable(),
  ipAddress: z.string(),
});

/**
 * Two-factor authentication schema
 */
export const TwoFactorAuthSchema = BaseEntitySchema.extend({
  userId: z.string().uuid(),
  secret: z.string().min(1),
  backupCodes: z.array(z.string()),
  isVerified: z.boolean().default(false),
  verifiedAt: z.coerce.date().nullable(),
  lastUsedAt: z.coerce.date().nullable(),
});

/**
 * OAuth provider schema
 */
export const OAuthProviderSchema = BaseEntitySchema.extend({
  userId: z.string().uuid(),
  provider: z.enum(['GOOGLE', 'GITHUB', 'MICROSOFT', 'APPLE']),
  providerId: z.string().min(1),
  providerEmail: z.string().email(),
  providerData: z.record(z.string(), z.unknown()),
  isLinked: z.boolean().default(true),
  linkedAt: z.coerce.date(),
});

/**
 * API key schema for service authentication
 */
export const ApiKeySchema = SoftDeletableEntitySchema.extend({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  keyHash: z.string().min(1),
  permissions: z.array(z.string()),
  expiresAt: z.coerce.date().nullable(),
  lastUsedAt: z.coerce.date().nullable(),
  isActive: z.boolean().default(true),
});

/**
 * Authentication audit log schema
 */
export const AuthAuditLogSchema = BaseEntitySchema.extend({
  userId: z.string().uuid().nullable(),
  action: z.enum([
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'LOGOUT',
    'PASSWORD_RESET_REQUESTED',
    'PASSWORD_RESET_COMPLETED',
    'EMAIL_VERIFICATION_SENT',
    'EMAIL_VERIFIED',
    'TWO_FACTOR_ENABLED',
    'TWO_FACTOR_DISABLED',
    'ACCOUNT_LOCKED',
    'ACCOUNT_UNLOCKED',
    'API_KEY_CREATED',
    'API_KEY_DELETED',
  ]),
  ipAddress: z.string(),
  userAgent: z.string(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  sessionId: z.string().uuid().nullable(),
});

// Type exports
export type User = z.infer<typeof UserSchema>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export type AuthSession = z.infer<typeof AuthSessionSchema>;
export type EmailVerificationToken = z.infer<
  typeof EmailVerificationTokenSchema
>;
export type PasswordResetToken = z.infer<typeof PasswordResetTokenSchema>;
export type TwoFactorAuth = z.infer<typeof TwoFactorAuthSchema>;
export type OAuthProvider = z.infer<typeof OAuthProviderSchema>;
export type ApiKey = z.infer<typeof ApiKeySchema>;
export type AuthAuditLog = z.infer<typeof AuthAuditLogSchema>;
