/**
 * @file cli.ts
 * @description
 * Main CLI runner for PortaPack. Handles argument parsing, calls the bundler via `pack()`,
 * writes output to disk (unless dry-run), logs build stats, and captures structured output.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseOptions } from './options.js';
import { pack } from '../index.js';
import type { CLIResult } from '../types';

/**
 * Dynamically loads version info from package.json.
 *
 * @returns {Record<string, any>} Parsed package.json or fallback
 */
function getPackageJson(): Record<string, any> {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const pkgPath = path.resolve(__dirname, '../../package.json');

    if (fs.existsSync(pkgPath)) {
      return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }
  } catch (_) {
    // Ignore and fall back
  }
  return { version: '0.1.0' };
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

  console.log = (...args) => { stdout += args.join(' ') + '\n'; };
  console.error = (...args) => { stderr += args.join(' ') + '\n'; };
  console.warn = (...args) => { stderr += args.join(' ') + '\n'; };

  let opts;
  try {
    opts = parseOptions(argv);
    const version = getPackageJson().version || '0.1.0';

    if (opts.verbose) {
      console.log(`📦 PortaPack v${version}`);
    }

    if (!opts.input) {
      console.error('❌ Missing input file or URL');
      return { stdout, stderr, exitCode: 1 };
    }

    const outputPath = opts.output ?? `${path.basename(opts.input).split('.')[0] || 'output'}.packed.html`;

    if (opts.verbose) {
      console.log(`📥 Input: ${opts.input}`);
      console.log(`📤 Output: ${outputPath}`);
      console.log(`   Recursive: ${opts.recursive ?? false}`);
      console.log(`   Embed Assets: ${opts.embedAssets}`);
      console.log(`   Minify HTML: ${opts.minifyHtml}`);
      console.log(`   Minify CSS: ${opts.minifyCss}`);
      console.log(`   Minify JS: ${opts.minifyJs}`);
      console.log(`   Log Level: ${opts.logLevel}`);
    }

    if (opts.dryRun) {
      console.log('💡 Dry run mode — no output will be written');
      return { stdout, stderr, exitCode: 0 };
    }

    // Unified call to the high-level bundler
    const result = await pack(opts.input, opts);

    fs.writeFileSync(outputPath, result.html, 'utf-8');

    const meta = result.metadata;
    console.log(`✅ Packed: ${meta.input} → ${outputPath}`);
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
    if (err?.stack && opts?.verbose) {
      console.error(err.stack);
    }
    exitCode = 1;
  } finally {
    // Restore original console functions
    console.log = originalLog;
    console.error = originalErr;
    console.warn = originalWarn;
  }

  return { stdout, stderr, exitCode };
}

/**
 * Default exportable main runner for CLI invocation.
 */
export const main = runCli;
