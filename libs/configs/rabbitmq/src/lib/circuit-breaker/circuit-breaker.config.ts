import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ServiceName } from '@usecapsule/parameters';
import { TimeoutOperation } from '@usecapsule/parameters';
import type {
  CircuitBreakerConfig,
  GlobalCircuitBreakerConfig,
  RecoveryStrategy,
} from './circuit-breaker.types';

/**
 * Circuit breaker configuration service that provides intelligent defaults
 * based on service characteristics and environment settings.
 */
@Injectable()
export class CircuitBreakerConfigService {
  private readonly config: GlobalCircuitBreakerConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.buildConfiguration();
  }

  /**
   * Get circuit breaker configuration for a specific service.
   */
  getServiceConfig(
    serviceName: ServiceName | string,
    operation?: TimeoutOperation,
  ): CircuitBreakerConfig {
    const serviceKey = this.normalizeServiceName(serviceName);
    const serviceConfig = this.config.services[serviceKey] || {};
    const operationConfig = this.getOperationSpecificConfig(operation);

    return {
      ...this.config.defaults,
      ...operationConfig,
      ...serviceConfig,
    };
  }

  /**
   * Get recovery strategy for a specific service.
   */
  getRecoveryStrategy(serviceName: ServiceName | string): RecoveryStrategy {
    const serviceKey = this.normalizeServiceName(serviceName);
    return (
      this.config.recoveryStrategies[serviceKey] ||
      this.config.recoveryStrategies.default
    );
  }

  /**
   * Check if circuit breaker is enabled for a service.
   */
  isEnabled(serviceName?: ServiceName | string): boolean {
    if (!this.config.enabled) return false;
    if (!serviceName) return true;

    const serviceKey = this.normalizeServiceName(serviceName);
    const serviceConfig = this.config.services[serviceKey];
    return serviceConfig?.enabled !== false; // Default to enabled unless explicitly disabled
  }

  /**
   * Get global monitoring configuration.
   */
  getMonitoringConfig() {
    return this.config.monitoring;
  }

  /**
   * Get complete configuration for debugging.
   */
  getDebugInfo(): Record<string, unknown> {
    return {
      globalEnabled: this.config.enabled,
      defaults: this.config.defaults,
      serviceConfigs: Object.keys(this.config.services),
      recoveryStrategies: Object.keys(this.config.recoveryStrategies),
      monitoring: this.config.monitoring,
    };
  }

  /**
   * Build the complete circuit breaker configuration.
   */
  private buildConfiguration(): GlobalCircuitBreakerConfig {
    return {
      enabled:
        this.configService.get('CIRCUIT_BREAKER_ENABLED', 'true') === 'true',
      defaults: this.buildDefaultConfig(),
      services: this.buildServiceConfigs(),
      recoveryStrategies: this.buildRecoveryStrategies(),
      monitoring: {
        enabled:
          this.configService.get('CIRCUIT_BREAKER_MONITORING', 'true') ===
          'true',
        metricsInterval: this.configService.get(
          'CIRCUIT_BREAKER_METRICS_INTERVAL',
          60000,
        ),
        healthCheckInterval: this.configService.get(
          'CIRCUIT_BREAKER_HEALTH_INTERVAL',
          30000,
        ),
        alertThreshold: this.configService.get(
          'CIRCUIT_BREAKER_ALERT_THRESHOLD',
          80,
        ),
      },
    };
  }

  /**
   * Build default circuit breaker configuration.
   */
  private buildDefaultConfig(): CircuitBreakerConfig {
    const baseTimeout = this.configService.get(
      'RABBITMQ_DEFAULT_TIMEOUT',
      5000,
    );

    return {
      timeout: baseTimeout,
      errorThresholdPercentage: this.configService.get(
        'CIRCUIT_BREAKER_ERROR_THRESHOLD',
        50,
      ),
      resetTimeout: this.configService.get(
        'CIRCUIT_BREAKER_RESET_TIMEOUT',
        60000,
      ),
      volumeThreshold: this.configService.get(
        'CIRCUIT_BREAKER_VOLUME_THRESHOLD',
        10,
      ),
      rollingCountTimeout: this.configService.get(
        'CIRCUIT_BREAKER_ROLLING_WINDOW',
        60000,
      ),
      rollingCountBuckets: this.configService.get(
        'CIRCUIT_BREAKER_ROLLING_BUCKETS',
        10,
      ),
      enableMonitoring:
        this.configService.get('CIRCUIT_BREAKER_ENABLE_MONITORING', 'true') ===
        'true',
      errorFilter: (error: unknown) => {
        // Don't count validation errors as circuit breaker failures
        if (
          (error &&
            typeof error === 'object' &&
            'name' in error &&
            error.name === 'ValidationError') ||
          (error &&
            typeof error === 'object' &&
            'statusCode' in error &&
            error.statusCode === 400)
        ) {
          return false;
        }
        // Don't count unauthorized errors
        if (
          error &&
          typeof error === 'object' &&
          'statusCode' in error &&
          (error.statusCode === 401 || error.statusCode === 403)
        ) {
          return false;
        }
        return true;
      },
    };
  }

  /**
   * Build service-specific circuit breaker configurations.
   */
  private buildServiceConfigs(): Record<string, Partial<CircuitBreakerConfig>> {
    return {
      'auth-service': {
        timeout: this.configService.get('AUTH_SERVICE_TIMEOUT', 2000),
        errorThresholdPercentage: 40, // More sensitive for auth failures
        resetTimeout: 30000, // Faster recovery for critical service
        volumeThreshold: 5, // Lower threshold for auth service
      },
      'billing-service': {
        timeout: this.configService.get('BILLING_SERVICE_TIMEOUT', 8000),
        errorThresholdPercentage: 60, // More tolerant for billing operations
        resetTimeout: 120000, // Longer reset for financial operations
        volumeThreshold: 3, // Lower threshold due to critical nature
      },
      'deploy-service': {
        timeout: this.configService.get('DEPLOY_SERVICE_TIMEOUT', 15000),
        errorThresholdPercentage: 70, // Very tolerant for deployment operations
        resetTimeout: 300000, // 5 minutes reset for deployment service
        volumeThreshold: 2, // Very low threshold
      },
      'monitor-service': {
        timeout: this.configService.get('MONITOR_SERVICE_TIMEOUT', 10000),
        errorThresholdPercentage: 80, // Very tolerant for monitoring
        resetTimeout: 180000, // 3 minutes reset
        volumeThreshold: 5,
      },
    };
  }

  /**
   * Build recovery strategies for different services.
   */
  private buildRecoveryStrategies(): Record<string, RecoveryStrategy> {
    return {
      default: {
        type: 'exponential_backoff',
        baseDelay: 1000,
        maxDelay: 60000,
        multiplier: 2,
        maxAttempts: 5,
      },
      'auth-service': {
        type: 'exponential_backoff',
        baseDelay: 500,
        maxDelay: 30000,
        multiplier: 1.5,
        maxAttempts: 3, // Faster recovery attempts for auth
      },
      'billing-service': {
        type: 'linear_backoff',
        baseDelay: 2000,
        maxDelay: 120000,
        multiplier: 1,
        maxAttempts: 3, // Conservative recovery for billing
      },
      'deploy-service': {
        type: 'exponential_backoff',
        baseDelay: 5000,
        maxDelay: 300000, // 5 minutes max delay
        multiplier: 2,
        maxAttempts: 2, // Limited attempts for deployment
      },
      'monitor-service': {
        type: 'immediate',
        baseDelay: 1000,
        maxDelay: 60000,
        multiplier: 1,
        maxAttempts: 10, // Many attempts for monitoring
      },
    };
  }

  /**
   * Get operation-specific configuration adjustments.
   */
  private getOperationSpecificConfig(
    operation?: TimeoutOperation,
  ): Partial<CircuitBreakerConfig> {
    switch (operation) {
      case TimeoutOperation.HEALTH_CHECK:
        return {
          timeout: this.configService.get('HEALTH_CHECK_TIMEOUT', 3000),
          errorThresholdPercentage: 30, // More sensitive for health checks
          resetTimeout: 15000, // Faster reset for health checks
          volumeThreshold: 3,
        };
      case TimeoutOperation.DATABASE_QUERY:
        return {
          timeout: this.configService.get('DATABASE_OPERATION_TIMEOUT', 10000),
          errorThresholdPercentage: 40,
          resetTimeout: 60000,
        };
      case TimeoutOperation.HTTP_REQUEST:
        return {
          timeout: this.configService.get('HTTP_REQUEST_TIMEOUT', 30000),
          errorThresholdPercentage: 60,
          resetTimeout: 90000,
        };
      default:
        return {};
    }
  }

  /**
   * Normalize service name to consistent format.
   */
  private normalizeServiceName(serviceName: ServiceName | string): string {
    if (typeof serviceName !== 'string') {
      return String(serviceName);
    }

    // Convert 'auth.register' -> 'auth-service'
    if (serviceName.includes('.')) {
      const servicePrefix = serviceName.split('.')[0];
      return `${servicePrefix}-service`;
    }

    // Ensure it ends with '-service'
    if (!serviceName.endsWith('-service')) {
      return `${serviceName}-service`;
    }

    return serviceName;
  }
}
