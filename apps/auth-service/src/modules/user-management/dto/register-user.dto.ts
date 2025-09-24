/**
 * Data Transfer Object for user registration.
 *
 * This DTO defines the structure and validation rules for user registration requests.
 * It includes all required fields for creating a new user account.
 */
export interface RegisterUserDto {
  /**
   * User's email address. Must be unique in the system.
   */
  email: string;

  /**
   * User's plain text password. Will be hashed before storage.
   */
  password: string;

  /**
   * User's first name.
   */
  firstName: string;

  /**
   * User's last name.
   */
  lastName: string;

  /**
   * Optional profile picture URL.
   */
  profilePictureUrl?: string;

  /**
   * User's timezone (defaults to 'UTC').
   */
  timezone?: string;

  /**
   * User's locale (defaults to 'en').
   */
  locale?: string;
}

/**
 * Response DTO for successful user registration.
 */
export interface RegisterUserResponseDto {
  /**
   * The newly created user's ID.
   */
  id: string;

  /**
   * User's email address.
   */
  email: string;

  /**
   * User's first name.
   */
  firstName: string;

  /**
   * User's last name.
   */
  lastName: string;

  /**
   * User's full name.
   */
  fullName: string;

  /**
   * Profile picture URL if provided.
   */
  profilePictureUrl?: string;

  /**
   * Email verification status (always false for new registrations).
   */
  emailVerified: boolean;

  /**
   * User's timezone.
   */
  timezone: string;

  /**
   * User's locale.
   */
  locale: string;

  /**
   * Account creation timestamp.
   */
  createdAt: Date;

  /**
   * Message indicating next steps.
   */
  message: string;
}