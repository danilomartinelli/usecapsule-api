import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import type { PasswordService } from '../../auth/services/password.service';
import type { IUserRepository } from '../database/user.repository.interface';
import { User } from '../domain/entities/user.entity';
import type { RegisterUserDto, RegisterUserResponseDto } from '../dto/register-user.dto';

/**
 * Command handler for user registration.
 *
 * This command handles the business logic for creating new user accounts,
 * including validation, password hashing, and user creation. It follows
 * the Command pattern from CQRS architecture.
 */
@Injectable()
export class RegisterUserCommand {
  private readonly logger = new Logger(RegisterUserCommand.name);

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * Executes the user registration command.
   *
   * @param dto - User registration data
   * @returns Promise resolving to the registration response
   * @throws BadRequestException for validation errors
   * @throws ConflictException if email already exists
   */
  async execute(dto: RegisterUserDto): Promise<RegisterUserResponseDto> {
    this.logger.log(`Starting user registration for email: ${dto.email}`);

    try {
      // Validate input data
      await this.validateRegistrationData(dto);

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(dto.email);
      if (existingUser) {
        this.logger.warn(`Registration attempt with existing email: ${dto.email}`);
        throw new ConflictException('User with this email already exists');
      }

      // Validate password strength
      const passwordValidation = this.passwordService.validatePasswordStrength(dto.password);
      if (!passwordValidation.isValid) {
        throw new BadRequestException({
          message: 'Password does not meet strength requirements',
          errors: passwordValidation.errors,
        });
      }

      // Hash the password
      const passwordHash = await this.passwordService.hashPassword(dto.password);

      // Create user entity
      const userId = uuidv4();
      const user = User.create(
        userId,
        dto.email,
        passwordHash,
        dto.firstName,
        dto.lastName,
        dto.profilePictureUrl,
        dto.timezone || 'UTC',
        dto.locale || 'en'
      );

      // Save user to database
      const createdUser = await this.userRepository.create(user);

      // TEMP: Email verification service integration point
      // TODO: Integrate with mailer-service to send email verification
      // await this.sendEmailVerification(createdUser.id, createdUser.email);
      this.logger.debug(`TEMP: Would send email verification to ${createdUser.email}`);

      this.logger.log(`User registered successfully with ID: ${createdUser.id}`);

      // Return response DTO
      const userSafeData = createdUser.toSafeObject();
      return {
        id: userSafeData.id,
        email: userSafeData.email,
        firstName: userSafeData.firstName,
        lastName: userSafeData.lastName,
        fullName: userSafeData.fullName,
        profilePictureUrl: userSafeData.profilePictureUrl,
        emailVerified: userSafeData.emailVerified,
        timezone: userSafeData.timezone,
        locale: userSafeData.locale,
        createdAt: userSafeData.createdAt,
        message: 'User registered successfully. Please check your email to verify your account.',
      };
    } catch (error) {
      this.logger.error(`User registration failed for ${dto.email}:`, error);

      // Re-throw known exceptions
      if (error instanceof BadRequestException || error instanceof ConflictException) {
        throw error;
      }

      // Wrap unknown errors
      throw new BadRequestException('User registration failed');
    }
  }

  /**
   * Validates the registration data.
   *
   * @param dto - Registration data to validate
   * @throws BadRequestException for validation errors
   */
  private async validateRegistrationData(dto: RegisterUserDto): Promise<void> {
    const errors: string[] = [];

    // Required field validation
    if (!dto.email || dto.email.trim().length === 0) {
      errors.push('Email is required');
    }

    if (!dto.password || dto.password.length === 0) {
      errors.push('Password is required');
    }

    if (!dto.firstName || dto.firstName.trim().length === 0) {
      errors.push('First name is required');
    }

    if (!dto.lastName || dto.lastName.trim().length === 0) {
      errors.push('Last name is required');
    }

    // Email format validation
    if (dto.email && !/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(dto.email)) {
      errors.push('Invalid email format');
    }

    // Length validation
    if (dto.email && dto.email.length > 255) {
      errors.push('Email address is too long (max 255 characters)');
    }

    if (dto.firstName && dto.firstName.length > 100) {
      errors.push('First name is too long (max 100 characters)');
    }

    if (dto.lastName && dto.lastName.length > 100) {
      errors.push('Last name is too long (max 100 characters)');
    }

    // Profile picture URL validation
    if (dto.profilePictureUrl) {
      try {
        new URL(dto.profilePictureUrl);
      } catch {
        errors.push('Invalid profile picture URL format');
      }
    }

    // Timezone validation (basic check)
    if (dto.timezone && dto.timezone.length > 50) {
      errors.push('Timezone is too long (max 50 characters)');
    }

    // Locale validation (basic check)
    if (dto.locale && !/^[a-z]{2}(-[A-Z]{2})?$/.test(dto.locale)) {
      errors.push('Invalid locale format (expected: en, pt-BR, etc.)');
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors,
      });
    }
  }

  // TEMP: Email verification integration point
  // This method will be implemented when mailer-service is ready
  /*
  private async sendEmailVerification(userId: string, email: string): Promise<void> {
    // TODO: Create email verification token
    // TODO: Publish message to mailer-service via RabbitMQ
    // Routing key: 'mailer.send.verification'
    // Exchange: 'capsule.commands'
    // Payload: { userId, email, token, templateType: 'email-verification' }
  }
  */
}