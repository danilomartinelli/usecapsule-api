import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);
  private readonly saltRounds: number;

  constructor() {
    // Use a fixed salt rounds value since it's not in the schema
    this.saltRounds = 12;
  }

  async hashPassword(plainPassword: string): Promise<string> {
    try {
      const hashedPassword = await bcrypt.hash(plainPassword, this.saltRounds);
      this.logger.debug('Password hashed successfully');
      return hashedPassword;
    } catch (error) {
      this.logger.error('Failed to hash password:', error);
      throw new Error('Password hashing failed');
    }
  }

  async verifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      this.logger.debug(`Password verification result: ${isValid}`);
      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify password:', error);
      throw new Error('Password verification failed');
    }
  }

  async timingSafeVerifyPassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const startTime = process.hrtime.bigint();
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      const endTime = process.hrtime.bigint();

      const duration = Number(endTime - startTime) / 1_000_000;
      this.logger.debug(`Password verification took ${duration}ms`);

      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify password with timing safety:', error);
      throw new Error('Password verification failed');
    }
  }

  validatePasswordStrength(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
