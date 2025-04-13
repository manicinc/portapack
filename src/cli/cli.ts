/**
 * @file cli.ts
 * @description
 * Main CLI runner for PortaPack. Handles argument parsing, calls the bundler via `pack()`,
 * writes output to disk (unless dry-run), logs build stats, and captures structured output.
 */

import fs from 'fs';
import path from 'path';
// Use standard require for core modules in CJS context if needed
// const path = require('path');
// const fs = require('fs');

import { parseOptions } from './options';
import { pack } from '../index';
// Import CLIOptions correctly
import type { CLIResult, BundleOptions, BundleMetadata, CLIOptions } from '../types';

/**
 * Dynamically loads version info from package.json using CommonJS compatible method.
 *
 * @returns {Record<string, any>} Parsed package.json or fallback
 */
function getPackageJson(): Record<string, any> {
  try {
    // FIX: Use require.resolve which works in CommonJS to find the package path
    // It resolves relative to the location of this file or the node_modules structure
    // Assumes 'portapack' is the package name defined in package.json
    // We need the package.json itself, so resolve 'portapack/package.json'
    // Use __dirname if available in CJS context, otherwise try relative from cwd as fallback
    const searchPath = typeof __dirname !== 'undefined' ? path.join(__dirname, '..', '..') : process.cwd();
    const pkgJsonPath = require.resolve('portapack/package.json', { paths: [searchPath] });
    return require(pkgJsonPath); // Use require directly to load JSON
  } catch (err) {
     console.error("Warning: Could not dynamically load package.json for version.", err); // Log error for debugging
     return { version: '0.0.0-unknown' };
  }
}

/**
 * Entrypoint for CLI execution. Parses args, runs bundler, logs output and errors.
 *
 * @param {string[]} [argv=process.argv] - Command-line arguments (default: system args)
 * @returns {Promise<CLIResult>} - Structured result containing output, error, and exit code
 */
export async function runCli(argv: string[] = process.argv): Promise<CLIResult> {
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  // Capture console output
  const originalLog = console.log;
  const originalErr = console.error;
  const originalWarn = console.warn;

  const restoreConsole = () => {
      console.log = originalLog;
      console.error = originalErr;
      console.warn = originalWarn;
  };

  console.log = (...args) => { stdout += args.join(' ') + '\n'; };
  console.error = (...args) => { stderr += args.join(' ') + '\n'; };
  console.warn = (...args) => { stderr += args.join(' ') + '\n'; };

  // FIX: Use the correct type CLIOptions which includes 'input'
  let cliOptions: CLIOptions | undefined;
  try {
    // Get the fully parsed options object which includes 'input'
    cliOptions = parseOptions(argv);
    const version = getPackageJson().version || '0.0.0';

    if (cliOptions.verbose) {
      console.log(`📦 PortaPack v${version}`);
    }

    // Check for the input property on the correct object
    if (!cliOptions.input) {
      console.error('❌ Missing input file or URL');
      restoreConsole();
      return { stdout, stderr, exitCode: 1 };
    }

    // Use path.basename and handle potential extension removal carefully
    const inputBasename = path.basename(cliOptions.input);
    const outputDefaultBase = inputBasename.includes('.') ? inputBasename.substring(0, inputBasename.lastIndexOf('.')) : inputBasename;
    // Use the parsed output option or generate default
    const outputPath = cliOptions.output ?? `${outputDefaultBase || 'output'}.packed.html`;

    if (cliOptions.verbose) {
      console.log(`📥 Input: ${cliOptions.input}`); // Access input correctly
      console.log(`📤 Output: ${outputPath}`);
      // Display other resolved options
      console.log(`  Recursive: ${cliOptions.recursive ?? false}`);
      console.log(`  Embed Assets: ${cliOptions.embedAssets}`);
      console.log(`  Minify HTML: ${cliOptions.minifyHtml}`);
      console.log(`  Minify CSS: ${cliOptions.minifyCss}`);
      console.log(`  Minify JS: ${cliOptions.minifyJs}`);
      console.log(`  Log Level: ${cliOptions.logLevel}`);
    }

    if (cliOptions.dryRun) {
      console.log('💡 Dry run mode — no output will be written');
      restoreConsole();
      return { stdout, stderr, exitCode: 0 };
    }

    // FIX: Call pack with input as the first argument, and the rest of the options as the second.
    // The cliOptions object should be compatible with PackOptions expected by pack.
    const result = await pack(cliOptions.input, cliOptions);

    // Use standard fs sync version as used before
    fs.writeFileSync(outputPath, result.html, 'utf-8');

    const meta = result.metadata;
    // Log results to captured stdout
    console.log(`✅ Packed: ${meta.input} → ${outputPath}`); // meta.input should be correct from pack's result
    console.log(`📦 Size: ${(meta.outputSize / 1024).toFixed(2)} KB`);
    console.log(`⏱️ Time: ${meta.buildTimeMs} ms`);
    console.log(`🖼️ Assets: ${meta.assetCount}`);

    if (meta.pagesBundled && meta.pagesBundled > 0) {
      console.log(`🧩 Pages: ${meta.pagesBundled}`);
    }

    if (meta.errors?.length) {
      console.warn(`\n⚠️  ${meta.errors.length} warning(s):`);
      for (const err of meta.errors) {
        console.warn(`  - ${err}`);
      }
    }

  } catch (err: any) {
    console.error(`\n💥 Error: ${err?.message || 'Unknown failure'}`);
    // Check verbose flag on the correct variable
    if (err?.stack && cliOptions?.verbose) {
      console.error(err.stack);
    }
    exitCode = 1;
  } finally {
    restoreConsole();
  }

  return { stdout, stderr, exitCode };
}

/**
 * Default exportable main runner for CLI invocation.
 */
export const main = runCli;