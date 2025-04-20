/**
 * @file bundler.ts
 * @description Core bundling functions to handle both single and multi-page HTML documents. This includes asset extraction, optional minification, and full inlining into a self-contained HTML file.
 */

import { dirname, resolve, sep as pathSeparator } from 'path';
import { pathToFileURL, URL } from 'url';
import { extractAssets } from './extractor';
import { minifyAssets } from './minifier';
import { packHTML } from './packer';
import { Logger } from '../utils/logger';
import { ParsedHTML, BundleOptions, PageEntry, LogLevel } from '../types'; // Added LogLevel import
import { sanitizeSlug } from '../utils/slugify';

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
      // Go up to the last '/' in the pathname
      url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
      url.search = ''; // Remove query string
      url.hash = ''; // Remove fragment
      const baseUrl = url.toString();
      logger?.debug(`Determined remote base URL: ${baseUrl}`);
      return baseUrl;
    } else {
      // Handle local file path
      const absoluteDir = dirname(resolve(input));
      // Ensure trailing separator for directory URL conversion
      const dirPathWithSeparator = absoluteDir.endsWith(pathSeparator)
        ? absoluteDir
        : absoluteDir + pathSeparator;
      const baseUrl = pathToFileURL(dirPathWithSeparator).href;
      logger?.debug(`Determined local base URL: ${baseUrl}`);
      return baseUrl;
    }
  } catch (error: any) {
    // Use logger?.error correctly
    logger?.error(`💀 Failed to determine base URL for "${input}": ${error.message}`);
    // Return a default relative base URL on error
    return './';
  }
}

/**
 * Creates a self-contained HTML file from a parsed HTML structure and options.
 *
 * @param parsedHtml - The parsed HTML document.
 * @param inputPathOrUrl - The original input file or URL for base URL calculation.
 * @param options - Optional bundling options.
 * @param logger - Optional logger instance.
 * @returns A fully inlined and bundled HTML string.
 */
export async function bundleSingleHTML(
  parsedHtml: ParsedHTML,
  inputPathOrUrl: string, // Renamed parameter for clarity
  options: BundleOptions = {},
  logger?: Logger
): Promise<string> {
  // Define comprehensive defaults
  const defaultOptions: Required<Omit<BundleOptions, 'logLevel' | 'loggerInstance'>> = {
    // Omit non-serializable/runtime options from defaults
    embedAssets: true,
    minifyHtml: true,
    minifyJs: true,
    minifyCss: true,
    baseUrl: '',
    verbose: false, // Default verbosity usually controlled by logger level
    dryRun: false,
    recursive: false, // Default non-recursive for single bundle
    output: '', // Default handled elsewhere or not relevant here
    // Omit logLevel from defaults, use logger?.level
  };

  // Merge provided options over defaults
  const mergedOptions = { ...defaultOptions, ...options };

  // Determine base URL only if not explicitly provided
  if (!mergedOptions.baseUrl) {
    mergedOptions.baseUrl = determineBaseUrl(inputPathOrUrl, logger);
  }

  try {
    logger?.debug(`Starting HTML bundling for ${inputPathOrUrl}`);
    // Use logger?.level safely
    const effectiveLogLevel =
      logger && typeof logger.level === 'number' ? logger.level : LogLevel.INFO; // Default to INFO if logger undefined or level wrong type
    logger?.debug(
      `Effective options: ${JSON.stringify(
        {
          ...mergedOptions,
          logLevel: effectiveLogLevel, // Include actual log level if needed
        },
        null,
        2
      )}`
    );

    // Execute the bundling pipeline
    const extracted = await extractAssets(
      parsedHtml,
      mergedOptions.embedAssets,
      mergedOptions.baseUrl,
      logger
    );
    const minified = await minifyAssets(extracted, mergedOptions, logger);
    const result = packHTML(minified, logger);

    logger?.info(`Single HTML bundling complete for: ${inputPathOrUrl}`);
    return result;
  } catch (error: any) {
    logger?.error(`Error during single HTML bundling for ${inputPathOrUrl}: ${error.message}`);
    // Re-throw to allow higher-level handling
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

  let pageIndex = 0; // Keep track of original index for logging
  const validPages = pages.filter(page => {
    const isValid =
      page &&
      typeof page === 'object' &&
      typeof page.url === 'string' &&
      typeof page.html === 'string';
    // Log with original index if invalid
    if (!isValid) logger?.warn(`Skipping invalid page entry at index ${pageIndex}`);
    pageIndex++; // Increment index regardless
    return isValid;
  });

  if (validPages.length === 0) {
    const errorMsg = 'No valid page entries found in input array';
    logger?.error(errorMsg);
    throw new Error(errorMsg);
  }

  const slugMap = new Map<string, string>();
  const usedSlugs = new Set<string>();
  let firstValidSlug: string | undefined = undefined;
  let pageCounterForFallback = 1; // Counter for unique fallback slugs

  for (const page of validPages) {
    // --- REVISED SLUG LOGIC ---
    let baseSlug = sanitizeSlug(page.url);

    // Determine if the URL represents a root index page
    const isRootIndex =
      page.url === '/' || page.url === 'index.html' || page.url.endsWith('/index.html');

    if (baseSlug === 'index' && !isRootIndex) {
      // If sanitizeSlug produced 'index' but it wasn't from a root index URL, avoid using 'index'.
      logger?.debug(`URL "${page.url}" sanitized to "index", attempting to find alternative slug.`);
      // Try using the last path segment instead.
      // Get parts, remove trailing slash/index/index.html, filter empty
      const pathParts = page.url
        .replace(/\/$/, '')
        .split('/')
        .filter(p => p && p.toLowerCase() !== 'index.html' && p.toLowerCase() !== 'index');
      if (pathParts.length > 0) {
        const lastPartSlug = sanitizeSlug(pathParts[pathParts.length - 1]);
        if (lastPartSlug && lastPartSlug !== 'index') {
          // Avoid re-introducing 'index' or using empty
          baseSlug = lastPartSlug;
          logger?.debug(`Using last path part slug "${baseSlug}" instead.`);
        } else {
          baseSlug = 'page'; // Fallback if last part is empty, 'index', or missing
          logger?.debug(`Last path part invalid ("${lastPartSlug}"), using fallback slug "page".`);
        }
      } else {
        baseSlug = 'page'; // Fallback if no other parts
        logger?.debug(`No valid path parts found, using fallback slug "page".`);
      }
    } else if (!baseSlug) {
      // Handle cases where sanitizeSlug returns an empty string initially (e.g. sanitizeSlug('/'))
      if (isRootIndex) {
        baseSlug = 'index'; // Ensure root index gets 'index' slug even if sanitizeSlug returns empty
        logger?.debug(
          `URL "${page.url}" sanitized to empty string, using "index" as it is a root index.`
        );
      } else {
        baseSlug = 'page'; // Fallback for other empty slugs
        logger?.debug(`URL "${page.url}" sanitized to empty string, using fallback slug "page".`);
      }
    }
    // Ensure baseSlug is never empty after this point before collision check
    if (!baseSlug) {
      // Use a counter to ensure uniqueness if multiple pages sanitize to empty/page
      baseSlug = `page-${pageCounterForFallback++}`;
      logger?.warn(
        `Could not determine a valid base slug for "${page.url}", using generated fallback "${baseSlug}".`
      );
    }
    // --- Collision Handling ---
    let slug = baseSlug;
    let collisionCounter = 1;
    // Keep track of the original baseSlug for logging purposes in case of collision
    const originalBaseSlugForLog = baseSlug;
    while (usedSlugs.has(slug)) {
      const newSlug = `${originalBaseSlugForLog}-${collisionCounter++}`;
      // Log with original intended base slug for clarity
      logger?.warn(
        `Slug collision detected for "${page.url}" (intended slug: '${originalBaseSlugForLog}'). Using "${newSlug}" instead.`
      );
      slug = newSlug;
    }
    usedSlugs.add(slug);
    slugMap.set(page.url, slug);

    // Track the first valid slug for default navigation
    if (firstValidSlug === undefined) {
      // Use triple equals for check
      firstValidSlug = slug;
    }
  }

  // Determine the default page slug - prefer 'index' if present, otherwise use the first page's slug
  // Use 'page' as ultimate fallback if firstValidSlug is somehow still undefined (e.g., only one page failed slug generation)
  const defaultPageSlug = usedSlugs.has('index') ? 'index' : firstValidSlug || 'page';

  // Generate HTML structure
  // (Ensure template IDs use `page-${slug}`)
  // (Ensure nav links use `href="#${slug}"` and `data-page="${slug}"`)
  // (Ensure router script uses `${defaultPageSlug}` correctly)
  const output = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multi-Page Bundle</title>
    <style>
        body { font-family: sans-serif; margin: 0; }
        #main-nav { background-color: #f0f0f0; padding: 10px; border-bottom: 1px solid #ccc; }
        #main-nav a { margin-right: 15px; text-decoration: none; color: #007bff; }
        #main-nav a.active { font-weight: bold; text-decoration: underline; }
        #page-container { padding: 20px; }
        template { display: none; }
    </style>
</head>
<body>
<nav id="main-nav">
    ${validPages
      .map(p => {
        const slug = slugMap.get(p.url)!; // Slug is guaranteed to exist here
        const label = slug; // Use slug as label for simplicity
        return `<a href="#${slug}" data-page="${slug}">${label}</a>`;
      })
      .join('\n        ')}
</nav>
<div id="page-container"></div>
${validPages
  .map(p => {
    const slug = slugMap.get(p.url)!;
    // Basic sanitization/escaping might be needed for p.html if needed
    return `<template id="page-${slug}">${p.html}</template>`;
  })
  .join('\n    ')}
<script id="router-script">
    document.addEventListener('DOMContentLoaded', function() {
        const pageContainer = document.getElementById('page-container');
        const navLinks = document.querySelectorAll('#main-nav a');

        function navigateTo(slug) {
            const template = document.getElementById('page-' + slug);
            if (!template || !pageContainer) {
                console.warn('Navigation failed: Template or container not found for slug:', slug);
                // Maybe try navigating to default page? Or just clear container?
                if (pageContainer) pageContainer.innerHTML = '<p>Page not found.</p>';
                return;
            }
            // Clear previous content and append new content
            pageContainer.innerHTML = ''; // Clear reliably
            pageContainer.appendChild(template.content.cloneNode(true));

            // Update active link styling
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('data-page') === slug);
            });

            // Update URL hash without triggering hashchange if already correct
            if (window.location.hash.substring(1) !== slug) {
                // Use pushState for cleaner history
                history.pushState({ slug: slug }, '', '#' + slug);
            }
        }

        // Handle back/forward navigation
        window.addEventListener('popstate', (event) => {
            let slug = window.location.hash.substring(1);
            // If popstate event has state use it, otherwise fallback to hash or default
            if (event && event.state && event.state.slug) { // Check event exists
                slug = event.state.slug;
            }
            // Ensure the target page exists before navigating, fallback to default slug
            const targetSlug = document.getElementById('page-' + slug) ? slug : '${defaultPageSlug}';
            navigateTo(targetSlug);
        });

        // Handle direct link clicks
        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const slug = this.getAttribute('data-page');
                if (slug) navigateTo(slug);
            });
        });

        // Initial page load
        const initialHash = window.location.hash.substring(1);
        const initialSlug = document.getElementById('page-' + initialHash) ? initialHash : '${defaultPageSlug}';
        navigateTo(initialSlug);
    });
</script>
</body>
</html>`;
  logger?.info(`Multi-page bundle generated. Size: ${Buffer.byteLength(output, 'utf-8')} bytes.`);
  return output;
}
