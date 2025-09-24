import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  EmailAlreadyExistsException,
  InvalidCredentialsException,
} from '@usecapsule/exceptions';
import { v4 as uuidv4 } from 'uuid';

import type { PasswordService } from '../../auth/services/password.service';
import type { IUserRepository } from '../database/user.repository.interface';
import { User } from '../domain/entities/user.entity';
import type { RegisterUserDto, RegisterUserResponseDto } from '../dto/register-user.dto';
import { registerUserSchema } from '../dto/register-user.schema';

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
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
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
      // Validate input data using Zod schema
      const validatedData = registerUserSchema.parse(dto);

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(validatedData.email);
      if (existingUser) {
        this.logger.warn(`Registration attempt with existing email: ${validatedData.email}`);
        throw new EmailAlreadyExistsException(validatedData.email);
      }

      // Validate password strength (redundant with schema, but good for additional security)
      const passwordValidation = this.passwordService.validatePasswordStrength(validatedData.password);
      if (!passwordValidation.isValid) {
        throw new InvalidCredentialsException({
          reason: 'Password does not meet strength requirements',
          errors: passwordValidation.errors,
        });
      }

      // Hash the password
      const passwordHash = await this.passwordService.hashPassword(validatedData.password);

      // Create user entity
      const userId = uuidv4();
      const user = User.create(
        userId,
        validatedData.email,
        passwordHash,
        validatedData.firstName,
        validatedData.lastName,
        validatedData.profilePictureUrl,
        validatedData.timezone || 'UTC',
        validatedData.locale || 'en'
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
      if (error instanceof EmailAlreadyExistsException || error instanceof InvalidCredentialsException) {
        throw error;
      }

      // Handle Zod validation errors
      if (error instanceof Error && error.name === 'ZodError') {
        throw new InvalidCredentialsException({
          reason: 'Invalid input data',
          validationErrors: error.message,
        });
      }

      // Wrap unknown errors
      throw new InvalidCredentialsException({
        reason: 'User registration failed due to internal error',
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