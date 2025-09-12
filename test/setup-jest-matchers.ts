import { 
  toHaveValidHealthResponse, 
  toBeHealthy, 
  toBeUnhealthy, 
  toBeDegraded 
} from '../libs/shared/testing/src/lib/matchers/health-response.matcher';

// Extend Jest with custom matchers
expect.extend({
  toHaveValidHealthResponse,
  toBeHealthy,
  toBeUnhealthy,
  toBeDegraded,
});