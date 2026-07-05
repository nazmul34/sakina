/**
 * Unit-test runner for pure logic and orchestration that doesn't need the native
 * runtime. We deliberately don't use `jest-expo`/RN here: the modules under test
 * (geofence selection + arming) are plain TS, and their few native/Expo imports
 * are mocked per-test. `ts-jest` compiles against the project tsconfig.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  // Skip type-checking during tests (tsc --noEmit already gates that in CI); this
  // keeps runs fast and avoids RN/Expo ambient-type noise from the base tsconfig.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
};
