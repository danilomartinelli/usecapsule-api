import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export interface PostgreSQLContainerConfig {
  database?: string;
  user?: string;
  password?: string;
  port?: number;
  image?: string;
}

export class PostgreSQLTestContainer {
  private container: StartedTestContainer | null = null;
  private config: Required<PostgreSQLContainerConfig>;

  constructor(config: PostgreSQLContainerConfig = {}) {
    this.config = {
      database: config.database ?? 'testdb',
      user: config.user ?? 'testuser',
      password: config.password ?? 'testpass',
      port: config.port ?? 5432,
      image: config.image ?? 'postgres:15-alpine',
    };
  }

  async start(): Promise<StartedTestContainer> {
    if (this.container) {
      return this.container;
    }

    this.container = await new GenericContainer(this.config.image)
      .withEnvironment({
        POSTGRES_DB: this.config.database,
        POSTGRES_USER: this.config.user,
        POSTGRES_PASSWORD: this.config.password,
        POSTGRES_HOST_AUTH_METHOD: 'trust',
      })
      .withExposedPorts(this.config.port)
      .withWaitStrategy(
        Wait.forLogMessage('database system is ready to accept connections')
      )
      .withStartupTimeout(30000)
      .start();

    // Wait a bit more for PostgreSQL to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    return this.container;
  }

  async stop(): Promise<void> {
    if (this.container) {
      await this.container.stop();
      this.container = null;
    }
  }

  getConnectionUri(): string {
    if (!this.container) {
      throw new Error('Container not started. Call start() first.');
    }

    const mappedPort = this.container.getMappedPort(this.config.port);
    return `postgresql://${this.config.user}:${this.config.password}@localhost:${mappedPort}/${this.config.database}`;
  }

  getConnectionConfig() {
    if (!this.container) {
      throw new Error('Container not started. Call start() first.');
    }

    const mappedPort = this.container.getMappedPort(this.config.port);
    return {
      host: 'localhost',
      port: mappedPort,
      database: this.config.database,
      username: this.config.user,
      password: this.config.password,
    };
  }

  getHost(): string {
    return this.container?.getHost() ?? 'localhost';
  }

  getPort(): number {
    if (!this.container) {
      throw new Error('Container not started. Call start() first.');
    }
    return this.container.getMappedPort(this.config.port);
  }

  getDatabase(): string {
    return this.config.database;
  }

  getUser(): string {
    return this.config.user;
  }

  getPassword(): string {
    return this.config.password;
  }
}