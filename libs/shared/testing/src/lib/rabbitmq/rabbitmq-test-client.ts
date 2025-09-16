import type { Channel, ChannelModel } from 'amqplib';
import { connect } from 'amqplib';
import * as uuid from 'uuid';

export interface TestExchange {
  name: string;
  type: 'direct' | 'topic' | 'fanout' | 'headers';
  options?: {
    durable?: boolean;
    autoDelete?: boolean;
    internal?: boolean;
    alternateExchange?: string;
  };
}

export interface TestQueue {
  name: string;
  options?: {
    exclusive?: boolean;
    durable?: boolean;
    autoDelete?: boolean;
    messageTtl?: number;
    expires?: number;
    maxLength?: number;
  };
}

export interface TestBinding {
  exchange: string;
  queue: string;
  routingKey: string;
}

export interface RabbitMQTestClientConfig {
  connectionUri: string;
  exchanges?: TestExchange[];
  queues?: TestQueue[];
  bindings?: TestBinding[];
  testPrefix?: string;
}

export interface MessageCapture {
  content: Buffer;
  properties: unknown;
  fields: unknown;
  timestamp: Date;
  routingKey: string;
  exchange: string;
}

export class RabbitMQTestClient {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private config: RabbitMQTestClientConfig;
  private messageCaptures: Map<string, MessageCapture[]> = new Map();
  private consumerTags: string[] = [];

  constructor(config: RabbitMQTestClientConfig) {
    this.config = {
      ...config,
      testPrefix: config.testPrefix ?? `test_${Date.now()}_`,
    };
  }

  async connect(): Promise<void> {
    this.connection = await connect(this.config.connectionUri);
    if (!this.connection) {
      throw new Error('Failed to establish RabbitMQ connection');
    }
    this.channel = await this.connection.createChannel();

    // Setup test infrastructure
    await this.setupExchanges();
    await this.setupQueues();
    await this.setupBindings();
  }

  async disconnect(): Promise<void> {
    // Stop all consumers
    for (const consumerTag of this.consumerTags) {
      try {
        await this.channel?.cancel(consumerTag);
      } catch {
        // Ignore errors when cleaning up
      }
    }
    this.consumerTags = [];

    // Cleanup test infrastructure
    await this.cleanup();

    if (this.channel) {
      await this.channel.close();
    }
    if (this.connection) {
      await this.connection.close();
    }
    this.channel = null;
    this.connection = null;
  }

  private async setupExchanges(): Promise<void> {
    if (!this.channel || !this.config.exchanges) return;

    for (const exchange of this.config.exchanges) {
      const exchangeName = this.getTestName(exchange.name);
      await this.channel.assertExchange(
        exchangeName,
        exchange.type,
        exchange.options ?? { durable: false },
      );
    }
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel || !this.config.queues) return;

    for (const queue of this.config.queues) {
      const queueName = this.getTestName(queue.name);
      await this.channel.assertQueue(
        queueName,
        queue.options ?? { durable: false },
      );
    }
  }

  private async setupBindings(): Promise<void> {
    if (!this.channel || !this.config.bindings) return;

    for (const binding of this.config.bindings) {
      const exchangeName = this.getTestName(binding.exchange);
      const queueName = this.getTestName(binding.queue);
      await this.channel.bindQueue(queueName, exchangeName, binding.routingKey);
    }
  }

  private async cleanup(): Promise<void> {
    if (!this.channel) return;

    try {
      // Delete test queues
      if (this.config.queues) {
        for (const queue of this.config.queues) {
          const queueName = this.getTestName(queue.name);
          try {
            await this.channel.deleteQueue(queueName);
          } catch {
            // Queue might not exist or might be in use
          }
        }
      }

      // Delete test exchanges
      if (this.config.exchanges) {
        for (const exchange of this.config.exchanges) {
          const exchangeName = this.getTestName(exchange.name);
          try {
            await this.channel.deleteExchange(exchangeName);
          } catch {
            // Exchange might not exist or might be in use
          }
        }
      }
    } catch {
      // Ignore cleanup errors in tests
    }
  }

  private getTestName(name: string): string {
    return `${this.config.testPrefix}${name}`;
  }

  async publishMessage(
    exchange: string,
    routingKey: string,
    content: unknown,
    options: Record<string, unknown> = {},
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected. Call connect() first.');
    }

    const exchangeName = this.getTestName(exchange);
    const messageContent = Buffer.from(JSON.stringify(content));

    this.channel.publish(exchangeName, routingKey, messageContent, {
      timestamp: Date.now(),
      messageId: uuid.v4(),
      ...options,
    });
  }

  async sendRPCMessage<T>(
    exchange: string,
    routingKey: string,
    content: unknown,
    timeout = 5000,
  ): Promise<T> {
    if (!this.channel) {
      throw new Error('Not connected. Call connect() first.');
    }

    const correlationId = uuid.v4();
    const exchangeName = this.getTestName(exchange);

    // Create temporary queue for response
    const replyQueue = await this.channel.assertQueue('', {
      exclusive: true,
    });

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        reject(new Error(`RPC request timeout after ${timeout}ms`));
      }, timeout);

      // Consume response
      if (!this.channel) {
        reject(new Error('Channel not available'));
        return;
      }
      this.channel
        .consume(
          replyQueue.queue,
          (msg) => {
            if (msg && msg.properties.correlationId === correlationId) {
              clearTimeout(timeoutHandle);
              try {
                const response = JSON.parse(msg.content.toString());
                resolve(response);
              } catch (parseError) {
                reject(new Error(`Invalid JSON response: ${parseError}`));
              }
              if (this.channel) {
                this.channel.ack(msg);
              }
            }
          },
          { noAck: false },
        )
        .then((consumerTag) => {
          this.consumerTags.push(consumerTag.consumerTag);

          // Send request
          const messageContent = Buffer.from(JSON.stringify(content));
          if (!this.channel) {
            reject(new Error('Channel not available'));
            return;
          }
          this.channel.publish(exchangeName, routingKey, messageContent, {
            correlationId,
            replyTo: replyQueue.queue,
            timestamp: Date.now(),
            messageId: uuid.v4(),
          });
        })
        .catch(reject);
    });
  }

  async captureMessages(
    queueName: string,
    captureKey?: string,
  ): Promise<string> {
    if (!this.channel) {
      throw new Error('Not connected. Call connect() first.');
    }

    const testQueueName = this.getTestName(queueName);
    const key = captureKey ?? `${testQueueName}_${Date.now()}`;

    if (!this.messageCaptures.has(key)) {
      this.messageCaptures.set(key, []);
    }

    const consumerTag = await this.channel.consume(
      testQueueName,
      (msg) => {
        if (msg) {
          const capture: MessageCapture = {
            content: msg.content,
            properties: msg.properties,
            fields: msg.fields,
            timestamp: new Date(),
            routingKey: msg.fields.routingKey,
            exchange: msg.fields.exchange,
          };

          const messageArray = this.messageCaptures.get(key);
          if (messageArray && this.channel) {
            messageArray.push(capture);
            this.channel.ack(msg);
          }
        }
      },
      { noAck: false },
    );

    this.consumerTags.push(consumerTag.consumerTag);
    return key;
  }

  getCapturedMessages(captureKey: string): MessageCapture[] {
    return this.messageCaptures.get(captureKey) ?? [];
  }

  getLastCapturedMessage(captureKey: string): MessageCapture | null {
    const messages = this.getCapturedMessages(captureKey);
    return messages.length > 0 ? messages[messages.length - 1] : null;
  }

  clearCapturedMessages(captureKey?: string): void {
    if (captureKey) {
      this.messageCaptures.delete(captureKey);
    } else {
      this.messageCaptures.clear();
    }
  }

  async waitForMessages(
    captureKey: string,
    expectedCount: number,
    timeout = 5000,
  ): Promise<MessageCapture[]> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        const currentCount = this.getCapturedMessages(captureKey).length;
        reject(
          new Error(
            `Timeout waiting for ${expectedCount} messages. Got ${currentCount} after ${timeout}ms`,
          ),
        );
      }, timeout);

      const checkMessages = () => {
        const messages = this.getCapturedMessages(captureKey);
        if (messages.length >= expectedCount) {
          clearTimeout(timeoutHandle);
          resolve(messages.slice(0, expectedCount));
        } else {
          setTimeout(checkMessages, 10);
        }
      };

      checkMessages();
    });
  }

  async purgeQueue(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('Not connected. Call connect() first.');
    }

    const testQueueName = this.getTestName(queueName);
    await this.channel.purgeQueue(testQueueName);
  }

  async getQueueMessageCount(queueName: string): Promise<number> {
    if (!this.channel) {
      throw new Error('Not connected. Call connect() first.');
    }

    const testQueueName = this.getTestName(queueName);
    const queueInfo = await this.channel.checkQueue(testQueueName);
    return queueInfo.messageCount;
  }
}
