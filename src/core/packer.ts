/**
 * @file src/core/packer.ts
 * @description Inlines CSS, JS, and images into an HTML document for full portability.
 * Uses Cheerio for safe DOM manipulation.
 */

import * as cheerio from 'cheerio';
// Import CheerioAPI type
import type { CheerioAPI } from 'cheerio';
import type { ParsedHTML, Asset } from '../types'; // Assuming correct path
import { Logger } from '../utils/logger'; // Assuming correct path
import { guessMimeType } from '../utils/mime'; // Assuming correct path

/**
 * Escapes characters potentially problematic within inline `<script>` tags.
 */
function escapeScriptContent(code: string): string {
    return code.replace(/<\/(script)/gi, '<\\/$1');
}

/**
 * Ensures a `<base href="./">` tag exists within the `<head>` of the HTML.
 * Creates <head> or even <html> if necessary using Cheerio.
 *
 * @param {CheerioAPI} $ - The Cheerio instance representing the HTML document.
 * @param {Logger} [logger] - Optional logger instance.
 */
function ensureBaseTag($: CheerioAPI, logger?: Logger): void {
    let head = $('head');

    // If <head> doesn't exist, create it, ensuring <html> exists first.
    if (head.length === 0) {
        logger?.debug('No <head> tag found. Creating <head> and ensuring <html> exists.');
        let htmlElement = $('html');

        // If <html> doesn't exist, create it and wrap the existing content.
        if (htmlElement.length === 0) {
            logger?.debug('No <html> tag found. Wrapping content in <html><body>...');
            const bodyContent = $.root().html() || '';
            $.root().empty();
            // FIX: Use 'as any' for type assertion
            htmlElement = $('<html>').appendTo($.root()) as any;
            // FIX: Use 'as any' for type assertion
            head = $('<head>').appendTo(htmlElement) as any;
            $('<body>').html(bodyContent).appendTo(htmlElement);
        } else {
            // If <html> exists but <head> doesn't, prepend <head> to <html>
            // FIX: Use 'as any' for type assertion
            head = $('<head>').prependTo(htmlElement) as any;
        }
    }

    // Now head should represent the head element selection.
    // Check if <base> exists within the guaranteed <head>.
    // Use type guard just in case head couldn't be created properly
    if (head && head.length > 0 && head.find('base[href]').length === 0) {
        logger?.debug('Prepending <base href="./"> to <head>.');
        head.prepend('<base href="./">');
    }
}


/**
 * Inlines assets into the HTML document using Cheerio for safe DOM manipulation.
 */
function inlineAssets($: CheerioAPI, assets: Asset[], logger?: Logger): void {
    logger?.debug(`Inlining ${assets.filter(a => a.content).length} assets with content...`);
    const assetMap = new Map<string, Asset>(assets.map(asset => [asset.url, asset]));

    // 1. Inline CSS (<link rel="stylesheet" href="...">)
    $('link[rel="stylesheet"][href]').each((_, el) => {
        const link = $(el);
        const href = link.attr('href');
        const asset = href ? assetMap.get(href) : undefined;
        if (asset?.content && typeof asset.content === 'string') {
            if (asset.content.startsWith('data:')) {
                 logger?.debug(`Replacing link with style tag using existing data URI: ${asset.url}`);
                 const styleTag = $('<style>').text(`@import url("${asset.content}");`);
                 link.replaceWith(styleTag);
            } else {
                 logger?.debug(`Inlining CSS: ${asset.url}`);
                 const styleTag = $('<style>').text(asset.content);
                 link.replaceWith(styleTag);
            }
        } else if (href) {
             logger?.warn(`Could not inline CSS: ${href}. Content missing or invalid.`);
        }
    });

    // 2. Inline JS (<script src="...">)
    $('script[src]').each((_, el) => {
        const script = $(el);
        const src = script.attr('src');
        const asset = src ? assetMap.get(src) : undefined;
        if (asset?.content && typeof asset.content === 'string') {
            logger?.debug(`Inlining JS: ${asset.url}`);
            const inlineScript = $('<script>');
            inlineScript.text(escapeScriptContent(asset.content));
            Object.entries(script.attr() || {}).forEach(([key, value]) => {
                 if (key.toLowerCase() !== 'src') inlineScript.attr(key, value);
            });
            script.replaceWith(inlineScript);
        } else if (src) {
            logger?.warn(`Could not inline JS: ${src}. Content missing or not string.`);
        }
    });

    // 3. Inline Images (<img src="...">, <video poster="...">, etc.)
    $('img[src], video[poster], input[type="image"][src]').each((_, el) => {
        const element = $(el);
        const srcAttr = element.is('video') ? 'poster' : 'src';
        const src = element.attr(srcAttr);
        const asset = src ? assetMap.get(src) : undefined;
        if (asset?.content && typeof asset.content === 'string' && asset.content.startsWith('data:')) {
            logger?.debug(`Inlining image via ${srcAttr}: ${asset.url}`);
            element.attr(srcAttr, asset.content);
        } else if (src) {
            logger?.warn(`Could not inline image via ${srcAttr}: ${src}. Content missing or not a data URI.`);
        }
    });

     // 4. Inline srcset attributes (<img srcset="...">, <source srcset="...">)
     $('img[srcset], source[srcset]').each((_, el) => {
         const element = $(el);
         const srcset = element.attr('srcset');
         if (!srcset) return;
         const newSrcsetParts: string[] = [];
         let changed = false;
         srcset.split(',').forEach(part => {
             const trimmedPart = part.trim();
             const [url, descriptor] = trimmedPart.split(/\s+/, 2);
             const asset = url ? assetMap.get(url) : undefined;
             if (asset?.content && typeof asset.content === 'string' && asset.content.startsWith('data:')) {
                 newSrcsetParts.push(`${asset.content}${descriptor ? ' ' + descriptor : ''}`);
                 changed = true;
             } else {
                 newSrcsetParts.push(trimmedPart);
             }
         });
         if (changed) {
              element.attr('srcset', newSrcsetParts.join(', '));
         }
     });

     // 5. Inline other asset types (video, audio sources)
      $('video[src], audio[src], video > source[src], audio > source[src]').each((_, el) => {
         const element = $(el);
         const src = element.attr('src');
         const asset = src ? assetMap.get(src) : undefined;
         if (asset?.content && typeof asset.content === 'string' && asset.content.startsWith('data:')) {
             logger?.debug(`Inlining media source: ${asset.url}`);
             element.attr('src', asset.content);
         }
     });

    logger?.debug('Asset inlining process complete.');
}


/**
 * Packs a ParsedHTML object into a single, self-contained HTML string.
 * This involves ensuring a base tag exists and inlining all assets
 * that have content available. Uses Cheerio for safe DOM manipulation.
 *
 * @export
 * @param {ParsedHTML} parsed - The parsed HTML document object, including its list of assets (which may have content).
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {string} The packed HTML string with assets inlined. Returns a minimal HTML structure if input is invalid.
 */
export function packHTML(parsed: ParsedHTML, logger?: Logger): string {
    const { htmlContent, assets } = parsed;
    if (!htmlContent || typeof htmlContent !== 'string') {
        logger?.warn('Packer received empty or invalid htmlContent. Returning minimal HTML shell.');
        return '<!DOCTYPE html><html><head><base href="./"></head><body></body></html>';
    }

    logger?.debug('Loading HTML content into Cheerio for packing...');
    const $ = cheerio.load(htmlContent);

    logger?.debug('Ensuring <base> tag exists...');
    ensureBaseTag($, logger); // Ensure base tag safely

    logger?.debug('Starting asset inlining...');
    inlineAssets($, assets, logger); // Inline assets safely

    logger?.debug('Generating final packed HTML string...');
    const finalHtml = $.html();

    logger?.debug(`Packing complete. Final size: ${Buffer.byteLength(finalHtml)} bytes.`);
    return finalHtml;
}