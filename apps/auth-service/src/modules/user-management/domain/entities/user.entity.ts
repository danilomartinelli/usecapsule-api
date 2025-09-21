import { SoftDeletableEntity } from '@usecapsule/ddd';

/**
 * User domain entity representing a user in the authentication system.
 * This entity encapsulates user data and business logic.
 *
 * Aligned with UserSchema from @usecapsule/configs/database/schemas/auth.schemas.ts
 * and users table from V1.1.0__Create_users_table.sql migration.
 */
export class User extends SoftDeletableEntity {
  private _email: string;
  private _passwordHash: string;
  private _firstName: string;
  private _lastName: string;
  private _profilePictureUrl?: string;
  private _emailVerified: boolean;
  private _emailVerifiedAt?: Date;
  private _lastLoginAt?: Date;
  private _failedLoginAttempts: number;
  private _lockedAt?: Date;
  private _isActive: boolean;
  private _timezone: string;
  private _locale: string;
  private _twoFactorEnabled: boolean;

  constructor(
    id: string,
    createdAt: Date,
    updatedAt: Date,
    email: string,
    passwordHash: string,
    firstName: string,
    lastName: string,
    deletedAt?: Date,
    profilePictureUrl?: string,
    emailVerified = false,
    emailVerifiedAt?: Date,
    lastLoginAt?: Date,
    failedLoginAttempts = 0,
    lockedAt?: Date,
    isActive = true,
    timezone = 'UTC',
    locale = 'en',
    twoFactorEnabled = false
  ) {
    super(id, createdAt, updatedAt, deletedAt);
    this._email = email;
    this._passwordHash = passwordHash;
    this._firstName = firstName;
    this._lastName = lastName;
    this._profilePictureUrl = profilePictureUrl;
    this._emailVerified = emailVerified;
    this._emailVerifiedAt = emailVerifiedAt;
    this._lastLoginAt = lastLoginAt;
    this._failedLoginAttempts = failedLoginAttempts;
    this._lockedAt = lockedAt;
    this._isActive = isActive;
    this._timezone = timezone;
    this._locale = locale;
    this._twoFactorEnabled = twoFactorEnabled;
  }

  // Getters
  get email(): string {
    return this._email;
  }

  get passwordHash(): string {
    return this._passwordHash;
  }

  get firstName(): string {
    return this._firstName;
  }

  get lastName(): string {
    return this._lastName;
  }

  get fullName(): string {
    return `${this._firstName} ${this._lastName}`.trim();
  }

  get profilePictureUrl(): string | undefined {
    return this._profilePictureUrl;
  }

  get emailVerified(): boolean {
    return this._emailVerified;
  }

  get emailVerifiedAt(): Date | undefined {
    return this._emailVerifiedAt;
  }

  get lastLoginAt(): Date | undefined {
    return this._lastLoginAt;
  }

  get failedLoginAttempts(): number {
    return this._failedLoginAttempts;
  }

  get lockedAt(): Date | undefined {
    return this._lockedAt;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get timezone(): string {
    return this._timezone;
  }

  get locale(): string {
    return this._locale;
  }

  get twoFactorEnabled(): boolean {
    return this._twoFactorEnabled;
  }

  // Business logic methods

  /**
   * Checks if the user account is currently locked due to failed login attempts.
   */
  get isLocked(): boolean {
    return this._lockedAt !== undefined;
  }

  /**
   * Checks if the user can attempt to login (not locked, active, not deleted).
   */
  get canLogin(): boolean {
    return this._isActive && !this.isDeleted && !this.isLocked;
  }

  /**
   * Records a successful login attempt.
   */
  recordSuccessfulLogin(): void {
    this._lastLoginAt = new Date();
    this._failedLoginAttempts = 0;
    this._lockedAt = undefined;
    this.touch();
  }

  /**
   * Records a failed login attempt and locks account if threshold is reached.
   * @param maxAttempts Maximum allowed failed attempts before locking (default: 5)
   */
  recordFailedLogin(maxAttempts = 5): void {
    this._failedLoginAttempts += 1;

    if (this._failedLoginAttempts >= maxAttempts) {
      this._lockedAt = new Date();
    }

    this.touch();
  }

  /**
   * Unlocks the user account by clearing the locked timestamp and failed attempts.
   */
  unlock(): void {
    this._lockedAt = undefined;
    this._failedLoginAttempts = 0;
    this.touch();
  }

  /**
   * Verifies the user's email address.
   */
  verifyEmail(): void {
    this._emailVerified = true;
    this._emailVerifiedAt = new Date();
    this.touch();

    // TEMP: Email verification completion notification
    // TODO: Publish event to mailer-service for welcome email
    // Exchange: capsule.events, Routing Key: user.email-verified
  }

  /**
   * Updates the user's email address and resets verification status.
   */
  updateEmail(newEmail: string): void {
    if (newEmail !== this._email) {
      this._email = newEmail;
      this._emailVerified = false;
      this._emailVerifiedAt = undefined;
      this.touch();

      // TEMP: Email change verification notification
      // TODO: Send email verification to new email address
      // Command to mailer-service: 'mailer.send.verification'
      // Exchange: capsule.commands
    }
  }

  /**
   * Updates the user's password hash.
   */
  updatePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this.touch();
  }

  /**
   * Updates the user's profile information.
   */
  updateProfile(
    firstName?: string,
    lastName?: string,
    profilePictureUrl?: string,
    timezone?: string,
    locale?: string
  ): void {
    let hasChanges = false;

    if (firstName !== undefined && firstName !== this._firstName) {
      this._firstName = firstName;
      hasChanges = true;
    }

    if (lastName !== undefined && lastName !== this._lastName) {
      this._lastName = lastName;
      hasChanges = true;
    }

    if (profilePictureUrl !== undefined && profilePictureUrl !== this._profilePictureUrl) {
      this._profilePictureUrl = profilePictureUrl;
      hasChanges = true;
    }

    if (timezone !== undefined && timezone !== this._timezone) {
      this._timezone = timezone;
      hasChanges = true;
    }

    if (locale !== undefined && locale !== this._locale) {
      this._locale = locale;
      hasChanges = true;
    }

    if (hasChanges) {
      this.touch();
    }
  }

  /**
   * Enables two-factor authentication for the user.
   */
  enableTwoFactor(): void {
    this._twoFactorEnabled = true;
    this.touch();
  }

  /**
   * Disables two-factor authentication for the user.
   */
  disableTwoFactor(): void {
    this._twoFactorEnabled = false;
    this.touch();
  }

  /**
   * Activates the user account.
   */
  activate(): void {
    this._isActive = true;
    this.touch();
  }

  /**
   * Deactivates the user account.
   */
  deactivate(): void {
    this._isActive = false;
    this.touch();
  }

  /**
   * Validates email format using a simple regex.
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  }

  /**
   * Factory method to create a new user instance with validation.
   */
  static create(
    id: string,
    email: string,
    passwordHash: string,
    firstName: string,
    lastName: string,
    profilePictureUrl?: string,
    timezone = 'UTC',
    locale = 'en'
  ): User {
    // Validation
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Invalid email address');
    }

    if (!passwordHash || passwordHash.length === 0) {
      throw new Error('Password hash is required');
    }

    if (!firstName || firstName.trim().length === 0) {
      throw new Error('First name is required');
    }

    if (!lastName || lastName.trim().length === 0) {
      throw new Error('Last name is required');
    }

    if (email.length > 255) {
      throw new Error('Email address is too long (max 255 characters)');
    }

    if (firstName.length > 100) {
      throw new Error('First name is too long (max 100 characters)');
    }

    if (lastName.length > 100) {
      throw new Error('Last name is too long (max 100 characters)');
    }

    const now = new Date();

    return new User(
      id,
      now,
      now,
      email.toLowerCase().trim(),
      passwordHash,
      firstName.trim(),
      lastName.trim(),
      undefined, // deletedAt
      profilePictureUrl,
      false, // emailVerified
      undefined, // emailVerifiedAt
      undefined, // lastLoginAt
      0, // failedLoginAttempts
      undefined, // lockedAt
      true, // isActive
      timezone,
      locale,
      false // twoFactorEnabled
    );
  }

  /**
   * Factory method to recreate a user from database data.
   */
  static fromDatabase(data: {
    id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
    email_verified: boolean;
    email_verified_at?: Date;
    last_login_at?: Date;
    failed_login_attempts: number;
    locked_at?: Date;
    is_active: boolean;
    timezone: string;
    locale: string;
    two_factor_enabled: boolean;
  }): User {
    return new User(
      data.id,
      data.created_at,
      data.updated_at,
      data.email,
      data.password_hash,
      data.first_name,
      data.last_name,
      data.deleted_at,
      data.profile_picture_url,
      data.email_verified,
      data.email_verified_at,
      data.last_login_at,
      data.failed_login_attempts,
      data.locked_at,
      data.is_active,
      data.timezone,
      data.locale,
      data.two_factor_enabled
    );
  }

  /**
   * Converts the user entity to database format.
   */
  toDatabase(): {
    id: string;
    created_at: Date;
    updated_at: Date;
    deleted_at?: Date;
    email: string;
    password_hash: string;
    first_name: string;
    last_name: string;
    profile_picture_url?: string;
    email_verified: boolean;
    email_verified_at?: Date;
    last_login_at?: Date;
    failed_login_attempts: number;
    locked_at?: Date;
    is_active: boolean;
    timezone: string;
    locale: string;
    two_factor_enabled: boolean;
  } {
    return {
      id: this.id,
      created_at: this.createdAt,
      updated_at: this.updatedAt,
      deleted_at: this.deletedAt,
      email: this._email,
      password_hash: this._passwordHash,
      first_name: this._firstName,
      last_name: this._lastName,
      profile_picture_url: this._profilePictureUrl,
      email_verified: this._emailVerified,
      email_verified_at: this._emailVerifiedAt,
      last_login_at: this._lastLoginAt,
      failed_login_attempts: this._failedLoginAttempts,
      locked_at: this._lockedAt,
      is_active: this._isActive,
      timezone: this._timezone,
      locale: this._locale,
      two_factor_enabled: this._twoFactorEnabled,
    };
  }

  /**
   * Returns a safe representation of the user for API responses (without sensitive data).
   */
  toSafeObject(): {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
    profilePictureUrl?: string;
    emailVerified: boolean;
    emailVerifiedAt?: Date;
    lastLoginAt?: Date;
    isActive: boolean;
    isLocked: boolean;
    timezone: string;
    locale: string;
    twoFactorEnabled: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      email: this._email,
      firstName: this._firstName,
      lastName: this._lastName,
      fullName: this.fullName,
      profilePictureUrl: this._profilePictureUrl,
      emailVerified: this._emailVerified,
      emailVerifiedAt: this._emailVerifiedAt,
      lastLoginAt: this._lastLoginAt,
      isActive: this._isActive,
      isLocked: this.isLocked,
      timezone: this._timezone,
      locale: this._locale,
      twoFactorEnabled: this._twoFactorEnabled,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}