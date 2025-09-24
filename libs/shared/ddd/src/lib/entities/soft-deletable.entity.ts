import { BaseEntity } from './base.entity';

/**
 * Soft-deletable entity class that extends BaseEntity with soft delete functionality.
 * Entities that inherit from this class can be "deleted" without actually removing
 * them from the database by setting a deletedAt timestamp.
 */
export abstract class SoftDeletableEntity extends BaseEntity {
  protected _deletedAt?: Date;

  constructor(id: string, createdAt: Date, updatedAt: Date, deletedAt?: Date) {
    super(id, createdAt, updatedAt);
    this._deletedAt = deletedAt;
  }

  get deletedAt(): Date | undefined {
    return this._deletedAt;
  }

  /**
   * Checks if the entity has been soft deleted.
   */
  get isDeleted(): boolean {
    return this._deletedAt !== undefined;
  }

  /**
   * Soft deletes the entity by setting the deletedAt timestamp.
   */
  delete(): void {
    this._deletedAt = new Date();
    this.touch();
  }

  /**
   * Restores a soft-deleted entity by clearing the deletedAt timestamp.
   */
  restore(): void {
    this._deletedAt = undefined;
    this.touch();
  }
}