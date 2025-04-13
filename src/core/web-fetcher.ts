/**
 * @file src/core/web-fetcher.ts
 * @description Provides functions for fetching web page content using Puppeteer,
 * including recursive site crawling capabilities.
 */

import * as puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger'; // Assuming logger is in ../utils
import { BuildResult, PageEntry, BundleMetadata } from '../types'; // Assuming types are defined here
import { bundleMultiPageHTML } from './bundler'; // Assuming bundler is here

// Puppeteer Launch Options (Consider making configurable)
const PUPPETEER_LAUNCH_OPTIONS: puppeteer.LaunchOptions = {
    headless: true,
    args: [
        '--no-sandbox', // Often required in containerized environments
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Recommended for Docker/CI
    ],
};

// Default Page Navigation Options (Consider making configurable)
const DEFAULT_PAGE_TIMEOUT = 30000; // 30 seconds

/**
 * Fetches the rendered HTML content and basic metadata for a single web page URL.
 * Manages its own browser instance lifecycle (launch and close).
 *
 * @param {string} url - The fully qualified URL to fetch.
 * @param {Logger} [logger] - Optional logger instance for debug/info messages.
 * @param {number} [timeout=DEFAULT_PAGE_TIMEOUT] - Navigation timeout in milliseconds.
 * @param {string} [userAgent] - Optional custom User-Agent string.
 * @returns {Promise<BuildResult>} A promise that resolves with the fetched HTML
 * and metadata, or rejects on critical errors.
 * @throws {Error} Throws errors from Puppeteer launch, page creation, or navigation failures.
 */
export async function fetchAndPackWebPage(
    url: string,
    logger?: Logger,
    timeout: number = DEFAULT_PAGE_TIMEOUT,
    userAgent?: string,
): Promise<BuildResult> {
    let browser: puppeteer.Browser | null = null;
    const start = Date.now();
    logger?.info(`Initiating fetch for single page: ${url}`);

    try {
        logger?.debug('Launching browser...');
        browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
        logger?.debug(`Browser launched successfully (PID: ${browser.process()?.pid}).`);
        const page = await browser.newPage();
        logger?.debug(`New page created for ${url}`);

        // Set User-Agent if provided
        if (userAgent) {
            await page.setUserAgent(userAgent);
            logger?.debug(`User-Agent set to: "${userAgent}"`);
        }

        try {
            logger?.debug(`Navigating to ${url} with timeout ${timeout}ms`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout });
            logger?.debug(`Navigation successful for ${url}`);
            const html = await page.content();
            logger?.debug(`Content retrieved for ${url} (${Buffer.byteLength(html, 'utf-8')} bytes)`);

            const metadata: BundleMetadata = {
                input: url,
                outputSize: Buffer.byteLength(html, 'utf-8'),
                assetCount: 0, // Basic fetch doesn't track assets processed by *this* tool
                buildTimeMs: Date.now() - start,
                errors: [], // No errors if we reached this point
            };

            await page.close();
            logger?.debug(`Page closed for ${url}`);
            await browser.close();
            logger?.debug(`Browser closed for ${url}`);
            browser = null; // Ensure browser is marked as closed

            return { html, metadata };

        } catch (pageError: any) {
            logger?.error(`Error during page processing for ${url}: ${pageError.message}`);
             // Attempt to close the page even if processing failed
            if (page && !page.isClosed()) {
                try {
                    await page.close();
                    logger?.debug(`Page closed after error for ${url}`);
                } catch (closeErr: any) {
                     logger?.error(`Failed to close page after error for ${url}: ${closeErr.message}`);
                     // Decide if this secondary error should be thrown or just logged
                }
            }
            throw pageError; // Re-throw the original page processing error
        }
    } catch (launchError: any) {
        logger?.error(`Critical error during browser launch or page setup for ${url}: ${launchError.message}`);
        // Ensure browser is closed if launch succeeded partially but later failed
        if (browser) {
            try {
                await browser.close();
                logger?.debug('Browser closed after launch/setup error.');
             } catch (closeErr: any) {
                 logger?.warn(`Failed to close browser after launch/setup error: ${closeErr.message}`);
             }
             browser = null;
        }
        throw launchError; // Re-throw the original launch/setup error
    } finally {
        // Final safety net: If browser somehow wasn't closed and isn't null, attempt closure.
        if (browser) {
             logger?.warn(`Closing browser in final cleanup for ${url}. This might indicate an unusual error path.`);
             try { await browser.close(); } catch (closeErr) { /* Ignore final browser close error */ }
        }
    }
}


/**
 * @typedef {object} CrawlOptions
 * @property {number} [maxDepth=1] - Maximum crawl depth.
 * @property {number} [timeout=DEFAULT_PAGE_TIMEOUT] - Navigation timeout per page.
 * @property {string[]} [include=[]] - Glob patterns for URLs to include.
 * @property {string[]} [exclude=[]] - Glob patterns for URLs to exclude.
 * @property {string} [userAgent] - Custom User-Agent string.
 * @property {Logger} [logger] - Optional logger instance.
 */

/**
 * Internal function to recursively crawl a website starting from a given URL.
 * Uses a single browser instance and manages pages for efficiency during crawl.
 * Implements Breadth-First Search (BFS) using a queue.
 * Respects same-origin policy and visited URLs.
 *
 * @private
 * @param {string} startUrl - The initial URL to start crawling from.
 * @param {CrawlOptions} options - Crawling configuration options.
 * @returns {Promise<PageEntry[]>} A promise resolving to an array of PageEntry objects
 * containing the URL and HTML for each successfully crawled page.
 */
async function crawlWebsite(
    startUrl: string,
    options: {
        maxDepth?: number;
        timeout?: number;
        include?: string[]; // Add include/exclude/userAgent later if needed
        exclude?: string[];
        userAgent?: string;
        logger?: Logger;
    }
): Promise<PageEntry[]> {
    const {
        maxDepth = 1,
        timeout = DEFAULT_PAGE_TIMEOUT,
        // include = ['**'], // TODO: Implement glob filtering
        // exclude = [],
        userAgent,
        logger,
    } = options;

    logger?.info(`Starting crawl for ${startUrl} with maxDepth ${maxDepth}`);

    if (maxDepth <= 0) {
        logger?.warn('maxDepth is 0 or negative, no pages will be crawled.');
        return [];
    }

    let browser: puppeteer.Browser | null = null;
    const visited = new Set<string>();
    const results: PageEntry[] = [];
    const queue: { url: string; depth: number }[] = [];
    let startOrigin: string;

    try {
        // Validate start URL and get origin
        try {
            startOrigin = new URL(startUrl).origin;
        } catch (e: any) {
            logger?.error(`Invalid start URL: ${startUrl}. ${e.message}`);
            throw new Error(`Invalid start URL: ${startUrl}`); // Propagate error
        }

        // Normalize start URL (remove fragment)
        let normalizedStartUrl: string;
        try {
            const parsedStartUrl = new URL(startUrl);
            parsedStartUrl.hash = '';
            normalizedStartUrl = parsedStartUrl.href;
        } catch (e: any) {
            logger?.error(`Invalid start URL: ${startUrl}. ${e.message}`);
            throw new Error(`Invalid start URL: ${startUrl}`); // Propagate error
        }

        // Launch browser *after* validating URL
        logger?.debug('Launching browser for crawl...');
        browser = await puppeteer.launch(PUPPETEER_LAUNCH_OPTIONS);
        logger?.debug(`Browser launched for crawl (PID: ${browser.process()?.pid}).`);

        // Initial queue setup
        visited.add(normalizedStartUrl);
        queue.push({ url: normalizedStartUrl, depth: 1 });
        logger?.debug(`Queued initial URL: ${normalizedStartUrl} (depth 1)`);

        while (queue.length > 0) {
            const { url, depth } = queue.shift()!;
            logger?.info(`Processing: ${url} (depth ${depth})`);
            let page: puppeteer.Page | null = null;

            try {
                page = await browser.newPage();

                if (userAgent) {
                    await page.setUserAgent(userAgent);
                }
                // Consider adding viewport setting if needed: await page.setViewport({ width: 1280, height: 800 });

                await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout });
                const html = await page.content();

                results.push({ url, html }); // Matches PageEntry type
                logger?.debug(`Successfully fetched content for ${url}`);

                // Link Discovery (only if not at max depth)
                if (depth < maxDepth) {
                    logger?.debug(`Discovering links on ${url} (depth ${depth}/${maxDepth})`);
                    const hrefs = await page.evaluate(() =>
                        Array.from(document.querySelectorAll('a[href]'), a => a.getAttribute('href'))
                    );
                    logger?.debug(`Found ${hrefs.length} potential hrefs on ${url}`);

                    let linksAdded = 0;
                    for (const href of hrefs) {
                        if (!href) continue;

                        let absoluteUrl: string;
                        try {
                            const resolved = new URL(href, url);
                            resolved.hash = ''; // Normalize
                            absoluteUrl = resolved.href;
                        } catch (e) {
                            logger?.debug(`Ignoring invalid URL syntax: "${href}" on page ${url}`);
                            continue;
                        }

                        // TODO: Implement include/exclude filtering here using micromatch or similar
                        // if (!matchesInclude(absoluteUrl, include) || matchesExclude(absoluteUrl, exclude)) {
                        //     logger?.debug(`Skipping due to include/exclude rules: ${absoluteUrl}`);
                        //     continue;
                        // }

                        // Filter: same origin and not visited
                        if (absoluteUrl.startsWith(startOrigin) && !visited.has(absoluteUrl)) {
                            visited.add(absoluteUrl);
                            queue.push({ url: absoluteUrl, depth: depth + 1 });
                            linksAdded++;
                        }
                    }
                    logger?.debug(`Added ${linksAdded} new unique internal links to queue from ${url}`);
                } else {
                    logger?.debug(`Max depth (${maxDepth}) reached, not discovering links on ${url}`);
                }

            } catch (err: any) {
                logger?.warn(`❌ Failed to process ${url}: ${err.message}`);
                // Continue crawl even if one page fails
            } finally {
                if (page && !page.isClosed()) {
                    try {
                        await page.close();
                    } catch (pageCloseError: any) {
                        logger?.error(`Failed to close page for ${url}: ${pageCloseError.message}`);
                    }
                }
            }
        } // End while loop

    } catch (error) {
        // Catch critical errors like invalid start URL or browser launch failure
        logger?.error(`Critical crawl error: ${error instanceof Error ? error.message : error}`);
        // Rethrow or handle appropriately
        throw error;
    } finally {
        // Ensure browser is closed after crawl finishes or critical error occurs
        if (browser) {
            logger?.info(`Crawl finished or errored. Closing browser.`);
            await browser.close();
            logger?.debug(`Browser closed after crawl.`);
        }
    }

    logger?.info(`Crawl found ${results.length} pages.`);
    return results;
}


/**
 * Fetches all internal pages of a website recursively starting from a given URL,
 * bundles them into a single HTML string using the bundler module, and writes
 * the result to a file. Creates its own logger unless `loggerInstance` is provided.
 *
 * @export
 * @param {string} startUrl - The fully qualified URL to begin crawling from.
 * @param {string} outputFile - The path where the bundled HTML file should be saved.
 * @param {number} [maxDepth=1] - The maximum depth to crawl links (default: 1, only the start page).
 * @param {Logger} [loggerInstance] - Optional external logger instance to use.
 * @returns {Promise<{ pages: number; html: string }>} A promise resolving to an object containing
 * the number of pages successfully crawled and the final bundled HTML string.
 * @throws {Error} Throws errors if the crawl initiation fails, bundling fails, or file writing fails.
 */
export async function recursivelyBundleSite(
    startUrl: string,
    outputFile: string,
    maxDepth = 1,
    loggerInstance?: Logger // Added optional logger parameter
): Promise<{ pages: number; html: string }> {
    // Use provided logger OR create a new default one
    const logger = loggerInstance || new Logger();
    logger.info(`Starting recursive site bundle for ${startUrl} to ${outputFile} (maxDepth: ${maxDepth})`);

    try {
        // Step 1: Crawl the website
        // Pass necessary options down to crawlWebsite
        const crawlOptions = { maxDepth, logger /* Add other options like timeout, userAgent if needed */ };
        const pages: PageEntry[] = await crawlWebsite(startUrl, crawlOptions);

        if (pages.length === 0) {
            logger.warn("Crawl completed but found 0 pages. Output file may be empty or reflect an empty bundle.");
        } else {
            logger.info(`Crawl successful, found ${pages.length} pages. Starting bundling.`);
        }

        // Step 2: Bundle the HTML content
        // Pass the same logger instance for consistent logging
        const bundledHtml = bundleMultiPageHTML(pages, logger);
        logger.info(`Bundling complete. Output size: ${Buffer.byteLength(bundledHtml, 'utf-8')} bytes.`);

        // Step 3: Write the bundled HTML to the output file
        logger.info(`Writing bundled HTML to ${outputFile}`);
        await fs.writeFile(outputFile, bundledHtml, 'utf-8');
        logger.info(`Successfully wrote bundled output to ${outputFile}`);

        // Step 4: Return the results
        return {
            pages: pages.length,
            html: bundledHtml
        };
    } catch (error: any) {
        logger.error(`Error during recursive site bundle: ${error.message}`);
        if (error.stack) {
            logger.error(`Stack trace: ${error.stack}`);
        }
        throw error; // Re-throw the error
    }
}