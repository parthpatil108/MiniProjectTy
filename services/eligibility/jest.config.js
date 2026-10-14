module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }]
  },
  testTimeout: 30000,
  verbose: true,
  moduleNameMapper: {
    '^(\\..*)\\.js$': '$1',
  }
};
