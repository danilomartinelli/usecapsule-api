module.exports = {
  displayName: 'E2E Tests',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '../..',
  testRegex: 'test/e2e/.*\\.e2e\\.spec\\.ts$',
  setupFiles: ['<rootDir>/test/setup-reflect-metadata.js'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: {
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
      },
    ],
  },
  // Transform ESM modules
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|@golevelup/nestjs-rabbitmq)/)',
  ],
  // Module name mapping for workspace libraries
  moduleNameMapper: {
    '^@usecapsule/types$': '<rootDir>/libs/shared/types/src/index.ts',
    '^@usecapsule/utils$': '<rootDir>/libs/shared/utils/src/index.ts',
    '^@usecapsule/rabbitmq$': '<rootDir>/libs/configs/rabbitmq/src/index.ts',
    '^@usecapsule/parameters$': '<rootDir>/libs/configs/parameters/src/index.ts',
    '^@usecapsule/database$': '<rootDir>/libs/shared/database/src/index.ts',
    '^@usecapsule/messaging$': '<rootDir>/libs/shared/messaging/src/index.ts',
    '^@usecapsule/decorators$': '<rootDir>/libs/shared/decorators/src/index.ts',
    '^@usecapsule/exceptions$': '<rootDir>/libs/shared/exceptions/src/index.ts',
    '^@usecapsule/observability$': '<rootDir>/libs/shared/observability/src/index.ts',
    '^@usecapsule/testing$': '<rootDir>/libs/shared/testing/src/index.ts',
    '^@usecapsule/ddd$': '<rootDir>/libs/shared/ddd/src/index.ts',
    // Map uuid to CommonJS version for Jest
    '^uuid$': '<rootDir>/node_modules/uuid/dist/index.js',
  },
  collectCoverageFrom: [
    'apps/**/*.ts',
    'libs/**/*.ts',
    '!**/*.d.ts',
    '!**/index.ts',
    '!**/main.ts',
    '!**/*.spec.ts',
    '!**/*.integration.spec.ts',
    '!**/*.e2e.spec.ts',
  ],
  coverageDirectory: 'coverage/e2e',
  setupFilesAfterEnv: [
    '<rootDir>/test/setup.ts',
  ],
  testTimeout: 60000, // 60 seconds for E2E tests
  maxWorkers: 2, // Limit concurrent E2E tests
};