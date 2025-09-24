import type { User } from '../domain/entities/user.entity';

/**
 * Repository interface for User entity operations.
 *
 * This interface defines the contract for user data persistence operations.
 * It follows the Repository pattern to abstract database operations from business logic.
 */
export interface IUserRepository {
  /**
   * Creates a new user in the database.
   *
   * @param user - The user entity to create
   * @returns Promise resolving to the created user
   * @throws Error if user with email already exists
   */
  create(user: User): Promise<User>;

  /**
   * Finds a user by their unique ID.
   *
   * @param id - The user's unique identifier
   * @returns Promise resolving to the user or null if not found
   */
  findById(id: string): Promise<User | null>;

  /**
   * Finds a user by their email address.
   *
   * @param email - The user's email address
   * @returns Promise resolving to the user or null if not found
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Updates an existing user in the database.
   *
   * @param user - The user entity with updated values
   * @returns Promise resolving to the updated user
   * @throws Error if user not found
   */
  update(user: User): Promise<User>;

  /**
   * Soft deletes a user by their ID.
   *
   * @param id - The user's unique identifier
   * @returns Promise resolving to void
   * @throws Error if user not found
   */
  softDelete(id: string): Promise<void>;

  /**
   * Checks if a user with the given email already exists.
   *
   * @param email - The email address to check
   * @returns Promise resolving to true if email exists, false otherwise
   */
  existsByEmail(email: string): Promise<boolean>;
}