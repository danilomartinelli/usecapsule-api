import { Interceptor } from 'slonik';

import { loggingInterceptor } from './logging.interceptor';

export function createInterceptors(
  environment: 'development' | 'production' | 'test',
): readonly Interceptor[] {
  return [
    // Add your custom interceptors here
    loggingInterceptor(environment),
  ];
}
