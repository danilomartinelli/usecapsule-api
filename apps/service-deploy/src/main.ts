/**
 * Service Deploy - Comunicação via RabbitMQ
 * Este serviço não expõe porta HTTP, apenas comunicação interna via mensageria
 */

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { AppModule } from './app/app.module';

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
        queue: 'deploy_queue',
        queueOptions: {
          durable: false,
        },
      },
    }
  );

  // Service-deploy não expõe porta HTTP, apenas comunicação via RabbitMQ
  Logger.log('🚀 Service Deploy iniciado - Comunicação via RabbitMQ');
  Logger.log('📡 Conectado ao RabbitMQ na fila: deploy_queue');

  await app.listen();
}

void bootstrap();
