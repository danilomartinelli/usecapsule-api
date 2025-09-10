/**
 * Auth Service Bootstrap Module
 *
 * This module bootstraps the Auth Service microservice in the DDD architecture.
 * It creates a RabbitMQ-based microservice that communicates with the API Gateway
 * and other services via message queues.
 *
 * Key features:
 * - Type-safe configuration management using ConfigService
 * - RabbitMQ transport for inter-service communication
 * - Comprehensive error handling and logging
 * - Graceful shutdown handling
 * - Production-ready service lifecycle management
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

import { INestMicroservice, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core'
import { MicroserviceOptions, Transport } from '@nestjs/microservices'

import type { AuthServiceSchema } from '@usecapsule/parameters';
import { AppModule } from './app/app.module'

/**
 * Bootstrap function for the Auth Service microservice.
 *
 * This function:
 * 1. Creates the NestJS application context (which loads and validates configuration)
 * 2. Retrieves validated configuration from ConfigService
 * 3. Configures RabbitMQ transport with proper connection settings
 * 4. Sets up error handling and graceful shutdown
 * 5. Starts the microservice listener
 *
 * The service will exit with code 1 if configuration validation fails
 * or if any critical errors occur during startup.
 *
 * @throws {Error} When configuration is invalid or missing
 * @throws {Error} When RabbitMQ connection cannot be established
 * @throws {Error} When microservice fails to start
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('AuthServiceBootstrap');

  try {
    logger.log('Starting Auth Service microservice...');

    // First create the application context to initialize the ParametersModule
    // This will load and validate the configuration
    logger.log('Creating application context and loading configuration...');
    const appContext = await NestFactory.createApplicationContext(AppModule);

    // Get the validated configuration from ConfigService
    const configService = appContext.get(ConfigService<AuthServiceSchema>);

    // Build RabbitMQ configuration from validated config
    const rabbitUrl = configService.get('RABBITMQ_URL', { infer: true });
    const rabbitQueue = configService.get('RABBITMQ_QUEUE', { infer: true });

    if (!rabbitUrl) {
      throw new Error('RABBITMQ_URL is required but not configured');
    }

    const rabbitConfig = {
      urls: [rabbitUrl],
      queue: rabbitQueue,
      queueOptions: {
        durable: true,
      },
    };

    logger.log(
      `RabbitMQ config: ${rabbitConfig.urls[0]} -> ${rabbitConfig.queue}`,
    );

    // Close the application context as we only needed it for configuration
    await appContext.close();

    logger.log('Creating microservice with RabbitMQ transport...');
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
      AppModule,
      {
        transport: Transport.RMQ,
        options: rabbitConfig,
      },
    );

    // Setup graceful shutdown handling
    setupGracefulShutdown(app, logger);

    // Start the microservice
    logger.log('Starting microservice listener...');
    await app.listen();
    logger.log(
      `Auth Service microservice successfully started and listening on queue: ${rabbitConfig.queue}`,
    );
  } catch (error) {
    logger.error(
      'Failed to start Auth Service microservice:',
      error instanceof Error ? error.stack : error,
    );
    process.exit(1);
  }
}

/**
 * Sets up graceful shutdown handling for the microservice.
 *
 * This function ensures that the service shuts down gracefully when receiving
 * termination signals, allowing ongoing requests to complete and cleaning up
 * resources properly.
 *
 * @param app - The NestJS microservice application instance
 * @param logger - Logger instance for shutdown messages
 */
function setupGracefulShutdown(app: INestMicroservice, logger: Logger): void {
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await app.close();
      logger.log('Auth Service microservice shut down gracefully');
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
