/**
 * API Gateway Bootstrap Module
 *
 * This module bootstraps the API Gateway as an HTTP server in the DDD architecture.
 * It serves as the single entry point for all external HTTP traffic and routes
 * requests to appropriate microservices via RabbitMQ message queues.
 *
 * Key features:
 * - Type-safe configuration management using ConfigService
 * - HTTP server with configurable port and CORS
 * - RabbitMQ client integration for microservice communication
 * - JWT authentication and rate limiting
 * - Comprehensive error handling and logging
 * - Graceful shutdown handling
 * - Production-ready service lifecycle management
 *
 * @example
 * ```bash
 * # Start the API Gateway in development
 * nx serve api-gateway
 *
 * # Start with specific environment
 * NODE_ENV=production nx serve api-gateway
 * ```
 */

import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import type { ApiGatewayConfig } from '@usecapsule/parameters';
import { AppModule } from './app/app.module';

/**
 * Bootstrap function for the API Gateway HTTP server.
 *
 * This function:
 * 1. Creates the NestJS application (which loads and validates configuration)
 * 2. Retrieves validated configuration from ConfigService
 * 3. Configures HTTP server with CORS and global prefix
 * 4. Sets up error handling and graceful shutdown
 * 5. Starts the HTTP server
 *
 * The service will exit with code 1 if configuration validation fails
 * or if any critical errors occur during startup.
 *
 * @throws {Error} When configuration is invalid or missing
 * @throws {Error} When HTTP server cannot bind to port
 * @throws {Error} When application fails to start
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('ApiGatewayBootstrap');

  try {
    logger.log('Starting API Gateway HTTP server...');

    // Create the NestJS application (this will load and validate configuration)
    logger.log('Creating application and loading configuration...');
    const app = await NestFactory.create(AppModule);

    // Get the validated configuration from ConfigService
    const configService = app.get(ConfigService<ApiGatewayConfig>);

    // Configure server settings from validated config
    const port = configService.get('SERVICE_PORT', { infer: true });
    const corsEnabled = configService.get('CORS_ENABLED', { infer: true });
    const corsOrigins = configService.get('CORS_ORIGINS', { infer: true });

    // Set global API prefix
    const globalPrefix = 'api';
    app.setGlobalPrefix(globalPrefix);

    // Configure CORS if enabled
    if (corsEnabled) {
      app.enableCors({
        origin: corsOrigins === '*' ? true : corsOrigins?.split(',').map(origin => origin.trim()) || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
        credentials: true,
      });
      logger.log(`CORS enabled with origins: ${corsOrigins || '*'}`);
    } else {
      logger.log('CORS is disabled');
    }

    // Setup graceful shutdown handling
    setupGracefulShutdown(app, logger);

    // Start the HTTP server
    logger.log(`Starting HTTP server on port ${port}...`);
    await app.listen(port || 3000);
    logger.log(
      `🚀 API Gateway HTTP server successfully started and listening on: http://localhost:${port || 3000}/${globalPrefix}`,
    );
  } catch (error) {
    logger.error(
      'Failed to start API Gateway HTTP server:',
      error instanceof Error ? error.stack : error,
    );
    process.exit(1);
  }
}

/**
 * Sets up graceful shutdown handling for the HTTP server.
 *
 * This function ensures that the server shuts down gracefully when receiving
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
      logger.log('API Gateway HTTP server shut down gracefully');
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

// Start the API Gateway
bootstrap().catch((error) => {
  console.error('Critical error during bootstrap:', error);
  process.exit(1);
});
