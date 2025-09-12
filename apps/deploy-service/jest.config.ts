/* eslint-disable */
export default {
  displayName: 'deploy-service',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/apps/deploy-service',
  moduleNameMapper: {
    '^@usecapsule/types$': '<rootDir>/../../libs/shared/types/src/index.ts',
    '^@usecapsule/utils$': '<rootDir>/../../libs/shared/utils/src/index.ts',
    '^@usecapsule/rabbitmq$': '<rootDir>/../../libs/configs/rabbitmq/src/index.ts',
    '^@usecapsule/parameters$': '<rootDir>/../../libs/configs/parameters/src/index.ts',
    '^@usecapsule/database$': '<rootDir>/../../libs/shared/database/src/index.ts',
    '^@usecapsule/messaging$': '<rootDir>/../../libs/shared/messaging/src/index.ts',
    '^@usecapsule/decorators$': '<rootDir>/../../libs/shared/decorators/src/index.ts',
    '^@usecapsule/exceptions$': '<rootDir>/../../libs/shared/exceptions/src/index.ts',
    '^@usecapsule/observability$': '<rootDir>/../../libs/shared/observability/src/index.ts',
    '^@usecapsule/testing$': '<rootDir>/../../libs/shared/testing/src/index.ts',
    '^@usecapsule/ddd$': '<rootDir>/../../libs/shared/ddd/src/index.ts',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.integration.spec.ts',
    '!src/**/*.e2e.spec.ts',
    '!src/main.ts',
  ],
};
