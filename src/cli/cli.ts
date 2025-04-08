/**
 * @file cli.ts
 * @description
 * Main CLI runner for PortaPack. Handles parsing CLI args, executing the HTML bundler,
 * writing output to disk, logging metadata, and returning structured results.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseOptions } from './options.js';
import { generatePortableHTML, generateRecursivePortableHTML } from '../index';
import type { CLIResult } from '../types';

/**
 * Dynamically loads package.json metadata.
 * Avoids global top-level JSON import to prevent Jest/Esm mocking issues.
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
    // Ignore and fallback
  }

  return { version: '0.1.0' };
}

/**
 * Entry function for running the CLI.
 * Handles all user interaction, logging, bundling logic and returns CLI result.
 * 
 * @param argv - Command-line arguments (default: process.argv)
 * @returns {Promise<CLIMainResult>}
 */
export async function runCli(argv: string[] = process.argv): Promise<CLIResult> {
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  const originalLog = console.log;
  const originalErr = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    stdout += args.join(' ') + '\n';
    if (process.env.NODE_ENV !== 'test') originalLog(...args);
  };

  console.error = (...args) => {
    stderr += args.join(' ') + '\n';
    if (process.env.NODE_ENV !== 'test') originalErr(...args);
  };

  console.warn = (...args) => {
    stderr += args.join(' ') + '\n';
    if (process.env.NODE_ENV !== 'test') originalWarn(...args);
  };

  try {
    const opts = parseOptions(argv);
    const version = getPackageJson().version || '0.1.0';

    if (opts.verbose) {
      console.log(`📦 PortaPack v${version}`);
    }

    if (!opts.input) {
      console.error('❌ Missing input file or URL');
      return { stdout, stderr, exitCode: 1 };
    }

    const outputPath = opts.output || `${opts.input}.packed.html`;

    if (opts.verbose) {
      console.log(`📥 Input: ${opts.input}`);
      console.log(`📤 Output: ${outputPath}`);
    }

    if (opts.dryRun) {
      console.log('💡 Dry run mode — no output will be written');
      return { stdout, stderr, exitCode: 0 };
    }

    const result = opts.recursive
      ? await generateRecursivePortableHTML(opts.input, Number(opts.recursive))
      : await generatePortableHTML(opts.input, opts);

    fs.writeFileSync(outputPath, result.html, 'utf-8');

    const meta = result.metadata;
    console.log(`✅ Packed: ${meta.input} → ${outputPath}`);
    console.log(`📦 Size: ${(meta.outputSize / 1024).toFixed(2)} KB`);
    console.log(`⏱  Time: ${meta.buildTimeMs} ms`);

    if (meta.pagesBundled && meta.pagesBundled > 1) {
      console.log(`🧩 Pages: ${meta.pagesBundled}`);
    }

    if (meta.errors?.length) {
      console.warn(`⚠️  ${meta.errors.length} warning(s):`);
      for (const err of meta.errors) {
        console.warn(`- ${err}`);
      }
    }
  } catch (err: any) {
    console.error(`💥 Error: ${err?.message || 'Unknown failure'}`);
    if (err?.stack && process.env.DEBUG) {
      console.error(err.stack);
    }
    exitCode = 1;
  } finally {
    console.log = originalLog;
    console.error = originalErr;
    console.warn = originalWarn;
  }

  return { stdout, stderr, exitCode };
}

export const main = runCli;
