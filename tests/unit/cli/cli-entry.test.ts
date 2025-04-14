import type { CLIResult } from '../../../src/types';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// --- Mock Setup ---
// Mock the main function from cli.ts that startCLI calls
const mockRunCliFn = jest.fn<() => Promise<CLIResult>>();

jest.mock('../../../src/cli/cli', () => ({
  __esModule: true,
  runCli: mockRunCliFn,
  main: mockRunCliFn, // Mock both exports for safety
}));

// Spy on process methods IF startCLI interacts with them directly
// NOTE: In the current cli-entry.ts, startCLI *doesn't* directly call exit/write.
// The if (require.main === module) block does. So spying here might not be needed
// for testing startCLI's direct behavior, but can be kept if needed for other tests.
let exitSpy: jest.SpiedFunction<typeof process.exit>;
let stdoutSpy: jest.SpiedFunction<typeof process.stdout.write>;
let stderrSpy: jest.SpiedFunction<typeof process.stderr.write>;
// --- End Mock Setup ---

// Import the function to test *AFTER* mocks
import { startCLI } from '../../../src/cli/cli-entry';

describe('CLI Entry Point Function (startCLI)', () => {
  const originalArgv = [...process.argv]; // Clone original argv

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset argv for each test (startCLI uses process.argv internally)
    process.argv = ['node', '/path/to/cli-entry.js', 'default-arg'];

    // Default mock implementation for the dependency (runCli)
    mockRunCliFn.mockResolvedValue({ exitCode: 0, stdout: 'Default Success', stderr: '' });

    // Spies (optional for testing startCLI directly, but good practice)
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    process.argv = originalArgv; // Restore original argv
    // jest.restoreAllMocks(); // Usually covered by clearAllMocks
  });

  it('should call the underlying runCli function with process.argv', async () => {
    const testArgs = ['node', 'cli-entry.js', 'input.file', '-o', 'output.file'];
    process.argv = testArgs; // Set specific argv for this test

    await startCLI(); // Execute the function exported from cli-entry

    expect(mockRunCliFn).toHaveBeenCalledTimes(1);
    // Verify runCli received the arguments startCLI got from process.argv
    expect(mockRunCliFn).toHaveBeenCalledWith(testArgs);
    // startCLI itself doesn't call process.exit or write, the surrounding block does
    expect(exitSpy).not.toHaveBeenCalled();
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).not.toHaveBeenCalled();
  });

  it('should return the result object from runCli', async () => {
    const expectedResult: CLIResult = {
      exitCode: 2,
      stdout: 'Programmatic output',
      stderr: 'Some warning',
    };
    mockRunCliFn.mockResolvedValue(expectedResult); // Configure mock return
    process.argv = ['node', 'cli.js', 'input.html']; // Set argv for this call

    // Call startCLI and check its return value
    const result = await startCLI();

    expect(result).toEqual(expectedResult); // Verify return value
    expect(mockRunCliFn).toHaveBeenCalledTimes(1);
    expect(mockRunCliFn).toHaveBeenCalledWith(process.argv); // Check args passed
    expect(exitSpy).not.toHaveBeenCalled(); // startCLI doesn't exit
  });

  it('should return the rejected promise if runCli rejects', async () => {
    const testArgs = ['node', 'cli.js', 'crash'];
    process.argv = testArgs;
    const testError = new Error('Unhandled crash');
    mockRunCliFn.mockRejectedValue(testError); // Configure mock rejection

    // Expect startCLI itself to reject when runCli rejects
    await expect(startCLI()).rejects.toThrow(testError);

    expect(mockRunCliFn).toHaveBeenCalledTimes(1);
    expect(mockRunCliFn).toHaveBeenCalledWith(testArgs);
    expect(exitSpy).not.toHaveBeenCalled(); // No exit from startCLI
  });
});
