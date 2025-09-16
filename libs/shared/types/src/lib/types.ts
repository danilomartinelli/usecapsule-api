/**
 * Health check response payload interface.
 * Used by all microservices to provide consistent health status information.
 */
export interface HealthCheckResponse {
  /** Current health status of the service */
  status: HealthStatus;
  /** Name of the service reporting health */
  service?: string;
  /** ISO timestamp when the health check was performed */
  timestamp: string;
  /** Optional additional metadata about service health */
  metadata?: {
    /** Version of the service */
    version?: string;
    /** Error message */
    error?: string;
    /** Memory usage information */
    memory?: {
      used: number;
      total: number;
      unit: 'MB' | 'GB';
    };
    /** Database connection status */
    database?: {
      connected: boolean;
      responseTime?: number;
    };
    /** Queue connection status */
    queue?: {
      name: string;
      connected: boolean;
      responseTime?: number;
    };
  };
}

/**
 * Simple health check response for basic HTTP endpoints.
 */
export interface SimpleHealthResponse {
  /** Service identification message */
  message: string;
}

/**
 * Aggregated health status response for all microservices.
 */
export interface AggregatedHealthResponse {
  /** Overall system health status */
  status: HealthStatus;
  /** Health status of individual services */
  services: Record<string, HealthCheckResponse>;
  /** ISO timestamp when the aggregated check was performed */
  timestamp: string;
}

/**
 * Service information type for identifying microservices.
 */
export type ServiceName =
  | 'api-gateway'
  | 'auth-service'
  | 'billing-service'
  | 'deploy-service'
  | 'monitor-service';

/**
 * Health status enumeration.
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

export function types(): string {
  return 'types';
}
