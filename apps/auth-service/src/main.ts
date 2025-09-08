import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('AuthService');

  // Create microservice instead of HTTP app
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [
          process.env.RABBITMQ_URL ||
            'amqp://usecapsule:usecapsule_dev_password@localhost:5672',
        ],
        queue: 'auth_service_queue',
        queueOptions: {
          durable: true,
        },
      },
    },
  );

  await app.listen();
  logger.log('🔐 Auth Service is listening for messages via RabbitMQ');
}

bootstrap().catch((error) => {
  console.error('Failed to start auth service:', error);
  process.exit(1);
});
