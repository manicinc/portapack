import { describe, it, expect, afterEach } from '@jest/globals';
// Import the function to test and necessary types
import { parseOptions } from '../../../src/cli/options'; // Adjust path if needed
import { LogLevel, type CLIOptions } from '../../../src/types'; // Adjust path if needed

// Helper function to simulate process.argv structure
const runParseOptions = (args: string[]): CLIOptions => {
    // Prepend standard node/script path expected by commander
    return parseOptions(['node', 'script.js', ...args]);
};

// Extract the helper function for direct testing if needed (though it's private)
// We'll test its effect through the main parseOptions function for the recursive flag
// const { parseRecursiveValue } = require('../../../src/cli/options'); // Or use import { parseRecursiveValue } from '...' if exported

describe('🔧 CLI Options Parser (options.ts)', () => {

    // Define expected defaults for easier comparison
    const defaultOptions: Partial<CLIOptions> = {
        baseUrl: undefined,
        dryRun: false,
        output: undefined,
        verbose: false,
        input: undefined,
        logLevel: LogLevel.INFO,
        recursive: undefined, // No flag means undefined
        embedAssets: true, // Default is true
        minifyHtml: true, // Default is true
        minifyCss: true,  // Default is true
        minifyJs: true,   // Default is true
    };

    afterEach(() => {
        // Commander potentially maintains state between parses if not careful,
        // although creating a new Command instance each time in parseOptions mitigates this.
        // No specific cleanup usually needed here unless mocking process.argv directly.
    });

    describe('Basic Options', () => {
        it('should parse input argument', () => {
            const input = 'input.html';
            const opts = runParseOptions([input]);
            expect(opts.input).toBe(input);
        });

        it('should parse input argument with other flags', () => {
            const input = 'https://example.com';
            const output = 'out.html';
            const opts = runParseOptions([input, '-o', output]);
            expect(opts.input).toBe(input);
            expect(opts.output).toBe(output);
        });

        it('should parse --output/-o', () => {
            const output = 'dist/bundle.html';
            expect(runParseOptions(['-o', output]).output).toBe(output);
            expect(runParseOptions(['--output', output]).output).toBe(output);
        });

        it('should parse --base-url/-b', () => {
            const url = 'https://example.com/base/';
            expect(runParseOptions(['-b', url]).baseUrl).toBe(url);
            expect(runParseOptions(['--base-url', url]).baseUrl).toBe(url);
        });

        it('should parse --dry-run/-d', () => {
            expect(runParseOptions(['-d']).dryRun).toBe(true);
            expect(runParseOptions(['--dry-run']).dryRun).toBe(true);
        });

        it('should have correct default values when no flags are provided', () => {
            const opts = runParseOptions([]);
            // Check against defined defaults
            expect(opts).toMatchObject(defaultOptions);
            // Explicitly check potentially tricky defaults
            expect(opts.logLevel).toBe(LogLevel.INFO);
            expect(opts.embedAssets).toBe(true);
            expect(opts.minifyHtml).toBe(true);
            expect(opts.minifyCss).toBe(true);
            expect(opts.minifyJs).toBe(true);
            expect(opts.dryRun).toBe(false);
            expect(opts.verbose).toBe(false);
            expect(opts.recursive).toBeUndefined();
        });
    });

    describe('Logging Options', () => {
        it('should default logLevel to INFO', () => {
            const opts = runParseOptions([]);
            expect(opts.logLevel).toBe(LogLevel.INFO);
            expect(opts.verbose).toBe(false);
        });

        it('should set verbose flag', () => {
            const opts = runParseOptions(['-v']);
            expect(opts.verbose).toBe(true);
        });

        it('should set logLevel to DEBUG with --verbose/-v', () => {
            expect(runParseOptions(['-v']).logLevel).toBe(LogLevel.DEBUG);
            expect(runParseOptions(['--verbose']).logLevel).toBe(LogLevel.DEBUG);
        });

        it('should set logLevel with --log-level', () => {
            expect(runParseOptions(['--log-level', 'debug']).logLevel).toBe(LogLevel.DEBUG);
            expect(runParseOptions(['--log-level', 'info']).logLevel).toBe(LogLevel.INFO);
            expect(runParseOptions(['--log-level', 'warn']).logLevel).toBe(LogLevel.WARN);
            expect(runParseOptions(['--log-level', 'error']).logLevel).toBe(LogLevel.ERROR);
            expect(runParseOptions(['--log-level', 'silent']).logLevel).toBe(LogLevel.NONE);
            expect(runParseOptions(['--log-level', 'none']).logLevel).toBe(LogLevel.NONE);
        });

        it('should prioritize --log-level over --verbose', () => {
            // Both present, --log-level wins
            expect(runParseOptions(['-v', '--log-level', 'warn']).logLevel).toBe(LogLevel.WARN);
            expect(runParseOptions(['--log-level', 'error', '--verbose']).logLevel).toBe(LogLevel.ERROR);
        });

        // Commander handles choice validation, but we could test invalid if needed (it would exit/error)
        // it('should throw error for invalid --log-level choice', () => { ... });
    });

    describe('Embedding Options', () => {
        it('should default embedAssets to true', () => {
            const opts = runParseOptions([]);
            expect(opts.embedAssets).toBe(true);
        });

        it('should respect -e/--embed-assets (should still be true)', () => {
            // This flag confirms the default, doesn't change behavior unless --no is used
            expect(runParseOptions(['-e']).embedAssets).toBe(true);
            expect(runParseOptions(['--embed-assets']).embedAssets).toBe(true);
        });

        it('should set embedAssets to false with --no-embed-assets', () => {
            const opts = runParseOptions(['--no-embed-assets']);
            expect(opts.embedAssets).toBe(false);
        });

         it('should prioritize --no-embed-assets over -e', () => {
            // If both somehow passed, the negation should win
            expect(runParseOptions(['-e', '--no-embed-assets']).embedAssets).toBe(false);
            expect(runParseOptions(['--no-embed-assets', '-e']).embedAssets).toBe(false);
        });
    });

    describe('Minification Options', () => {
        it('should default all minify flags to true', () => {
            const opts = runParseOptions([]);
            expect(opts.minifyHtml).toBe(true);
            expect(opts.minifyCss).toBe(true);
            expect(opts.minifyJs).toBe(true);
        });

        it('should respect -m/--minify (all still true)', () => {
             // This flag confirms the default behavior based on current logic
            const optsM = runParseOptions(['-m']);
            expect(optsM.minifyHtml).toBe(true);
            expect(optsM.minifyCss).toBe(true);
            expect(optsM.minifyJs).toBe(true);
             const optsMinify = runParseOptions(['--minify']);
             expect(optsMinify.minifyHtml).toBe(true);
             expect(optsMinify.minifyCss).toBe(true);
             expect(optsMinify.minifyJs).toBe(true);
        });

        it('should set all minify flags to false with --no-minify', () => {
            const opts = runParseOptions(['--no-minify']);
            expect(opts.minifyHtml).toBe(false);
            expect(opts.minifyCss).toBe(false);
            expect(opts.minifyJs).toBe(false);
        });

        it('should set only minifyHtml to false with --no-minify-html', () => {
            const opts = runParseOptions(['--no-minify-html']);
            expect(opts.minifyHtml).toBe(false);
            expect(opts.minifyCss).toBe(true);
            expect(opts.minifyJs).toBe(true);
        });

        it('should set only minifyCss to false with --no-minify-css', () => {
            const opts = runParseOptions(['--no-minify-css']);
            expect(opts.minifyHtml).toBe(true);
            expect(opts.minifyCss).toBe(false);
            expect(opts.minifyJs).toBe(true);
        });

        it('should set only minifyJs to false with --no-minify-js', () => {
            const opts = runParseOptions(['--no-minify-js']);
            expect(opts.minifyHtml).toBe(true);
            expect(opts.minifyCss).toBe(true);
            expect(opts.minifyJs).toBe(false);
        });

        it('should prioritize --no-minify over individual --no-minify-<type> flags', () => {
            // Commander processes flags in order, but our logic checks opts.minify first
            const opts = runParseOptions(['--no-minify-html', '--no-minify']);
            expect(opts.minifyHtml).toBe(false);
            expect(opts.minifyCss).toBe(false); // Should also be false due to --no-minify
            expect(opts.minifyJs).toBe(false); // Should also be false due to --no-minify
        });

         it('should prioritize individual --no-minify-<type> flags over --minify', () => {
             // If both --minify and --no-minify-html are present, html should be false
            const opts = runParseOptions(['--minify', '--no-minify-html']);
            expect(opts.minifyHtml).toBe(false); // Disabled specifically
            expect(opts.minifyCss).toBe(true); // Stays enabled (default)
            expect(opts.minifyJs).toBe(true);  // Stays enabled (default)
         });

         it('should handle combinations of --no-minify-<type>', () => {
             const opts = runParseOptions(['--no-minify-html', '--no-minify-js']);
             expect(opts.minifyHtml).toBe(false);
             expect(opts.minifyCss).toBe(true);
             expect(opts.minifyJs).toBe(false);
         });
    });

    describe('Recursive/MaxDepth Options', () => {
        it('should have recursive undefined by default', () => {
            const opts = runParseOptions([]);
            expect(opts.recursive).toBeUndefined();
        });

        it('should set recursive to true with -r', () => {
            const opts = runParseOptions(['-r']);
            expect(opts.recursive).toBe(true);
        });

        it('should set recursive to true with --recursive', () => {
            const opts = runParseOptions(['--recursive']);
            expect(opts.recursive).toBe(true);
        });

        it('should set recursive to a number with -r <depth>', () => {
            const opts = runParseOptions(['-r', '3']);
            expect(opts.recursive).toBe(3);
        });

        it('should set recursive to a number with --recursive <depth>', () => {
             const opts = runParseOptions(['--recursive', '5']);
             expect(opts.recursive).toBe(5);
        });

        it('should parse -r value correctly (helper function effect)', () => {
            expect(runParseOptions(['-r', '0']).recursive).toBe(0);
            expect(runParseOptions(['-r', '10']).recursive).toBe(10);
            expect(runParseOptions(['-r', 'abc']).recursive).toBe(true);

            // Add this line to ensure the flag-only case is tested:
            expect(runParseOptions(['-r']).recursive).toBe(true);
        });

        it('should set recursive to a number with --max-depth <depth>', () => {
             const opts = runParseOptions(['--max-depth', '2']);
             expect(opts.recursive).toBe(2);
        });

         it('should handle invalid --max-depth (NaN becomes undefined, logic handles it)', () => {
             // Commander's parseInt will return NaN for 'abc', which our logic ignores
             const opts = runParseOptions(['--max-depth', 'abc']);
             expect(opts.recursive).toBeUndefined(); // maxDepth is ignored, recursive wasn't set
         });

          it('should handle negative --max-depth (ignored)', () => {
             // Our logic ignores maxDepth < 0
             const opts = runParseOptions(['--max-depth', '-1']);
             expect(opts.recursive).toBeUndefined(); // maxDepth is ignored, recursive wasn't set
         });

        it('should prioritize --max-depth over -r (flag only)', () => {
            const opts = runParseOptions(['-r', '--max-depth', '4']);
            expect(opts.recursive).toBe(4);
        });

         it('should prioritize --max-depth over -r <depth>', () => {
            const opts = runParseOptions(['-r', '1', '--max-depth', '5']);
            expect(opts.recursive).toBe(5);
        });

        it('should prioritize --max-depth over --recursive (flag only)', () => {
            const opts = runParseOptions(['--recursive', '--max-depth', '2']);
            expect(opts.recursive).toBe(2);
        });

         it('should prioritize --max-depth over --recursive <depth>', () => {
             const opts = runParseOptions(['--recursive', '3', '--max-depth', '1']);
             expect(opts.recursive).toBe(1);
         });
    });

    // Optional: Direct tests for the helper if it were exported
    // describe('parseRecursiveValue() Helper', () => {
    //     it('should return true for undefined', () => {
    //         expect(parseRecursiveValue(undefined)).toBe(true);
    //     });
    //     it('should return number for valid string', () => {
    //         expect(parseRecursiveValue('0')).toBe(0);
    //         expect(parseRecursiveValue('5')).toBe(5);
    //     });
    //     it('should return true for invalid number string', () => {
    //         expect(parseRecursiveValue('abc')).toBe(true);
    //         expect(parseRecursiveValue('')).toBe(true); // isNaN('') is false, but parseInt('') is NaN
    //     });
    //     it('should return true for negative number string', () => {
    //         expect(parseRecursiveValue('-1')).toBe(true);
    //         expect(parseRecursiveValue('-10')).toBe(true);
    //     });
    // });
});