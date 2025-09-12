import {
  RabbitMQTestContainer,
  RabbitMQTestClient,
  MessageFixtureFactory,
} from '@usecapsule/testing';

describe('RabbitMQ Message Routing Integration', () => {
  let rabbitMQContainer: RabbitMQTestContainer;
  let rabbitMQClient: RabbitMQTestClient;

  beforeAll(async () => {
    rabbitMQContainer = new RabbitMQTestContainer({
      user: 'testuser',
      password: 'testpass',
      vhost: '/',
    });

    await rabbitMQContainer.start();

    rabbitMQClient = new RabbitMQTestClient({
      connectionUri: rabbitMQContainer.getConnectionUri(),
      exchanges: [
        { name: 'capsule.commands', type: 'direct' },
        { name: 'capsule.events', type: 'topic' },
        { name: 'test.exchange', type: 'direct' },
      ],
      queues: [
        { name: 'auth_queue', options: { durable: false } },
        { name: 'billing_queue', options: { durable: false } },
        { name: 'deploy_queue', options: { durable: false } },
        { name: 'monitor_queue', options: { durable: false } },
        { name: 'test_queue', options: { durable: false } },
        { name: 'event_queue', options: { durable: false } },
      ],
      bindings: [
        { exchange: 'capsule.commands', queue: 'auth_queue', routingKey: 'auth.*' },
        { exchange: 'capsule.commands', queue: 'billing_queue', routingKey: 'billing.*' },
        { exchange: 'capsule.commands', queue: 'deploy_queue', routingKey: 'deploy.*' },
        { exchange: 'capsule.commands', queue: 'monitor_queue', routingKey: 'monitor.*' },
        { exchange: 'capsule.events', queue: 'event_queue', routingKey: '*.*' },
        { exchange: 'test.exchange', queue: 'test_queue', routingKey: 'test.message' },
      ],
    });

    await rabbitMQClient.connect();
  });

  afterAll(async () => {
    await rabbitMQClient.disconnect();
    await rabbitMQContainer.stop();
  });

  beforeEach(async () => {
    // Clear any previous message captures
    rabbitMQClient.clearCapturedMessages();

    // Purge all test queues
    const queues = ['auth_queue', 'billing_queue', 'deploy_queue', 'monitor_queue', 'test_queue', 'event_queue'];
    for (const queue of queues) {
      await rabbitMQClient.purgeQueue(queue);
    }
  });

  describe('Command Exchange Routing', () => {
    it('should route auth commands to auth queue', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('auth_queue');
      const healthMessage = MessageFixtureFactory.createHealthCheckMessage('auth');

      // Act
      await rabbitMQClient.publishMessage(
        'capsule.commands',
        'auth.health',
        healthMessage.content
      );

      // Assert
      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchMessagePattern({
        routingKey: 'auth.health',
        exchange: 'capsule.commands',
      });
    });

    it('should route billing commands to billing queue', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('billing_queue');
      const chargeMessage = MessageFixtureFactory.createBillingChargeMessage({
        customerId: 'test-customer',
        amount: 1000,
      });

      // Act
      await rabbitMQClient.publishMessage(
        'capsule.commands',
        'billing.charge',
        chargeMessage.content
      );

      // Assert
      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchMessagePattern({
        routingKey: 'billing.charge',
        exchange: 'capsule.commands',
      });

      const messageContent = JSON.parse(messages[0].content.toString());
      expect(messageContent.customerId).toBe('test-customer');
      expect(messageContent.amount).toBe(1000);
    });

    it('should route deploy commands to deploy queue', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('deploy_queue');
      const deployMessage = MessageFixtureFactory.createDeploymentMessage({
        projectId: 'test-project',
        environment: 'staging',
      });

      // Act
      await rabbitMQClient.publishMessage(
        'capsule.commands',
        'deploy.create',
        deployMessage.content
      );

      // Assert
      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchMessagePattern({
        routingKey: 'deploy.create',
        exchange: 'capsule.commands',
      });

      const messageContent = JSON.parse(messages[0].content.toString());
      expect(messageContent.projectId).toBe('test-project');
      expect(messageContent.environment).toBe('staging');
    });

    it('should route monitor commands to monitor queue', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('monitor_queue');
      const metricsMessage = MessageFixtureFactory.createMonitoringMetricsMessage({
        serviceId: 'test-service',
        cpu: 75.5,
      });

      // Act
      await rabbitMQClient.publishMessage(
        'capsule.commands',
        'monitor.track',
        metricsMessage.content
      );

      // Assert
      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchMessagePattern({
        routingKey: 'monitor.track',
        exchange: 'capsule.commands',
      });

      const messageContent = JSON.parse(messages[0].content.toString());
      expect(messageContent.serviceId).toBe('test-service');
      expect(messageContent.metrics.cpu).toBe(75.5);
    });

    it('should not route commands with incorrect routing keys', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('auth_queue');

      // Act - Send with wrong routing key
      await rabbitMQClient.publishMessage(
        'capsule.commands',
        'wrong.routing.key',
        { test: 'data' }
      );

      // Wait a bit to see if any messages arrive
      await new Promise(resolve => setTimeout(resolve, 500));

      // Assert
      const messages = rabbitMQClient.getCapturedMessages(captureKey);
      expect(messages).toHaveLength(0);
    });
  });

  describe('Event Exchange Routing', () => {
    it('should route user events to event queue', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('event_queue');
      const userEvent = MessageFixtureFactory.createUserCreatedEvent('user-123', 'test@example.com');

      // Act
      await rabbitMQClient.publishMessage(
        'capsule.events',
        'user.created',
        userEvent.content
      );

      // Assert
      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchMessagePattern({
        routingKey: 'user.created',
        exchange: 'capsule.events',
      });

      const messageContent = JSON.parse(messages[0].content.toString());
      expect(messageContent.userId).toBe('user-123');
      expect(messageContent.email).toBe('test@example.com');
    });

    it('should route payment events to event queue', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('event_queue');
      const paymentEvent = MessageFixtureFactory.createPaymentProcessedEvent({
        paymentId: 'payment-456',
        amount: 2000,
        status: 'succeeded',
      });

      // Act
      await rabbitMQClient.publishMessage(
        'capsule.events',
        'payment.processed',
        paymentEvent.content
      );

      // Assert
      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchMessagePattern({
        routingKey: 'payment.processed',
        exchange: 'capsule.events',
      });

      const messageContent = JSON.parse(messages[0].content.toString());
      expect(messageContent.paymentId).toBe('payment-456');
      expect(messageContent.amount).toBe(2000);
      expect(messageContent.status).toBe('succeeded');
    });

    it('should route deployment events to event queue', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('event_queue');
      const deploymentEvent = MessageFixtureFactory.createDeploymentStartedEvent('deployment-789');

      // Act
      await rabbitMQClient.publishMessage(
        'capsule.events',
        'deployment.started',
        deploymentEvent.content
      );

      // Assert
      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchMessagePattern({
        routingKey: 'deployment.started',
        exchange: 'capsule.events',
      });

      const messageContent = JSON.parse(messages[0].content.toString());
      expect(messageContent.deploymentId).toBe('deployment-789');
      expect(messageContent.status).toBe('started');
    });
  });

  describe('Multiple Service Health Checks', () => {
    it('should route all health checks to correct service queues', async () => {
      // Arrange
      const authCaptureKey = await rabbitMQClient.captureMessages('auth_queue');
      const billingCaptureKey = await rabbitMQClient.captureMessages('billing_queue');
      const deployCaptureKey = await rabbitMQClient.captureMessages('deploy_queue');
      const monitorCaptureKey = await rabbitMQClient.captureMessages('monitor_queue');

      // Act - Send health checks for all services
      await Promise.all([
        rabbitMQClient.publishMessage('capsule.commands', 'auth.health', {}),
        rabbitMQClient.publishMessage('capsule.commands', 'billing.health', {}),
        rabbitMQClient.publishMessage('capsule.commands', 'deploy.health', {}),
        rabbitMQClient.publishMessage('capsule.commands', 'monitor.health', {}),
      ]);

      // Assert
      const authMessages = await rabbitMQClient.waitForMessages(authCaptureKey, 1, 2000);
      const billingMessages = await rabbitMQClient.waitForMessages(billingCaptureKey, 1, 2000);
      const deployMessages = await rabbitMQClient.waitForMessages(deployCaptureKey, 1, 2000);
      const monitorMessages = await rabbitMQClient.waitForMessages(monitorCaptureKey, 1, 2000);

      expect(authMessages).toHaveLength(1);
      expect(billingMessages).toHaveLength(1);
      expect(deployMessages).toHaveLength(1);
      expect(monitorMessages).toHaveLength(1);

      expect(authMessages[0].routingKey).toBe('auth.health');
      expect(billingMessages[0].routingKey).toBe('billing.health');
      expect(deployMessages[0].routingKey).toBe('deploy.health');
      expect(monitorMessages[0].routingKey).toBe('monitor.health');
    });
  });

  describe('Message Persistence and Delivery', () => {
    it('should deliver messages reliably', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('test_queue');
      const messageCount = 10;
      const messages = MessageFixtureFactory.createBatchMessages(
        messageCount,
        () => ({ test: 'data', id: Math.random() })
      );

      // Act
      for (const message of messages) {
        await rabbitMQClient.publishMessage('test.exchange', 'test.message', message);
      }

      // Assert
      const capturedMessages = await rabbitMQClient.waitForMessages(
        captureKey,
        messageCount,
        5000
      );
      
      expect(capturedMessages).toHaveLength(messageCount);
    });

    it('should handle message ordering within single connection', async () => {
      // Arrange
      const captureKey = await rabbitMQClient.captureMessages('test_queue');
      const orderedMessages = [
        { order: 1, data: 'first' },
        { order: 2, data: 'second' },
        { order: 3, data: 'third' },
      ];

      // Act - Send messages in order
      for (const message of orderedMessages) {
        await rabbitMQClient.publishMessage('test.exchange', 'test.message', message);
      }

      // Assert
      const capturedMessages = await rabbitMQClient.waitForMessages(captureKey, 3, 2000);
      
      expect(capturedMessages).toHaveLength(3);
      
      const parsedMessages = capturedMessages.map(msg => JSON.parse(msg.content.toString()));
      expect(parsedMessages[0].order).toBe(1);
      expect(parsedMessages[1].order).toBe(2);
      expect(parsedMessages[2].order).toBe(3);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle messages to non-existent exchanges', async () => {
      // This test ensures the client handles errors gracefully
      await expect(
        rabbitMQClient.publishMessage('nonexistent.exchange', 'test.key', {})
      ).rejects.toThrow();
    });

    it('should handle connection recovery', async () => {
      // Test basic functionality after potential connection issues
      const captureKey = await rabbitMQClient.captureMessages('test_queue');

      await rabbitMQClient.publishMessage('test.exchange', 'test.message', { test: 'recovery' });

      const messages = await rabbitMQClient.waitForMessages(captureKey, 1, 2000);
      expect(messages).toHaveLength(1);

      const messageContent = JSON.parse(messages[0].content.toString());
      expect(messageContent.test).toBe('recovery');
    });
  });
});