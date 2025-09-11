import { Module } from '@nestjs/common';
import {
  deployServiceFactory,
  deployServiceSchema,
  ParametersModule,
} from '@usecapsule/parameters';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Main application module for the Deploy Service.
 *
 * This module configures the Deploy Service with type-safe configuration management
 * using the parameters library. It sets up:
 * - Environment variable validation using Zod schemas
 * - Service-specific configuration filtering
 * - Global ConfigService for dependency injection
 * - Kubernetes and container registry configurations
 * - Database connection parameters
 *
 * The ParametersModule integration provides:
 * - Automatic environment variable loading and filtering
 * - Schema-based validation at startup
 * - Type-safe configuration access throughout the service
 * - Comprehensive error handling for configuration issues
 *
 * @example
 * ```typescript
 * // In other services/controllers
 * constructor(private configService: ConfigService<DeployServiceSchema>) {
 *   const dbHost = this.configService.get('DEPLOY_DB_HOST', { infer: true });
 *   const k8sUrl = this.configService.get('KUBERNETES_API_URL', { infer: true });
 *   const registryUrl = this.configService.get('REGISTRY_URL', { infer: true });
 * }
 * ```
 */
@Module({
  imports: [
    // Configure parameters with Deploy Service schema and factory
    ParametersModule.forService({
      serviceName: 'deploy-service',
      schema: deployServiceSchema,
      configFactory: deployServiceFactory,
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,
        stripUnknown: true,
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
