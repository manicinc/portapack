/**
 * @file tsup.config.ts
 * @description
 * Dual build configuration for PortaPack:
 *
 * 🔹 CLI Build:
 *   - CommonJS format (`cjs`) for CLI compatibility with Node/npx
 *   - .cjs file extension to avoid ESM interpretation issues
 *   - Shebang (`#!/usr/bin/env node`) for executability
 *
 * 🔹 API Build:
 *   - ESModule format (`esm`) for modern module usage
 *   - Generates type declarations (`.d.ts`)
 *   - Outputs to dist/ without interfering with CLI
 */

import { defineConfig } from 'tsup';

export default defineConfig([
  // 🔹 CLI BUILD (CJS + .cjs + shebang)
  {
    entry: {
      'cli-entry': 'src/cli/cli-entry.ts',
    },
    outDir: 'dist/cli',
    format: ['cjs'], // ✅ Required for CLI to work with npx
    platform: 'node',
    target: 'node18',
    splitting: false,
    clean: true, // Wipe dist/cli clean on each build
    dts: false, // No types for CLI
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node', // ✅ Required for CLI shebang
    },
    outExtension() {
      return {
        js: '.cjs', // ✅ Required: prevents ESM misinterpretation
      };
    },
    esbuildOptions(options) {
      // Support import.meta in case CLI uses it
      options.supported = {
        ...options.supported,
        'import-meta': true,
      };
    },
  },

  // 🔹 API BUILD (ESM + Types + dist/)
  {
    entry: {
      index: 'src/index.ts',
    },
    outDir: 'dist',
    format: ['esm'], // ✅ Modern ESM output for consumers
    platform: 'node',
    target: 'node18',
    splitting: false,
    clean: false, // Don't wipe CLI build!
    dts: true, // ✅ Generate TypeScript declarations
    sourcemap: true,
    outExtension() {
      return {
        js: '.js',
      };
    },
    esbuildOptions(options) {
      options.supported = {
        ...options.supported,
        'import-meta': true,
      };
    },
  },
]);
