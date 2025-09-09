import { Interceptor } from 'slonik';

import { Environment } from '@usecapsule/types';
import { loggingInterceptor } from './logging.interceptor';

export function createInterceptors(
  environment: Environment,
): readonly Interceptor[] {
  return [
    // Add your custom interceptors here
    loggingInterceptor(environment),
  ];
}
