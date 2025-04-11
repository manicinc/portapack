/**
 * @file cli-entry.ts
 * @description
 * Safe Node.js CLI entrypoint for PortaPack, compatible with both ESM and CommonJS output.
 */

import type { CLIResult } from '../types';

const startCLI = async (): Promise<CLIResult> => {
  const { main } = await import('./cli.js'); // This stays ESM-friendly
  return await main(process.argv);
};

// Safe: if this file is the entry point, run the CLI
if (require.main === module) {
  startCLI()
    .then(({ stdout, stderr, exitCode }) => {
      if (stdout) process.stdout.write(stdout);
      if (stderr) process.stderr.write(stderr);
      process.exit(Number(exitCode));
    })
    .catch((err) => {
      console.error('💥 Unhandled CLI error:', err);
      process.exit(1);
    });
}

export { startCLI };