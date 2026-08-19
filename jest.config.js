// Unit e integration (docs/TESTING.md fases 2 y 3). E2E web vive en playwright.config.ts.
const baseProject = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/tests/e2e/'],
  setupFiles: ['<rootDir>/tests/setup/async-storage.js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup/reset-storage.js'],
};

module.exports = {
  projects: [
    {
      ...baseProject,
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.@(ts|tsx)'],
    },
    {
      ...baseProject,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.@(ts|tsx)'],
    },
  ],
};
