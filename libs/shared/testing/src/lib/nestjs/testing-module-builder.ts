import { Test, TestingModule } from '@nestjs/testing';
import { ModuleMetadata } from '@nestjs/common';
import { RabbitMQTestClient } from '../rabbitmq/rabbitmq-test-client';
import { RabbitMQTestContainer } from '../containers/rabbitmq-container';
import { PostgreSQLTestContainer } from '../containers/postgresql-container';

export interface TestingModuleConfig extends ModuleMetadata {
  useRealRabbitMQ?: boolean;
  useRealDatabase?: boolean;
  rabbitMQConfig?: {
    exchanges?: string[];
    serviceName?: string;
  };
  databaseConfig?: {
    entities?: any[];
    migrations?: string[];
  };
}

export interface TestEnvironment {
  module: TestingModule;
  rabbitMQContainer?: RabbitMQTestContainer;
  rabbitMQClient?: RabbitMQTestClient;
  postgresContainer?: PostgreSQLTestContainer;
  cleanup: () => Promise<void>;
}

export class TestingModuleBuilder {
  private config: TestingModuleConfig;
  private rabbitMQContainer?: RabbitMQTestContainer;
  private postgresContainer?: PostgreSQLTestContainer;

  constructor(config: TestingModuleConfig) {
    this.config = config;
  }

  async build(): Promise<TestEnvironment> {
    const imports = [...(this.config.imports || [])];
    const providers = [...(this.config.providers || [])];

    let rabbitMQClient: RabbitMQTestClient | undefined;
    let rabbitMQContainer: RabbitMQTestContainer | undefined;
    let postgresContainer: PostgreSQLTestContainer | undefined;

    // Setup RabbitMQ if needed
    if (this.config.useRealRabbitMQ) {
      rabbitMQContainer = new RabbitMQTestContainer({
        user: 'testuser',
        password: 'testpass',
        vhost: '/',
      });

      await rabbitMQContainer.start();

      // Setup RabbitMQ module dynamically to avoid module boundary violation
      const { RabbitMQModule } = await import('@golevelup/nestjs-rabbitmq');
      const rabbitMQModule = RabbitMQModule.forRoot(RabbitMQModule, {
        uri: rabbitMQContainer.getConnectionUri(),
        exchanges: [
          {
            name: 'capsule.commands',
            type: 'direct',
            options: { durable: false },
          },
          {
            name: 'capsule.events',
            type: 'topic',
            options: { durable: false },
          },
        ],
        enableControllerDiscovery: true,
      });

      imports.push(rabbitMQModule);

      // Create test client
      rabbitMQClient = new RabbitMQTestClient({
        connectionUri: rabbitMQContainer.getConnectionUri(),
        exchanges: [
          { name: 'capsule.commands', type: 'direct' },
          { name: 'capsule.events', type: 'topic' },
        ],
        queues: [
          { name: 'test_queue', options: { durable: false } },
          { name: 'health_queue', options: { durable: false } },
        ],
        bindings: [
          {
            exchange: 'capsule.commands',
            queue: 'test_queue',
            routingKey: 'test.*',
          },
          {
            exchange: 'capsule.commands',
            queue: 'health_queue',
            routingKey: '*.health',
          },
        ],
      });

      await rabbitMQClient.connect();
    } else if (this.config.rabbitMQConfig) {
      // Import the AmqpConnection token properly
      const { AmqpConnection } = await import('@golevelup/nestjs-rabbitmq');

      // Mock RabbitMQ providers
      providers.push({
        provide: AmqpConnection,
        useValue: {
          request: jest.fn(),
          publish: jest.fn(),
          isConnected: true,
          managedConnection: {
            close: jest.fn(),
          },
        },
      });
    }

    const moduleBuilder = Test.createTestingModule({
      imports,
      controllers: this.config.controllers || [],
      providers,
      exports: this.config.exports || [],
    });

    // Setup PostgreSQL if needed
    if (this.config.useRealDatabase) {
      postgresContainer = new PostgreSQLTestContainer({
        database: 'testdb',
        user: 'testuser',
        password: 'testpass',
      });

      await postgresContainer.start();

      // You can extend this to setup TypeORM or other database modules
    }

    const module = await moduleBuilder.compile();

    return {
      module,
      rabbitMQContainer,
      rabbitMQClient,
      postgresContainer,
      cleanup: async () => {
        await module.close();
        if (rabbitMQClient) {
          await rabbitMQClient.disconnect();
        }
        if (rabbitMQContainer) {
          await rabbitMQContainer.stop();
        }
        if (postgresContainer) {
          await postgresContainer.stop();
        }
      },
    };
  }
}
