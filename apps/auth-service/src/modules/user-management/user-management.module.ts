import { Module } from '@nestjs/common';
import { createPool } from 'slonik';

import { PasswordService } from '../auth/services/password.service';

import { RegisterUserCommand } from './commands/register-user.command';
import { UserRepository } from './database/user.repository';

/**
 * User Management Module
 *
 * This module provides user management functionality including:
 * - User registration and account creation
 * - User profile management
 * - Email verification workflows
 * - Account status management (active/inactive, locked/unlocked)
 *
 * It follows Domain-Driven Design principles with:
 * - Domain entities (User)
 * - Command handlers (RegisterUserCommand)
 * - Repository pattern for data access
 * - Clear separation of concerns
 */
@Module({
  providers: [
    // Database connection
    {
      provide: 'DATABASE_CONNECTION',
      useFactory: () => {
        const connectionString = process.env.AUTH_DB_URL ||
          'postgresql://usecapsule:usecapsule_dev_password@localhost:5433/usecapsule_auth_dev';
        return createPool(connectionString);
      },
    },

    // Commands
    RegisterUserCommand,

    // Repositories
    {
      provide: 'IUserRepository',
      useClass: UserRepository,
    },

    // Services from auth module (shared dependency)
    PasswordService,
  ],
  exports: [
    RegisterUserCommand,
    'IUserRepository',
  ],
})
export class UserManagementModule {}