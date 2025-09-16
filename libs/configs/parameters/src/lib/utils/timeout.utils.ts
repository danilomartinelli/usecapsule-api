import type { TimeoutConfig, ServiceName } from '../schemas/timeout.schema';
import { ServiceTier } from '../schemas/timeout.schema';
import { SERVICE_TIMEOUT_MAPPING } from '../schemas/timeout.schema';

/**
 * Timeout utility functions for runtime timeout resolution and scaling.
 *
 * This module provides utilities for:
 * - Resolving service-specific timeouts
 * - Applying environment-based scaling
 * - Calculating timeouts based on service tiers
 * - Providing fallback mechanisms for timeout configuration
 */

/**
 * Application environment enumeration for timeout scaling.
 */
export enum AppEnvironment {
  TEST = 'test',
  LOCAL = 'local',
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
  CANARY = 'canary',
}

/**
 * Timeout operation types for different use cases.
 */
export enum TimeoutOperation {
  RPC_CALL = 'rpc_call',
  HEALTH_CHECK = 'health_check',
  DATABASE_QUERY = 'database_query',
  HTTP_REQUEST = 'http_request',
  EVENT_PUBLISH = 'event_publish',
}

/**
 * Timeout resolution result with metadata.
 */
export interface TimeoutResolution {
  /** Final timeout value in milliseconds */
  timeout: number;
  /** Source of the timeout value */
  source: 'specific' | 'tier' | 'default' | 'fallback';
  /** Service tier classification */
  tier: ServiceTier;
  /** Whether scaling was applied */
  scaled: boolean;
  /** Scale factor used (if any) */
  scaleFactor?: number;
  /** Original timeout before scaling */
  originalTimeout?: number;
}

/**
 * Timeout resolver class for service-specific timeout resolution.
 */
export class TimeoutResolver {
  private readonly config: TimeoutConfig;
  private readonly currentEnv: AppEnvironment;

  constructor(config: TimeoutConfig, environment?: string) {
    this.config = config;
    this.currentEnv = this.parseEnvironment(environment);
  }

  /**
   * Resolves timeout for a specific service and operation.
   *
   * @param serviceName - Target service name
   * @param operation - Type of operation
   * @returns Timeout resolution with metadata
   *
   * @example
   * ```typescript
   * const resolver = new TimeoutResolver(config);
   * const result = resolver.resolveTimeout('auth-service', TimeoutOperation.RPC_CALL);
   * console.log(`Using ${result.timeout}ms timeout from ${result.source}`);
   * ```
   */
  resolveTimeout(
    serviceName: ServiceName | string,
    operation: TimeoutOperation = TimeoutOperation.RPC_CALL,
  ): TimeoutResolution {
    let timeout: number;
    let source: TimeoutResolution['source'];
    let tier: ServiceTier;

    // Determine service tier and timeout
    if (serviceName in SERVICE_TIMEOUT_MAPPING) {
      const serviceConfig = SERVICE_TIMEOUT_MAPPING[serviceName as ServiceName];
      tier = serviceConfig.tier;

      // Try service-specific timeout first
      const specificTimeoutKey = serviceConfig.specific as keyof TimeoutConfig;
      if (operation === TimeoutOperation.HEALTH_CHECK) {
        timeout = this.config[
          serviceConfig.healthCheck as keyof TimeoutConfig
        ] as number;
        source = 'specific';
      } else if (specificTimeoutKey in this.config) {
        timeout = this.config[specificTimeoutKey] as number;
        source = 'specific';
      } else {
        timeout = this.getTierTimeout(tier);
        source = 'tier';
      }
    } else {
      // Unknown service - use default timeout
      tier = ServiceTier.STANDARD;
      timeout = this.getOperationTimeout(operation);
      source = 'default';
    }

    const originalTimeout = timeout;

    // Apply environment-based scaling
    const scaleFactor = this.getScaleFactor();
    let scaled = false;

    if (this.config.ENABLE_TIMEOUT_SCALING && scaleFactor !== 1.0) {
      timeout = Math.round(timeout * scaleFactor);
      scaled = true;
    }

    return {
      timeout: Math.max(timeout, 500), // Minimum 500ms timeout
      source,
      tier,
      scaled,
      scaleFactor: scaled ? scaleFactor : undefined,
      originalTimeout: scaled ? originalTimeout : undefined,
    };
  }

  /**
   * Gets timeout for a service tier.
   *
   * @param tier - Service tier
   * @returns Timeout in milliseconds
   */
  private getTierTimeout(tier: ServiceTier): number {
    switch (tier) {
      case ServiceTier.CRITICAL:
        return this.config.CRITICAL_SERVICE_TIMEOUT;
      case ServiceTier.STANDARD:
        return this.config.STANDARD_SERVICE_TIMEOUT;
      case ServiceTier.NON_CRITICAL:
        return this.config.NON_CRITICAL_SERVICE_TIMEOUT;
      default:
        return this.config.RABBITMQ_DEFAULT_TIMEOUT;
    }
  }

  /**
   * Gets timeout for an operation type.
   *
   * @param operation - Operation type
   * @returns Timeout in milliseconds
   */
  private getOperationTimeout(operation: TimeoutOperation): number {
    switch (operation) {
      case TimeoutOperation.HEALTH_CHECK:
        return this.config.HEALTH_CHECK_TIMEOUT;
      case TimeoutOperation.DATABASE_QUERY:
        return this.config.DATABASE_OPERATION_TIMEOUT;
      case TimeoutOperation.HTTP_REQUEST:
        return this.config.HTTP_REQUEST_TIMEOUT;
      case TimeoutOperation.RPC_CALL:
      case TimeoutOperation.EVENT_PUBLISH:
      default:
        return this.config.RABBITMQ_DEFAULT_TIMEOUT;
    }
  }

  /**
   * Gets environment-specific scaling factor.
   *
   * @returns Scale factor
   */
  private getScaleFactor(): number {
    switch (this.currentEnv) {
      case AppEnvironment.PRODUCTION:
      case AppEnvironment.STAGING:
      case AppEnvironment.CANARY:
        return this.config.PRODUCTION_TIMEOUT_SCALE_FACTOR;
      case AppEnvironment.DEVELOPMENT:
      case AppEnvironment.LOCAL:
        return this.config.DEVELOPMENT_TIMEOUT_SCALE_FACTOR;
      case AppEnvironment.TEST:
        return 0.5; // Faster timeouts for tests
      default:
        return 1.0;
    }
  }

  /**
   * Parses environment string to AppEnvironment enum.
   *
   * @param environment - Environment string
   * @returns AppEnvironment enum value
   */
  private parseEnvironment(environment?: string): AppEnvironment {
    if (!environment) {
      return AppEnvironment.DEVELOPMENT;
    }

    const env = environment.toLowerCase();
    switch (env) {
      case 'test':
        return AppEnvironment.TEST;
      case 'local':
        return AppEnvironment.LOCAL;
      case 'development':
      case 'dev':
        return AppEnvironment.DEVELOPMENT;
      case 'staging':
      case 'stage':
        return AppEnvironment.STAGING;
      case 'production':
      case 'prod':
        return AppEnvironment.PRODUCTION;
      case 'canary':
        return AppEnvironment.CANARY;
      default:
        return AppEnvironment.DEVELOPMENT;
    }
  }

  /**
   * Creates a timeout resolver with default configuration.
   *
   * @param config - Timeout configuration
   * @param environment - Current environment
   * @returns Timeout resolver instance
   */
  static create(config: TimeoutConfig, environment?: string): TimeoutResolver {
    return new TimeoutResolver(config, environment);
  }

  /**
   * Gets all configured timeouts for debugging purposes.
   *
   * @returns Object with all configured timeouts and their sources
   */
  getDebugInfo(): Record<string, unknown> {
    const services = Object.keys(SERVICE_TIMEOUT_MAPPING) as ServiceName[];
    const timeouts: Record<string, unknown> = {};

    for (const service of services) {
      const resolution = this.resolveTimeout(service);
      timeouts[service] = {
        rpc: resolution,
        healthCheck: this.resolveTimeout(
          service,
          TimeoutOperation.HEALTH_CHECK,
        ),
      };
    }

    return {
      environment: this.currentEnv,
      scalingEnabled: this.config.ENABLE_TIMEOUT_SCALING,
      scaleFactor: this.getScaleFactor(),
      services: timeouts,
      defaults: {
        rabbitmq: this.config.RABBITMQ_DEFAULT_TIMEOUT,
        healthCheck: this.config.HEALTH_CHECK_TIMEOUT,
        database: this.config.DATABASE_OPERATION_TIMEOUT,
        http: this.config.HTTP_REQUEST_TIMEOUT,
      },
    };
  }
}

/**
 * Creates a timeout resolver with configuration.
 *
 * @param config - Timeout configuration
 * @param environment - Current environment
 * @returns Timeout resolver instance
 */
export function createTimeoutResolver(
  config: TimeoutConfig,
  environment?: string,
): TimeoutResolver {
  return TimeoutResolver.create(config, environment);
}

/**
 * Quick timeout resolution function for simple use cases.
 *
 * @param config - Timeout configuration
 * @param serviceName - Target service name
 * @param operation - Operation type
 * @param environment - Current environment
 * @returns Timeout in milliseconds
 *
 * @example
 * ```typescript
 * const timeout = resolveTimeout(config, 'auth-service', TimeoutOperation.RPC_CALL);
 * ```
 */
export function resolveTimeout(
  config: TimeoutConfig,
  serviceName: ServiceName | string,
  operation: TimeoutOperation = TimeoutOperation.RPC_CALL,
  environment?: string,
): number {
  const resolver = new TimeoutResolver(config, environment);
  return resolver.resolveTimeout(serviceName, operation).timeout;
}
