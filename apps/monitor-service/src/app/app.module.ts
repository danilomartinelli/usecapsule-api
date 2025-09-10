import { Module } from '@nestjs/common';
import {
  monitorServiceFactory,
  monitorServiceSchema,
  ParametersModule,
} from '@usecapsule/parameters';

import { AppController } from './app.controller';
import { AppService } from './app.service';

/**
 * Main application module for the Monitor Service.
 *
 * This module configures the Monitor Service with type-safe configuration management
 * using the parameters library. It sets up:
 * - Environment variable validation using Zod schemas
 * - Service-specific configuration filtering
 * - Global ConfigService for dependency injection
 * - Prometheus metrics collection configuration
 * - Grafana dashboard integration settings
 * - Alertmanager notification configuration
 * - Database connection parameters
 * - Monitoring thresholds and retention policies
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
 * constructor(private configService: ConfigService<MonitorServiceConfig>) {
 *   const dbHost = this.configService.get('MONITOR_DB_HOST', { infer: true });
 *   const prometheusUrl = this.configService.get('PROMETHEUS_URL', { infer: true });
 *   const alertThreshold = this.configService.get('ALERT_CPU_THRESHOLD_PERCENT', { infer: true });
 * }
 * ```
 */
@Module({
  imports: [
    // Configure parameters with Monitor Service schema and factory
    ParametersModule.forService({
      serviceName: 'monitor-service',
      schema: monitorServiceSchema,
      configFactory: monitorServiceFactory,
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
