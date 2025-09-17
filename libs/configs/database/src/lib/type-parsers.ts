import type { DriverTypeParser } from 'slonik';

/**
 * PostgreSQL type name constants for type safety and reusability
 */
const PG_TYPES = {
  UUID: 'uuid',
  JSON: 'json',
  JSONB: 'jsonb',
  DATE: 'date',
  TIMESTAMP: 'timestamp',
  TIMESTAMPTZ: 'timestamptz',
  INT8: 'int8',
  NUMERIC: 'numeric',
  DECIMAL: 'decimal',
} as const;

/**
 * Type parser function signature
 */
type ParserFunction<T = unknown> = (value: string) => T;

/**
 * Type parser configuration with enhanced type safety
 */
interface TypeParserConfig<T = unknown> {
  readonly name: string;
  readonly parse: ParserFunction<T>;
}

/**
 * Safe JSON parser that handles parsing errors gracefully
 *
 * @param value - JSON string to parse
 * @returns Parsed JSON object or the original string if parsing fails
 */
const safeJsonParser: ParserFunction<unknown> = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    // Use console.warn in development, consider using a proper logger in production
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Failed to parse JSON value: ${value}`, error);
    }
    return value; // Return original string as fallback
  }
};

/**
 * Safe date parser that handles invalid dates gracefully
 *
 * @param value - Date string to parse
 * @returns Parsed Date object or null if parsing fails
 */
const safeDateParser: ParserFunction<Date | null> = (value: string) => {
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
};

/**
 * Safe numeric parser that handles invalid numbers gracefully
 *
 * @param value - Numeric string to parse
 * @returns Parsed number or NaN if parsing fails
 */
const safeNumericParser: ParserFunction<number> = (value: string) => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Safe BigInt parser that handles invalid BigInt values gracefully
 *
 * @param value - BigInt string to parse
 * @returns Parsed BigInt or 0n if parsing fails
 */
const safeBigIntParser: ParserFunction<bigint> = (value: string): bigint => {
  try {
    return BigInt(value);
  } catch (error) {
    // Use console.warn in development, consider using a proper logger in production
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`Failed to parse BigInt value: ${value}`, error);
    }
    return 0n; // Return 0 as fallback
  }
};

/**
 * Identity parser that returns the value as-is
 *
 * @param value - Value to return unchanged
 * @returns The original value
 */
const identityParser: ParserFunction<string> = (value: string) => value;

/**
 * Configuration for all supported PostgreSQL type parsers
 */
const TYPE_PARSER_CONFIGS: readonly TypeParserConfig[] = [
  {
    name: PG_TYPES.UUID,
    parse: identityParser,
  },
  {
    name: PG_TYPES.JSON,
    parse: safeJsonParser,
  },
  {
    name: PG_TYPES.JSONB,
    parse: safeJsonParser,
  },
  {
    name: PG_TYPES.DATE,
    parse: safeDateParser,
  },
  {
    name: PG_TYPES.TIMESTAMP,
    parse: safeDateParser,
  },
  {
    name: PG_TYPES.TIMESTAMPTZ,
    parse: safeDateParser,
  },
  {
    name: PG_TYPES.INT8,
    parse: safeBigIntParser,
  },
  {
    name: PG_TYPES.NUMERIC,
    parse: safeNumericParser,
  },
  {
    name: PG_TYPES.DECIMAL,
    parse: safeNumericParser,
  },
] as const;

/**
 * Creates type parsers for PostgreSQL data types used with Slonik.
 *
 * These parsers automatically convert PostgreSQL values to appropriate JavaScript types:
 * - `uuid`: String (no conversion)
 * - `json`/`jsonb`: Parsed JSON objects with error handling
 * - `date`/`timestamp`/`timestamptz`: Date objects with validation
 * - `int8`: BigInt values with error handling
 * - `numeric`/`decimal`: Floating-point numbers with error handling
 *
 * All parsers include error handling to prevent application crashes from
 * malformed data, logging warnings and providing sensible fallback values.
 *
 * @returns Array of configured DriverTypeParser instances
 *
 * @example
 * ```typescript
 * import { createPool } from 'slonik';
 * import { createTypeParsers } from './type-parsers';
 *
 * const pool = createPool(connectionString, {
 *   typeParsers: createTypeParsers(),
 * });
 *
 * // UUID values will be returned as strings
 * // JSON values will be parsed to objects
 * // Dates will be converted to Date instances
 * // BigInt values will be converted to BigInt type
 * ```
 *
 * @see {@link https://github.com/gajus/slonik#type-parsers} Slonik type parsers documentation
 */
export function createTypeParsers(): DriverTypeParser[] {
  return TYPE_PARSER_CONFIGS.map(
    (config): DriverTypeParser => ({
      name: config.name,
      parse: config.parse,
    }),
  );
}

/**
 * Export type constants for external use
 */
export { PG_TYPES };
