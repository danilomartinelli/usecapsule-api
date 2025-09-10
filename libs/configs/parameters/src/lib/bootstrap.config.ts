import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

export class BootstrapConfig {
  private static instance: BootstrapConfig;
  private config: Record<string, unknown> = {};
  private readonly serviceName: string;

  private constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.loadConfiguration();
  }

  static getInstance(serviceName: string): BootstrapConfig {
    if (!BootstrapConfig.instance) {
      BootstrapConfig.instance = new BootstrapConfig(serviceName);
    }
    return BootstrapConfig.instance;
  }

  private loadConfiguration() {
    // 1. Carrega .env global
    this.loadEnvFile('.env');

    // 2. Carrega .env do ambiente
    if (process.env.NODE_ENV) {
      this.loadEnvFile(`.env.${process.env.NODE_ENV}`);
    }

    // 3. Carrega .env específico do serviço
    this.loadEnvFile(`.env.${this.serviceName}`);

    // 4. Aplica filtros por prefixo
    this.applyServiceFilter();
  }

  private loadEnvFile(filename: string) {
    const envPath = path.resolve(process.cwd(), filename);
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath });
      if (result.parsed) {
        Object.assign(this.config, result.parsed);
      }
    }
  }

  private applyServiceFilter() {
    const servicePrefix = this.serviceName.toUpperCase().replace('-', '_');
    const globalVars = ['NODE_ENV', 'APP_ENV', 'LOG_LEVEL', 'RABBITMQ_URL'];

    // Cria novo objeto com apenas as vars permitidas
    const filtered: Record<string, string> = {};

    Object.entries(this.config).forEach(([key, value]) => {
      if (globalVars.includes(key)) {
        filtered[key] = value as string;
      } else if (key.startsWith(`${servicePrefix}_`)) {
        // Remove prefixo para uso mais limpo
        const cleanKey = key.replace(`${servicePrefix}_`, '');
        filtered[cleanKey] = value as string;
      }
    });

    // Atualiza process.env com valores filtrados
    Object.assign(process.env, filtered);
    this.config = filtered;
  }

  get<T = string>(key: string): T | undefined;
  get<T = string>(key: string, defaultValue: T): T;
  get<T = string>(key: string, defaultValue?: T): T | undefined {
    return (this.config[key] as T) ?? defaultValue;
  }

  getRabbitMQConfig() {
    return {
      urls: [this.get('RABBITMQ_URL', 'amqp://localhost:5672')],
      queue: this.get('QUEUE', `${this.serviceName}_queue`),
      prefetchCount: parseInt(this.get('PREFETCH_COUNT', '10'), 10),
    };
  }

  getDatabaseConfig() {
    return {
      host: this.get('DB_HOST'),
      port: parseInt(this.get('DB_PORT', '5432'), 10),
      database: this.get('DB_NAME'),
      username: this.get('DB_USER'),
      password: this.get('DB_PASSWORD'),
    };
  }
}
