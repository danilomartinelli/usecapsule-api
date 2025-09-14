import type { ServiceName, TimeoutOperation } from '@usecapsule/parameters';

/**
 * Circuit breaker state enumeration
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Circuit breaker configuration options
 */
export interface CircuitBreakerConfig {
  /** Timeout in milliseconds for individual operations */
  timeout: number;
  /** Error threshold percentage (0-100) to trip the breaker */
  errorThresholdPercentage: number;
  /** Time in milliseconds to wait before attempting to close the breaker */
  resetTimeout: number;
  /** Minimum number of requests in rolling window before statistics matter */
  volumeThreshold: number;
  /** Rolling window time period in milliseconds */
  rollingCountTimeout: number;
  /** Number of buckets in the rolling window */
  rollingCountBuckets: number;
  /** Enable performance monitoring */
  enableMonitoring: boolean;
  /** Custom fallback function */
  fallback?: (...args: any[]) => any;
  /** Custom error filter function */
  errorFilter?: (error: any) => boolean;
}

/**
 * Circuit breaker metrics for monitoring
 */
export interface CircuitBreakerMetrics {
  /** Current state of the circuit breaker */
  state: CircuitBreakerState;
  /** Total number of requests */
  requestCount: number;
  /** Total number of successful requests */
  successCount: number;
  /** Total number of failed requests */
  failureCount: number;
  /** Total number of rejected requests (when open) */
  rejectionCount: number;
  /** Current error percentage */
  errorPercentage: number;
  /** Average response time in milliseconds */
  averageResponseTime: number;
  /** Last error that caused a failure */
  lastError?: string;
  /** Timestamp of last state change */
  lastStateChange: number;
  /** Time remaining until next reset attempt (when open) */
  timeToReset?: number;
}

/**
 * Health status for circuit breaker
 */
export interface CircuitBreakerHealth {
  /** Service name */
  service: string;
  /** Current circuit breaker state */
  state: CircuitBreakerState;
  /** Health status based on state and error rate */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** Current metrics */
  metrics: CircuitBreakerMetrics;
  /** Timestamp of health check */
  timestamp: string;
}

/**
 * Circuit breaker options for service-specific configuration
 */
export interface ServiceCircuitBreakerOptions {
  /** Service name */
  serviceName: ServiceName | string;
  /** Operation type */
  operation?: TimeoutOperation;
  /** Custom circuit breaker configuration */
  config?: Partial<CircuitBreakerConfig>;
  /** Enable/disable circuit breaker for this service */
  enabled?: boolean;
}

/**
 * Result from circuit breaker protected operation
 */
export interface CircuitBreakerResult<T = any> {
  /** Result data */
  data: T;
  /** Whether the operation was successful */
  success: boolean;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Circuit breaker state during execution */
  circuitState: CircuitBreakerState;
  /** Whether the result came from fallback */
  fromFallback: boolean;
  /** Error information if failed */
  error?: string;
}

/**
 * Circuit breaker recovery strategy configuration
 */
export interface RecoveryStrategy {
  /** Strategy type */
  type: 'exponential_backoff' | 'linear_backoff' | 'immediate' | 'custom';
  /** Base delay in milliseconds */
  baseDelay: number;
  /** Maximum delay in milliseconds */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  multiplier: number;
  /** Maximum number of recovery attempts */
  maxAttempts: number;
  /** Custom recovery function */
  customRecovery?: () => Promise<boolean>;
}

/**
 * Global circuit breaker configuration
 */
export interface GlobalCircuitBreakerConfig {
  /** Global enable/disable flag */
  enabled: boolean;
  /** Default configuration for all services */
  defaults: CircuitBreakerConfig;
  /** Service-specific configurations */
  services: Record<string, Partial<CircuitBreakerConfig>>;
  /** Recovery strategies by service */
  recoveryStrategies: Record<string, RecoveryStrategy>;
  /** Monitoring configuration */
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    alertThreshold: number;
  };
}
