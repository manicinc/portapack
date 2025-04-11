/**
 * @file cli.ts
 * @description
 * Main CLI runner for PortaPack. Handles parsing CLI args, executing the HTML bundler,
 * writing output to disk, logging metadata, and returning structured results.
 */

import fs from 'fs'; // Use default import if mocking default below
import path from 'path';
import { fileURLToPath } from 'url';

import { parseOptions } from './options.js';
import { generatePortableHTML, generateRecursivePortableHTML } from '../index';
import type { CLIResult } from '../types';

import { LogLevel } from '../types';

/**
 * Dynamically loads package.json metadata.
 */
function getPackageJson(): Record<string, any> {
    try {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        const pkgPath = path.resolve(__dirname, '../../package.json');

        // Use fs directly, assuming mock works or it's okay in non-test env
        if (fs.existsSync(pkgPath)) {
            return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        }
    } catch (_) {
        // Ignore and fallback
    }
    return { version: '0.1.0' }; // Default fallback version
}

/**
 * Entry function for running the CLI.
 */
export async function runCli(argv: string[] = process.argv): Promise<CLIResult> {
    let stdout = '';
    let stderr = '';
    let exitCode = 0;

    // Capture console output for result object
    const originalLog = console.log;
    const originalErr = console.error;
    const originalWarn = console.warn;
    console.log = (...args) => { stdout += args.join(' ') + '\n'; };
    console.error = (...args) => { stderr += args.join(' ') + '\n'; };
    console.warn = (...args) => { stderr += args.join(' ') + '\n'; }; // Capture warnings in stderr too

    let opts: ReturnType<typeof parseOptions> | undefined;
    try {
        opts = parseOptions(argv);
        const version = getPackageJson().version || '0.1.0';

        if (opts.verbose) {
            console.log(`📦 PortaPack v${version}`);
        }

        if (!opts.input) {
            console.error('❌ Missing input file or URL');
            // Restore console before returning
            console.log = originalLog; console.error = originalErr; console.warn = originalWarn;
            return { stdout, stderr, exitCode: 1 };
        }

        // Determine output path using nullish coalescing
        const outputPath = opts.output ?? `${path.basename(opts.input).split('.')[0] || 'output'}.packed.html`;

        if (opts.verbose) {
            console.log(`📥 Input: ${opts.input}`);
            console.log(`📤 Output: ${outputPath}`);
            // Log other effective options if verbose
            console.log(`   Recursive: ${opts.recursive ?? false}`);
            console.log(`   Embed Assets: ${opts.embedAssets}`);
            console.log(`   Minify HTML: ${opts.minifyHtml}`);
            console.log(`   Minify CSS: ${opts.minifyCss}`);
            console.log(`   Minify JS: ${opts.minifyJs}`);
            console.log(`   Log Level: ${LogLevel[opts.logLevel ?? LogLevel.INFO]}`);
        }

        if (opts.dryRun) {
            console.log('💡 Dry run mode — no output will be written');
            // Restore console before returning
            console.log = originalLog; console.error = originalErr; console.warn = originalWarn;
            return { stdout, stderr, exitCode: 0 };
        }

        // --- FIX: Pass 'opts' object to generate functions ---
        const result = opts.recursive
            // Convert boolean recursive flag to depth 1 if needed, otherwise use number
            ? await generateRecursivePortableHTML(opts.input, typeof opts.recursive === 'boolean' ? 1 : opts.recursive, opts)
            : await generatePortableHTML(opts.input, opts);
        // ----------------------------------------------------

        // Use fs directly - ensure mock is working in tests
        fs.writeFileSync(outputPath, result.html, 'utf-8');

        const meta = result.metadata;
        console.log(`✅ Packed: ${meta.input} → ${outputPath}`);
        console.log(`📦 Size: ${(meta.outputSize / 1024).toFixed(2)} KB`);
        console.log(`⏱️ Time: ${meta.buildTimeMs} ms`); // Use alternative emoji
        console.log(`🖼️ Assets: ${meta.assetCount}`); // Add asset count log

        if (meta.pagesBundled && meta.pagesBundled > 0) { // Check > 0 for clarity
            console.log(`🧩 Pages: ${meta.pagesBundled}`);
        }

        if (meta.errors && meta.errors.length > 0) {
            console.warn(`\n⚠️  ${meta.errors.length} warning(s):`); // Add newline for separation
            for (const err of meta.errors) {
                console.warn(`  - ${err}`);
            }
        }
    } catch (err: any) {
        console.error(`\n💥 Error: ${err?.message || 'Unknown failure'}`); // Add newline
        if (err?.stack && opts?.verbose) { // Show stack only if verbose
            console.error(err.stack);
        }
        exitCode = 1;
    } finally {
        // Restore original console methods
        console.log = originalLog;
        console.error = originalErr;
        console.warn = originalWarn;
    }

    return { stdout, stderr, exitCode };
}

// Optional: Define main export if this file is intended to be run directly
export const main = runCli;

// Example direct execution (usually handled by bin entry in package.json)
// if (require.main === module) {
//     runCli();
// }