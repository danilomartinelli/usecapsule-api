import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CircuitBreakerService } from './circuit-breaker.service';
import { CircuitBreakerConfigService } from './circuit-breaker.config';
import { CircuitBreakerHealthService } from './circuit-breaker-health.service';
import { CircuitBreakerMetricsService } from './circuit-breaker-metrics.service';

/**
 * Circuit breaker module that provides fault tolerance for microservices.
 *
 * This module is global and provides circuit breaker functionality
 * across the entire application.
 */
@Global()
@Module({
  imports: [
    ConfigModule,
    EventEmitterModule.forRoot({
      // Use this instance to emit circuit breaker events
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
  ],
  providers: [
    CircuitBreakerConfigService,
    CircuitBreakerService,
    CircuitBreakerHealthService,
    CircuitBreakerMetricsService,
  ],
  exports: [
    CircuitBreakerService,
    CircuitBreakerConfigService,
    CircuitBreakerHealthService,
    CircuitBreakerMetricsService,
  ],
})
export class CircuitBreakerModule {}
