/**
 * Configuration factory for the Auth Service.
 *
 * This factory function creates the configuration object for the Auth Service
 * by reading from environment variables. It provides type-safe configuration
 * that will be validated against the authServiceSchema.
 *
 * @returns Auth Service configuration object
 *
 * @example
 * ```typescript
 * import { authServiceFactory, authServiceSchema } from '@usecapsule/parameters';
 *
 * const config = authServiceFactory();
 * const validatedConfig = authServiceSchema.parse(config);
 * ```
 */
export const authServiceFactory = (): AuthServiceConfig => ({
  database: {
    host: process.env.DB_HOST,
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: Number.parseInt(process.env.DB_PORT || '5432', 10),
    ssl: process.env.DB_SSL === 'true',
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRATION || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },
  bcrypt: {
    rounds: Number.parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
  },
  oauth: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
} as const);

/**
 * Type representing the Auth Service configuration structure.
 */
export interface AuthServiceConfig {
  readonly database: {
    readonly host: string | undefined;
    readonly name: string | undefined;
    readonly user: string | undefined;
    readonly password: string | undefined;
    readonly port: number;
    readonly ssl: boolean;
  };
  readonly jwt: {
    readonly secret: string | undefined;
    readonly expiresIn: string;
    readonly refreshExpiresIn: string;
  };
  readonly bcrypt: {
    readonly rounds: number;
  };
  readonly oauth: {
    readonly github: {
      readonly clientId: string | undefined;
      readonly clientSecret: string | undefined;
    };
  };
}

/**
 * Type alias for the auth service factory function.
 */
export type AuthServiceFactory = typeof authServiceFactory;
