/**
 * @file src/cli/options.ts
 * @description Centralized CLI argument parser for PortaPack using Commander.
 * Returns strongly typed options object including the determined LogLevel.
 */

import { Command, Option } from 'commander';
// Import LogLevel enum and names type from the central types file
// Ensure CLIOptions is imported correctly if defined in types.ts
import { LogLevel, type LogLevelName, type CLIOptions, type BundleOptions } from '../types';


// Define valid choices for the --log-level option
const logLevels: LogLevelName[] = ['debug', 'info', 'warn', 'error', 'silent', 'none'];

/**
 * Parses CLI arguments using Commander and returns a typed CLIOptions object.
 * Handles mapping --verbose and --log-level flags to the appropriate LogLevel enum value.
 * Handles mapping --no-minify to individual minification flags.
 *
 * @param {string[]} [argv=process.argv] - Command-line arguments array (e.g., process.argv).
 * @returns {CLIOptions} Parsed and structured options object.
 * @throws {Error} Throws errors if Commander encounters parsing/validation issues.
 */
export function parseOptions(argv: string[] = process.argv): CLIOptions {
    const program = new Command();

    program
        .name('portapack')
        .version('0.0.0') // Version updated dynamically by cli.ts
        .description('📦 Bundle HTML and its dependencies into a portable file')
        .argument('[input]', 'Input HTML file or URL')
        .option('-o, --output <file>', 'Output file path')
        // Changed default for minify to avoid ambiguity with --no-minify
        // Let the final object construction handle defaults.
        .option('-m, --minify', 'Enable all minification (HTML, CSS, JS)')
        .option('--no-minify', 'Disable all minification') // Shorthand disable
        .option('--no-minify-html', 'Disable HTML minification')
        .option('--no-minify-css', 'Disable CSS minification')
        .option('--no-minify-js', 'Disable JavaScript minification')
        .option('-e, --embed-assets', 'Embed assets as data URIs (default)') // Default handled below
        .option('--no-embed-assets', 'Keep asset links relative/absolute')
        .option('-r, --recursive [depth]', 'Recursively crawl site (optional depth)', parseRecursiveValue)
        .option('--max-depth <n>', 'Set max depth for recursive crawl (alias for -r <n>)', parseInt)
        .option('-b, --base-url <url>', 'Base URL for resolving relative links')
        .option('-d, --dry-run', 'Run without writing output file')
        .option('-v, --verbose', 'Enable verbose (debug) logging')
        .addOption(new Option('--log-level <level>', 'Set logging level')
            .choices(logLevels));

    program.parse(argv);

    // Cast opts to CLIOptions AFTER parsing, as Commander adds the 'minify' property based on flags
    const opts = program.opts<CLIOptions>();
    const inputArg = program.args.length > 0 ? program.args[0] : undefined;

    // --- Determine Effective LogLevel ---
    let finalLogLevel: LogLevel;
    const cliLogLevel = opts.logLevel as unknown as LogLevelName | undefined;
    if (cliLogLevel) {
        switch (cliLogLevel) {
            case 'debug': finalLogLevel = LogLevel.DEBUG; break;
            case 'info': finalLogLevel = LogLevel.INFO; break;
            case 'warn': finalLogLevel = LogLevel.WARN; break;
            case 'error': finalLogLevel = LogLevel.ERROR; break;
            case 'silent': case 'none': finalLogLevel = LogLevel.NONE; break;
            default: finalLogLevel = LogLevel.INFO;
        }
    } else if (opts.verbose) {
        finalLogLevel = LogLevel.DEBUG;
    } else {
        finalLogLevel = LogLevel.INFO;
    }

    // --- Handle Minification Flags ---
    // Start with assuming true unless explicitly disabled
    let minifyHtml = opts.minifyHtml !== false;
    let minifyCss = opts.minifyCss !== false;
    let minifyJs = opts.minifyJs !== false;

    // If the shorthand --no-minify flag was used, commander sets opts.minify to false
    if (opts.minify === false) {
        minifyHtml = false;
        minifyCss = false;
        minifyJs = false;
    }
     // The individual --no-minify-<type> flags already correctly set opts.minify<Type> to false via commander

    // --- Handle Recursive/MaxDepth ---
    let recursiveOpt = opts.recursive; // Keep the parsed value (boolean | number)
    if (opts.maxDepth !== undefined && opts.maxDepth >= 0) {
        recursiveOpt = opts.maxDepth; // maxDepth takes precedence if valid
    }

    // Return the final structured options object
    return {
        // Pass other options directly from commander's opts
        baseUrl: opts.baseUrl,
        dryRun: opts.dryRun ?? false, // Default to false
        output: opts.output,
        verbose: opts.verbose ?? false, // Default to false

        // Set calculated/processed options
        input: inputArg,
        logLevel: finalLogLevel,
        recursive: recursiveOpt, // Use the processed recursive value

        // Set final boolean values for minification and embedding
        embedAssets: opts.embedAssets !== false, // Default true unless --no-embed used
        minifyHtml: minifyHtml,
        minifyCss: minifyCss,
        minifyJs: minifyJs,
        // DO NOT include the intermediate 'minify' or 'maxDepth' properties from Commander's opts here
    };
}

/** Custom parser for the --recursive option value. */
function parseRecursiveValue(val: string | undefined): boolean | number {
    if (val === undefined) return true; // Flag only
    const parsed = parseInt(val, 10);
    return isNaN(parsed) || parsed < 0 ? true : parsed; // Invalid number -> true, else number
}