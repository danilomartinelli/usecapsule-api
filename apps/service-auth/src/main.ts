import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [
          process.env.RABBITMQ_URL ||
            'amqp://usecapsule:usecapsule_dev_password@localhost:5672',
        ],
        queue: 'auth_queue',
        queueOptions: {
          durable: false,
        },
      },
    }
  );

  Logger.log('🔐 Service Auth iniciado - Comunicação via RabbitMQ');
  Logger.log('📡 Conectado ao RabbitMQ na fila: auth_queue');

  await app.listen();
}

void bootstrap();
