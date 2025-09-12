/* eslint-disable */
export default {
  displayName: '@usecapsule/testing',
  preset: '../../../jest.preset.js',
  setupFiles: ['<rootDir>/../../../test/setup-reflect-metadata.js'],
  setupFilesAfterEnv: ['<rootDir>/../../../test/setup-jest-matchers.ts'],
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/shared/testing',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
};