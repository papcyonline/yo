module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.(js|ts)',
    '**/*.(test|spec).(js|ts)'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/',
    '/coverage/',
    '/logs/',
    '/uploads/'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    }
  },
  testTimeout: 30000,
  verbose: true,
  // Clear mocks between tests
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  // Simplified setup without MongoDB Memory Server
  // globalSetup: '<rootDir>/tests/globalSetup.js',
  // globalTeardown: '<rootDir>/tests/globalTeardown.js',
  // Transform ES modules
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx'],
  // Test files to ignore
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/dist/'
  ]
};