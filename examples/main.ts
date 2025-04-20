/**
 * examples/main.ts
 *
 * Demo showcasing PortaPack API usage with clear file output and metadata.
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

import {
  generatePortableHTML,
  bundleMultiPageHTML,
  generateRecursivePortableHTML,
} from '../src/index'; // 🔧 use '../src/index' for dev, '../dist/index' for built

const TEMP_DIR = path.join(os.tmpdir(), 'portapack-example');

async function writeTempFile(name: string, html: string): Promise<string> {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  const fullPath = path.join(TEMP_DIR, name);
  await fs.writeFile(fullPath, html, 'utf-8');
  return fullPath;
}

function logMetadata(meta: any, filePath: string) {
  console.log(chalk.gray('\n--- Metadata ---'));
  console.log(`📄 Output: file://${filePath}`);
  if (meta.input) console.log(`🔗 Input: ${meta.input}`);
  if (meta.outputSize) console.log(`📦 Size: ${(meta.outputSize / 1024).toFixed(2)} KB`);
  if (meta.buildTimeMs) console.log(`⏱  Time: ${meta.buildTimeMs} ms`);
  if (meta.pagesBundled) console.log(`🧩 Pages: ${meta.pagesBundled}`);
  if (meta.errors?.length) {
    console.warn(chalk.yellow(`⚠️  ${meta.errors.length} warning(s):`));
    meta.errors.forEach((e: string) => console.warn(`- ${e}`));
  }
  console.log(chalk.gray('----------------\n'));
}

// Accepts a function that returns { html, metadata }
async function timedBundle(name: string, task: () => Promise<{ html: string; metadata: any }>) {
  const start = Date.now();
  console.log(chalk.cyanBright(`\n⏳ ${name}`));

  try {
    const { html, metadata } = await task();
    const outputFile = await writeTempFile(`${name.toLowerCase().replace(/\s+/g, '-')}.html`, html);
    console.log(chalk.green(`✅ Finished in ${Date.now() - start}ms`));
    logMetadata(metadata, outputFile);
  } catch (err) {
    console.error(chalk.red(`❌ ${name} failed:`), err);
  }
}

(async () => {
  console.log(chalk.magenta.bold('\n🌐 PortaPack API Examples'));

  // 🔹 Single local HTML file
  await timedBundle('Local HTML File Bundling', () =>
    generatePortableHTML('./examples/sample-project/index.html', {
      embedAssets: true,
      minifyHtml: true,
      minifyCss: true,
      minifyJs: true,
    })
  );

  // 🔹 Multi-page manual bundle
  await timedBundle('Multi-Page Site Bundling', async () => {
    const pages = [
      { url: 'https://example.com', html: '<html><body>Page 1</body></html>' },
      { url: 'https://example.com/about', html: '<html><body>Page 2</body></html>' },
    ];
    const html = bundleMultiPageHTML(pages);
    return {
      html,
      metadata: {
        input: 'manual pages',
        pagesBundled: pages.length,
        outputSize: html.length,
        buildTimeMs: 0,
      },
    };
  });

  // 🔹 Recursive crawl & bundle
  await timedBundle('Recursive Site Bundling', () =>
    generateRecursivePortableHTML('https://getbootstrap.com', 2)
  );

  console.log(chalk.gray(`\n📁 Output directory: ${TEMP_DIR}\n`));
})();
