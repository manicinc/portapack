/**
 * @file index.ts
 * @description Public API surface for PortaPack.
 * Exposes the unified `pack()` method and advanced helpers like recursive crawling and multi-page bundling.
 */

import { fetchAndPackWebPage as coreFetchAndPack, recursivelyBundleSite as coreRecursivelyBundleSite } from './core/web-fetcher';
import { parseHTML } from './core/parser';
import { extractAssets } from './core/extractor';
import { minifyAssets } from './core/minifier';
import { packHTML } from './core/packer';
import { bundleMultiPageHTML } from './core/bundler';

import { Logger } from './utils/logger';
import { BuildTimer } from './utils/meta';

import type {
  BundleOptions,
  BundleMetadata,
  BuildResult,
  CLIResult,
  CLIOptions,
  LogLevel,
  LogLevelName,
  ParsedHTML,
  Asset,
  PageEntry,
} from './types';

/**
 * Unified high-level API: bundle a local file or remote URL (with optional recursion)
 *
 * @param input - File path or remote URL
 * @param options - Configuration options
 * @returns A Promise resolving to { html, metadata }
 */
export async function pack(input: string, options: Partial<BundleOptions> = {}): Promise<BuildResult> {
  const isRemote = /^https?:\/\//i.test(input);
  const recursive = options.recursive === true || typeof options.recursive === 'number';
  const logger = new Logger(options.logLevel);

  if (isRemote && recursive) {
    const depth = typeof options.recursive === 'number' ? options.recursive : 1;
    return generateRecursivePortableHTML(input, depth, options, logger);
  }

  return generatePortableHTML(input, options, logger);
}

/**
 * Bundle a single HTML file or URL (no crawling).
 * Can be a local file or remote URL.
 */
export async function generatePortableHTML(
  input: string,
  options: BundleOptions = {},
  loggerInstance?: Logger
): Promise<BuildResult> {
  const logger = loggerInstance || new Logger(options.logLevel);
  const timer = new BuildTimer(input);

  if (/^https?:\/\//i.test(input)) {
    logger.info(`Fetching remote page: ${input}`);
    const result = await coreFetchAndPack(input, logger);
    const metadata = timer.finish(result.html, result.metadata);
    return { html: result.html, metadata };
  }

  logger.info(`Processing local file: ${input}`);
  const baseUrl = options.baseUrl || input;
  const parsed = await parseHTML(input, logger);
  const enriched = await extractAssets(parsed, options.embedAssets ?? true, baseUrl, logger);
  const minified = await minifyAssets(enriched, options, logger);
  const finalHtml = packHTML(minified, logger);

  const metadata = timer.finish(finalHtml, {
    assetCount: minified.assets.length,
  });

  return { html: finalHtml, metadata };
}

/**
 * Recursively crawl a remote site and bundle it into a single HTML file
 */
export async function generateRecursivePortableHTML(
  url: string,
  depth = 1,
  options: BundleOptions = {},
  loggerInstance?: Logger
): Promise<BuildResult> {
  const logger = loggerInstance || new Logger(options.logLevel);
  const timer = new BuildTimer(url);

  const { html, pages } = await coreRecursivelyBundleSite(url, 'output.html', depth);
  timer.setPageCount(pages);

  const metadata = timer.finish(html, {
    assetCount: 0,
    pagesBundled: pages,
  });

  return { html, metadata };
}

/**
 * Create a multipage HTML bundle from raw HTML strings and route metadata.
 */
export { bundleMultiPageHTML };

// Re-export logger so users can pass their own
export { Logger } from './utils/logger';

// Re-export shared types for users
export type {
  BundleOptions,
  BundleMetadata,
  BuildResult,
  CLIResult,
  CLIOptions,
  LogLevel,
  LogLevelName,
  ParsedHTML,
  Asset,
  PageEntry,
};
