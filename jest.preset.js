const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.base.json');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/../../test/setup-reflect-metadata.js'],
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
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
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!src/**/*.e2e.spec.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'text', 'text-summary', 'cobertura', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  testTimeout: 30000,
  maxWorkers: '50%',
};