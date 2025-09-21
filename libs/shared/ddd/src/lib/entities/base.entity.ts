/**
 * Base entity class with common fields and functionality for all domain entities.
 * Provides unique identification, timestamps, and update tracking.
 */
export abstract class BaseEntity {
  protected _id: string;
  protected _createdAt: Date;
  protected _updatedAt: Date;

  constructor(id: string, createdAt: Date, updatedAt: Date) {
    this._id = id;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  get id(): string {
    return this._id;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  /**
   * Updates the entity's updatedAt timestamp to the current time.
   * Should be called whenever the entity is modified.
   */
  protected touch(): void {
    this._updatedAt = new Date();
  }

  /**
   * Compares two entities by their ID for equality.
   */
  equals(other: BaseEntity): boolean {
    return this._id === other._id;
  }

  /**
   * Returns the entity's unique identifier.
   */
  toString(): string {
    return this._id;
  }
}