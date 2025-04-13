/**
 * @file src/core/extractor.ts
 * @description Handles discovery, resolution, fetching, and optional embedding of assets
 * linked from HTML and recursively within CSS (@import, url()). This is the heart of finding EVERYTHING.
 * @version 1.1.4 - Added console logs for debugging path/URL resolution. Refined determineBaseUrl.
 */

// === Node.js Core Imports ===
import { readFile } from 'fs/promises';
import * as fs from 'fs'; // Required for statSync for sync directory check
import type { FileHandle } from 'fs/promises';
import path from 'path';
import { fileURLToPath, URL } from 'url'; // Crucial for file path/URL conversion

// === External Dependencies ===
// Using requireNamespace avoids potential ESM/CJS interop issues with mocks if they arise
// const axios = require('axios'); // Alternative if import * causes issues with mocks
import * as axiosNs from 'axios'; // Using namespace import for clarity
import type { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// === Project Imports ===
import type { Asset, ParsedHTML } from '../types'; // Adjust path if needed
import { guessMimeType } from '../utils/mime'; // Adjust path if needed
import { Logger } from '../utils/logger'; // Adjust path if needed

// === Constants ===
/** Set of asset types defined in Asset['type'] generally considered text-based */
const TEXT_ASSET_TYPES: Set<Asset['type']> = new Set(['css', 'js']);
/** Set of asset types defined in Asset['type'] generally considered binary and embedded via Base64 Data URI */
const BINARY_ASSET_TYPES: Set<Asset['type']> = new Set(['image', 'font', 'video', 'audio']);
/** Maximum number of iterations for the asset discovery loop to prevent infinite cycles. */
const MAX_ASSET_EXTRACTION_ITERATIONS = 1000;

// === Helper Functions ===

/**
 * Custom type for Node.js error objects with a `code` property.
 */
type NodeJSErrnoException = Error & { code?: string };

/**
 * Checks if decoding a buffer as UTF-8 and re-encoding is lossy.
 * @param {Buffer} originalBuffer The original binary buffer.
 * @param {string} decodedString The string resulting from toString('utf-8').
 * @returns {boolean} True if re-encoding doesn't match original buffer (lossy), false otherwise.
 */
function isUtf8DecodingLossy(originalBuffer: Buffer, decodedString: string): boolean {
    try {
        const reEncodedBuffer = Buffer.from(decodedString, 'utf-8');
        return !originalBuffer.equals(reEncodedBuffer);
    } catch (e) {
        // Error during re-encoding likely means original wasn't valid UTF-8
        return true;
    }
}

/**
 * Determines the absolute base directory URL (http://, https://, or file:///) ending in '/'.
 * This is crucial for resolving relative links found in the source document.
 * @param {string} inputPathOrUrl - The original source HTML file path or a full HTTP/HTTPS URL.
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {string | undefined} The absolute base URL string ending in '/', or undefined if determination fails.
 */
function determineBaseUrl(inputPathOrUrl: string, logger?: Logger): string | undefined {
    // [DEBUG LOG] Added for diagnostics
    console.log(`[DEBUG determineBaseUrl] Input: "${inputPathOrUrl}"`);
    logger?.debug(`Determining base URL for input: ${inputPathOrUrl}`);
    if (!inputPathOrUrl) {
        logger?.warn('Cannot determine base URL: inputPathOrUrl is empty or invalid.');
        return undefined;
    }

    try {
        // Handle non-file URLs (HTTP, HTTPS)
        if (/^https?:\/\//i.test(inputPathOrUrl)) {
            const url = new URL(inputPathOrUrl);
            // Get URL up to the last slash in the path
            url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
            url.search = ''; url.hash = ''; // Clear query params/fragments
            const baseUrl = url.href;
            logger?.debug(`Determined remote base URL: ${baseUrl}`);
            // [DEBUG LOG] Added for diagnostics
            console.log(`[DEBUG determineBaseUrl] Determined Remote URL: "${baseUrl}"`);
            return baseUrl; // URLs from constructor usually end in '/' if path ends in '/'
        }
        // Handle other protocols (warn and return undefined)
        else if (inputPathOrUrl.includes('://') && !inputPathOrUrl.startsWith('file:')) {
            logger?.warn(`Input "${inputPathOrUrl}" looks like a URL but uses an unsupported protocol. Cannot determine base URL.`);
             // [DEBUG LOG] Added for diagnostics
             console.log(`[DEBUG determineBaseUrl] Unsupported protocol.`);
            return undefined;
        }
        // Handle file paths and file: URLs
        else {
            let resourcePath: string; // Path to the actual file or dir input
            let isInputLikelyDirectory = false;

            // Convert input to an absolute path
            if (inputPathOrUrl.startsWith('file:')) {
                resourcePath = fileURLToPath(inputPathOrUrl);
                // file: URLs ending in / strongly suggest a directory
                isInputLikelyDirectory = inputPathOrUrl.endsWith('/');
            } else {
                resourcePath = path.resolve(inputPathOrUrl); // Resolve relative/absolute file paths
                 // Check if the resolved path *actually* exists and is a directory
                 // This distinguishes 'C:\path\to\dir' from 'C:\path\to\file.html'
                 try {
                     // Use statSync carefully - assumes it's available and works (or mocked)
                     isInputLikelyDirectory = fs.statSync(resourcePath).isDirectory();
                 } catch {
                     // If stat fails (ENOENT, EACCES), assume it refers to a file path
                     isInputLikelyDirectory = false;
                 }
            }
             // [DEBUG LOG] Added for diagnostics
             console.log(`[DEBUG determineBaseUrl] resourcePath: "${resourcePath}", isInputLikelyDirectory: ${isInputLikelyDirectory}`);

             // The base directory is the directory containing the resourcePath,
             // OR resourcePath itself if it was identified as a directory.
            const baseDirPath = isInputLikelyDirectory ? resourcePath : path.dirname(resourcePath);
            // [DEBUG LOG] Added for diagnostics
            console.log(`[DEBUG determineBaseUrl] Calculated baseDirPath: "${baseDirPath}"`);

            // Convert base directory path back to a file URL ending in '/'
            let normalizedPathForURL = baseDirPath.replace(/\\/g, '/'); // Use forward slashes
            // Ensure leading slash for Windows file URLs (e.g., /C:/...)
            if (/^[A-Z]:\//i.test(normalizedPathForURL) && !normalizedPathForURL.startsWith('/')) {
                normalizedPathForURL = '/' + normalizedPathForURL;
            }
            // Ensure trailing slash for the directory URL
            if (!normalizedPathForURL.endsWith('/')) {
                normalizedPathForURL += '/';
            }

            const fileUrl = new URL('file://' + normalizedPathForURL);
            const fileUrlString = fileUrl.href;

            logger?.debug(`Determined base URL: ${fileUrlString} (from: ${inputPathOrUrl}, resolved base dir: ${baseDirPath})`);
             // [DEBUG LOG] Added for diagnostics
             console.log(`[DEBUG determineBaseUrl] Determined File URL: "${fileUrlString}"`);
            return fileUrlString;

        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // [DEBUG LOG] Added for diagnostics
        console.error(`[DEBUG determineBaseUrl] Error determining base URL: ${message}`);
        logger?.error(`💀 Failed to determine base URL for "${inputPathOrUrl}": ${message}${error instanceof Error && error.stack ? ` - Stack: ${error.stack}` : ''}`);
        return undefined;
    }
}

/**
 * Resolves an asset URL relative to a base URL context.
 * Handles data URIs, fragments, protocol-relative URLs.
 * @param {string} assetUrl - The raw URL string found in the source (e.g., href, src).
 * @param {string} [baseContextUrl] - The absolute base URL of the containing document (HTML or CSS).
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {URL | null} A validated, absolute URL object, or null if invalid/ignorable.
 */
function resolveAssetUrl(assetUrl: string, baseContextUrl?: string, logger?: Logger): URL | null {
    const trimmedUrl = assetUrl?.trim();
    // Ignore empty, data URIs, or fragment-only URLs
    if (!trimmedUrl || trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('#')) {
        return null;
    }

    let resolvableUrl = trimmedUrl;

    // Handle protocol-relative URLs (e.g., //example.com/image.png)
    if (resolvableUrl.startsWith('//') && baseContextUrl) {
        try {
            const base = new URL(baseContextUrl);
            resolvableUrl = base.protocol + resolvableUrl; // Prepend the base protocol (http: or https:)
        } catch (e) {
            logger?.warn(`Could not extract protocol from base "${baseContextUrl}" for protocol-relative URL "${trimmedUrl}". Skipping.`);
            return null;
        }
    }

    try {
        // Use URL constructor for resolution. Handles absolute, relative paths, ../ etc.
        // baseContextUrl provides the context for resolving relative URLs.
        const resolved = new URL(resolvableUrl, baseContextUrl);
        // Don't attempt to fetch ws://, mailto:, etc. Add protocols as needed.
        if (!['http:', 'https:', 'file:'].includes(resolved.protocol)) {
             logger?.debug(`Skipping asset with unsupported protocol: ${resolved.href}`);
             return null;
        }
        return resolved;
    } catch (error: unknown) {
        // Log errors during URL parsing/resolution but don't halt the process
        const message = error instanceof Error ? error.message : String(error);
        // Avoid warning for relative paths when no base was provided (e.g., direct HTML string input)
        if (!/^[a-z]+:/i.test(resolvableUrl) && !resolvableUrl.startsWith('/') && !baseContextUrl) {
            logger?.warn(`Cannot resolve relative URL "${resolvableUrl}" - Base context URL was not provided or determined.`);
        } else {
            logger?.warn(`⚠️ Failed to parse/resolve URL "${resolvableUrl}" ${baseContextUrl ? 'against base "' + baseContextUrl + '"' : '(no base provided)'}: ${message}`);
        }
        return null; // Return null if resolution fails
    }
}

/**
 * Properly resolves CSS relative paths (like url("../images/bg.png")), handling "../" correctly.
 * Uses the CSS file's own location as the base for resolution.
 * @param {string} relativeUrl - The relative URL string from CSS (e.g., "../images/bg.png").
 * @param {string} cssBaseContextUrl - The absolute URL of the CSS file containing the relative URL.
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {string | null} The resolved absolute URL string, or null if resolution fails/invalid.
 */
function resolveCssRelativeUrl(
    relativeUrl: string,
    cssBaseContextUrl: string, // e.g., file:///C:/mock/base/dir/css/deep.css or https://.../style.css
    logger?: Logger
): string | null {
     // [DEBUG LOG] Added for diagnostics
     console.log(`[DEBUG resolveCssRelativeUrl] Input: relative="${relativeUrl}", base="${cssBaseContextUrl}"`);

    if (!relativeUrl || relativeUrl.startsWith('data:') || relativeUrl.startsWith('#')) {
        return null; // Ignore empty, data URIs, or fragments
    }

    try {
        // Use the URL constructor which correctly handles relative paths including ../
        // relative to the base URL provided.
        const resolvedUrl = new URL(relativeUrl, cssBaseContextUrl);

        // [DEBUG LOG] Added for diagnostics
        console.log(`[DEBUG resolveCssRelativeUrl] Resolved URL object href: "${resolvedUrl.href}"`);
        return resolvedUrl.href; // Return the resolved absolute URL string

    } catch (error) {
        // Log warning if URL resolution fails for some reason
        logger?.warn(
            `Failed to resolve CSS URL: "${relativeUrl}" relative to "${cssBaseContextUrl}": ${String(error)}`
        );
         // [DEBUG LOG] Added for diagnostics
         console.error(`[DEBUG resolveCssRelativeUrl] Error resolving: ${String(error)}`);
        return null;
    }
}


/**
 * Asynchronously fetches the content of a resolved asset URL (http, https, file).
 * @async
 * @param {URL} resolvedUrl - The absolute URL object of the asset to fetch.
 * @param {Logger} [logger] - Optional logger instance.
 * @param {number} [timeout=10000] - Network timeout in milliseconds for HTTP(S) requests.
 * @returns {Promise<Buffer | null>} Asset content as a Buffer, or null on failure.
 */
async function fetchAsset(resolvedUrl: URL, logger?: Logger, timeout: number = 10000): Promise<Buffer | null> {
    // [DEBUG LOG] Added for diagnostics
    console.log(`[DEBUG fetchAsset] Attempting fetch for URL: ${resolvedUrl.href}`);
    logger?.debug(`Attempting to fetch asset: ${resolvedUrl.href}`);
    const protocol = resolvedUrl.protocol;

    try {
        if (protocol === 'http:' || protocol === 'https:') {
            // Use axios namespace import's default property
            const response: AxiosResponse<ArrayBuffer> = await axiosNs.default.get(resolvedUrl.href, {
                responseType: 'arraybuffer', timeout: timeout,
            });
             logger?.debug(`Workspaceed remote asset ${resolvedUrl.href} (Status: ${response.status}, Type: ${response.headers['content-type'] || 'N/A'}, Size: ${response.data?.byteLength ?? 0} bytes)`);
             // [DEBUG LOG] Added for diagnostics
             console.log(`[DEBUG fetchAsset] HTTP fetch SUCCESS for: ${resolvedUrl.href}, Status: ${response.status}`);
             return Buffer.from(response.data);
        } else if (protocol === 'file:') {
            let filePath: string;
            try {
                // Convert file URL to path. IMPORTANT: This strips query params and fragments.
                filePath = fileURLToPath(resolvedUrl);
            } catch (e: any) {
                 // [DEBUG LOG] Added for diagnostics
                 console.error(`[DEBUG fetchAsset] fileURLToPath FAILED for: ${resolvedUrl.href}`, e);
                logger?.error(`Could not convert file URL to path: ${resolvedUrl.href}. Error: ${e.message}`);
                return null;
            }

            const normalizedForLog = path.normalize(filePath);
             // [DEBUG LOG] Added for diagnostics
             console.log(`[DEBUG fetchAsset] Attempting readFile with path: "${normalizedForLog}" (Original from URL: "${filePath}")`);

             // Read file using fs/promises
            const data = await readFile(filePath); // This call uses the mock in tests

             // [DEBUG LOG] Added for diagnostics
             console.log(`[DEBUG fetchAsset] readFile call SUCCEEDED for path: "${normalizedForLog}". Data length: ${data?.byteLength}`);
             logger?.debug(`Read local file ${filePath} (${data.byteLength} bytes)`);
            return data;
        } else {
             // [DEBUG LOG] Added for diagnostics
             console.log(`[DEBUG fetchAsset] Unsupported protocol: ${protocol}`);
             logger?.warn(`Unsupported protocol "${protocol}" in URL: ${resolvedUrl.href}`);
            return null;
        }
    } catch (error: unknown) {
         // [DEBUG LOG] Added for diagnostics
         const failedId = protocol === 'file:' ? path.normalize(fileURLToPath(resolvedUrl)) : resolvedUrl.href;
         console.error(`[DEBUG fetchAsset] fetch/read FAILED for: "${failedId}". Error:`, error);

        // --- Handle Errors Based on Protocol/Context ---
        // Use the imported namespace directly for isAxiosError check
        if ((protocol === 'http:' || protocol === 'https:') && axiosNs.isAxiosError(error)) {
            const status = error.response?.status ?? 'N/A';
            const statusText = error.response?.statusText ?? 'Error';
            const code = error.code ?? 'N/A';
            const message = error.message;
            // Format consistent with test expectations
            const logMessage = `⚠️ Failed to fetch remote asset ${resolvedUrl.href}: Status ${status} - ${statusText}. Code: ${code}, Message: ${message}`;
            logger?.warn(logMessage);
        }
        // Check for specific FS errors (only relevant if protocol was file:)
            if (error instanceof Error && (error as { code?: string }).code === 'ENOENT') {
            let failedPath = resolvedUrl.href; // Fallback path for logging if conversion fails
            try { failedPath = fileURLToPath(resolvedUrl); } catch { /* ignore */ }
            failedPath = path.normalize(failedPath); // Normalize for consistent logging

            if (error instanceof Error && (error as NodeJSErrnoException).code === 'ENOENT') {
                logger?.warn(`⚠️ File not found (ENOENT) for asset: ${failedPath}.`);
            } else if (error instanceof Error && (error as NodeJSErrnoException).code === 'EACCES') {
                // Log EACCES specifically for tests to catch if needed
                 logger?.warn(`⚠️ Permission denied (EACCES) reading asset: ${failedPath}.`);
                 // Also log the more generic message that the test currently expects
                 logger?.warn(`⚠️ Failed to read local asset ${failedPath}: ${error.message}`);
            } else if (error instanceof Error) {
                logger?.warn(`⚠️ Failed to read local asset ${failedPath}: ${error.message}`);
            } else {
                logger?.warn(`⚠️ An unknown error occurred while reading local asset ${failedPath}: ${String(error)}`);
            }
        }
        // Generic fallback for truly unexpected errors during fetch/read
        else if (error instanceof Error) {
            logger?.warn(`⚠️ An unexpected error occurred processing asset ${resolvedUrl.href}: ${error.message}`);
        } else {
            logger?.warn(`⚠️ An unknown and unexpected error occurred processing asset ${resolvedUrl.href}: ${String(error)}`);
        }
        return null; // Return null on ANY fetch/read error caught here
    }
}

/**
 * Extracts URLs from CSS content using regex and resolves them.
 * Finds `url(...)` and `@import` rules.
 * @param {string} cssContent - The CSS content string to parse.
 * @param {string} cssBaseContextUrl - The absolute URL of the CSS file (used for resolving relative paths).
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {Asset[]} An array of newly discovered Asset objects (type, resolved URL, content initially undefined).
 */
function extractUrlsFromCSS(
    cssContent: string,
    cssBaseContextUrl: string,
    logger?: Logger
): Asset[] {
    const newlyDiscovered: Asset[] = [];
    // Track URLs processed within this specific CSS file to avoid adding duplicates from the same file
    const processedInThisParse = new Set<string>();

    // Regex for url(...) patterns, handling optional quotes
    const urlRegex = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    // Regex for @import rules, handling url() or bare string, optional quotes
    const importRegex = /@import\s+(?:url\(\s*(['"]?)(.*?)\1\s*\)|(['"])(.*?)\3)\s*;/gi;

    /** Internal helper to process a found URL string */
    const processFoundUrl = (rawUrl: string | undefined, ruleType: '@import' | 'url()') => {
        if (!rawUrl || rawUrl.trim() === '' || rawUrl.startsWith('data:')) return;

        const resolvedUrl = resolveCssRelativeUrl(rawUrl, cssBaseContextUrl, logger);

        // If successfully resolved and not already found in *this* CSS file
        if (resolvedUrl && !processedInThisParse.has(resolvedUrl)) {
            processedInThisParse.add(resolvedUrl);
            const { assetType } = guessMimeType(resolvedUrl); // Guess type based on resolved URL

            // Add to the list of assets discovered in this pass
            newlyDiscovered.push({
                type: assetType,
                url: resolvedUrl, // The resolved absolute URL string
                content: undefined // Content will be fetched later if needed
            });
             logger?.debug(`Discovered nested ${assetType} asset (${ruleType}) in CSS ${cssBaseContextUrl}: ${resolvedUrl}`);
        }
    };

    // Execute regex for url(...)
    let match;
    while ((match = urlRegex.exec(cssContent)) !== null) {
        processFoundUrl(match[2], 'url()'); // Group 2 captures the URL part
    }

    // Execute regex for @import
    // Reset lastIndex as we're using the same regex instance implicitly if defined outside loop
    importRegex.lastIndex = 0; // Explicitly reset
    while ((match = importRegex.exec(cssContent)) !== null) {
        // Group 2 captures url('...'), Group 4 captures bare "..."
        processFoundUrl(match[2] || match[4], '@import');
    }

    return newlyDiscovered;
}

/**
 * Extracts all discoverable assets recursively from HTML and CSS.
 * Fetches assets if embedAssets is true or if the asset is CSS (to parse for more assets).
 * Resolves URLs relative to their context (HTML base or CSS file location).
 * Handles potential infinite loops with an iteration limit.
 *
 * @async
 * @export
 * @param {ParsedHTML} parsed - Initial parsed HTML data containing `htmlContent` and an initial `assets` array.
 * @param {boolean} [embedAssets=true] - Whether to fetch asset content and store it (usually as a data URI or text). If false, content remains undefined, but assets are still discovered.
 * @param {string} [inputPathOrUrl] - The original source location (file path or URL) of the HTML. Used to determine the base context for resolving relative paths in the HTML.
 * @param {Logger} [logger] - Optional logger instance for detailed logging.
 * @returns {Promise<ParsedHTML>} Processed data with `htmlContent` and the final `assets` array containing all discovered assets (with content if `embedAssets` was true and fetch succeeded).
 */
export async function extractAssets(
    parsed: ParsedHTML,
    embedAssets = true,
    inputPathOrUrl?: string,
    logger?: Logger
): Promise<ParsedHTML> {
    logger?.info(`🚀 Starting asset extraction! Embed: ${embedAssets}. Input: ${inputPathOrUrl || '(HTML content only)'}`);

    const initialAssets: Asset[] = parsed.assets || [];
    // Stores the final result: Map<resolved URL string, Asset object>
    const finalAssetsMap = new Map<string, Asset>();
    // Queue holds assets to be processed: { url: string (resolved), type: ..., content?: ... }
    let assetsToProcess: Asset[] = [];
    // Set to track URLs that are already processed (in finalAssetsMap) OR currently in the queue (assetsToProcess)
    const processedOrQueuedUrls = new Set<string>();

    // --- Determine Base URL Context ---
    const htmlBaseContextUrl = determineBaseUrl(inputPathOrUrl || '', logger);
    if (!htmlBaseContextUrl && initialAssets.some(a => !/^[a-z]+:/i.test(a.url) && !a.url.startsWith('data:') && !a.url.startsWith('#') && !a.url.startsWith('/'))) {
        logger?.warn("🚨 No valid base path/URL determined for the HTML source! Resolution of relative asset paths from HTML may fail.");
    } else if (htmlBaseContextUrl) {
        logger?.debug(`Using HTML base context URL: ${htmlBaseContextUrl}`);
    }

    // --- Initial Queue Population ---
    logger?.debug(`Queueing ${initialAssets.length} initial assets parsed from HTML...`);
    for (const asset of initialAssets) {
        // Resolve the initial asset URL against the HTML base context
        const resolvedUrlObj = resolveAssetUrl(asset.url, htmlBaseContextUrl, logger);
        if (!resolvedUrlObj) {
             logger?.debug(` -> Skipping initial asset with unresolvable/ignorable URL: ${asset.url}`);
             continue; // Skip if URL is invalid or data URI etc.
        }
        const urlToQueue = resolvedUrlObj.href; // Use the resolved absolute URL string

        // Skip data URIs and check if this URL is already tracked
        if (!urlToQueue.startsWith('data:') && !processedOrQueuedUrls.has(urlToQueue)) {
            processedOrQueuedUrls.add(urlToQueue); // Mark as queued

            // Guess type from the resolved/original URL if not provided initially
            const { assetType: guessedType } = guessMimeType(urlToQueue);
            const initialType = asset.type ?? guessedType;

            // Add to the processing queue
            assetsToProcess.push({
                url: urlToQueue, // Use the resolved URL
                type: initialType,
                content: undefined
            });
             logger?.debug(` -> Queued initial asset: ${urlToQueue} (Original raw: ${asset.url})`);
        } else if (urlToQueue.startsWith('data:')) {
            logger?.debug(` -> Skipping data URI: ${urlToQueue.substring(0, 50)}...`);
        } else {
             logger?.debug(` -> Skipping already processed/queued initial asset: ${urlToQueue}`);
        }
    }

    // --- Main processing loop ---
    let iterationCount = 0;
    while (assetsToProcess.length > 0) {
        iterationCount++;
        if (iterationCount > MAX_ASSET_EXTRACTION_ITERATIONS) {
            logger?.error(`🛑 Asset extraction loop limit hit (${MAX_ASSET_EXTRACTION_ITERATIONS})! Aborting.`);
            const remainingUrls = assetsToProcess.map(a => a.url).slice(0, 10).join(', ');
            logger?.error(`Remaining queue sample (${assetsToProcess.length} items): ${remainingUrls}...`);
            // Add assets remaining in queue to final map without content before breaking
            assetsToProcess.forEach(asset => {
                if (!finalAssetsMap.has(asset.url)) {
                     finalAssetsMap.set(asset.url, { ...asset, content: undefined });
                }
            });
            assetsToProcess = []; // Clear queue
            break; // Exit loop
        }

        // Process assets in batches for clarity in logs
        const currentBatch = [...assetsToProcess];
        assetsToProcess = []; // Clear queue for the next batch discovered in this iteration

        logger?.debug(`--- Processing batch ${iterationCount}: ${currentBatch.length} asset(s) ---`);

        for (const asset of currentBatch) {
            // Skip if already fully processed (e.g., added in a previous batch)
            if (finalAssetsMap.has(asset.url)) {
                 logger?.debug(`Skipping asset already in final map: ${asset.url}`);
                continue;
            }

            let assetContentBuffer: Buffer | null = null;
            let finalContent: string | undefined = undefined; // For embedding
            let cssContentForParsing: string | undefined = undefined; // For CSS parsing

            // --- Determine if fetching is needed ---
            // Fetch if embedding everything OR if it's CSS (need content for parsing)
            const needsFetching = embedAssets || asset.type === 'css';
            let assetUrlObj: URL | null = null; // URL object needed for fetchAsset

            if (needsFetching) {
                // --- Create URL object for fetching ---
                try {
                    assetUrlObj = new URL(asset.url); // Asset URL should be absolute here
                } catch (urlError) {
                     logger?.warn(`Cannot create URL object for "${asset.url}", skipping fetch. Error: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
                    finalAssetsMap.set(asset.url, { ...asset, content: undefined }); // Store asset without content
                    continue; // Skip to next asset in batch
                }

                // --- Fetch Asset ---
                if (assetUrlObj) {
                    assetContentBuffer = await fetchAsset(assetUrlObj, logger);
                    // fetchAsset returns null on failure
                }
            } // End if(needsFetching)

            // --- If fetching was needed but failed, store asset without content and skip ---
            if (needsFetching && assetContentBuffer === null) {
                 logger?.debug(`Storing asset ${asset.url} without content due to fetch failure.`);
                finalAssetsMap.set(asset.url, { ...asset, content: undefined });
                continue; // Skip to next asset in batch
            }

            // --- Prepare Content for Storing/Embedding (if fetched successfully) ---
            if (assetContentBuffer) { // Only proceed if content was fetched
                 const mimeInfo = guessMimeType(asset.url); // Guess MIME based on URL extension
                 const effectiveMime = mimeInfo.mime || 'application/octet-stream'; // Fallback MIME

                 // Try to decode TEXT types as UTF-8
                 if (TEXT_ASSET_TYPES.has(asset.type)) {
                     let textContent: string | undefined;
                     let wasLossy = false;
                     try {
                         textContent = assetContentBuffer.toString('utf-8');
                         wasLossy = isUtf8DecodingLossy(assetContentBuffer, textContent);
                     } catch (e) { textContent = undefined; wasLossy = true; }

                     if (!wasLossy && textContent !== undefined) {
                         // If embedding, store the text content
                         if (embedAssets) {
                             finalContent = textContent;
                         } else {
                             finalContent = undefined; // Not embedding text
                         }
                         // If it's CSS, store its text content for parsing regardless of embedding
                         if (asset.type === 'css') {
                             cssContentForParsing = textContent;
                         }
                     } else {
                         // Decoding failed or was lossy
                         logger?.warn(`Could not decode ${asset.type} asset ${asset.url} as valid UTF-8 text.${embedAssets ? ' Falling back to base64 data URI.' : ''}`);
                         cssContentForParsing = undefined; // Cannot parse if decoding failed
                         // Embed as base64 data URI if requested
                         if (embedAssets) {
                             finalContent = `data:${effectiveMime};base64,${assetContentBuffer.toString('base64')}`;
                         } else {
                             finalContent = undefined;
                         }
                     }
                 }
                 // Embed BINARY types as base64 data URI if requested
                 else if (BINARY_ASSET_TYPES.has(asset.type)) {
                     if (embedAssets) {
                         finalContent = `data:${effectiveMime};base64,${assetContentBuffer.toString('base64')}`;
                     } else {
                         finalContent = undefined; // Not embedding
                     }
                     cssContentForParsing = undefined; // Not CSS
                 }
                 // Handle 'other' types: attempt text decode, fallback to base64 if embedding
                 else { // asset.type === 'other' or unknown
                      cssContentForParsing = undefined; // Not CSS
                     if (embedAssets) {
                         try {
                             const attemptedTextContent = assetContentBuffer.toString('utf-8');
                             if (isUtf8DecodingLossy(assetContentBuffer, attemptedTextContent)) {
                                 logger?.warn(`Couldn't embed unclassified asset ${asset.url} as text due to invalid UTF-8 sequences. Falling back to base64 (octet-stream).`);
                                 finalContent = `data:application/octet-stream;base64,${assetContentBuffer.toString('base64')}`;
                             } else {
                                 finalContent = attemptedTextContent;
                                 logger?.debug(`Successfully embedded unclassified asset ${asset.url} as text.`);
                             }
                         } catch (decodeError) {
                              logger?.warn(`Error during text decoding for unclassified asset ${asset.url}: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}. Falling back to base64.`);
                              finalContent = `data:application/octet-stream;base64,${assetContentBuffer.toString('base64')}`;
                         }
                     } else {
                         finalContent = undefined; // Not embedding
                     }
                 }
            } else { // Content was not fetched (e.g., embedAssets=false and not CSS)
                 finalContent = undefined;
                 cssContentForParsing = undefined;
            }

            // --- Store the final asset ---
            // Use the resolved URL as the key and in the asset object itself
            finalAssetsMap.set(asset.url, { ...asset, url: asset.url, content: finalContent });
            // Note: URL was already added to processedOrQueuedUrls when initially queued or discovered

            // --- Process CSS for nested assets ---
            // Only if it's CSS and we successfully decoded its content for parsing
            if (asset.type === 'css' && cssContentForParsing) {
                // Determine the base URL *for this specific CSS file* to resolve its relative links
                 const cssBaseContextUrl = determineBaseUrl(asset.url, logger); // CSS URL is absolute here
                 logger?.debug(`CSS base context for resolving nested assets within ${asset.url}: ${cssBaseContextUrl}`);

                if (cssBaseContextUrl) {
                    // Get the list of *potentially* new assets discovered in this CSS file's content
                    const newlyDiscoveredAssets = extractUrlsFromCSS(
                        cssContentForParsing,
                        cssBaseContextUrl, // Use CSS file's base URL
                        logger
                    );

                    if (newlyDiscoveredAssets.length > 0) {
                         logger?.debug(`Discovered ${newlyDiscoveredAssets.length} nested assets in CSS ${asset.url}. Checking against queue...`);
                        for (const newAsset of newlyDiscoveredAssets) {
                             // CHECK: Add to queue only if this resolved URL hasn't been processed OR queued before.
                             if (!processedOrQueuedUrls.has(newAsset.url)) {
                                 processedOrQueuedUrls.add(newAsset.url); // Mark as queued now
                                 assetsToProcess.push(newAsset); // Add to the main queue for the *next* iteration
                                 logger?.debug(` -> Queued new nested asset: ${newAsset.url}`);
                             } else {
                                  logger?.debug(` -> Skipping already processed/queued nested asset: ${newAsset.url}`);
                             }
                        }
                    }
                } else {
                     logger?.warn(`Could not determine base URL context for CSS file ${asset.url}. Cannot resolve nested relative paths within it.`);
                }
            } // End if(asset.type === 'css' && cssContentForParsing)
        } // End for loop over currentBatch
    } // End while loop

    const finalIterationCount = iterationCount > MAX_ASSET_EXTRACTION_ITERATIONS ? 'MAX+' : iterationCount;
    logger?.info(`✅ Asset extraction COMPLETE! Found ${finalAssetsMap.size} unique assets in ${finalIterationCount} iterations.`);

    // Return the original HTML content and the final list of processed assets
    return {
        htmlContent: parsed.htmlContent,
        assets: Array.from(finalAssetsMap.values())
    };
}