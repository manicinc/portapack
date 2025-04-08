/**
 * @file cli-entry.ts
 * @description
 * Node.js entry point for PortaPack CLI (compatible with ESM).
 * 
 * Supports:
 * - Direct execution: `node cli-entry.js`
 * - Programmatic import for testing: `import { startCLI } from './cli-entry'`
 */

import type { CLIResult } from '../types';

/**
 * Starts the CLI by importing and invoking the main CLI logic.
 * 
 * @returns {Promise<CLIResult>} - Exit code and any captured output
 */
const startCLI = async (): Promise<CLIResult> => {
  const { main } = await import('./cli.js');
  return await main(process.argv);
};

// If executed directly from the command line, run and exit.
if (import.meta.url === `file://${process.argv[1]}`) {
  startCLI().then(({ exitCode }) => process.exit(Number(exitCode))); // Cast exitCode to Number
}

export { startCLI };
