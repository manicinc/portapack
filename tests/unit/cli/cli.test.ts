// tests/unit/cli/cli.test.ts

import { jest, describe, it, beforeAll, afterAll, beforeEach, expect } from '@jest/globals';
// Import types
import type { CLIOptions, BuildResult, CLIResult, BundleMetadata, BundleOptions } from '../../../src/types'; // Ensure all needed types are imported
import { LogLevel } from '../../../src/types';

// --- Import ACTUAL fs module to spy on ---
import fs from 'fs';

// --- Mock ONLY external dependencies (options.ts, index.ts) ---
const mockParseOptions = jest.fn<(argv: string[]) => CLIOptions>();
const mockGeneratePortableHTML = jest.fn<(input: string, options: BundleOptions) => Promise<BuildResult>>();
const mockGenerateRecursivePortableHTML = jest.fn<(url: string, depth: number | boolean, options: BundleOptions) => Promise<BuildResult>>();

jest.unstable_mockModule('../../../src/cli/options', () => ({ // Adjust path
    parseOptions: mockParseOptions
}));
jest.unstable_mockModule('../../../src/index', () => ({ // Adjust path
    generatePortableHTML: mockGeneratePortableHTML,
    generateRecursivePortableHTML: mockGenerateRecursivePortableHTML,
}));


// --- Dynamic Import of the module under test ---
let runCli: (argv?: string[]) => Promise<CLIResult>;
beforeAll(async () => {
    // Import AFTER mocks for external deps are configured
    const cliModule = await import('../../../src/cli/cli'); // Adjust path
    runCli = cliModule.runCli;
});


// --- Test Suite ---
describe('CLI Runner Logic', () => {

    // --- Declare Spies for FS module ---
    let writeFileSyncSpy: jest.SpiedFunction<typeof fs.writeFileSync>;
    let existsSyncSpy: jest.SpiedFunction<typeof fs.existsSync>;
    let readFileSyncSpy: jest.SpiedFunction<typeof fs.readFileSync>;

    // Helper to create mock metadata
    const createMockMetadata = (input: string, overrides: Partial<BundleMetadata> = {}): BundleMetadata => ({
        input: input, assetCount: 5, outputSize: 1024, buildTimeMs: 100,
        pagesBundled: undefined, errors: [], ...overrides,
    });

    beforeEach(() => {
        // --- Reset ALL Mocks and Spies ---
        jest.clearAllMocks();

        // --- Setup Spies on FS module ---
        // Spy on writeFileSync and provide a mock implementation (e.g., do nothing)
        writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        // Spy on others used by getPackageJson and provide mock return values
        existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ version: "1.0.0-test" }));
        // --------------------------------

        // Default mock implementations for external dependencies
        mockParseOptions.mockReturnValue({
            input: 'default.html', output: undefined, recursive: false, dryRun: false,
            logLevel: LogLevel.INFO, verbose: false, embedAssets: true, minifyHtml: true, minifyCss: true, minifyJs: true
        });
        mockGeneratePortableHTML.mockResolvedValue({
            html: '<html>Default Portable</html>',
            metadata: createMockMetadata('default.html')
        });
        mockGenerateRecursivePortableHTML.mockResolvedValue({
            html: '<html>Default Recursive</html>',
            metadata: createMockMetadata('https://default.recursive', { pagesBundled: 1, assetCount: 1 })
        });
    });

    afterEach(() => {
        // Restore original implementations spied on by jest.spyOn
        jest.restoreAllMocks();
    });

    // --- Tests ---

    it('calls parseOptions with process arguments', async () => {
        const testArgs = ['node', 'cli.js', 'test-input.html', '-o', 'test-output.html'];
        mockParseOptions.mockReturnValueOnce({ input: 'test-input.html', output: 'test-output.html', recursive: false } as CLIOptions);
        mockGeneratePortableHTML.mockResolvedValueOnce({ html: '', metadata: createMockMetadata('test-input.html') });

        await runCli(testArgs);

        expect(mockParseOptions).toHaveBeenCalledTimes(1);
        expect(mockParseOptions).toHaveBeenCalledWith(testArgs);
    });

    it('runs generatePortableHTML when not recursive', async () => {
        const args = ['node', 'cli.js', 'index.html', '-o', 'output.html'];
        const mockCliOptions: CLIOptions = {
            input: 'index.html', output: 'output.html', recursive: false, dryRun: false,
            logLevel: LogLevel.INFO, verbose: false, minifyHtml: true, minifyCss: true, minifyJs: true, embedAssets: true
        };
        const specificMetadata = createMockMetadata('index.html', { assetCount: 3, outputSize: 2048, buildTimeMs: 55 });
        mockParseOptions.mockReturnValueOnce(mockCliOptions);
        mockGeneratePortableHTML.mockResolvedValueOnce({
             html: '<html>Generated Non-Recursive</html>',
             metadata: specificMetadata
        });

        const result = await runCli(args);

        expect(mockGeneratePortableHTML).toHaveBeenCalledWith('index.html', mockCliOptions);
        expect(mockGenerateRecursivePortableHTML).not.toHaveBeenCalled();
        // --- Check the SPY ---
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
        expect(writeFileSyncSpy).toHaveBeenCalledWith('output.html', '<html>Generated Non-Recursive</html>', 'utf-8');
        // --- Check result ---
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✅ Packed: index.html → output.html');
        // ... other stdout checks ...
    });

    it('runs generateRecursivePortableHTML when recursive is enabled (boolean)', async () => {
        const args = ['node', 'cli.js', 'https://site.com', '-r', '-o', 'site-packed.html'];
        const mockCliOptions: CLIOptions = {
            input: 'https://site.com', output: 'site-packed.html', recursive: true,
            dryRun: false, logLevel: LogLevel.INFO, verbose: false, /* other flags */
        };
         const specificMetadata = createMockMetadata('https://site.com', { pagesBundled: 3, assetCount: 10, outputSize: 3000 });
         mockParseOptions.mockReturnValueOnce(mockCliOptions);
         mockGenerateRecursivePortableHTML.mockResolvedValueOnce({
              html: '<html>Generated Recursive Boolean</html>',
              metadata: specificMetadata
         });

        const result = await runCli(args);

        expect(mockGenerateRecursivePortableHTML).toHaveBeenCalledTimes(1);
        // Check args passed to generateRecursivePortableHTML (cli.ts passes options now)
        expect(mockGenerateRecursivePortableHTML).toHaveBeenCalledWith('https://site.com', 1, mockCliOptions);
        expect(mockGeneratePortableHTML).not.toHaveBeenCalled();
        // --- Check the SPY ---
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
        expect(writeFileSyncSpy).toHaveBeenCalledWith('site-packed.html', '<html>Generated Recursive Boolean</html>', 'utf-8');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✅ Packed: https://site.com → site-packed.html');
        // ... other stdout checks ...
    });

     it('runs generateRecursivePortableHTML when recursive is enabled (number)', async () => {
        const args = ['node', 'cli.js', 'https://site.com', '-r', '2', '-o', 'site-packed.html'];
        const mockCliOptions: CLIOptions = {
            input: 'https://site.com', output: 'site-packed.html', recursive: 2,
            dryRun: false, logLevel: LogLevel.INFO, verbose: false, /* other flags */
        };
        const specificMetadata = createMockMetadata('https://site.com', { pagesBundled: 5, assetCount: 20, outputSize: 5000 });
        mockParseOptions.mockReturnValueOnce(mockCliOptions);
        mockGenerateRecursivePortableHTML.mockResolvedValueOnce({
             html: '<html>Generated Recursive Number</html>',
             metadata: specificMetadata
        });

        const result = await runCli(args);

        expect(mockGenerateRecursivePortableHTML).toHaveBeenCalledTimes(1);
        expect(mockGenerateRecursivePortableHTML).toHaveBeenCalledWith('https://site.com', 2, mockCliOptions);
        expect(mockGeneratePortableHTML).not.toHaveBeenCalled();
        // --- Check the SPY ---
        expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
        expect(writeFileSyncSpy).toHaveBeenCalledWith('site-packed.html', '<html>Generated Recursive Number</html>', 'utf-8');
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('✅ Packed: https://site.com → site-packed.html');
        // ... other stdout checks ...
    });

     it('returns error if input is missing', async () => {
         const args = ['node', 'cli.js'];
         mockParseOptions.mockReturnValueOnce({ } as CLIOptions); // Simulate no input parsed

         const result = await runCli(args);

         expect(result.exitCode).toBe(1);
         expect(result.stderr).toContain('❌ Missing input file or URL');
         expect(mockGeneratePortableHTML).not.toHaveBeenCalled();
         expect(mockGenerateRecursivePortableHTML).not.toHaveBeenCalled();
         expect(writeFileSyncSpy).not.toHaveBeenCalled(); // Check SPY not called
     });

     it('skips processing and writing in dry-run mode', async () => {
         const args = ['node', 'cli.js', 'index.html', '--dry-run', '-o','should-not-write.html'];
         mockParseOptions.mockReturnValueOnce({
             input: 'index.html', output: 'should-not-write.html', dryRun: true, recursive: false
         } as CLIOptions);

         const result = await runCli(args);

         expect(mockGeneratePortableHTML).not.toHaveBeenCalled();
         expect(mockGenerateRecursivePortableHTML).not.toHaveBeenCalled();
         expect(writeFileSyncSpy).not.toHaveBeenCalled(); // Check SPY not called
         expect(result.exitCode).toBe(0);
         expect(result.stdout).toContain('💡 Dry run mode');
         expect(result.stdout).not.toContain('✅ Packed:');
     });

     it('handles unexpected errors gracefully', async () => {
         const args = ['node', 'cli.js', 'bad-input.html'];
         const errorMessage = 'Something broke during processing';
         mockParseOptions.mockReturnValueOnce({ input: 'bad-input.html', output: 'out.html', recursive: false } as CLIOptions);
         mockGeneratePortableHTML.mockRejectedValueOnce(new Error(errorMessage)); // Simulate error

         const result = await runCli(args);

         expect(result.exitCode).toBe(1);
         expect(result.stderr).toContain(`💥 Error: ${errorMessage}`);
         expect(writeFileSyncSpy).not.toHaveBeenCalled(); // Check SPY not called
     });

     it('displays warnings from metadata', async () => {
         const args = ['node', 'cli.js', 'index.html'];
         const warningMessage = 'Asset not found: missing.css';
         const metadataWithWarning = createMockMetadata('index.html', { errors: [warningMessage] });
         mockParseOptions.mockReturnValueOnce({ input: 'index.html', output: 'output.html', recursive: false } as CLIOptions);
         mockGeneratePortableHTML.mockResolvedValueOnce({ html: '<html>Warning</html>', metadata: metadataWithWarning });

         const result = await runCli(args);

         expect(result.exitCode).toBe(0);
         expect(result.stdout).toContain('✅ Packed: index.html → output.html');
         expect(result.stderr).toContain('⚠️  1 warning(s):');
         expect(result.stderr).toContain(`- ${warningMessage}`);
         expect(writeFileSyncSpy).toHaveBeenCalledTimes(1); // Check SPY called
         expect(writeFileSyncSpy).toHaveBeenCalledWith('output.html', '<html>Warning</html>', 'utf-8');
     });
});