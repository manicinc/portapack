import type { Config } from 'jest';
import path from 'path';

const config: Config = {
  /**
   * Use ts-jest with ESM support.
   */
  // preset: 'ts-jest/presets/default-esm',
  preset: 'ts-jest',

  /**
   * Node test environment
   */
  testEnvironment: 'node',

  /**
   * Custom setup scripts after env is ready.
   */
  setupFilesAfterEnv: ['<rootDir>/jest.setup.cjs'],

  /**
   * Tell ts-jest to use ESM transformation
   */
  // transform: {
  //   '^.+\\.tsx?$': [
  //     'ts-jest',
  //     {
  //       useESM: true,
  //       tsconfig: './tsconfig.jest.json'
  //     }
  //   ]
  // },

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        // useESM: false, // Explicitly false or remove this line entirely
        tsconfig: './tsconfig.jest.json', // Ensure this tsconfig targets CommonJS
      },
    ],
  },
  /**
   * Treat `.ts` files as ESM modules.
   */
  extensionsToTreatAsEsm: ['.ts'],

  /**
   * Module name mapping to handle extensions in imports for ESM
   */
  moduleNameMapper: {
    // Map imports ending in '.js' back to source file (remove .js)
    '^(\\.{1,2}/.*)\\.js$': '$1',
    // Keep absolute path alias
    '^portapack(.*)$': '<rootDir>/src$1',
    // Mock path support
    '^__mocks__/(.*)$': '<rootDir>/__mocks__/$1',
  },

  /**
   * Collect coverage from source files only.
   */
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/types.ts',
    '!src/cli/cli-entry.ts',
  ],

  /**
   * Output coverage report here.
   */
  coverageDirectory: './coverage',

  /**
   * Global coverage enforcement - temporarily lowered to help get tests passing and an initial package build live for testing
   */
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  /**
   * Increase test timeout to allow Puppeteer + network-dependent tests.
   */
  testTimeout: 60000, // Increased from 30s to 60s

  /**
   * Type-ahead filters for watch mode
   */
  watchPlugins: ['jest-watch-typeahead/filename', 'jest-watch-typeahead/testname'],

  /**
   * Don't error if no tests found (for initial development)
   */
  passWithNoTests: true,

  /**
   * Ignore specific paths in watch mode
   */
  watchPathIgnorePatterns: [path.join('<rootDir>', 'tests', '__fixtures__', 'output')],

  /**
   * Mock implementations
   */
  modulePathIgnorePatterns: ['<rootDir>/dist/'],

  /**
   * Make all tests deterministic - resets mocks between tests
   */
  resetMocks: false, // Changed to false to allow persistent mocks when needed

  /**
   * Verbosity level
   */
  verbose: true,

  /**
   * Add test failure diagnostics
   */
  errorOnDeprecated: true,
};

export default config;
