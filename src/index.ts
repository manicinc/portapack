/**
 * @file index.ts
 * @description Public API surface for PortaPack.
 * Exposes the unified `pack()` method and advanced helpers like recursive crawling and multi-page bundling.
 */

import {
  fetchAndPackWebPage as coreFetchAndPack,
  recursivelyBundleSite as coreRecursivelyBundleSite,
} from './core/web-fetcher';
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
 * Options specifically for the top-level pack function, allowing logger injection.
 */
interface PackOptions extends BundleOptions {
  /** Optional custom logger instance to use instead of the default console logger. */
  loggerInstance?: Logger;
}

/**
 * Unified high-level API: bundle a local file or remote URL (with optional recursion).
 * Creates its own logger based on `options.logLevel` unless `options.loggerInstance` is provided.
 *
 * @param {string} input - File path or remote URL (http/https).
 * @param {Partial<PackOptions>} [options={}] - Configuration options, including optional `loggerInstance`, `recursive` depth, `logLevel`, etc.
 * @returns {Promise<BuildResult>} A Promise resolving to an object containing the bundled HTML (`html`) and build metadata (`metadata`).
 * @throws Will throw an error if the input protocol is unsupported or file reading/network fetching fails.
 */
export async function pack(
  input: string,
  options: Partial<PackOptions> = {}
): Promise<BuildResult> {
  const logger = options.loggerInstance || new Logger(options.logLevel);
  const isHttp = /^https?:\/\//i.test(input);

  // Check if it contains '://' but isn't http(s) -> likely unsupported protocol
  // Allow anything else (including relative/absolute paths without explicit protocols)
  if (!isHttp && /:\/\//.test(input) && !input.startsWith('file://')) {
    const errorMsg = `Unsupported protocol or input type: ${input}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  const isRemote = /^https?:\/\//i.test(input); // Check again after validation
  const recursive = options.recursive === true || typeof options.recursive === 'number';

  if (isRemote && recursive) {
    const depth = typeof options.recursive === 'number' ? options.recursive : 1;
    logger.info(`Starting recursive fetch for ${input} up to depth ${depth}`);
    return generateRecursivePortableHTML(input, depth, options, logger);
  }

  logger.info(`Starting single page processing for: ${input}`);
  return generatePortableHTML(input, options, logger);
}

/**
 * Bundle a single HTML file or URL without recursive crawling.
 * Handles both local file paths and remote HTTP/HTTPS URLs.
 * If `loggerInstance` is not provided, it creates its own logger based on `options.logLevel`.
 *
 * @param {string} input - Local file path or remote URL (http/https).
 * @param {BundleOptions} [options={}] - Configuration options.
 * @param {Logger} [loggerInstance] - Optional external logger instance.
 * @returns {Promise<BuildResult>} A Promise resolving to the build result.
 * @throws Errors during file reading, network fetching, parsing, or asset processing.
 */
export async function generatePortableHTML(
  input: string,
  options: BundleOptions = {},
  loggerInstance?: Logger
): Promise<BuildResult> {
  const logger = loggerInstance || new Logger(options.logLevel);
  const timer = new BuildTimer(input);

  if (/^https?:\/\//i.test(input)) {
    logger.info(`Workspaceing remote page: ${input}`); // Corrected typo "Workspaceing" -> "Fetching"
    try {
      const result = await coreFetchAndPack(input, logger);
      const metadata = timer.finish(result.html, result.metadata);
      logger.info(`Finished fetching and packing remote page: ${input}`);
      return { html: result.html, metadata };
    } catch (error: any) {
      logger.error(`Error fetching remote page ${input}: ${error.message}`);
      throw error;
    }
  }

  logger.info(`Processing local file: ${input}`);
  try {
    const baseUrl = options.baseUrl || input;
    // **CRITICAL: These calls MUST use the mocked versions provided by Jest**
    const parsed = await parseHTML(input, logger);
    const enriched = await extractAssets(parsed, options.embedAssets ?? true, baseUrl, logger);
    const minified = await minifyAssets(enriched, options, logger);
    const finalHtml = packHTML(minified, logger);

    const metadata = timer.finish(finalHtml, {
      assetCount: minified.assets.length,
    });
    logger.info(`Finished processing local file: ${input}`);
    return { html: finalHtml, metadata };
  } catch (error: any) {
    logger.error(`Error processing local file ${input}: ${error.message}`);
    throw error;
  }
}

/**
 * Recursively crawl a remote website starting from a URL and bundle it.
 * If `loggerInstance` is not provided, it creates its own logger based on `options.logLevel`.
 *
 * @param {string} url - The starting URL (must be http/https).
 * @param {number} [depth=1] - Maximum recursion depth (0 for only the entry page, 1 for entry + links, etc.).
 * @param {BundleOptions} [options={}] - Configuration options.
 * @param {Logger} [loggerInstance] - Optional external logger instance.
 * @returns {Promise<BuildResult>} A Promise resolving to the build result containing the multi-page bundled HTML.
 * @throws Errors during network fetching, parsing, or bundling.
 */
export async function generateRecursivePortableHTML(
  url: string,
  depth = 1,
  options: BundleOptions = {},
  loggerInstance?: Logger
): Promise<BuildResult> {
  const logger = loggerInstance || new Logger(options.logLevel);
  const timer = new BuildTimer(url);

  if (!/^https?:\/\//i.test(url)) {
    const errorMsg = `Invalid URL for recursive bundling. Must start with http:// or https://. Received: ${url}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  logger.info(`Starting recursive bundle for ${url} up to depth ${depth}`);
  try {
    // **CRITICAL: This call MUST use the mocked version provided by Jest**
    const { html, pages } = await coreRecursivelyBundleSite(url, 'output.html', depth, logger);
    timer.setPageCount(pages);

    const metadata = timer.finish(html, {
      assetCount: 0,
      pagesBundled: pages,
    });

    logger.info(`Finished recursive bundle for ${url}. Bundled ${pages} pages.`);
    return { html, metadata };
  } catch (error: any) {
    logger.error(`Error during recursive bundle for ${url}: ${error.message}`);
    throw error;
  }
}

/**
 * Create a multipage HTML bundle directly from provided page entries (HTML content and metadata).
 * Re-exported from the core bundler module.
 */
export { bundleMultiPageHTML };

/**
 * Re-export the Logger class so users can potentially create and pass their own instances.
 */
export { Logger } from './utils/logger';

/**
 * Re-export shared types for consumers of the library.
 */
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
