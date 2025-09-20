# Service Development Guide

**Complete guide for developing new microservices in the Capsule Platform using Domain-Driven Design (DDD) and @golevelup/nestjs-rabbitmq**

## Overview

This guide provides step-by-step instructions for creating new microservices in the Capsule Platform. Each service represents a bounded context in our Domain-Driven Design architecture, communicating exclusively via RabbitMQ exchanges.

### Architecture Principles

- **Microservices**: Each service is a complete bounded context
- **Message-Only Communication**: No HTTP between services
- **Database per Service**: Each service owns its data completely
- **Exchange-Based Routing**: All messaging via @golevelup/nestjs-rabbitmq
- **Health Check Monitoring**: Every service must be observable

## Prerequisites

Before creating a new service, ensure you have:

- **Nx CLI**: `npm install -g nx`
- **Running Infrastructure**: `npm run infrastructure:up`
- **Database Migrations**: `npm run db:migrate:all`
- **Understanding of DDD**: Review [System Architecture](../architecture/system-overview.md)

## Step 1: Service Generation

### 1.1 Generate the Service Structure

Use Nx generators to create consistent service structure:

```bash
# Generate new NestJS application
nx generate @nx/nest:app <service-name>

# Example: Creating a notification service
nx generate @nx/nest:app notification-service
```

### 1.2 Verify Generated Structure

The generator creates this structure:

```text
apps/notification-service/
├── src/
│   ├── app/
│   │   ├── app.controller.ts
│   │   ├── app.module.ts
│   │   ├── app.service.ts
│   │   └── app.controller.spec.ts
│   ├── assets/
│   ├── main.ts
│   └── environments/
├── project.json
├── tsconfig.app.json
├── tsconfig.spec.json
└── jest.config.ts
```

## Step 2: Configure RabbitMQ Microservice

### 2.1 Update main.ts Bootstrap

Replace the default HTTP server with @golevelup/nestjs-rabbitmq configuration:

```typescript
// apps/notification-service/src/main.ts
/**
 * Notification Service Bootstrap Module
 *
 * This module bootstraps the Notification Service using @golevelup/nestjs-rabbitmq.
 * It creates a standard NestJS application that uses RabbitMQ for inter-service
 * communication via exchange-based routing.
 */

import type { INestApplication } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app/app.module';

/**
 * Bootstrap function for the Notification Service.
 */
async function bootstrap(): Promise<void> {
  const logger = new Logger('NotificationServiceBootstrap');

  try {
    logger.log('Starting Notification Service with @golevelup/nestjs-rabbitmq...');

    // Create standard NestJS application
    const app = await NestFactory.create(AppModule);

    // Setup graceful shutdown handling
    setupGracefulShutdown(app, logger);

    // Start the application (RabbitMQ connection is handled by the module)
    const port = process.env.NOTIFICATION_SERVICE_PORT || 3004;
    await app.listen(port);

    logger.log(`Notification Service started successfully on port ${port}`);
    logger.log('RabbitMQ handlers registered and listening for messages');
  } catch (error) {
    logger.error(
      'Failed to start Notification Service:',
      error instanceof Error ? error.stack : error,
    );
    process.exit(1);
  }
}

/**
 * Sets up graceful shutdown handling for the application.
 */
function setupGracefulShutdown(app: INestApplication, logger: Logger): void {
  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Starting graceful shutdown...`);

    try {
      await app.close();
      logger.log('Notification Service shut down gracefully');
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
```

### 2.2 Configure RabbitMQ Module

Update `app.module.ts` to include RabbitMQ configuration:

```typescript
// apps/notification-service/src/app/app.module.ts
import { Module } from '@nestjs/common';
import {
  notificationServiceFactory,
  notificationServiceSchema,
  ParametersModule,
} from '@usecapsule/parameters';
import { RabbitMQModule } from '@usecapsule/rabbitmq';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Main application module for the Notification Service.
 */
@Module({
  imports: [
    // Configure parameters with Notification Service schema and factory
    ParametersModule.forService({
      serviceName: 'notification-service',
      schema: notificationServiceSchema,
      configFactory: notificationServiceFactory,
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,
        stripUnknown: true,
      },
    }),
    // Configure RabbitMQ for microservice
    RabbitMQModule.forMicroservice({
      uri:
        process.env.RABBITMQ_URL ||
        'amqp://usecapsule:usecapsule_dev_password@localhost:7010',
      serviceName: 'notification-service',
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

## Step 3: Add Required Message Handlers

### 3.1 Define Routing Keys

Add your service's routing keys to the shared messaging constants:

```typescript
// libs/shared/messaging/src/lib/constants.ts

/**
 * Notification service routing keys for command operations.
 * All notification service commands use the capsule.commands exchange.
 */
export const NOTIFICATION_ROUTING_KEYS = {
  // Health and Status
  HEALTH: 'notification.health',
  STATUS: 'notification.status',

  // Email Operations
  SEND_EMAIL: 'notification.send-email',
  SEND_BULK_EMAIL: 'notification.send-bulk-email',

  // SMS Operations
  SEND_SMS: 'notification.send-sms',
  SEND_BULK_SMS: 'notification.send-bulk-sms',

  // Push Notifications
  SEND_PUSH: 'notification.send-push',
  SEND_BULK_PUSH: 'notification.send-bulk-push',

  // Template Management
  CREATE_TEMPLATE: 'notification.create-template',
  UPDATE_TEMPLATE: 'notification.update-template',
  DELETE_TEMPLATE: 'notification.delete-template',
  GET_TEMPLATE: 'notification.get-template',
} as const;
```

### 3.2 Implement Health Check Handler (REQUIRED)

Every service MUST implement a health check handler:

```typescript
// apps/notification-service/src/app/app.controller.ts
import { Controller } from '@nestjs/common';
import { EXCHANGES, NOTIFICATION_ROUTING_KEYS } from '@usecapsule/messaging';
import { RabbitRPC } from '@usecapsule/rabbitmq';
import type { HealthCheckResponse } from '@usecapsule/types';

import type { AppService } from './app.service';

/**
 * Main application controller for the Notification Service.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check RPC handler for RabbitMQ monitoring.
   *
   * This handler responds to RPC calls with routing key from NOTIFICATION_ROUTING_KEYS.HEALTH,
   * allowing the system to verify that the notification-service is running
   * and responding to messages properly.
   *
   * @returns Service health status
   */
  @RabbitRPC({
    exchange: EXCHANGES.COMMANDS,
    routingKey: NOTIFICATION_ROUTING_KEYS.HEALTH,
  })
  healthCheck(): HealthCheckResponse {
    return this.appService.getHealthStatus();
  }

  /**
   * Send email notification handler.
   *
   * Handles email sending requests from other services.
   */
  @RabbitRPC({
    exchange: EXCHANGES.COMMANDS,
    routingKey: NOTIFICATION_ROUTING_KEYS.SEND_EMAIL,
  })
  async sendEmail(@RabbitPayload() emailRequest: SendEmailRequest): Promise<SendEmailResponse> {
    return this.appService.sendEmail(emailRequest);
  }
}
```

### 3.3 Implement Service Logic

Update the app service with health check implementation:

```typescript
// apps/notification-service/src/app/app.service.ts
import { Injectable, Logger } from '@nestjs/common';
import type { HealthCheckResponse } from '@usecapsule/types';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  /**
   * Returns the health status of the notification service.
   */
  getHealthStatus(): HealthCheckResponse {
    return {
      status: 'healthy',
      service: 'notification-service',
      timestamp: new Date().toISOString(),
      version: process.env.SERVICE_VERSION || '1.0.0',
      dependencies: {
        database: 'healthy', // Update based on actual health checks
        rabbitmq: 'healthy',
        emailProvider: 'healthy',
      },
    };
  }

  /**
   * Send email notification.
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.logger.log(`Sending email to ${request.to}: ${request.subject}`);

    // Implement actual email sending logic here

    return {
      success: true,
      messageId: 'email-123',
      timestamp: new Date().toISOString(),
    };
  }
}
```

## Step 4: Add Database Configuration

### 4.1 Add Database Service to Docker Compose

Add your service's database to `compose.yml`:

```yaml
# compose.yml
services:
  # ... existing services

  notification-db:
    container_name: notification_db_dev
    image: postgres:15
    environment:
      POSTGRES_USER: notification_user
      POSTGRES_PASSWORD: notification_pass
      POSTGRES_DB: notification_service_db
    ports:
      - '7140:5432'  # Use next available port
    volumes:
      - notification_db_data:/var/lib/postgresql/data
      - ./devtools/infra/postgres/init-scripts:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U notification_user -d notification_service_db']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  # ... existing volumes
  notification_db_data:
```

### 4.2 Add Database Migrations

Create migration scripts for your service:

```bash
# Create migrations directory
mkdir -p apps/notification-service/migrations

# Create initial migration
cat > apps/notification-service/migrations/V1__create_notifications_tables.sql << 'EOF'
-- Notification Service Database Schema
-- Initial migration for notification service tables

-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    type VARCHAR(50) NOT NULL, -- email, sms, push
    subject VARCHAR(255),
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, sent, failed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Create notification templates table
CREATE TABLE notification_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    subject_template VARCHAR(255),
    content_template TEXT NOT NULL,
    variables JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notification_templates_type ON notification_templates(type);

-- Create updated_at trigger for templates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EOF
```

### 4.3 Add Database Configuration Scripts

Update package.json to include migration scripts:

```json
{
  "scripts": {
    "db:migrate:notification": "flyway -url=jdbc:postgresql://localhost:7140/notification_service_db -user=notification_user -password=notification_pass -locations=filesystem:apps/notification-service/migrations migrate"
  }
}
```

## Step 5: Event Publishing and Subscription

### 5.1 Publishing Domain Events

Implement event publishing for domain events:

```typescript
// apps/notification-service/src/app/app.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@usecapsule/rabbitmq';
import { EXCHANGES, EVENT_ROUTING_KEYS } from '@usecapsule/messaging';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    this.logger.log(`Sending email to ${request.to}: ${request.subject}`);

    try {
      // Send email logic here
      const result = await this.emailProvider.send(request);

      // Publish email sent event
      await this.amqpConnection.publish(
        EXCHANGES.EVENTS,
        'notification.email.sent',
        {
          notificationId: result.messageId,
          userId: request.userId,
          type: 'email',
          subject: request.subject,
          sentAt: new Date().toISOString(),
        }
      );

      return {
        success: true,
        messageId: result.messageId,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Publish email failed event
      await this.amqpConnection.publish(
        EXCHANGES.EVENTS,
        'notification.email.failed',
        {
          userId: request.userId,
          type: 'email',
          subject: request.subject,
          error: error.message,
          timestamp: new Date().toISOString(),
        }
      );

      throw error;
    }
  }
}
```

### 5.2 Subscribing to Events

Add event subscription handlers:

```typescript
// apps/notification-service/src/app/app.controller.ts
import { RabbitSubscribe } from '@usecapsule/rabbitmq';

@Controller()
export class AppController {
  // ... existing methods

  /**
   * Handle user created events to send welcome emails.
   */
  @RabbitSubscribe({
    exchange: EXCHANGES.EVENTS,
    routingKey: EVENT_ROUTING_KEYS.USER_CREATED,
  })
  async onUserCreated(@RabbitPayload() event: UserCreatedEvent): Promise<void> {
    this.logger.log(`Sending welcome email to new user: ${event.email}`);

    await this.appService.sendWelcomeEmail({
      userId: event.userId,
      email: event.email,
      name: event.name,
    });
  }

  /**
   * Handle payment processed events to send receipts.
   */
  @RabbitSubscribe({
    exchange: EXCHANGES.EVENTS,
    routingKey: EVENT_ROUTING_KEYS.PAYMENT_PROCESSED,
  })
  async onPaymentProcessed(@RabbitPayload() event: PaymentProcessedEvent): Promise<void> {
    this.logger.log(`Sending payment receipt for payment: ${event.paymentId}`);

    await this.appService.sendPaymentReceipt(event);
  }
}
```

## Step 6: Domain-Driven Design Implementation

### 6.1 Create Domain Structure

Organize your service using DDD patterns:

```text
apps/notification-service/src/
├── app/
│   ├── app.controller.ts         # Message handlers
│   ├── app.module.ts            # Module configuration
│   └── app.service.ts           # Application services
├── modules/
│   ├── email/                   # Email bounded context
│   │   ├── commands/            # Write operations
│   │   │   ├── send-email.command.ts
│   │   │   └── send-email.handler.ts
│   │   ├── queries/             # Read operations
│   │   │   ├── get-email-status.query.ts
│   │   │   └── get-email-status.handler.ts
│   │   ├── domain/              # Business entities
│   │   │   ├── email.entity.ts
│   │   │   ├── email.repository.ts
│   │   │   └── value-objects/
│   │   ├── database/            # Infrastructure adapters
│   │   │   └── email.repository.impl.ts
│   │   └── message-handlers/    # RabbitMQ handlers
│   │       └── email.controller.ts
│   ├── sms/                     # SMS bounded context
│   └── templates/               # Template management
├── shared/
│   ├── interfaces/              # Shared interfaces
│   ├── dto/                     # Data transfer objects
│   └── types/                   # Type definitions
└── main.ts
```

### 6.2 Implement Domain Entities

Create domain entities following DDD principles:

```typescript
// apps/notification-service/src/modules/email/domain/email.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export enum EmailStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  BOUNCED = 'bounced',
}

@Entity('emails')
export class Email {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ length: 255 })
  to: string;

  @Column({ length: 255, nullable: true })
  subject?: string;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: EmailStatus,
    default: EmailStatus.PENDING,
  })
  status: EmailStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  sentAt?: Date;

  @Column({ nullable: true })
  errorMessage?: string;

  // Domain methods
  markAsSent(): void {
    this.status = EmailStatus.SENT;
    this.sentAt = new Date();
    this.errorMessage = null;
  }

  markAsFailed(errorMessage: string): void {
    this.status = EmailStatus.FAILED;
    this.errorMessage = errorMessage;
  }

  canRetry(): boolean {
    return this.status === EmailStatus.FAILED || this.status === EmailStatus.PENDING;
  }
}
```

### 6.3 Implement Repository Pattern

Create repository interfaces and implementations:

```typescript
// apps/notification-service/src/modules/email/domain/email.repository.ts
import { Email } from './email.entity';

export interface EmailRepository {
  save(email: Email): Promise<Email>;
  findById(id: string): Promise<Email | null>;
  findByUserId(userId: string): Promise<Email[]>;
  findPendingEmails(): Promise<Email[]>;
  markAsProcessed(id: string, status: EmailStatus, errorMessage?: string): Promise<void>;
}
```

## Step 7: Testing

### 7.1 Unit Tests

Create comprehensive unit tests:

```typescript
// apps/notification-service/src/app/app.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service';
import { AmqpConnection } from '@usecapsule/rabbitmq';

describe('AppService', () => {
  let service: AppService;
  let amqpConnection: jest.Mocked<AmqpConnection>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        {
          provide: AmqpConnection,
          useValue: {
            publish: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AppService>(AppService);
    amqpConnection = module.get(AmqpConnection);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHealthStatus', () => {
    it('should return healthy status', () => {
      const result = service.getHealthStatus();

      expect(result.status).toBe('healthy');
      expect(result.service).toBe('notification-service');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('sendEmail', () => {
    it('should send email and publish event', async () => {
      const request = {
        userId: 'user-123',
        to: 'test@example.com',
        subject: 'Test Email',
        content: 'Test content',
      };

      const result = await service.sendEmail(request);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(amqpConnection.publish).toHaveBeenCalledWith(
        'capsule.events',
        'notification.email.sent',
        expect.objectContaining({
          userId: request.userId,
          type: 'email',
          subject: request.subject,
        })
      );
    });
  });
});
```

### 7.2 Integration Tests

Create integration tests for message handlers:

```typescript
// apps/notification-service/src/app/app.controller.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController Integration', () => {
  let app: TestingModule;
  let controller: AppController;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    controller = app.get<AppController>(AppController);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('healthCheck', () => {
    it('should return health status', () => {
      const result = controller.healthCheck();

      expect(result).toEqual({
        status: 'healthy',
        service: 'notification-service',
        timestamp: expect.any(String),
        version: expect.any(String),
        dependencies: expect.any(Object),
      });
    });
  });
});
```

## Step 8: Service Registration and Discovery

### 8.1 Register with API Gateway

Add service endpoints to the API Gateway:

```typescript
// apps/api-gateway/src/modules/notifications/notifications.service.ts
import { Injectable } from '@nestjs/common';
import { AmqpConnection } from '@usecapsule/rabbitmq';
import { EXCHANGES, NOTIFICATION_ROUTING_KEYS } from '@usecapsule/messaging';

@Injectable()
export class NotificationsService {
  constructor(private readonly amqpConnection: AmqpConnection) {}

  async sendEmail(emailRequest: SendEmailRequest): Promise<SendEmailResponse> {
    return this.amqpConnection.request({
      exchange: EXCHANGES.COMMANDS,
      routingKey: NOTIFICATION_ROUTING_KEYS.SEND_EMAIL,
      payload: emailRequest,
      timeout: 10000,
    });
  }

  async getNotificationStatus(notificationId: string): Promise<NotificationStatusResponse> {
    return this.amqpConnection.request({
      exchange: EXCHANGES.COMMANDS,
      routingKey: NOTIFICATION_ROUTING_KEYS.GET_STATUS,
      payload: { notificationId },
      timeout: 5000,
    });
  }
}
```

### 8.2 Add HTTP Endpoints

Create REST API endpoints in the API Gateway:

```typescript
// apps/api-gateway/src/modules/notifications/notifications.controller.ts
import { Controller, Post, Get, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('email')
  @ApiOperation({ summary: 'Send email notification' })
  @ApiResponse({ status: 200, description: 'Email sent successfully' })
  async sendEmail(@Body() emailRequest: SendEmailRequest): Promise<SendEmailResponse> {
    return this.notificationsService.sendEmail(emailRequest);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get notification status' })
  @ApiResponse({ status: 200, description: 'Notification status retrieved' })
  async getStatus(@Param('id') id: string): Promise<NotificationStatusResponse> {
    return this.notificationsService.getNotificationStatus(id);
  }
}
```

## Step 9: Development and Testing

### 9.1 Start the Service

Build and run your new service:

```bash
# Build the service
nx build notification-service

# Start in development mode
nx serve notification-service --watch

# Or run all services
npm run dev
```

### 9.2 Test Health Check

Verify the service is responding to health checks:

```bash
# Via API Gateway
curl http://localhost:3000/health

# Direct RabbitMQ test (via Management UI)
# 1. Go to http://localhost:7020
# 2. Navigate to Queues → notification_queue → Publish Message
# 3. Routing Key: notification.health
# 4. Payload: {}
```

### 9.3 Test Message Handlers

Test your service's message handlers:

```bash
# Test via API Gateway
curl -X POST http://localhost:3000/notifications/email \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "to": "test@example.com",
    "subject": "Test Email",
    "content": "Hello from Capsule Platform!"
  }'
```

## Step 10: Production Readiness

### 10.1 Add Monitoring

Implement comprehensive logging and monitoring:

```typescript
// apps/notification-service/src/app/app.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    const startTime = Date.now();

    this.logger.log(`Starting email send for user: ${request.userId}`);

    try {
      const result = await this.emailProvider.send(request);

      const duration = Date.now() - startTime;
      this.logger.log(`Email sent successfully in ${duration}ms: ${result.messageId}`);

      // Emit metrics
      this.metricsService.incrementCounter('emails_sent_total');
      this.metricsService.recordDuration('email_send_duration', duration);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Email send failed after ${duration}ms: ${error.message}`);

      this.metricsService.incrementCounter('emails_failed_total');

      throw error;
    }
  }
}
```

### 10.2 Add Configuration Validation

Use the parameters library for configuration management:

```typescript
// libs/configs/src/lib/notification-service.config.ts
import { z } from 'zod';

export const notificationServiceSchema = z.object({
  // Database configuration
  NOTIFICATION_DB_HOST: z.string().default('localhost'),
  NOTIFICATION_DB_PORT: z.coerce.number().default(7140),
  NOTIFICATION_DB_NAME: z.string().default('notification_service_db'),
  NOTIFICATION_DB_USER: z.string().default('notification_user'),
  NOTIFICATION_DB_PASSWORD: z.string(),

  // Service configuration
  NOTIFICATION_SERVICE_PORT: z.coerce.number().default(3004),

  // Email provider configuration
  EMAIL_PROVIDER: z.enum(['sendgrid', 'mailgun', 'ses']).default('sendgrid'),
  EMAIL_API_KEY: z.string(),
  EMAIL_FROM_ADDRESS: z.string().email(),

  // SMS provider configuration
  SMS_PROVIDER: z.enum(['twilio', 'aws-sns']).default('twilio'),
  SMS_API_KEY: z.string().optional(),
  SMS_ACCOUNT_SID: z.string().optional(),

  // Redis configuration for rate limiting
  REDIS_URL: z.string().optional(),
});

export type NotificationServiceConfig = z.infer<typeof notificationServiceSchema>;

export const notificationServiceFactory = (
  config: NotificationServiceConfig
): NotificationServiceConfig => config;
```

### 10.3 Add Database Migrations

Set up proper database migration management:

```bash
# Create additional migrations as needed
cat > apps/notification-service/migrations/V2__add_rate_limiting.sql << 'EOF'
-- Add rate limiting tables
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(user_id, notification_type, window_start)
);

CREATE INDEX idx_rate_limits_user_type ON rate_limits(user_id, notification_type);
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);
EOF
```

### 10.4 Add Error Handling

Implement comprehensive error handling:

```typescript
// apps/notification-service/src/shared/exceptions/notification.exceptions.ts
export class NotificationException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = 'NotificationException';
  }
}

export class EmailDeliveryException extends NotificationException {
  constructor(message: string, public readonly emailAddress: string) {
    super(message, 'EMAIL_DELIVERY_FAILED', 422);
  }
}

export class RateLimitExceededException extends NotificationException {
  constructor(public readonly userId: string, public readonly resetTime: Date) {
    super('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED', 429);
  }
}
```

## Best Practices Summary

### Architecture

- **Follow DDD principles**: Organize code by domain, not by technical layers
- **Use message-only communication**: Never implement HTTP endpoints between services
- **Implement health checks**: Every service must respond to health check messages
- **Use exchange-based routing**: Always route through RabbitMQ exchanges

### Code Quality

- **Write comprehensive tests**: Unit, integration, and end-to-end tests
- **Use TypeScript strictly**: Enable strict mode and use proper types
- **Follow naming conventions**: Use consistent naming for routing keys and handlers
- **Document message contracts**: Clearly document all message payloads

### Monitoring & Operations

- **Implement structured logging**: Use consistent log formats across services
- **Add metrics collection**: Track performance and business metrics
- **Handle errors gracefully**: Implement proper error handling and recovery
- **Use circuit breakers**: Protect against cascading failures

### Security

- **Validate all inputs**: Use Zod schemas for validation
- **Implement rate limiting**: Protect against abuse
- **Use secure configurations**: Never hardcode secrets
- **Audit sensitive operations**: Log all security-relevant actions

This completes the comprehensive service development guide. Each new service should follow these patterns to ensure consistency and reliability across the Capsule Platform.
