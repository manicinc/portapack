/**
 * @file bundler.ts
 * @description Core bundling functions to handle both single and multi-page HTML documents. This includes asset extraction, optional minification, and full inlining into a self-contained HTML file.
 * @version 1.3.0
 */

import { dirname, resolve } from 'path';
import { pathToFileURL, URL } from 'url';
import { extractAssets } from './extractor.js';
import { minifyAssets } from './minifier.js';
import { packHTML } from './packer.js';
import { Logger } from '../utils/logger.js';
import { ParsedHTML, BundleOptions, PageEntry } from '../types.js';
import { sanitizeSlug, slugify } from '../utils/slugify.js';

/**
 * Determines the appropriate base URL for resolving relative assets
 * based on input HTML file path or URL.
 *
 * @param input - The original HTML path or URL.
 * @param logger - Optional logger instance.
 * @returns The resolved base URL, ending in a trailing slash.
 */
function determineBaseUrl(input: string, logger?: Logger): string {
    try {
        if (input.startsWith('http://') || input.startsWith('https://')) {
            const url = new URL(input);
            url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
            url.search = '';
            url.hash = '';
            const baseUrl = url.toString();
            logger?.debug(`Determined remote base URL: ${baseUrl}`);
            return baseUrl;
        } else {
            const absoluteDir = dirname(resolve(input));
            const baseUrl = pathToFileURL(absoluteDir + '/').href;
            logger?.debug(`Determined local base URL: ${baseUrl}`);
            return baseUrl;
        }
    } catch (error: any) {
        logger?.error(`Failed to determine base URL for "${input}": ${error.message}`);
        return './';
    }
}

/**
 * Creates a self-contained HTML file from a parsed HTML structure and options.
 *
 * @param parsedHtml - The parsed HTML document.
 * @param inputPath - The original input file or URL for base URL calculation.
 * @param options - Optional bundling options.
 * @param logger - Optional logger instance.
 * @returns A fully inlined and bundled HTML string.
 */
export async function bundleSingleHTML(
    parsedHtml: ParsedHTML,
    inputPath: string,
    options: BundleOptions = {},
    logger?: Logger
): Promise<string> {
    try {
        const defaultOptions: Required<BundleOptions> = {
            embedAssets: true,
            minifyHtml: true,
            minifyJs: true,
            minifyCss: true,
            baseUrl: '',
            verbose: false,
            dryRun: false,
            recursive: false,
            output: '',
            logLevel: logger?.level ?? 3,
        };

        const mergedOptions = { ...defaultOptions, ...options };

        if (!mergedOptions.baseUrl) {
            mergedOptions.baseUrl = determineBaseUrl(inputPath, logger);
        }

        logger?.debug(`Starting HTML bundling for ${inputPath}`);
        logger?.debug(`Effective options: ${JSON.stringify(mergedOptions, null, 2)}`);

        const extracted = await extractAssets(parsedHtml, mergedOptions.embedAssets, mergedOptions.baseUrl, logger);
        const minified = await minifyAssets(extracted, mergedOptions, logger);
        const result = packHTML(minified, logger);

        logger?.info(`Single HTML bundling complete for: ${inputPath}`);
        return result;
    } catch (error: any) {
        logger?.error(`Error during single HTML bundling: ${error.message}`);
        throw error;
    }
}

/**
 * Combines multiple HTML pages into a single HTML file with client-side routing.
 *
 * @param pages - An array of PageEntry objects (each with a URL and HTML content).
 * @param logger - Optional logger for diagnostics.
 * @returns A complete HTML document as a string.
 * @throws {Error} If the input is invalid or contains no usable pages.
 */
export function bundleMultiPageHTML(pages: PageEntry[], logger?: Logger): string {
    if (!Array.isArray(pages)) {
        const errorMsg = 'Input pages must be an array of PageEntry objects';
        logger?.error(errorMsg);
        throw new Error(errorMsg);
    }

    logger?.info(`Bundling ${pages.length} pages into a multi-page HTML document.`);

    const validPages = pages.filter(page => {
        const isValid = page && typeof page === 'object' && typeof page.url === 'string' && typeof page.html === 'string';
        if (!isValid) logger?.warn('Skipping invalid page entry');
        return isValid;
    });

    if (validPages.length === 0) {
        const errorMsg = 'No valid page entries found in input array';
        logger?.error(errorMsg);
        throw new Error(errorMsg);
    }

    const slugMap = new Map<string, string>();
    const usedSlugs = new Set<string>();

    for (const page of validPages) {
        const baseSlug = sanitizeSlug(page.url);
        let slug = baseSlug;
        let counter = 1;
        while (usedSlugs.has(slug)) {
            slug = `${baseSlug}-${counter++}`;
            logger?.warn(`Slug collision detected for "${page.url}". Using "${slug}" instead.`);
        }
        usedSlugs.add(slug);
        slugMap.set(page.url, slug);
    }

    const defaultPageSlug = slugMap.get(validPages[0].url);

    let output = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Page Bundle</title>
</head>
<body>
    <nav id="main-nav">
        ${validPages.map(p => {
            const slug = slugMap.get(p.url)!;
            const label = p.url.split('/').pop()?.split('.')[0] || 'Page';
            return `<a href="#${slug}" data-page="${slug}">${label}</a>`;
        }).join('\n')}
    </nav>
    <div id="page-container"></div>
    ${validPages.map(p => {
        const slug = slugMap.get(p.url)!;
        return `<template id="page-${slug}">${p.html}</template>`;
    }).join('\n')}
    <script id="router-script">
        document.addEventListener('DOMContentLoaded', function() {
            function navigateTo(slug) {
                const template = document.getElementById('page-' + slug);
                const container = document.getElementById('page-container');
                if (!template || !container) return;
                container.innerHTML = '';
                container.appendChild(template.content.cloneNode(true));
                document.querySelectorAll('#main-nav a').forEach(link => {
                    if (link.getAttribute('data-page') === slug) link.classList.add('active');
                    else link.classList.remove('active');
                });
                if (window.location.hash.substring(1) !== slug) {
                    history.pushState(null, '', '#' + slug);
                }
            }

            window.addEventListener('hashchange', () => {
                const slug = window.location.hash.substring(1);
                if (document.getElementById('page-' + slug)) navigateTo(slug);
            });

            document.querySelectorAll('#main-nav a').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const slug = this.getAttribute('data-page');
                    navigateTo(slug);
                });
            });

            const initial = window.location.hash.substring(1);
            navigateTo(document.getElementById('page-' + initial) ? initial : '${defaultPageSlug}');
        });
    </script>
</body>
</html>`;

    logger?.info(`Multi-page bundle generated. Size: ${Buffer.byteLength(output, 'utf-8')} bytes.`);
    return output;
}
