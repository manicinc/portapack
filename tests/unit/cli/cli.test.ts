import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals'; // Assuming beforeAll/afterAll aren't strictly needed for these tests unless used by setup

// Import types
import type { CLIOptions, BuildResult, CLIResult, BundleMetadata } from '../../../src/types';
import { LogLevel } from '../../../src/types';

// --- Import ACTUAL fs module to spy on ---
import fs from 'fs';
// Import package.json for version checks if needed (ensure path is correct)
import * as packageJson from '../../../package.json';

// --- MOCK DEPENDENCIES ---
// Mock the function that parses options (dependency of cli.ts)
const mockParseOptions = jest.fn<() => CLIOptions>();
// Mock the main pack function (dependency of cli.ts)
const mockPackFn = jest.fn<() => Promise<BuildResult>>();

// Tell Jest to replace the actual modules with our mocks *before* cli.ts is imported
jest.mock('../../../src/cli/options', () => ({
  __esModule: true,
  parseOptions: mockParseOptions,
}));
jest.mock('../../../src/index', () => ({
  __esModule: true,
  pack: mockPackFn,
}));

// --- Import the module under test AFTER mocks are defined ---
// Now imports the *actual* runCli function, not a mocked version
import { runCli } from '../../../src/cli/cli';

// --- Test Suite ---
describe('CLI Runner Logic', () => {
  // --- Declare Spies for FS module (used by cli.ts) ---
  let writeFileSyncSpy: jest.SpiedFunction<typeof fs.writeFileSync>;
  let existsSyncSpy: jest.SpiedFunction<typeof fs.existsSync>;
  let readFileSyncSpy: jest.SpiedFunction<typeof fs.readFileSync>;

  // Helper to create mock metadata
  const createMockMetadata = (
    input: string,
    overrides: Partial<BundleMetadata> = {}
  ): BundleMetadata => ({
    input: input,
    assetCount: 5,
    outputSize: 1024,
    buildTimeMs: 100,
    pagesBundled: undefined, // Default to undefined
    errors: [], // Default to empty errors/warnings array
    ...overrides,
  });

  // Default options structure returned by the mock parseOptions
  const defaultCliOptions: CLIOptions = {
    input: 'default.html',
    output: undefined,
    recursive: false,
    dryRun: false,
    logLevel: LogLevel.INFO,
    verbose: false,
    embedAssets: true,
    minifyHtml: true,
    minifyCss: true,
    minifyJs: true,
  };

  beforeEach(() => {
    // --- Reset ALL Mocks and Spies ---
    // Clears call history etc. between tests
    jest.clearAllMocks();

    // --- Setup Spies on FS module ---
    // Mock implementations for fs functions called by cli.ts
    writeFileSyncSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {}); // Don't actually write files
    existsSyncSpy = jest.spyOn(fs, 'existsSync').mockReturnValue(true); // Assume files exist by default

    // Mock readFileSync to handle the package.json read required by getPackageJson (internal to cli.ts)
    readFileSyncSpy = jest.spyOn(fs, 'readFileSync').mockImplementation((pathInput, options) => {
      const pathStr = String(pathInput); // Ensure path is treated as a string
      // Check if it's trying to read package.json (adjust check if needed)
      if (pathStr.includes('portapack') && pathStr.endsWith('package.json')) {
        return JSON.stringify({ version: '1.0.0-test' }); // Return mock version
      }
      // If cli.ts needed to read other files, mock them here too
      // if (pathStr.endsWith('some-other-expected-file.txt')) { return 'file content'; }

      // Throw an error for any unexpected file reads during tests
      throw new Error(`Unexpected readFileSync call in test: ${pathStr}`);
    });

    // --- Default mock implementations for dependencies ---
    // Ensure parseOptions returns a valid structure by default
    mockParseOptions.mockReturnValue(defaultCliOptions);
    // Ensure pack resolves successfully by default
    mockPackFn.mockResolvedValue({
      html: '<html>Default Pack Result</html>',
      metadata: createMockMetadata(defaultCliOptions.input ?? 'default.html'), // Use input from default options
    });
  });

  afterEach(() => {
    // Restore original implementations spied on by jest.spyOn
    // Important to avoid mocks leaking between test files
    jest.restoreAllMocks();
  });

  // --- Tests ---

  it('calls parseOptions with process arguments', async () => {
    const testArgs = ['node', 'cli.js', 'test-input.html', '-o', 'test-output.html'];
    const specificOptions = {
      ...defaultCliOptions,
      input: 'test-input.html',
      output: 'test-output.html',
    };
    mockParseOptions.mockReturnValueOnce(specificOptions); // Override default for this test
    // Configure pack mock for this specific input if its result matters
    mockPackFn.mockResolvedValueOnce({
      html: '<html>Specific Test Result</html>',
      metadata: createMockMetadata('test-input.html'),
    });

    await runCli(testArgs);

    expect(mockParseOptions).toHaveBeenCalledTimes(1);
    expect(mockParseOptions).toHaveBeenCalledWith(testArgs);
    // Verify pack was called because parseOptions returned valid input and not dry-run
    expect(mockPackFn).toHaveBeenCalledTimes(1);
    // Check if pack was called with the correct arguments derived from options
    expect(mockPackFn).toHaveBeenCalledWith(specificOptions.input, specificOptions);
  });

  it('calls pack for non-recursive input and writes file', async () => {
    const args = ['node', 'cli.js', 'index.html', '-o', 'output.html'];
    const mockCliOptions: CLIOptions = {
      ...defaultCliOptions,
      input: 'index.html',
      output: 'output.html', // Explicit output path
      recursive: false,
    };
    const specificMetadata = createMockMetadata('index.html', {
      assetCount: 3,
      outputSize: 2048,
      buildTimeMs: 55,
    });
    mockParseOptions.mockReturnValueOnce(mockCliOptions); // Use specific options for this test
    mockPackFn.mockResolvedValueOnce({
      // Use specific pack result for this test
      html: '<html>Packed Non-Recursive</html>',
      metadata: specificMetadata,
    });

    const result = await runCli(args);

    // Check that parseOptions was called
    expect(mockParseOptions).toHaveBeenCalledWith(args);
    // Check pack was called correctly
    expect(mockPackFn).toHaveBeenCalledTimes(1);
    expect(mockPackFn).toHaveBeenCalledWith(mockCliOptions.input, mockCliOptions); // Called with input and options object
    // Check file write happened
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      'output.html',
      '<html>Packed Non-Recursive</html>',
      'utf-8'
    );
    // Check result object
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✅ Packed: index.html → output.html');
    expect(result.stdout).toContain('📦 Size: 2.00 KB'); // Check stats based on mock metadata
  });

  it('calls pack for recursive input (boolean) and writes file', async () => {
    const args = ['node', 'cli.js', 'https://site.com', '-r', '-o', 'site-packed.html'];
    const mockCliOptions: CLIOptions = {
      ...defaultCliOptions,
      input: 'https://site.com',
      output: 'site-packed.html',
      recursive: true, // Recursive flag is true
    };
    const specificMetadata = createMockMetadata('https://site.com', {
      pagesBundled: 3,
      assetCount: 10,
    });
    mockParseOptions.mockReturnValueOnce(mockCliOptions);
    mockPackFn.mockResolvedValueOnce({
      html: '<html>Packed Recursive Boolean</html>',
      metadata: specificMetadata,
    });

    const result = await runCli(args);

    expect(mockParseOptions).toHaveBeenCalledWith(args);
    // Check pack was called
    expect(mockPackFn).toHaveBeenCalledTimes(1);
    expect(mockPackFn).toHaveBeenCalledWith(mockCliOptions.input, mockCliOptions);
    // Check file write
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      'site-packed.html',
      '<html>Packed Recursive Boolean</html>',
      'utf-8'
    );
    // Check result object and specific recursive output
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✅ Packed: https://site.com → site-packed.html');
    expect(result.stdout).toContain('🧩 Pages: 3'); // Check pages bundled output
  });

  it('calls pack for recursive input (number) and writes file', async () => {
    const args = ['node', 'cli.js', 'https://site.com', '-r', '2', '-o', 'site-packed.html'];
    const mockCliOptions: CLIOptions = {
      ...defaultCliOptions,
      input: 'https://site.com',
      output: 'site-packed.html',
      recursive: 2, // Recursive flag is number
    };
    const specificMetadata = createMockMetadata('https://site.com', { pagesBundled: 5 });
    mockParseOptions.mockReturnValueOnce(mockCliOptions);
    mockPackFn.mockResolvedValueOnce({
      html: '<html>Packed Recursive Number</html>',
      metadata: specificMetadata,
    });

    const result = await runCli(args);

    expect(mockParseOptions).toHaveBeenCalledWith(args);
    // Check pack was called
    expect(mockPackFn).toHaveBeenCalledTimes(1);
    expect(mockPackFn).toHaveBeenCalledWith(mockCliOptions.input, mockCliOptions);
    // Check file write
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy).toHaveBeenCalledWith(
      'site-packed.html',
      '<html>Packed Recursive Number</html>',
      'utf-8'
    );
    // Check result object and specific recursive output
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('✅ Packed: https://site.com → site-packed.html');
    expect(result.stdout).toContain('🧩 Pages: 5');
  });

  it('returns error if input is missing', async () => {
    const args = ['node', 'cli.js']; // No input provided
    // Simulate parseOptions returning options without an input
    mockParseOptions.mockReturnValueOnce({ ...defaultCliOptions, input: undefined });

    const result = await runCli(args);

    expect(mockParseOptions).toHaveBeenCalledWith(args);
    // Check for early exit
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('❌ Missing input file or URL');
    // Ensure pack and writeFile were not called
    expect(mockPackFn).not.toHaveBeenCalled();
    expect(writeFileSyncSpy).not.toHaveBeenCalled();
  });

  it('skips processing and writing in dry-run mode', async () => {
    const args = ['node', 'cli.js', 'index.html', '--dry-run'];
    // Simulate parseOptions returning dryRun: true
    mockParseOptions.mockReturnValueOnce({
      ...defaultCliOptions,
      input: 'index.html',
      dryRun: true,
    });

    const result = await runCli(args);

    expect(mockParseOptions).toHaveBeenCalledWith(args);
    // Ensure pack and writeFile were not called due to dry run
    expect(mockPackFn).not.toHaveBeenCalled();
    expect(writeFileSyncSpy).not.toHaveBeenCalled();
    // Check for successful exit code and dry run message
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('💡 Dry run mode');
  });

  it('handles unexpected errors from pack() gracefully', async () => {
    const args = ['node', 'cli.js', './valid-input.html'];
    const errorMessage = 'Something broke during processing';
    // Use valid options, but make pack() reject
    mockParseOptions.mockReturnValueOnce({ ...defaultCliOptions, input: './valid-input.html' });
    mockPackFn.mockRejectedValueOnce(new Error(errorMessage)); // Simulate error from pack

    const result = await runCli(args);

    expect(mockParseOptions).toHaveBeenCalledWith(args);
    expect(mockPackFn).toHaveBeenCalledTimes(1); // Ensure pack was called
    // Check for error exit code and message
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(`💥 Error: ${errorMessage}`);
    // Ensure file was not written on error
    expect(writeFileSyncSpy).not.toHaveBeenCalled();
  });

  it('displays warnings from metadata in stderr', async () => {
    const args = ['node', 'cli.js', 'index.html', '-o', 'output.html']; // Ensure output path is set
    const warningMessage = 'Asset not found: missing.css';
    const metadataWithWarning = createMockMetadata('index.html', { errors: [warningMessage] }); // Add error/warning to metadata
    mockParseOptions.mockReturnValueOnce({
      ...defaultCliOptions,
      input: 'index.html',
      output: 'output.html',
    });
    mockPackFn.mockResolvedValueOnce({
      html: '<html>Warning</html>',
      metadata: metadataWithWarning,
    }); // Return metadata with warning

    const result = await runCli(args);

    expect(mockParseOptions).toHaveBeenCalledWith(args);
    expect(mockPackFn).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1); // Verify write still happens
    expect(writeFileSyncSpy).toHaveBeenCalledWith('output.html', '<html>Warning</html>', 'utf-8');
    // Should exit 0 even with warnings
    expect(result.exitCode).toBe(0);
    // Standard output should still show success
    expect(result.stdout).toContain('✅ Packed: index.html → output.html');
    expect(result.stderr).toMatch(/⚠️\s+1\s+warning\(s\):/);
    // Warnings should be logged to stderr
    expect(result.stderr).toContain(`- ${warningMessage}`);
  });

  it('displays verbose startup logs when --verbose is used', async () => {
    const args = ['node', 'cli.js', 'index.html', '--verbose', '-o', 'out.html']; // Add verbose flag
    const verboseOptions: CLIOptions = {
      ...defaultCliOptions,
      input: 'index.html',
      output: 'out.html', // Explicit output needed for logs
      verbose: true,
      logLevel: LogLevel.DEBUG, // Verbose usually implies a lower log level from parseOptions
    };
    mockParseOptions.mockReturnValueOnce(verboseOptions);
    // We still need pack to resolve successfully
    mockPackFn.mockResolvedValue({
      html: '<!DOCTYPE html><html><body>Mock HTML</body></html>',
      metadata: createMockMetadata('index.html'), // Use simple metadata
    });

    const result = await runCli(args);

    const expectedVersionString = `📦 PortaPack v${packageJson.version}`; // Get version dynamically

    expect(mockParseOptions).toHaveBeenCalledWith(args);
    expect(mockPackFn).toHaveBeenCalledTimes(1);
    expect(writeFileSyncSpy).toHaveBeenCalledTimes(1); // Write should still occur

    // Check stdout for verbose logs
    expect(result.stdout).toContain(expectedVersionString);
    expect(result.stdout).toContain('📥 Input: index.html');
    expect(result.stdout).toContain('📤 Output: out.html'); // Checks resolved output path
    expect(result.stdout).toContain('Recursive: false'); // Check other options logged
    expect(result.stdout).toContain(`Log Level: ${verboseOptions.logLevel}`); // Check logged log level

    // Check for standard success logs as well
    expect(result.stdout).toContain('✅ Packed: index.html → out.html');
    expect(result.exitCode).toBe(0);
  });

  // Add more tests for other options, edge cases, different log levels etc.
});
