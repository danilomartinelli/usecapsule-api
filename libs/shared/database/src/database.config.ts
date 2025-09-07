export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export function createDatabaseConfig(serviceName: string): DatabaseConfig {
  const servicePrefix = serviceName.toLowerCase().replace('-service', '');
  
  return {
    host: process.env[`${servicePrefix.toUpperCase()}_DB_HOST`] || 'localhost',
    port: parseInt(process.env[`${servicePrefix.toUpperCase()}_DB_PORT`] || '5432'),
    username: process.env[`${servicePrefix.toUpperCase()}_DB_USER`] || `usecapsule_${servicePrefix}`,
    password: process.env[`${servicePrefix.toUpperCase()}_DB_PASSWORD`] || 'usecapsule_dev_password',
    database: process.env[`${servicePrefix.toUpperCase()}_DB_NAME`] || `usecapsule_${servicePrefix}`,
  };
}

export const AUTH_DB_CONFIG = createDatabaseConfig('auth-service');