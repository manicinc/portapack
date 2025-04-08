/**
 * @file src/core/parser.ts
 * @description
 * Parses an HTML file using Cheerio to extract the basic structure
 * and identify top-level linked assets (CSS, JS, images, fonts, video, audio etc.).
 * It relies on tag names, link relations, and file extensions to guess asset types.
 * It does *not* fetch or analyze the content of linked assets. Inline styles/scripts
 * and data URIs are ignored. Duplicate asset URLs are ignored.
 */

// FIX: Use only the named import for readFile
import { readFile } from 'fs/promises';
// NOTE: 'path' module was imported but not used, so removed. Add back if needed later.
// import path from 'path';
import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Asset, ParsedHTML } from '../types.js';
import { Logger } from '../utils/logger.js';
import { guessMimeType } from '../utils/mime.js';

/**
 * Parses an HTML file from the given path using Cheerio.
 * Extracts references to external assets like CSS, JS, images, fonts, video, audio
 * found in common HTML tags (<link>, <script>, <img>, <source>, <video>, <audio>, <input type="image">).
 * Does not extract assets linked *within* CSS (like @import, fonts or background images).
 * Data URIs and empty URLs are ignored. Duplicate URLs are ignored.
 *
 * @async
 * @function parseHTML
 * @param {string} entryFilePath - Absolute or relative path to the input HTML file.
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {Promise<ParsedHTML>} A promise that resolves to the parsed HTML content
 * and a list of discovered asset URLs with their inferred types.
 * @throws {Error} Throws an error with cause if the file cannot be read.
 */
export async function parseHTML(entryFilePath: string, logger?: Logger): Promise<ParsedHTML> {
    logger?.debug(`Parsing HTML file: ${entryFilePath}`);
    let htmlContent: string;
    try {
        // FIX: Use the correctly imported 'readFile' function directly
        htmlContent = await readFile(entryFilePath, 'utf-8');
        logger?.debug(`Successfully read HTML file (${Buffer.byteLength(htmlContent)} bytes).`);
    } catch (err: any) {
        logger?.error(`Failed to read HTML file "${entryFilePath}": ${err.message}`);
        throw new Error(`Could not read input HTML file: ${entryFilePath}`, { cause: err });
    }

    const $: CheerioAPI = cheerio.load(htmlContent);
    const assets: Asset[] = [];
    const addedUrls = new Set<string>();

    /** Helper to add unique assets */
    const addAsset = (url?: string, forcedType?: Asset['type']): void => {
        if (!url || url.trim() === '' || url.startsWith('data:')) {
            return;
        }
        if (!addedUrls.has(url)) {
            addedUrls.add(url);
            const mimeInfo = guessMimeType(url);
            const type = forcedType ?? mimeInfo.assetType;
            assets.push({ type, url });
            logger?.debug(`Discovered asset: Type='${type}', URL='${url}'`);
        } else {
             logger?.debug(`Skipping duplicate asset URL: ${url}`);
        }
    };

    logger?.debug('Extracting assets from HTML tags...');

    // --- Extract Assets from Various Tags ---
    // Stylesheets: <link rel="stylesheet" href="...">
    $('link[rel="stylesheet"][href]').each((_, el) => {
        addAsset($(el).attr('href'), 'css');
    });
    // JavaScript: <script src="...">
    $('script[src]').each((_, el) => {
        addAsset($(el).attr('src'), 'js');
    });
    // Images: <img src="...">, <input type="image" src="...">
    $('img[src]').each((_, el) => addAsset($(el).attr('src'), 'image'));
    $('input[type="image"][src]').each((_, el) => addAsset($(el).attr('src'), 'image'));
    // Image srcset: <img srcset="...">, <source srcset="..."> (within picture)
    $('img[srcset], picture source[srcset]').each((_, el) => {
        const srcset = $(el).attr('srcset');
        srcset?.split(',').forEach(entry => {
            const [url] = entry.trim().split(/\s+/);
            addAsset(url, 'image');
        });
    });
    // Video: <video src="...">, <video poster="...">
    $('video[src]').each((_, el) => addAsset($(el).attr('src'), 'video'));
    $('video[poster]').each((_, el) => addAsset($(el).attr('poster'), 'image'));
    // Audio: <audio src="...">
    $('audio[src]').each((_, el) => addAsset($(el).attr('src'), 'audio'));
    // Media Sources: <source src="..."> within <video> or <audio>
    $('video > source[src]').each((_, el) => addAsset($(el).attr('src'), 'video'));
    $('audio > source[src]').each((_, el) => addAsset($(el).attr('src'), 'audio'));
    // Icons and Manifest: <link rel="icon/shortcut icon/apple-touch-icon/manifest" href="...">
    $('link[href]').filter((_, el) => {
        const rel = $(el).attr('rel')?.toLowerCase() ?? '';
        return ['icon', 'shortcut icon', 'apple-touch-icon', 'manifest'].includes(rel);
    }).each((_, el) => {
         const rel = $(el).attr('rel')?.toLowerCase() ?? '';
         const isIcon = ['icon', 'shortcut icon', 'apple-touch-icon'].includes(rel);
         addAsset($(el).attr('href'), isIcon ? 'image' : undefined);
     });
    // Preloaded Fonts: <link rel="preload" as="font" href="...">
    $('link[rel="preload"][as="font"][href]').each((_, el) => {
        addAsset($(el).attr('href'), 'font');
    });

    // --- Parsing Complete ---
    logger?.info(`HTML parsing complete. Discovered ${assets.length} unique asset links.`);
    return { htmlContent, assets };
}