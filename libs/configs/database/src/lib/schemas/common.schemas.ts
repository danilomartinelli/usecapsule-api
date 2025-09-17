import { z } from 'zod';

/**
 * Base schema for all database entities with common fields
 */
export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Schema for soft-deletable entities
 */
export const SoftDeletableEntitySchema = BaseEntitySchema.extend({
  deletedAt: z.coerce.date().nullable(),
});

/**
 * Audit trail schema for tracking changes
 */
export const AuditTrailSchema = BaseEntitySchema.extend({
  entityType: z.string(),
  entityId: z.string().uuid(),
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  userId: z.string().uuid().nullable(),
  changes: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
});

/**
 * Database health check result schema
 */
export const DatabaseHealthSchema = z.object({
  version: z.string(),
  currentTime: z.string(),
  timescaleVersion: z.string().optional(),
});

/**
 * Pagination metadata schema
 */
export const PaginationMetadataSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive().max(1000),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
  hasPrevious: z.boolean(),
});

/**
 * Search query schema
 */
export const SearchQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  fields: z.array(z.string()).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sort: z
    .object({
      field: z.string(),
      direction: z.enum(['ASC', 'DESC']),
    })
    .optional(),
});

/**
 * Database error schema
 */
export const DatabaseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  detail: z.string().optional(),
  hint: z.string().optional(),
  position: z.string().optional(),
  internalPosition: z.string().optional(),
  internalQuery: z.string().optional(),
  where: z.string().optional(),
  schema: z.string().optional(),
  table: z.string().optional(),
  column: z.string().optional(),
  dataType: z.string().optional(),
  constraint: z.string().optional(),
  file: z.string().optional(),
  line: z.string().optional(),
  routine: z.string().optional(),
});

// Type exports
export type BaseEntity = z.infer<typeof BaseEntitySchema>;
export type SoftDeletableEntity = z.infer<typeof SoftDeletableEntitySchema>;
export type AuditTrail = z.infer<typeof AuditTrailSchema>;
export type DatabaseHealth = z.infer<typeof DatabaseHealthSchema>;
export type PaginationMetadata = z.infer<typeof PaginationMetadataSchema>;
export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type DatabaseError = z.infer<typeof DatabaseErrorSchema>;
