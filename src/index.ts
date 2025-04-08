/**
 * @file src/index.ts
 * @description
 * Main public API for the PortaPack library.
 * Provides functions to create portable HTML files from local paths or URLs,
 * including single-page fetching, recursive site crawling, and multi-page bundling.
 * It coordinates calls to various core modules (parser, extractor, minifier, packer, web-fetcher, bundler).
 */

// Core processing modules
import { parseHTML } from './core/parser';
import { extractAssets } from './core/extractor';
import { minifyAssets } from './core/minifier';
import { packHTML } from './core/packer';
// Core web fetching modules (imported with aliases)
import {
    fetchAndPackWebPage as coreFetchAndPack,
    recursivelyBundleSite as coreRecursivelyBundleSite
} from './core/web-fetcher';
// Core bundler module (for multi-page)
import { bundleMultiPageHTML as coreBundleMultiPageHTML } from './core/bundler';
// Utilities
import { BuildTimer } from './utils/meta';
import { Logger } from './utils/logger';

// Types
import type {
    BundleOptions,
    BuildResult,
    PageEntry,
    BundleMetadata // Type used in return values
} from './types';

/**
 * Generates a single, portable HTML file from a local file path or a remote URL.
 *
 * - **For local files:** Reads the file, parses it, discovers linked assets (CSS, JS, images, fonts),
 * fetches/reads asset content, optionally embeds assets as data URIs (default),
 * optionally minifies HTML/CSS/JS (default), and packs everything into a single HTML string.
 * - **For remote URLs:** Fetches the HTML content of the single specified URL using the core web-fetcher.
 * *Note: This does not process/embed assets for single remote URLs; it returns the fetched HTML as-is.*
 *
 * @export
 * @param {string} input - The local file path or remote http(s) URL of the HTML document.
 * @param {BundleOptions} [options={}] - Configuration options controlling embedding, minification,
 * base URL, logging level, etc. See `BundleOptions` type for details.
 * @param {Logger} [loggerInstance] - Optional pre-configured logger instance to use.
 * @returns {Promise<BuildResult>} A promise resolving to an object containing the final HTML string
 * and metadata (`BundleMetadata`) about the bundling process (input, size, time, assets, errors).
 * @throws {Error} Throws errors if file reading, parsing, required asset fetching, or processing fails critically.
 */
export async function generatePortableHTML(
    input: string,
    options: BundleOptions = {},
    loggerInstance?: Logger // Allow passing logger
): Promise<BuildResult> {
    // Use passed logger or create one based on options. Defaults to LogLevel.INFO.
    const logger = loggerInstance || new Logger(options.logLevel);
    logger.info(`Generating portable HTML for: ${input}`);
    const timer = new BuildTimer(input); // Start timing

    // --- Handle Remote URLs ---
    const isRemote = /^https?:\/\//i.test(input);
    if (isRemote) {
        logger.info(`Input is a remote URL. Fetching page content directly...`);
        try {
            // Call the specific public API wrapper for fetching, passing logger and options
            const result = await fetchAndPackWebPage(input, options, logger);
            logger.info(`Remote fetch complete. Input: ${input}, Size: ${result.metadata.outputSize} bytes, Time: ${result.metadata.buildTimeMs}ms`);
            // Forward the result (which includes metadata finalized by fetchAndPackWebPage)
            return result;
        } catch (error: any) {
            logger.error(`Failed to fetch remote URL ${input}: ${error.message}`);
            throw error; // Re-throw to signal failure
        }
    }

    // --- Handle Local Files ---
    logger.info(`Input is a local file path. Starting local processing pipeline...`);
    // Determine base path for resolving relative assets. Default to input file's path.
    const basePath = options.baseUrl || input;
    logger.debug(`Using base path for asset resolution: ${basePath}`);

    try {
        // Execute the core processing steps sequentially, passing the logger
        const parsed = await parseHTML(input, logger);
        const enriched = await extractAssets(parsed, options.embedAssets ?? true, basePath, logger);
        const minified = await minifyAssets(enriched, options, logger); // Pass full options
        const finalHtml = packHTML(minified, logger);

        // Finalize metadata using the timer.
        // Pass assetCount calculated from the final list of processed assets.
        const metadata = timer.finish(finalHtml, {
            assetCount: minified.assets.length
            // FIX: Removed incorrect attempt to get errors from logger
            // Errors collected by the timer itself (via timer.addError) will be included automatically.
        });
        logger.info(`Local processing complete. Input: ${input}, Size: ${metadata.outputSize} bytes, Assets: ${metadata.assetCount}, Time: ${metadata.buildTimeMs}ms`);
        if (metadata.errors && metadata.errors.length > 0) {
             logger.warn(`Completed with ${metadata.errors.length} warning(s) logged in metadata.`);
        }

        // Include any errors collected *by the timer* in the result
        return { html: finalHtml, metadata };

    } catch (error: any) {
        logger.error(`Error during local processing for ${input}: ${error.message}`);
        throw error; // Re-throw critical errors
    }
}

/**
 * Crawls a website starting from a given URL up to a specified depth,
 * bundles all discovered internal HTML pages into a single multi-page file,
 * and returns the result.
 *
 * @export
 * @param {string} url - The entry point URL to start crawling. Must be http or https.
 * @param {number} [depth=1] - The maximum link depth to crawl (1 means only the starting page).
 * @param {BundleOptions} [options={}] - Configuration options. Primarily used for `logLevel`.
 * @param {Logger} [loggerInstance] - Optional pre-configured logger instance to use.
 * @returns {Promise<BuildResult>} A promise resolving to an object containing the bundled multi-page HTML string
 * and metadata (`BundleMetadata`) about the crawl and bundling process.
 * @throws {Error} Throws errors if the initial URL is invalid, crawling fails, or bundling fails.
 */
export async function generateRecursivePortableHTML(
    url: string,
    depth = 1,
    options: BundleOptions = {},
    loggerInstance?: Logger // Allow passing logger
): Promise<BuildResult> {
    // Use passed logger or create one
    const logger = loggerInstance || new Logger(options.logLevel);
    logger.info(`Generating recursive portable HTML for: ${url}, Max Depth: ${depth}`);
    const timer = new BuildTimer(url);

    if (!/^https?:\/\//i.test(url)) {
        const errMsg = `Invalid input URL for recursive bundling: ${url}. Must start with http(s)://`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }

    // Placeholder output path for core function (consider removing if core doesn't need it)
    const internalOutputPathPlaceholder = `${new URL(url).hostname}_recursive.html`;

    try {
        // Call the CORE recursive site function
        // Assuming coreRecursivelyBundleSite accepts logger as an optional argument
        const { html, pages } = await coreRecursivelyBundleSite(url, internalOutputPathPlaceholder, depth); // Pass logger if accepted
        logger.info(`Recursive crawl complete. Discovered and bundled ${pages} pages.`);

        // Finalize metadata
        timer.setPageCount(pages); // Store page count
        const metadata = timer.finish(html, {
            assetCount: 0, // NOTE: Asset count across multiple pages is not currently aggregated.
            pagesBundled: pages
            // TODO: Potentially collect errors from the core function if it returns them
        });
        logger.info(`Recursive bundling complete. Input: ${url}, Size: ${metadata.outputSize} bytes, Pages: ${metadata.pagesBundled}, Time: ${metadata.buildTimeMs}ms`);
        if (metadata.errors && metadata.errors.length > 0) {
             logger.warn(`Completed with ${metadata.errors.length} warning(s) logged in metadata.`);
        }

        return { html, metadata };

    } catch (error: any) {
        logger.error(`Error during recursive generation for ${url}: ${error.message}`);
        if (error.cause instanceof Error) { // Log cause if it's an Error
            logger.error(`Cause: ${error.cause.message}`);
        }
        throw error; // Re-throw
    }
}

/**
 * Fetches the HTML content of a single remote URL using the core web-fetcher.
 * This function acts as a public wrapper, primarily adding standardized timing and metadata.
 * It does *not* process assets within the fetched HTML.
 *
 * @export
 * @param {string} url - The remote http(s) URL to fetch.
 * @param {BundleOptions} [options={}] - Configuration options, mainly for `logLevel`.
 * @param {Logger} [loggerInstance] - Optional pre-configured logger instance to use.
 * @returns {Promise<BuildResult>} A promise resolving to the BuildResult containing the fetched HTML
 * and metadata from the fetch operation.
 * @throws {Error} Propagates errors directly from the core fetching function or if URL is invalid.
 */
export async function fetchAndPackWebPage(
    url: string,
    options: BundleOptions = {},
    loggerInstance?: Logger // Allow passing an existing logger
): Promise<BuildResult> {
    // Use the passed logger or create a new one based on options
    const logger = loggerInstance || new Logger(options.logLevel);
    logger.info(`Workspaceing single remote page: ${url}`);
    const timer = new BuildTimer(url);

    if (!/^https?:\/\//i.test(url)) {
        const errMsg = `Invalid input URL for fetchAndPackWebPage: ${url}. Must start with http(s)://`;
        logger.error(errMsg);
        throw new Error(errMsg);
    }

    try {
        // Call the CORE fetcher function, passing the logger
        // Assuming coreFetchAndPack accepts logger as an optional second argument
        const result = await coreFetchAndPack(url, logger);

        // Finalize metadata using timer and data from the core result
        const metadata = timer.finish(result.html, {
            // Use assetCount and errors from core metadata if available
            assetCount: result.metadata?.assetCount ?? 0,
            errors: result.metadata?.errors ?? [] // Ensure errors array exists
        });
        logger.info(`Single page fetch complete. Input: ${url}, Size: ${metadata.outputSize} bytes, Assets: ${metadata.assetCount}, Time: ${metadata.buildTimeMs}ms`);
        if (metadata.errors && metadata.errors.length > 0) {
             logger.warn(`Completed with ${metadata.errors.length} warning(s) logged in metadata.`);
        }

        // Return HTML from core result, but use metadata finalized by this wrapper
        return { html: result.html, metadata };
    } catch (error: any) {
        logger.error(`Error during single page fetch for ${url}: ${error.message}`);
        throw error; // Re-throw original error
    }
}

/**
 * Bundles an array of pre-fetched/generated HTML pages into a single static HTML file
 * using `<template>` tags and a simple client-side hash-based router.
 * This function does not perform any asset processing on the input HTML strings.
 *
 * @export
 * @param {PageEntry[]} pages - An array of page objects, where each object has a `url` (for slug generation)
 * and `html` (the content for that page).
 * @param {BundleOptions} [options={}] - Configuration options, primarily used for `logLevel`.
 * @param {Logger} [loggerInstance] - Optional pre-configured logger instance.
 * @returns {string} A single HTML string representing the bundled multi-page document.
 */
export function bundleMultiPageHTML(
    pages: PageEntry[],
    options: BundleOptions = {},
    loggerInstance?: Logger // Allow passing an existing logger
): string {
    // Use passed logger or create a new one
    const logger = loggerInstance || new Logger(options.logLevel);
    logger.info(`Bundling ${pages.length} provided pages into multi-page HTML...`);

    try {
        // Directly call the CORE multi-page bundler function, passing the logger
        // Assuming coreBundleMultiPageHTML accepts logger as an optional second argument
        const bundledHtml = coreBundleMultiPageHTML(pages, logger);
        logger.info(`Multi-page bundling complete.`);
        return bundledHtml;
    } catch (error: any) {
         logger.error(`Error during multi-page bundling: ${error.message}`);
         throw error; // Re-throw error
    }
}

// Optional: Export core types directly from index for easier consumption?
export * from './types';