/**
 * @file src/core/extractor.ts
 * @description Handles discovery, resolution, fetching, and optional embedding of assets
 * linked from HTML and recursively within CSS (@import, url()). This is the heart of finding EVERYTHING.
 * @version 1.1.3 - Fixed CSS path resolution and handling of 'other' asset types.
 */

// === Node.js Core Imports ===
import { readFile } from 'fs/promises';
import * as fs from 'fs'; // Required for statSync for sync directory check
import type { FileHandle } from 'fs/promises';
import path from 'path';
import { fileURLToPath, URL } from 'url'; // Crucial for file path/URL conversion

// === External Dependencies ===
import * as axios from 'axios'; // Using namespace import for clarity
import type { AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// === Project Imports ===
import type { Asset, ParsedHTML } from '../types';
import { guessMimeType } from '../utils/mime';
import { Logger } from '../utils/logger';

// === Constants ===
/** Set of asset types defined in Asset['type'] generally considered text-based */
const TEXT_ASSET_TYPES: Set<Asset['type']> = new Set(['css', 'js']);
/** Set of asset types defined in Asset['type'] generally considered binary and embedded via Base64 Data URI */
const BINARY_ASSET_TYPES: Set<Asset['type']> = new Set(['image', 'font', 'video', 'audio']);
/** Maximum number of iterations for the asset discovery loop to prevent infinite cycles. */
const MAX_ASSET_EXTRACTION_ITERATIONS = 1000;

// === Helper Functions ===

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
        return true;
    }
}

/**
 * Determines the absolute base directory URL (http://, https://, or file:///) ending in '/'.
 * @param {string} inputPathOrUrl - The original source HTML file path or a full HTTP/HTTPS URL.
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {string | undefined} The absolute base URL string ending in '/', or undefined if determination fails.
 */
function determineBaseUrl(inputPathOrUrl: string, logger?: Logger): string | undefined {
    logger?.debug(`Determining base URL for input: ${inputPathOrUrl}`);
    if (!inputPathOrUrl) {
        logger?.warn('Cannot determine base URL: inputPathOrUrl is empty or invalid.');
        return undefined;
    }

    try {
        if (/^https?:\/\//i.test(inputPathOrUrl)) {
            const url = new URL(inputPathOrUrl);
            url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
            url.search = ''; url.hash = '';
            const baseUrl = url.href;
            logger?.debug(`Determined remote base URL: ${baseUrl}`);
            return baseUrl;
        }
        else if (inputPathOrUrl.includes('://') && !inputPathOrUrl.startsWith('file:')) {
            logger?.warn(`Input "${inputPathOrUrl}" looks like a URL but uses an unsupported protocol. Cannot determine base URL.`);
            return undefined;
        }
        else {
            let absolutePath: string;
            if (inputPathOrUrl.startsWith('file:')) {
                try { absolutePath = fileURLToPath(inputPathOrUrl); }
                catch (e: any) { logger?.error(`💀 Failed to convert file URL "${inputPathOrUrl}" to path: ${e.message}`); return undefined; }
            } else {
                absolutePath = path.resolve(inputPathOrUrl);
            }
            let isDirectory = false;
            try { isDirectory = fs.statSync(absolutePath).isDirectory(); }
            catch (statError: unknown) {
                if (statError instanceof Error && (statError as NodeJS.ErrnoException).code === 'ENOENT') {
                    logger?.debug(`Path "${absolutePath}" not found. Assuming input represents a file, using its parent directory as base.`);
                } else {
                    logger?.warn(`Could not stat local path "${absolutePath}" during base URL determination: ${statError instanceof Error ? statError.message : String(statError)}. Assuming input represents a file.`);
                }
                isDirectory = false;
            }
            const dirPath = isDirectory ? absolutePath : path.dirname(absolutePath);
            let normalizedPathForURL = dirPath.replace(/\\/g, '/');
            if (/^[A-Z]:\//i.test(normalizedPathForURL) && !normalizedPathForURL.startsWith('/')) {
                normalizedPathForURL = '/' + normalizedPathForURL;
            }
            const fileUrl = new URL('file://' + normalizedPathForURL);
            let fileUrlString = fileUrl.href;
            if (!fileUrlString.endsWith('/')) { fileUrlString += '/'; }
            logger?.debug(`Determined local base URL: ${fileUrlString} (from: ${inputPathOrUrl}, resolved dir: ${dirPath}, isDir: ${isDirectory})`);
            return fileUrlString;
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        logger?.error(`💀 Failed to determine base URL for "${inputPathOrUrl}": ${message}${error instanceof Error ? ` - Stack: ${error.stack}` : ''}`);
        return undefined;
    }
}

/**
 * Resolves an asset URL relative to a base URL context.
 * @param {string} assetUrl - The raw URL string found in the source.
 * @param {string} [baseContextUrl] - The absolute base URL of the containing document.
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {URL | null} A validated, absolute URL object or null.
 */
function resolveAssetUrl(assetUrl: string, baseContextUrl?: string, logger?: Logger): URL | null {
    const trimmedUrl = assetUrl?.trim();
    if (!trimmedUrl || trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('#')) {
        return null;
    }
    let resolvableUrl = trimmedUrl;
    if (resolvableUrl.startsWith('//') && baseContextUrl) {
        try {
            const base = new URL(baseContextUrl);
            resolvableUrl = base.protocol + resolvableUrl;
        } catch (e) {
            logger?.warn(`Could not extract protocol from base "${baseContextUrl}" for protocol-relative URL "${trimmedUrl}". Skipping.`);
            return null;
        }
    }
    try {
        const resolved = new URL(resolvableUrl, baseContextUrl);
        return resolved;
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/^[a-z]+:/i.test(resolvableUrl) && !resolvableUrl.startsWith('/') && !baseContextUrl) {
            logger?.warn(`Cannot resolve relative URL "${resolvableUrl}" - Base context URL was not provided or determined.`);
        } else {
            logger?.warn(`⚠️ Failed to parse/resolve URL "${resolvableUrl}" ${baseContextUrl ? 'against base "' + baseContextUrl + '"' : '(no base provided)'}: ${message}`);
        }
        return null;
    }
}

/**
 * Properly resolves CSS relative paths, handling "../" correctly.
 * This is critical for properly resolving paths in CSS like "../images/bg.png".
 * 
 * @param {string} relativeUrl - The relative URL from CSS (e.g., "../images/bg.png")
 * @param {string} cssBaseUrl - The base URL of the CSS file
 * @param {Logger} [logger] - Optional logger instance
 * @returns {string | null} The resolved absolute URL or null if resolution fails
 */
function resolveCssRelativeUrl(
    relativeUrl: string,
    cssBaseContextUrl: string,
    logger?: Logger
): string | null {
    // Skip empty or data URLs
    if (!relativeUrl || relativeUrl.startsWith('data:')) {
        return null;
    }

    try {
        if (cssBaseContextUrl.startsWith('file:')) {
            // Turn the CSS base URL into a filesystem path
            const basePath = fileURLToPath(cssBaseContextUrl);

            // If that base path is actually a directory, use it directly;
            // otherwise, use its dirname. This prevents us from dropping
            // the final directory name when we already have a trailing slash.
            let cssDir: string;
            try {
                const stat = fs.statSync(basePath);
                if (stat.isDirectory()) {
                    cssDir = basePath;
                } else {
                    cssDir = path.dirname(basePath);
                }
            } catch {
                // If stat fails, assume it's a file path
                cssDir = path.dirname(basePath);
            }

            // Resolve relativeUrl against this directory
            let resolvedPath = path.resolve(cssDir, relativeUrl);
            resolvedPath = resolvedPath.replace(/\\/g, '/'); // Normalize to forward slashes

            // On Windows, ensure file:///C:/something
            if (/^[A-Z]:/i.test(resolvedPath) && !resolvedPath.startsWith('/')) {
                resolvedPath = '/' + resolvedPath;
            }
            return `file://${resolvedPath}`;
        } else {
            // For http/https etc., do standard resolution
            return new URL(relativeUrl, cssBaseContextUrl).href;
        }
    } catch (error) {
        logger?.warn(
            `Failed to resolve CSS URL: "${relativeUrl}" against "${cssBaseContextUrl}": ${String(error)}`
        );
        return null;
    }
}


/**
 * Asynchronously fetches the content of a resolved asset URL.
 * @async
 * @param {URL} resolvedUrl - The absolute URL object of the asset to fetch.
 * @param {Logger} [logger] - Optional logger instance.
 * @param {number} [timeout=10000] - Network timeout in milliseconds.
 * @returns {Promise<Buffer | null>} Asset content as a Buffer, or null on failure.
 */
/**
 * Asynchronously fetches the content of a resolved asset URL.
 * @async
 * @param {URL} resolvedUrl - The absolute URL object of the asset to fetch.
 * @param {Logger} [logger] - Optional logger instance.
 * @param {number} [timeout=10000] - Network timeout in milliseconds.
 * @returns {Promise<Buffer | null>} Asset content as a Buffer, or null on failure.
 */
async function fetchAsset(resolvedUrl: URL, logger?: Logger, timeout: number = 10000): Promise<Buffer | null> {
    logger?.debug(`Attempting to fetch asset: ${resolvedUrl.href}`);
    const protocol = resolvedUrl.protocol;

    try {
        if (protocol === 'http:' || protocol === 'https:') {
            const response: AxiosResponse<ArrayBuffer> = await axios.default.get(resolvedUrl.href, {
                responseType: 'arraybuffer', timeout: timeout,
            });
            logger?.debug(`Workspaceed remote asset ${resolvedUrl.href} (Status: ${response.status}, Type: ${response.headers['content-type'] || 'N/A'}, Size: ${response.data.byteLength} bytes)`);
            return Buffer.from(response.data);
        } else if (protocol === 'file:') {
            let filePath: string;
            try {
                 filePath = fileURLToPath(resolvedUrl);
             } catch (e: any) {
                 // Log error specifically for path conversion failure
                 logger?.error(`Could not convert file URL to path: ${resolvedUrl.href}. Error: ${e.message}`);
                 return null; // Cannot proceed without a valid path
             }
            // This section will now only be reached if fileURLToPath succeeded
            const data = await readFile(filePath); // This might throw ENOENT, EACCES etc.
            logger?.debug(`Read local file ${filePath} (${data.byteLength} bytes)`);
            return data;
        } else {
            logger?.warn(`Unsupported protocol "${protocol}" in URL: ${resolvedUrl.href}`);
            return null;
        }
    } catch (error: unknown) {
        // --- Handle Errors Based on Protocol/Context ---

        // Check for AxiosError FIRST (only relevant if protocol was http/https)
        if ((protocol === 'http:' || protocol === 'https:') && axios.default.isAxiosError(error)) {
            const status = error.response?.status ?? 'N/A';
            const statusText = error.response?.statusText ?? 'Error';
            const code = error.code ?? 'N/A';
            const message = error.message;
            // Construct the message matching test expectation
            const logMessage = `⚠️ Failed to fetch remote asset ${resolvedUrl.href}: Status ${status} - ${statusText}. Code: ${code}, Message: ${message}`;
            logger?.warn(logMessage);
        }
        // Check for specific FS errors (only relevant if protocol was file:)
        else if (protocol === 'file:') {
            // Determine the file path again for logging, handling potential errors
            let failedPath = resolvedUrl.href;
            try { failedPath = fileURLToPath(resolvedUrl); } catch { /* ignore if conversion fails here, use original href */ }

            if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
                logger?.warn(`⚠️ File not found (ENOENT) for asset: ${failedPath}.`);
            } else if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'EACCES') {
                logger?.warn(`⚠️ Permission denied (EACCES) reading asset: ${failedPath}.`);
            } else if (error instanceof Error) { // Catch other errors during file reading (but not path conversion which is handled above)
                 logger?.warn(`⚠️ Failed to read local asset ${failedPath}: ${error.message}`);
            } else {
                 logger?.warn(`⚠️ An unknown error occurred while reading local asset ${failedPath}: ${String(error)}`);
            }
        }
        // Check for other specific errors like invalid URL types if necessary (ERR_INVALID_URL handled above mostly)
        // else if (error instanceof TypeError && error.message.includes('ERR_INVALID_URL')) { ... }

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
 * Extracts URLs from CSS content and resolves them against the CSS base URL.
 * @param {string} cssContent - The CSS content to parse
 * @param {string} cssBaseContextUrl - The base URL of the CSS file
 * @param {Asset[]} discoveredAssets - Array to push newly discovered assets to
 * @param {Set<string>} visitedUrls - Set of already visited URLs to avoid duplicates
 * @param {Logger} [logger] - Optional logger instance
 */
/**
 * Extracts URLs from CSS content and resolves them against the CSS base URL.
 * Returns an array of *potentially* new Asset objects with resolved URLs.
 */
function extractUrlsFromCSS(
    cssContent: string,
    cssBaseContextUrl: string,
    // discoveredAssets: Asset[], // REMOVE: This function will now RETURN the assets
    // visitedUrls: Set<string>, // REMOVE
    logger?: Logger
): Asset[] { // RETURN the discovered assets
    const newlyDiscovered: Asset[] = []; // Internal list for this parse
    const processedInThisParse = new Set<string>(); // Track URLs found in *this specific* CSS file to avoid duplicates from the same file

    const urlRegex = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
    const importRegex = /@import\s+(?:url\(\s*(['"]?)(.*?)\1\s*\)|(['"])(.*?)\3)\s*;/gi;

    const processFoundUrl = (rawUrl: string | undefined, ruleType: '@import' | 'url()') => {
        if (!rawUrl || rawUrl.trim() === '' || rawUrl.startsWith('data:')) return;

        const resolvedUrl = resolveCssRelativeUrl(rawUrl, cssBaseContextUrl, logger);

        // Check if resolved AND not already processed within *this* CSS file
        if (resolvedUrl && !processedInThisParse.has(resolvedUrl)) {
            processedInThisParse.add(resolvedUrl); // Mark as found in this file
            const { assetType } = guessMimeType(resolvedUrl);

            // Add to the list to be returned
            newlyDiscovered.push({
                type: assetType,
                url: resolvedUrl, // The resolved URL string
                content: undefined
            });
            logger?.debug(`Discovered nested ${assetType} asset (${ruleType}) in CSS ${cssBaseContextUrl}: ${resolvedUrl}`);
        }
    };

    // ... (run regex loops calling processFoundUrl) ...
    urlRegex.lastIndex = 0;
    importRegex.lastIndex = 0;
    let match;
    while ((match = urlRegex.exec(cssContent)) !== null) {
        processFoundUrl(match[2], 'url()');
    }
    importRegex.lastIndex = 0;
    while ((match = importRegex.exec(cssContent)) !== null) {
        processFoundUrl(match[2] || match[4], '@import');
    }

    return newlyDiscovered; // Return the list
}

/**
 * Extracts all discoverable assets recursively from HTML and CSS.
 * @async
 * @export
 * @param {ParsedHTML} parsed - Initial parsed HTML data.
 * @param {boolean} [embedAssets=true] - Whether to embed content.
 * @param {string} [inputPathOrUrl] - Original HTML source location.
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {Promise<ParsedHTML>} Processed data with all assets.
 */
/**
 * Extracts all discoverable assets recursively from HTML and CSS.
 * Fetches assets if embedAssets is true or if the asset is CSS (to parse for more assets).
 * Resolves URLs relative to their context (HTML base or CSS file location).
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

    // Determine the base URL context for resolving relative paths FROM THE HTML
    const htmlBaseContextUrl = determineBaseUrl(inputPathOrUrl || '', logger);
    if (!htmlBaseContextUrl && initialAssets.some(a => !/^[a-z]+:/i.test(a.url) && !a.url.startsWith('data:') && !a.url.startsWith('#') && !a.url.startsWith('/'))) {
        logger?.warn("🚨 No valid base path/URL determined for the HTML source! Resolution of relative asset paths from HTML may fail.");
    } else if (htmlBaseContextUrl) {
        logger?.debug(`Using HTML base context URL: ${htmlBaseContextUrl}`);
    }

    // --- CORRECTED: Define processedOrQueuedUrls HERE in the main function scope ---
    // Set to track URLs that are already processed (in finalAssetsMap) OR currently in the queue (assetsToProcess)
    // This prevents adding the same asset to the queue multiple times.
    const processedOrQueuedUrls = new Set<string>();

    // --- Initial Queue Population ---
    logger?.debug(`Queueing ${initialAssets.length} initial assets parsed from HTML...`);
    for (const asset of initialAssets) {
        // Resolve the initial asset URL against the HTML base context
        const resolvedUrlObj = resolveAssetUrl(asset.url, htmlBaseContextUrl, logger);
        // Use the resolved URL string if resolution succeeded, otherwise use the original
        const urlToQueue = resolvedUrlObj ? resolvedUrlObj.href : asset.url;

        // Skip data URIs and check if this URL is already tracked
        if (!urlToQueue.startsWith('data:') && !processedOrQueuedUrls.has(urlToQueue)) {
            processedOrQueuedUrls.add(urlToQueue); // Mark as queued

            // Guess type from the resolved/original URL if not provided initially
            const { assetType: guessedType } = guessMimeType(urlToQueue);
            const initialType = asset.type ?? guessedType;

            // Add to the processing queue
            assetsToProcess.push({
                url: urlToQueue,
                type: initialType,
                content: undefined
            });
            logger?.debug(` -> Queued initial asset: ${urlToQueue} (Original raw: ${asset.url})`);
        } else if (urlToQueue.startsWith('data:')) {
             logger?.debug(` -> Skipping data URI: ${urlToQueue.substring(0, 50)}...`);
        } else {
             logger?.debug(` -> Skipping already queued initial asset: ${urlToQueue}`);
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

        // Process assets in batches
        const currentBatch = [...assetsToProcess];
        assetsToProcess = []; // Clear queue for the next batch discovered in this iteration

        logger?.debug(`--- Processing batch ${iterationCount}: ${currentBatch.length} asset(s) ---`);

        for (const asset of currentBatch) {
            // Skip if already fully processed
            if (finalAssetsMap.has(asset.url)) {
                logger?.debug(`Skipping asset already in final map: ${asset.url}`);
                continue;
            }

            let assetContentBuffer: Buffer | null = null;
            let finalContent: string | undefined = undefined; // For embedding
            let cssContentForParsing: string | undefined = undefined; // For CSS parsing

            // --- Determine if fetching is needed ---
            const needsFetching = embedAssets || asset.type === 'css';
            let assetUrlObj: URL | null = null;

            if (needsFetching) {
                // --- Create URL object for fetching ---
                try {
                    assetUrlObj = new URL(asset.url);
                } catch (urlError) {
                    logger?.warn(`Cannot create URL object for "${asset.url}", skipping fetch. Error: ${urlError instanceof Error ? urlError.message : String(urlError)}`);
                    finalAssetsMap.set(asset.url, { ...asset, content: undefined });
                    continue; // Skip to next asset in batch
                }

                // --- Fetch Asset ---
                if (assetUrlObj) {
                    assetContentBuffer = await fetchAsset(assetUrlObj, logger);
                }
            } // End if(needsFetching)

            // --- If fetching was needed but failed, add to map without content and skip ---
            if (needsFetching && assetContentBuffer === null) {
                logger?.debug(`Storing asset ${asset.url} without content due to fetch failure.`);
                finalAssetsMap.set(asset.url, { ...asset, content: undefined });
                continue; // Skip to next asset in batch
            }

            // --- Prepare Content for Storing/Embedding (if fetched successfully) ---
            if (assetContentBuffer) { // Only proceed if content was fetched
                 const mimeInfo = guessMimeType(asset.url);
                 const effectiveMime = mimeInfo.mime || 'application/octet-stream';

                 // Try to decode TEXT types as UTF-8
                 if (TEXT_ASSET_TYPES.has(asset.type)) {
                     let textContent: string | undefined;
                     let wasLossy = false;
                     try {
                         textContent = assetContentBuffer.toString('utf-8');
                         wasLossy = isUtf8DecodingLossy(assetContentBuffer, textContent);
                     } catch (e) { textContent = undefined; wasLossy = true; }

                     if (!wasLossy && textContent !== undefined) {
                         // Store the decoded text content if embedding or it's CSS (for parsing)
                         if (embedAssets) {
                             finalContent = textContent;
                         } else {
                             finalContent = undefined; // Not embedding text
                         }
                         // If it's CSS, store it for parsing later regardless of embedding
                         if (asset.type === 'css') {
                             cssContentForParsing = textContent;
                         }
                     } else {
                         // Decoding failed or was lossy
                         logger?.warn(`Could not decode ${asset.type} ${asset.url} as valid UTF-8 text.${embedAssets ? ' Falling back to base64 data URI.' : ''}`);
                         cssContentForParsing = undefined; // Cannot parse if decoding failed
                         // Embed as base64 if requested
                         if (embedAssets) {
                             finalContent = `data:${effectiveMime};base64,${assetContentBuffer.toString('base64')}`;
                         } else {
                             finalContent = undefined; // Not embedding, content remains undefined
                         }
                     }
                 }
                 // Embed BINARY types as base64 if requested
                 else if (BINARY_ASSET_TYPES.has(asset.type)) {
                     if (embedAssets) {
                         finalContent = `data:${effectiveMime};base64,${assetContentBuffer.toString('base64')}`;
                     } else {
                         finalContent = undefined; // Not embedding
                     }
                     cssContentForParsing = undefined; // Not CSS
                 }
                 // Handle 'other' types: try text, fallback to base64 if embedding
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
            } else {
                 // Content was not fetched
                 finalContent = undefined;
                 cssContentForParsing = undefined;
            }

            // --- Store the final asset ---
            // Use the resolved URL as the key and in the asset object itself
            finalAssetsMap.set(asset.url, { ...asset, url: asset.url, content: finalContent });
            // Note: URL is already marked in processedOrQueuedUrls

            // --- Process CSS for nested assets ---
            // Only if it's CSS and we successfully decoded its content for parsing
            if (asset.type === 'css' && cssContentForParsing) {
                // Determine the base URL *for this specific CSS file*
                const cssBaseContextUrl = determineBaseUrl(asset.url, logger);
                 logger?.debug(`CSS base context for resolving nested assets within ${asset.url}: ${cssBaseContextUrl}`);

                if (cssBaseContextUrl) {
                    // Get the list of *potentially* new assets discovered in this CSS
                    const newlyDiscoveredAssets = extractUrlsFromCSS(
                        cssContentForParsing,
                        cssBaseContextUrl,
                        logger
                    );

                    if (newlyDiscoveredAssets.length > 0) {
                        logger?.debug(`Discovered ${newlyDiscoveredAssets.length} nested assets in CSS ${asset.url}. Checking against queue...`);
                        for (const newAsset of newlyDiscoveredAssets) {
                            // CHECK: Add to queue only if this resolved URL hasn't been processed OR queued before.
                            // Use the 'processedOrQueuedUrls' Set which tracks both.
                            if (!processedOrQueuedUrls.has(newAsset.url)) {
                                processedOrQueuedUrls.add(newAsset.url); // Mark as queued now
                                assetsToProcess.push(newAsset);      // Add to the main queue for the *next* iteration
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