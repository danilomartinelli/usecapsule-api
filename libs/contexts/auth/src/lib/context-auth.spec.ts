import { contextAuth } from './context-auth';

describe('contextAuth', () => {
  it('should work', () => {
    expect(contextAuth()).toEqual('context-auth');
  });
});
