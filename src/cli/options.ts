/**
 * @file src/cli/options.ts
 * @description Centralized CLI argument parser for PortaPack using Commander.
 * Returns strongly typed options object including the determined LogLevel.
 */

import { Command, Option } from 'commander';
// Import LogLevel enum and names type from the central types file
// Ensure CLIOptions is imported correctly if defined in types.ts
import { LogLevel, type LogLevelName, type CLIOptions } from '../types';


// Define valid choices for the --log-level option
const logLevels: LogLevelName[] = ['debug', 'info', 'warn', 'error', 'silent', 'none'];

/**
 * Custom parser for the --recursive option value.
 * Treats flag without value, non-numeric value, or negative value as true.
 *
 * @param {string | undefined} val - The value passed to the option.
 * @returns {boolean | number} True if flag only/invalid number, otherwise the parsed depth.
 */
function parseRecursiveValue(val: string | undefined): boolean | number {
    if (val === undefined) return true; // Flag only
    const parsed = parseInt(val, 10);
    // Invalid number (NaN) or negative depth treated as simple boolean 'true'
    return isNaN(parsed) || parsed < 0 ? true : parsed;
}

/**
 * Parses CLI arguments using Commander and returns a typed CLIOptions object.
 * Handles mapping --verbose and --log-level flags to the appropriate LogLevel enum value.
 * Handles mapping --no-minify to individual minification flags.
 * Ensures flags like --no-embed-assets correctly override their positive counterparts.
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
        .option('-m, --minify', 'Enable all minification (HTML, CSS, JS)') // Presence enables default true below
        .option('--no-minify', 'Disable all minification') // Global disable flag
        .option('--no-minify-html', 'Disable HTML minification')
        .option('--no-minify-css', 'Disable CSS minification')
        .option('--no-minify-js', 'Disable JavaScript minification')
        .option('-e, --embed-assets', 'Embed assets as data URIs') // Presence enables default true below
        .option('--no-embed-assets', 'Keep asset links relative/absolute') // Disable flag
        .option('-r, --recursive [depth]', 'Recursively crawl site (optional depth)', parseRecursiveValue)
        .option('--max-depth <n>', 'Set max depth for recursive crawl (alias for -r <n>)', parseInt)
        .option('-b, --base-url <url>', 'Base URL for resolving relative links')
        .option('-d, --dry-run', 'Run without writing output file')
        .option('-v, --verbose', 'Enable verbose (debug) logging')
        .addOption(new Option('--log-level <level>', 'Set logging level')
            .choices(logLevels));

    // Prevent commander from exiting on error during tests (optional)
    // program.exitOverride();

    program.parse(argv);

    // Raw options object from Commander's parsing
    const opts = program.opts<CLIOptions>();
    // Get the positional argument (input) if provided
    const inputArg = program.args.length > 0 ? program.args[0] : undefined;

    // --- Determine Effective LogLevel ---
    let finalLogLevel: LogLevel;
    const cliLogLevel = opts.logLevel as unknown as LogLevelName | undefined; // Commander stores choice string
    if (cliLogLevel) {
        // Map string choice to LogLevel enum value
        switch (cliLogLevel) {
            case 'debug': finalLogLevel = LogLevel.DEBUG; break;
            case 'info': finalLogLevel = LogLevel.INFO; break;
            case 'warn': finalLogLevel = LogLevel.WARN; break;
            case 'error': finalLogLevel = LogLevel.ERROR; break;
            case 'silent': case 'none': finalLogLevel = LogLevel.NONE; break;
            default: finalLogLevel = LogLevel.INFO; // Fallback, though choices() should prevent this
        }
    } else if (opts.verbose) {
        // --verbose is shorthand for debug level if --log-level not set
        finalLogLevel = LogLevel.DEBUG;
    } else {
        // Default log level
        finalLogLevel = LogLevel.INFO;
    }

    // --- Handle Embedding ---
    // Default is true. --no-embed-assets flag sets opts.embedAssets to false.
    // Check argv directly to ensure --no- wins regardless of order.
    let embedAssets = true; // Start with default
    if (argv.includes('--no-embed-assets')) {
         embedAssets = false; // Explicit negation flag takes precedence
    } else if (opts.embedAssets === true) {
         embedAssets = true; // Positive flag enables it if negation wasn't present
    }
    // If neither flag is present, it remains the default 'true'.

    // --- Handle Minification ---
    // Default to true unless specifically disabled by --no-minify-<type>
    let minifyHtml = opts.minifyHtml !== false;
    let minifyCss = opts.minifyCss !== false;
    let minifyJs = opts.minifyJs !== false;

    // Global --no-minify flag overrides all individual settings
    // Commander sets opts.minify to false if --no-minify is used.
    if (opts.minify === false) {
        minifyHtml = false;
        minifyCss = false;
        minifyJs = false;
    }
    // Note: Positive flags (-m or individual --minify-<type>) don't need extra handling
    // as the initial state is true, and negations correctly turn them off.

    // --- Handle Recursive/MaxDepth ---
    // Start with the value parsed from -r/--recursive
    let recursiveOpt = opts.recursive;
    // If --max-depth was provided and is a valid non-negative number, it overrides -r
    if (opts.maxDepth !== undefined && !isNaN(opts.maxDepth) && opts.maxDepth >= 0) {
        recursiveOpt = opts.maxDepth;
    }

    // Return the final structured options object
    return {
        // Pass through directly parsed options
        baseUrl: opts.baseUrl,
        dryRun: opts.dryRun ?? false, // Ensure boolean, default false
        output: opts.output,
        verbose: opts.verbose ?? false, // Ensure boolean, default false

        // Set calculated/processed options
        input: inputArg,
        logLevel: finalLogLevel,
        recursive: recursiveOpt, // Final calculated value for recursion
        embedAssets: embedAssets, // Final calculated value
        minifyHtml: minifyHtml,   // Final calculated value
        minifyCss: minifyCss,     // Final calculated value
        minifyJs: minifyJs,       // Final calculated value

        // Exclude intermediate commander properties like:
        // minify, logLevel (string version), maxDepth,
        // minifyHtml, minifyCss, minifyJs (commander's raw boolean flags)
    };
}