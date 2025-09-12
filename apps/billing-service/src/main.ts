/**
 * Billing Service Bootstrap Module
 *
 * This module bootstraps the Billing Service using @golevelup/nestjs-rabbitmq.
 * It creates a standard NestJS application that uses RabbitMQ for inter-service
 * communication via exchange-based routing.
 *
 * Key features:
 * - @golevelup/nestjs-rabbitmq for unified exchange-based messaging
 * - Declarative RabbitMQ configuration via RabbitMQModule
 * - @RabbitRPC decorators for message handlers
 * - Comprehensive error handling and logging
 * - Graceful shutdown handling
 * - Stripe payment processing integration
 * - Subscription and billing cycle management
 *
 * @example
 * ```bash
 * # Start the service in development
 * nx serve billing-service
 *
 * # Start with specific environment
 * NODE_ENV=production nx serve billing-service
 * ```
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

/**
 * Bootstrap function for the Billing Service.
 *
 * Creates a standard NestJS application that uses @golevelup/nestjs-rabbitmq
 * for RabbitMQ integration. The RabbitMQ configuration is handled declaratively
 * through the RabbitMQModule.forMicroservice() configuration.
 *
 * @throws {Error} When application fails to start
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('BillingServiceBootstrap');

  try {
    logger.log('Starting Billing Service...');

    const app = await NestFactory.create(AppModule);

    // Setup graceful shutdown handling
    setupGracefulShutdown(app, logger);

    const port = process.env.BILLING_SERVICE_PORT || 3003;
    await app.listen(port);

    logger.log(`Billing Service started successfully on port ${port}`);
  } catch (error) {
    logger.error(
      'Failed to start Billing Service:',
      error instanceof Error ? error.stack : error,
    );
    process.exit(1);
  }
}

/**
 * Sets up graceful shutdown handling for the application.
 *
 * This function ensures that the service shuts down gracefully when receiving
 * termination signals, allowing ongoing requests to complete and cleaning up
 * resources properly.
 *
 * @param app - The NestJS application instance
 * @param logger - Logger instance for shutdown messages
 */
function setupGracefulShutdown(app: any, logger: Logger): void {
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await app.close();
      logger.log('Billing Service shut down gracefully');
      process.exit(0);
    } catch (error) {
      logger.error(
        'Error during shutdown:',
        error instanceof Error ? error.stack : error,
      );
      process.exit(1);
    }
  };

  // Handle termination signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions and rejections
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

// Start the service
bootstrap().catch((error) => {
  console.error('Critical error during bootstrap:', error);
  process.exit(1);
});
