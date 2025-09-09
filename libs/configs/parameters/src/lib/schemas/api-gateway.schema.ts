import { z } from 'zod';

export const apiGatewaySchema = z.object({
  // The allowed values for NODE_ENV are production , development and test
  NODE_ENV: z.string()
    .valid('test', 'development', 'production')
    .default('development'),
  APP_ENV

  SERVICE_NAME: Joi.string().valid('api-gateway').required(),
  SERVICE_PORT: Joi.number().default(3000),

  // RabbitMQ - para proxy para outros serviços
  RABBITMQ_URL: Joi.string().uri().required(),

  // JWT - para validação de tokens
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('15m'),

  // Rate Limiting
  RATE_LIMIT_TTL: Joi.number().default(60),
  RATE_LIMIT_MAX: Joi.number().default(100),

  // CORS
  CORS_ENABLED: Joi.boolean().default(true),
  CORS_ORIGINS: Joi.string().default('*'),

  // Logging
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info'),
}).unknown(false); // Rejeita envs não definidas!
