/**
 * @file src/core/web-fetcher.ts
 * @description Provides functions for fetching web page content using Puppeteer,
 * including recursive site crawling capabilities.
 */

import * as puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import { Logger } from '../utils/logger'; // Assuming logger is in ../utils
import { BuildResult, PageEntry } from '../types'; // Assuming types are defined here
import { bundleMultiPageHTML } from './bundler'; // Assuming bundler is here

/**
 * @typedef {object} CrawlResult
 * @property {string} url - The URL of the crawled page.
 * @property {string} html - The HTML content of the crawled page.
 */

/**
 * Fetches the rendered HTML content and basic metadata for a single web page URL.
 * Manages its own browser instance lifecycle (launch and close).
 *
 * @param {string} url - The fully qualified URL to fetch.
 * @param {Logger} [logger] - Optional logger instance for debug/info messages.
 * @param {number} [timeout=30000] - Navigation timeout in milliseconds.
 * @returns {Promise<BuildResult>} A promise that resolves with the fetched HTML
 * and metadata, or rejects on critical errors.
 * @throws {Error} Throws errors from Puppeteer launch, page creation, or navigation failures.
 */
export async function fetchAndPackWebPage(
    url: string,
    logger?: Logger,
    timeout: number = 30000
): Promise<BuildResult> {
    let browser: puppeteer.Browser | null = null; // Initialize browser to null
    const start = Date.now();
    logger?.debug(`Initiating fetch for single page: ${url}`);

    try {
        browser = await puppeteer.launch({ headless: true });
        logger?.debug(`Browser launched for ${url}`);
        const page = await browser.newPage();
        logger?.debug(`Page created for ${url}`);

        try {
            logger?.debug(`Navigating to ${url} with timeout ${timeout}ms`);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: timeout });
            logger?.debug(`Navigation successful for ${url}`);
            const html = await page.content();
            logger?.debug(`Content retrieved for ${url}`);

            const metadata: BuildResult['metadata'] = {
                input: url,
                outputSize: Buffer.byteLength(html, 'utf-8'),
                assetCount: 0, // Basic fetch doesn't track assets
                buildTimeMs: Date.now() - start,
                errors: [], // No errors if we reached this point
            };

            await page.close(); // Close the page specifically
            logger?.debug(`Page closed for ${url}`);
            // await browser.close(); // Close the browser instance
            logger?.debug(`Browser closed for ${url}`);
            browser = null; // Ensure browser is marked as closed

            return { html, metadata };

        } catch (pageError: any) {
            logger?.error(`Error during page processing for ${url}: ${pageError.message}`);
             // Ensure page is closed even if an error occurred during processing
            try { await page.close();

             } catch (closeErr) { 
                throw closeErr;
            }
            throw pageError; // Re-throw the original page processing error
        }
    } catch (launchError: any) {
        logger?.error(`Critical error during browser launch or page creation for ${url}: ${launchError.message}`);
        // Ensure browser is closed if launch succeeded but newPage failed, etc.
        // Although if launch fails, browser might be null.
        if (browser) {
            try { await browser.close(); } catch (closeErr) { /* Ignore browser close error */ }
        }
        throw launchError; // Re-throw the original launch/setup error
    } finally {
        // Final check: If browser somehow wasn't closed and isn't null, attempt closure.
        // This handles edge cases where errors might bypass earlier closes.
        if (browser) {
             logger?.warn(`Closing browser in final cleanup for ${url}. This might indicate an unusual error path.`);
             try { await browser.close(); } catch (closeErr) { /* Ignore final browser close error */ }
        }
    }
}

/**
 * Internal function to recursively crawl a website starting from a given URL.
 * Uses a single browser instance and manages pages for efficiency during crawl.
 * Implements Breadth-First Search (BFS) using a queue.
 *
 * @private
 * @param {string} startUrl - The initial URL to start crawling from.
 * @param {number} maxDepth - The maximum depth of links to follow (1 means only the start URL).
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {Promise<PageEntry[]>} A promise resolving to an array of PageEntry objects
 * containing the URL and HTML for each successfully crawled page.
 */
async function crawlWebsite(
    startUrl: string,
    maxDepth: number,
    logger?: Logger
): Promise<PageEntry[]> {
    logger?.info(`Starting crawl for ${startUrl} with maxDepth ${maxDepth}`);
    
    // Don't even start a browser if maxDepth is 0
    if (maxDepth <= 0) {
        logger?.info('maxDepth is 0 or negative, no pages will be crawled.');
        return [];
    }
    
    const browser = await puppeteer.launch({ headless: true });
    const visited = new Set<string>();
    const results: PageEntry[] = [];
    // Queue stores URLs to visit and their corresponding depth
    const queue: { url: string; depth: number }[] = [];
    
    // Initialize startOrigin for same-origin check
    let startOrigin: string;
    try {
        startOrigin = new URL(startUrl).origin;
    } catch (e: any) {
        logger?.error(`Invalid start URL: ${startUrl}. ${e.message}`);
        await browser.close();
        return []; // Cannot start crawl with invalid URL
    }

    // Normalize start URL (remove fragment) and add to queue/visited if depth allows
    let normalizedStartUrl: string;
    try {
        const parsedStartUrl = new URL(startUrl);
        parsedStartUrl.hash = ''; // Remove fragment for consistent visited checks
        normalizedStartUrl = parsedStartUrl.href;
    } catch (e: any) {
        logger?.error(`Invalid start URL: ${startUrl}. ${e.message}`);
        await browser.close();
        return []; // Cannot start crawl with invalid URL
    }

    visited.add(normalizedStartUrl);
    queue.push({ url: normalizedStartUrl, depth: 1 });
    logger?.debug(`Queued initial URL: ${normalizedStartUrl} (depth 1)`);

    while (queue.length > 0) {
        const { url, depth } = queue.shift()!; // Non-null assertion ok due to queue.length check
        logger?.info(`Processing: ${url} (depth ${depth})`);
        let page: puppeteer.Page | null = null;

        try {
            page = await browser.newPage();
            // Set a reasonable viewport, sometimes helps with rendering/layout dependent scripts
            await page.setViewport({ width: 1280, height: 800 });
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            const html = await page.content();

            // Add successfully fetched page to results
            // Ensure the object structure matches your PageEntry type definition
            results.push({ url, html });
            logger?.debug(`Successfully fetched content for ${url}`);

            // --- Link Discovery ---
            // Only look for more links if we haven't reached the maximum depth
            if (depth < maxDepth) {
                logger?.debug(`Discovering links on ${url} (current depth ${depth}, maxDepth ${maxDepth})`);
                // Use page.evaluate to get all href attributes directly from the DOM
                const hrefs = await page.evaluate(() =>
                    Array.from(document.querySelectorAll('a[href]'), a => a.getAttribute('href'))
                );
                logger?.debug(`Found ${hrefs.length} potential hrefs on ${url}`);

                let linksAdded = 0;
                for (const href of hrefs) {
                    if (!href) continue; // Skip empty hrefs like href=""

                    let absoluteUrl: string;
                    try {
                        // Resolve the href relative to the current page's URL
                        const resolved = new URL(href, url);
                        // Remove fragment (#) for visited checks and queueing consistency
                        resolved.hash = '';
                        absoluteUrl = resolved.href;
                    } catch (e) {
                        // Ignore URLs that fail to parse (e.g., "javascript:void(0)")
                        logger?.debug(`Ignoring invalid URL syntax: "${href}" on page ${url}`);
                        continue;
                    }

                    // --- Filtering and Queueing ---
                    // 1. Check if it belongs to the same origin as the start URL
                    // 2. Check if it has already been visited (or is in the queue)
                    if (absoluteUrl.startsWith(startOrigin) && !visited.has(absoluteUrl)) {
                        visited.add(absoluteUrl); // Mark as visited *before* adding to queue
                        queue.push({ url: absoluteUrl, depth: depth + 1 });
                        linksAdded++;
                        // logger?.debug(`Queueing: ${absoluteUrl} (depth ${depth + 1})`); // Verbose
                    } else {
                        // logger?.debug(`Skipping (external, visited, or invalid): ${absoluteUrl}`); // Verbose
                    }
                }
                logger?.debug(`Added ${linksAdded} new unique internal links to queue from ${url}`);
            } else {
                logger?.debug(`Max depth (${maxDepth}) reached, not discovering links on ${url}`);
            }

        } catch (err: any) {
            // Log errors encountered during page processing (goto, content, evaluate)
            logger?.warn(`❌ Failed to process ${url}: ${err.message}`);
            // Optionally add error details to results or a separate error list if needed
        } finally {
            // Ensure the page is closed reliably after processing or error
            if (page) {
                try {
                    await page.close();
                } catch (pageCloseError: any) {
                    // Log if closing the page fails, but don't let it stop the crawl
                    logger?.error(`Failed to close page for ${url}: ${pageCloseError.message}`);
                }
            }
        }
    } // End while loop

    logger?.info(`Crawl finished. Closing browser.`);
    await browser.close();
    logger?.info(`Found ${results.length} pages.`);
    return results;
}

/**
 * Fetches all internal pages of a website recursively starting from a given URL,
 * bundles them into a single HTML string using the bundler module, and writes
 * the result to a file.
 *
 * @export
 * @param {string} startUrl - The fully qualified URL to begin crawling from.
 * @param {string} outputFile - The path where the bundled HTML file should be saved.
 * @param {number} [maxDepth=1] - The maximum depth to crawl links (default: 1, only the start page).
 * @returns {Promise<{ pages: number; html: string }>} A promise resolving to an object containing
 * the number of pages successfully crawled and the final bundled HTML string.
 * @throws {Error} Throws errors if the crawl initiation fails, bundling fails, or file writing fails.
 */
export async function recursivelyBundleSite(
    startUrl: string,
    outputFile: string,
    maxDepth = 1
): Promise<{ pages: number; html: string }> {
    // Create a logger instance specifically for this operation
    const logger = new Logger();
    logger.info(`Starting recursive site bundle for ${startUrl} to ${outputFile} (maxDepth: ${maxDepth})`);

    try {
        // Step 1: Crawl the website
        const pages: PageEntry[] = await crawlWebsite(startUrl, maxDepth, logger);

        if (pages.length === 0) {
            logger.warn("Crawl completed but found 0 pages. Output file may be empty or reflect an empty bundle.");
        } else {
            logger.info(`Crawl successful, found ${pages.length} pages. Starting bundling.`);
        }

        // Step 2: Bundle the HTML content
        const bundledHtml = bundleMultiPageHTML(pages, logger); // Passing logger for consistency
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
        // Log the stack trace for better debugging if available
        if (error.stack) {
            logger.error(`Stack trace: ${error.stack}`);
        }
        // Re-throw the error to signal failure to the caller
        throw error;
    }
}