/**
 * @file tsup.config.ts
 * @description
 * Build configuration for tsup bundler.
 * Configures:
 * - Separate CLI and API builds
 * - ESM output for Node.js
 * - TypeScript declaration files for API only
 * - Source maps for debugging
 * - Shebang for CLI binary
 */

import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // CLI build configuration
    entry: {
      'cli-entry': 'src/cli/cli-entry.ts',  // Entry point for CLI binary
    },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    splitting: false,
    clean: true,                  // Clean the output directory
    dts: false,                   // No types for CLI output
    sourcemap: true,
    outDir: 'dist/cli',
    banner: {
      js: '#!/usr/bin/env node',  // Include shebang for CLI executable
    },
    outExtension({ format }) {
      return {
        js: '.js',  // Keep .js extension for ESM imports
      };
    },
    esbuildOptions(options) {
      // Make sure to preserve import.meta.url
      options.supported = {
        ...options.supported,
        'import-meta': true,
      };
    },
  },
  {
    // API build configuration
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    target: 'node18',
    platform: 'node',
    splitting: false,
    clean: false,                 // Don't wipe CLI output
    dts: true,                    // Generate TypeScript declarations
    sourcemap: true,
    outDir: 'dist',
    outExtension({ format }) {
      return {
        js: '.js',  // Keep .js extension for ESM imports
      };
    },
    esbuildOptions(options) {
      // Make sure to preserve import.meta.url
      options.supported = {
        ...options.supported,
        'import-meta': true,
      };
    },
  }
]);