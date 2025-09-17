/**
 * Auth Service Bootstrap Module
 *
 * This module bootstraps the Auth Service using @golevelup/nestjs-rabbitmq.
 * It creates a standard NestJS application that uses RabbitMQ for inter-service
 * communication via exchange-based routing.
 *
 * Key features:
 * - @golevelup/nestjs-rabbitmq for unified exchange-based messaging
 * - Declarative RabbitMQ configuration via RabbitMQModule
 * - @RabbitRPC decorators for message handlers
 * - Comprehensive error handling and logging
 * - Graceful shutdown handling
 *
 * @example
 * ```bash
 * # Start the service in development
 * nx serve auth-service
 *
 * # Start with specific environment
 * NODE_ENV=production nx serve auth-service
 * ```
 */

import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

/**
 * Bootstrap function for the Auth Service.
 *
 * Using @golevelup/nestjs-rabbitmq, this creates a standard NestJS application
 * that automatically connects to RabbitMQ and registers message handlers.
 * The RabbitMQModule handles all connection management internally.
 *
 * @throws {Error} When configuration is invalid or missing
 * @throws {Error} When RabbitMQ connection cannot be established
 * @throws {Error} When application fails to start
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('AuthServiceBootstrap');

  try {
    logger.log('Starting Auth Service with @golevelup/nestjs-rabbitmq...');

    // Create standard NestJS application
    const app = await NestFactory.create(AppModule);

    // Setup graceful shutdown handling
    setupGracefulShutdown(app, logger);

    // Start the application (RabbitMQ connection is handled by the module)
    const port = process.env.AUTH_SERVICE_PORT || 3001;
    await app.listen(port);

    logger.log(`Auth Service started successfully on port ${port}`);
    logger.log('RabbitMQ handlers registered and listening for messages');
  } catch (error) {
    logger.error(
      'Failed to start Auth Service:',
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
function setupGracefulShutdown(app: INestApplication, logger: Logger): void {
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await app.close();
      logger.log('Auth Service shut down gracefully');
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
