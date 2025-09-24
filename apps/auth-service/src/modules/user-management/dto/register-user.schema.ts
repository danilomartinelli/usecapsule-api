import { z } from 'zod';

/**
 * Zod schema for user registration validation.
 *
 * This schema provides comprehensive validation for user registration
 * including email format, password strength, name validation, and
 * optional fields like profile picture URL and locale settings.
 */
export const registerUserSchema = z.object({
  /**
   * User's email address.
   * Must be a valid email format and not exceed 255 characters.
   */
  email: z
    .string({
      required_error: 'Email is required',
      invalid_type_error: 'Email must be a string',
    })
    .min(1, 'Email cannot be empty')
    .max(255, 'Email cannot exceed 255 characters')
    .email('Invalid email format')
    .toLowerCase()
    .trim(),

  /**
   * User's password.
   * Must meet security requirements: minimum 8 characters,
   * containing uppercase, lowercase, number, and special character.
   */
  password: z
    .string({
      required_error: 'Password is required',
      invalid_type_error: 'Password must be a string',
    })
    .min(8, 'Password must be at least 8 characters long')
    .max(128, 'Password cannot exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),

  /**
   * User's first name.
   * Must be 1-100 characters, containing only letters, spaces, hyphens, and apostrophes.
   */
  firstName: z
    .string({
      required_error: 'First name is required',
      invalid_type_error: 'First name must be a string',
    })
    .min(1, 'First name cannot be empty')
    .max(100, 'First name cannot exceed 100 characters')
    .regex(
      /^[a-zA-ZÀ-ÿĀ-žА-я\s'-]+$/,
      'First name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .trim(),

  /**
   * User's last name.
   * Must be 1-100 characters, containing only letters, spaces, hyphens, and apostrophes.
   */
  lastName: z
    .string({
      required_error: 'Last name is required',
      invalid_type_error: 'Last name must be a string',
    })
    .min(1, 'Last name cannot be empty')
    .max(100, 'Last name cannot exceed 100 characters')
    .regex(
      /^[a-zA-ZÀ-ÿĀ-žА-я\s'-]+$/,
      'Last name can only contain letters, spaces, hyphens, and apostrophes'
    )
    .trim(),

  /**
   * Optional profile picture URL.
   * Must be a valid HTTPS URL if provided.
   */
  profilePictureUrl: z
    .string()
    .url('Invalid URL format for profile picture')
    .startsWith('https://', 'Profile picture URL must use HTTPS')
    .max(2048, 'Profile picture URL cannot exceed 2048 characters')
    .optional(),

  /**
   * User's timezone.
   * Must be a valid IANA timezone identifier.
   */
  timezone: z
    .string()
    .max(50, 'Timezone cannot exceed 50 characters')
    .regex(
      /^[A-Za-z]+\/[A-Za-z_]+$/,
      'Timezone must be a valid IANA timezone identifier (e.g., America/New_York)'
    )
    .default('UTC')
    .optional(),

  /**
   * User's locale.
   * Must be a valid locale format (e.g., en, pt-BR, en-US).
   */
  locale: z
    .string()
    .regex(
      /^[a-z]{2}(-[A-Z]{2})?$/,
      'Locale must be in format "en" or "en-US"'
    )
    .default('en')
    .optional(),
});

/**
 * Zod schema for user registration response validation.
 *
 * This schema ensures the response from registration contains
 * all expected fields in the correct format.
 */
export const registerUserResponseSchema = z.object({
  /**
   * The newly created user's ID.
   */
  id: z.string().uuid('User ID must be a valid UUID'),

  /**
   * User's email address.
   */
  email: z.string().email('Invalid email format'),

  /**
   * User's first name.
   */
  firstName: z.string().min(1, 'First name cannot be empty'),

  /**
   * User's last name.
   */
  lastName: z.string().min(1, 'Last name cannot be empty'),

  /**
   * User's full name.
   */
  fullName: z.string().min(1, 'Full name cannot be empty'),

  /**
   * Profile picture URL if provided.
   */
  profilePictureUrl: z.string().url().optional(),

  /**
   * Email verification status (always false for new registrations).
   */
  emailVerified: z.boolean(),

  /**
   * User's timezone.
   */
  timezone: z.string().min(1, 'Timezone cannot be empty'),

  /**
   * User's locale.
   */
  locale: z.string().min(1, 'Locale cannot be empty'),

  /**
   * Account creation timestamp.
   */
  createdAt: z.date(),

  /**
   * Message indicating next steps.
   */
  message: z.string().min(1, 'Message cannot be empty'),
});

/**
 * TypeScript types inferred from the schemas.
 */
export type RegisterUserSchemaType = z.infer<typeof registerUserSchema>;
export type RegisterUserResponseSchemaType = z.infer<typeof registerUserResponseSchema>;