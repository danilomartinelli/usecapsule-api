import { Injectable, Inject } from '@nestjs/common';
import { sql, type DatabaseConnection } from 'slonik';

import { User } from '../domain/entities/user.entity';

import type { IUserRepository } from './user.repository.interface';

type DatabaseUserRow = {
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
};

/**
 * Slonik-based implementation of the User repository.
 *
 * This repository handles all user-related database operations using
 * Slonik for type-safe SQL queries and connection management.
 */
@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @Inject('DATABASE_CONNECTION')
    private readonly db: DatabaseConnection,
  ) {}

  async create(user: User): Promise<User> {
    const userData = user.toDatabase();

    try {
      const result = await this.db.query(sql.unsafe`
        INSERT INTO users (
          id, created_at, updated_at, deleted_at, email, password_hash,
          first_name, last_name, profile_picture_url, email_verified,
          email_verified_at, last_login_at, failed_login_attempts,
          locked_at, is_active, timezone, locale, two_factor_enabled
        ) VALUES (
          ${userData.id}, ${userData.created_at.toISOString()}, ${userData.updated_at.toISOString()},
          ${userData.deleted_at ? userData.deleted_at.toISOString() : null}, ${userData.email}, ${userData.password_hash},
          ${userData.first_name}, ${userData.last_name}, ${userData.profile_picture_url || null},
          ${userData.email_verified}, ${userData.email_verified_at ? userData.email_verified_at.toISOString() : null}, ${userData.last_login_at ? userData.last_login_at.toISOString() : null},
          ${userData.failed_login_attempts}, ${userData.locked_at ? userData.locked_at.toISOString() : null}, ${userData.is_active},
          ${userData.timezone}, ${userData.locale}, ${userData.two_factor_enabled}
        )
        RETURNING *
      `);

      if (result.rows.length === 0) {
        throw new Error('Failed to create user');
      }

      const createdUser = User.fromDatabase(result.rows[0] as DatabaseUserRow);

      // TEMP: User creation event publication
      // TODO: Publish user.created event to capsule.events exchange
      // Event payload: { userId: createdUser.id, email: createdUser.email, createdAt: createdUser.createdAt }
      // This will trigger downstream services (billing, monitoring, mailer)

      return createdUser;
    } catch (error: unknown) {
      const pgError = error as { constraint?: string };
      if (pgError.constraint === 'users_email_unique') {
        throw new Error('User with this email already exists');
      }
      throw error;
    }
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query(sql.unsafe`
      SELECT * FROM users
      WHERE id = ${id} AND deleted_at IS NULL
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return User.fromDatabase(result.rows[0] as DatabaseUserRow);
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query(sql.unsafe`
      SELECT * FROM users
      WHERE email = ${email.toLowerCase()} AND deleted_at IS NULL
    `);

    if (result.rows.length === 0) {
      return null;
    }

    return User.fromDatabase(result.rows[0] as DatabaseUserRow);
  }

  async update(user: User): Promise<User> {
    const userData = user.toDatabase();

    const result = await this.db.query(sql.unsafe`
      UPDATE users SET
        updated_at = ${userData.updated_at.toISOString()},
        deleted_at = ${userData.deleted_at ? userData.deleted_at.toISOString() : null},
        email = ${userData.email},
        password_hash = ${userData.password_hash},
        first_name = ${userData.first_name},
        last_name = ${userData.last_name},
        profile_picture_url = ${userData.profile_picture_url || null},
        email_verified = ${userData.email_verified},
        email_verified_at = ${userData.email_verified_at ? userData.email_verified_at.toISOString() : null},
        last_login_at = ${userData.last_login_at ? userData.last_login_at.toISOString() : null},
        failed_login_attempts = ${userData.failed_login_attempts},
        locked_at = ${userData.locked_at ? userData.locked_at.toISOString() : null},
        is_active = ${userData.is_active},
        timezone = ${userData.timezone},
        locale = ${userData.locale},
        two_factor_enabled = ${userData.two_factor_enabled}
      WHERE id = ${userData.id} AND deleted_at IS NULL
      RETURNING *
    `);

    if (result.rows.length === 0) {
      throw new Error('User not found or already deleted');
    }

    return User.fromDatabase(result.rows[0] as DatabaseUserRow);
  }

  async softDelete(id: string): Promise<void> {
    const now = new Date();

    const result = await this.db.query(sql.unsafe`
      UPDATE users SET
        deleted_at = ${now.toISOString()},
        updated_at = ${now.toISOString()}
      WHERE id = ${id} AND deleted_at IS NULL
    `);

    if (result.rowCount === 0) {
      throw new Error('User not found or already deleted');
    }
  }

  async existsByEmail(email: string): Promise<boolean> {
    const result = await this.db.query(sql.unsafe`
      SELECT 1 FROM users
      WHERE email = ${email.toLowerCase()} AND deleted_at IS NULL
      LIMIT 1
    `);

    return result.rows.length > 0;
  }
}