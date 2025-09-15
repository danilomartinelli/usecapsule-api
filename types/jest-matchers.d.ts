/// <reference types="jest" />

declare global {
  namespace jest {
    interface Matchers<R> {
      /**
       * Validates that the received object is a valid health response with required fields
       */
      toHaveValidHealthResponse(): R;

      /**
       * Validates that the received object is a valid aggregated health response
       */
      toHaveValidAggregatedHealthResponse(): R;

      /**
       * Asserts that the health response has a status of 'healthy'
       */
      toBeHealthy(): R;

      /**
       * Asserts that the health response has a status of 'unhealthy'
       */
      toBeUnhealthy(): R;

      /**
       * Asserts that the health response has a status of 'degraded'
       */
      toBeDegraded(): R;

      /**
       * Validates that the received message matches the expected pattern
       */
      toMatchMessagePattern(pattern: any): R;
    }
  }
}

export {};