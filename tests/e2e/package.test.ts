/**
 * @file tests/e2e/package.test.ts
 * @description Checks the package as its users get it: the built CLI that the `bin` field
 * names, and the files `npm pack` puts in the tarball. `npm ci` runs the prepare script,
 * which builds dist, so CI runs these against the build; run `npm run build:code` first
 * when running them by hand.
 */

import { describe, it, expect } from '@jest/globals';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const bin = path.join(root, manifest.bin.portapack);

function requireBuild(): void {
  if (!fs.existsSync(bin)) {
    throw new Error(`${path.relative(root, bin)} is missing: run npm run build:code first`);
  }
}

describe('the built CLI', () => {
  it.each(['--version', '-V'])('prints the version in package.json for %s', flag => {
    requireBuild();
    const out = execFileSync(process.execPath, [bin, flag], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(out.trim()).toBe(manifest.version);
  });
});

describe('the packed package', () => {
  it('holds dist, package.json, the README and the licence, and every entry point', () => {
    requireBuild();
    const out = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const [packed] = JSON.parse(out.slice(out.search(/^\[/m)));
    const files: string[] = packed.files.map((file: { path: string }) => file.path);

    const topLevel = ['package.json', 'README.md', 'LICENSE.md'];
    const unexpected = files.filter(file => !file.startsWith('dist/') && !topLevel.includes(file));
    expect(unexpected).toEqual([]);

    const entryPoints = [manifest.main, manifest.module, manifest.types, manifest.bin.portapack];
    expect(files).toEqual(
      expect.arrayContaining(entryPoints.map((entry: string) => path.posix.normalize(entry)))
    );
  });
});
