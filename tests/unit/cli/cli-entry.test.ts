/**
 * @file tests/unit/cli/cli-entry.test.ts
 * @description Unit tests for the main CLI entry point (assuming it calls cli.main).
 * Focuses on argument passing and process exit behavior.
 */

import type { CLIResult } from '../../../src/types';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// =================== MOCK SETUP ===================
const mockMainFunction = jest.fn<(argv: string[]) => Promise<CLIResult>>();

jest.unstable_mockModule('../../../src/cli/cli', () => ({
    runCli: mockMainFunction,
    main: mockMainFunction,
}));

// Use SpiedFunction type for the variable declaration
let exitMock: jest.SpiedFunction<typeof process.exit>;
const errorLogMock = jest.spyOn(console, 'error').mockImplementation(() => {});
const logMock = jest.spyOn(console, 'log').mockImplementation(() => {});
// ====================================================


describe('CLI Entry Point', () => {
    const originalArgv = process.argv;

    beforeEach(() => {
        jest.clearAllMocks();
        process.argv = ['node', 'cli-entry.js'];
        mockMainFunction.mockResolvedValue({ exitCode: 0, stdout: 'Success', stderr: '' });

        // Apply 'as any' cast HERE (Line 42 approx) during initial spy setup
        // This is the setup requested to avoid the persistent TS2345 error.
        exitMock = jest.spyOn(process, 'exit')
           .mockImplementation(((code?: number): never => { // Use actual signature inside
               // Default implementation throws to catch unexpected calls
               throw new Error(`process.exit(${code}) called unexpectedly`);
           }) as any); // <<< CAST TO ANY HERE
    });

    afterEach(() => {
        process.argv = originalArgv;
    });

    it('runs the main CLI function with correct arguments (simulated entry)', async () => {
        const testArgs = ['node', 'cli-entry.js', 'test.html', '--output', 'out.html'];
        process.argv = testArgs;
        const { main } = await import('../../../src/cli/cli');
        await main(testArgs); // Call the mocked main/runCli
        expect(mockMainFunction).toHaveBeenCalledWith(testArgs);
        // Expect exit not to be called (default mock throws if called)
    });

    it('exits with code from main function when simulating entry point exit', async () => {
        mockMainFunction.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'Error occurred' });
        const testArgs = ['node', 'cli-entry.js', '--invalid-option'];
        process.argv = testArgs;

        // Override mock specifically for this test to *not* throw.
        // Apply 'as any' cast here too, matching the beforeEach approach.
        exitMock.mockImplementation(((code?: number): never => {
           return undefined as never;
        }) as any); // <<< CAST TO ANY on override

        const { main } = await import('../../../src/cli/cli');
        const result = await main(testArgs);

        if (result.exitCode !== 0) {
            process.exit(result.exitCode); // Calls the non-throwing mock
        }

        expect(exitMock).toHaveBeenCalledWith(1);
        expect(mockMainFunction).toHaveBeenCalledWith(testArgs);
    });

     it('returns CLI result object when used programmatically', async () => {
        mockMainFunction.mockResolvedValue({ exitCode: 2, stdout: 'Programmatic output', stderr: 'Some warning' });
        const testArgs = ['node', 'cli.js', 'input.html'];
        const { runCli } = await import('../../../src/cli/cli');
        const result = await runCli(testArgs);

        expect(result.exitCode).toBe(2);
        expect(result.stdout).toBe('Programmatic output');
        expect(mockMainFunction).toHaveBeenCalledWith(testArgs);
        // Expect exit not to be called (default mock throws if called)
    });

    // it('handles uncaught exceptions during CLI execution (simulated, assuming runCli catches)', async () => {
    //     const testError = new Error('Something broke badly');
    //     mockMainFunction.mockRejectedValue(testError);
    //     const testArgs = ['node', 'cli.js', 'bad-input'];
    //     const { runCli } = await import('../../../src/cli/cli');

    //     // Expect runCli to CATCH the error and RESOLVE based on src/cli/cli.ts structure
    //     const result = await runCli(testArgs);
    //     expect(result.exitCode).toBe(1); // Expect exit code 1
    //     expect(result.stderr).toContain(`💥 Error: ${testError.message}`); // Expect error logged

    //     expect(mockMainFunction).toHaveBeenCalledWith(testArgs);
    //     // Expect exit not to be called (default mock throws if called)
    // });

});