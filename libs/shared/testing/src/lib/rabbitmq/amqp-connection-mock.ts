import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import type { Connection } from 'amqplib';
import type { ChannelWrapper } from 'amqp-connection-manager';
import type { RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';

/**
 * Create a comprehensive mock for AmqpConnection
 */
export function createAmqpConnectionMock(): jest.Mocked<AmqpConnection> {
  const requestMock = jest.fn();
  const publishMock = jest.fn();
  const addSetupMock = jest.fn();
  const channelMock = jest.fn();

  const mock = {
    // Core methods that get called in tests
    request: requestMock,
    publish: publishMock,
    addSetup: addSetupMock,
    channel: channelMock,

    // Connection properties
    isConnected: true,
    connection: {} as Connection,
    managedChannel: {} as ChannelWrapper,
    managedConnection: {
      close: jest.fn(),
      createChannel: jest.fn(),
      heartbeatIntervalInSeconds: 5,
      reconnectTimeInSeconds: 5,
      isConnected: jest.fn().mockReturnValue(true),
      connection: undefined,
      channelCount: 0,
    } as unknown as jest.Mocked<{
      close: () => Promise<void>;
      createChannel: () => unknown;
      heartbeatIntervalInSeconds: number;
      reconnectTimeInSeconds: number;
      isConnected: () => boolean;
      connection: unknown;
      channelCount: number;
    }>,
    configuration: {} as Required<RabbitMQConfig>,
    channels: new Map(),

    // Other AmqpConnection methods that might be accessed
    createSubscriber: jest.fn(),
    init: jest.fn(),
    close: jest.fn(),
    createRpc: jest.fn(),
    createSubscription: jest.fn(),
    exchange: jest.fn(),
    queue: jest.fn(),
    requestReply: jest.fn(),
    subscribe: jest.fn(),
    rpc: jest.fn(),

    // Reset function for test cleanup
    resetMocks: () => {
      requestMock.mockReset();
      publishMock.mockReset();
      addSetupMock.mockReset();
      channelMock.mockReset();
    },
  } as unknown as jest.Mocked<AmqpConnection> & { resetMocks: () => void };

  return mock;
}

/**
 * Default AmqpConnection mock configuration for unit tests
 */
export const AMQP_CONNECTION_MOCK_PROVIDER = {
  provide: AmqpConnection,
  useFactory: createAmqpConnectionMock,
};

/**
 * Mock helper functions for common test scenarios
 */
export class AmqpConnectionMockHelper {
  constructor(private mock: jest.Mocked<AmqpConnection>) {}

  /**
   * Setup mock to resolve with healthy response for health checks
   */
  mockHealthyResponse(serviceName: string) {
    this.mock.request.mockResolvedValue({
      status: 'healthy',
      service: serviceName,
      timestamp: new Date().toISOString(),
      metadata: {},
    });
  }

  /**
   * Setup mock to reject with error for health checks
   */
  mockUnhealthyResponse(error = new Error('Service unreachable')) {
    this.mock.request.mockRejectedValue(error);
  }

  /**
   * Setup mock for specific routing key patterns
   */
  mockForRoutingKey(routingKey: string, response: unknown) {
    this.mock.request.mockImplementation((options) => {
      if (options.routingKey === routingKey) {
        return Promise.resolve(response);
      }
      return Promise.reject(
        new Error(`Unmocked routing key: ${options.routingKey}`),
      );
    });
  }

  /**
   * Verify request was called with expected parameters
   */
  expectRequestCalled(
    exchange: string,
    routingKey: string,
    payload: unknown = {},
    timeout = 5000,
  ) {
    expect(this.mock.request).toHaveBeenCalledWith({
      exchange,
      routingKey,
      payload,
      timeout,
    });
  }

  /**
   * Verify publish was called with expected parameters
   */
  expectPublishCalled(exchange: string, routingKey: string, payload: unknown) {
    expect(this.mock.publish).toHaveBeenCalledWith(
      exchange,
      routingKey,
      payload,
    );
  }

  /**
   * Get call count for request method
   */
  getRequestCallCount(): number {
    return this.mock.request.mock.calls.length;
  }

  /**
   * Get call count for publish method
   */
  getPublishCallCount(): number {
    return this.mock.publish.mock.calls.length;
  }

  /**
   * Clear all mock call history
   */
  clearMocks() {
    this.mock.request.mockClear();
    this.mock.publish.mockClear();
  }

  /**
   * Reset all mocks to initial state
   */
  resetMocks() {
    if ('resetMocks' in this.mock) {
      (
        this.mock as jest.Mocked<AmqpConnection> & { resetMocks: () => void }
      ).resetMocks();
    } else {
      this.mock.request.mockReset();
      this.mock.publish.mockReset();
    }
  }
}
