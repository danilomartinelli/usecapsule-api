import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';

export interface RabbitMQContainerConfig {
  user?: string;
  password?: string;
  vhost?: string;
  port?: number;
  managementPort?: number;
  image?: string;
}

export class RabbitMQTestContainer {
  private container: StartedTestContainer | null = null;
  private config: Required<RabbitMQContainerConfig>;

  constructor(config: RabbitMQContainerConfig = {}) {
    this.config = {
      user: config.user ?? 'test',
      password: config.password ?? 'test',
      vhost: config.vhost ?? '/',
      port: config.port ?? 5672,
      managementPort: config.managementPort ?? 15672,
      image: config.image ?? 'rabbitmq:3.13-management',
    };
  }

  async start(): Promise<StartedTestContainer> {
    if (this.container) {
      return this.container;
    }

    this.container = await new GenericContainer(this.config.image)
      .withEnvironment({
        RABBITMQ_DEFAULT_USER: this.config.user,
        RABBITMQ_DEFAULT_PASS: this.config.password,
        RABBITMQ_DEFAULT_VHOST: this.config.vhost,
      })
      .withExposedPorts(this.config.port, this.config.managementPort)
      .withWaitStrategy(Wait.forLogMessage('Server startup complete'))
      .withStartupTimeout(60000)
      .start();

    // Wait a bit more for RabbitMQ to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));

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
    return `amqp://${this.config.user}:${this.config.password}@localhost:${mappedPort}${this.config.vhost}`;
  }

  getManagementUri(): string {
    if (!this.container) {
      throw new Error('Container not started. Call start() first.');
    }

    const mappedPort = this.container.getMappedPort(this.config.managementPort);
    return `http://localhost:${mappedPort}`;
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

  getManagementPort(): number {
    if (!this.container) {
      throw new Error('Container not started. Call start() first.');
    }
    return this.container.getMappedPort(this.config.managementPort);
  }
}
