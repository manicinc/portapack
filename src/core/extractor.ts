/**
 * @file src/core/extractor.ts
 * @description Handles discovery, resolution, fetching, and optional embedding of assets
 * linked from HTML and recursively within CSS (@import, url()). This is the heart of finding EVERYTHING.
 */

// === Node.js Core Imports ===
import { readFile } from 'fs/promises';
import * as fs from 'fs'; // Required for statSync for sync directory check
import type { FileHandle } from 'fs/promises'; // Import specific type if needed elsewhere
import path from 'path';
import { fileURLToPath, URL } from 'url'; // Crucial for file path/URL conversion

// === External Dependencies ===
import * as axiosNs from 'axios'; // Using namespace import for clarity
import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'; // Import necessary types

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
    // Re-encode the decoded string back to a buffer using UTF-8
    const reEncodedBuffer = Buffer.from(decodedString, 'utf-8');
    // Compare the re-encoded buffer with the original buffer
    return !originalBuffer.equals(reEncodedBuffer);
  } catch (e) {
    // If an error occurs during re-encoding, it implies the original wasn't valid UTF-8
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
  // Log the input for debugging purposes
  // console.log(`[DEBUG determineBaseUrl] Input: "${inputPathOrUrl}"`); // Keep debug log commented unless needed
  logger?.debug(`Determining base URL for input: ${inputPathOrUrl}`);

  // Handle invalid or empty input
  if (!inputPathOrUrl) {
    logger?.warn('Cannot determine base URL: inputPathOrUrl is empty or invalid.');
    return undefined;
  }

  try {
    // Handle non-file URLs (HTTP, HTTPS)
    if (/^https?:\/\//i.test(inputPathOrUrl)) {
      const url = new URL(inputPathOrUrl);
      // Construct the base URL by taking the path up to the last '/'
      url.pathname = url.pathname.substring(0, url.pathname.lastIndexOf('/') + 1);
      url.search = ''; // Remove query parameters
      url.hash = ''; // Remove fragments
      const baseUrl = url.href;
      logger?.debug(`Determined remote base URL: ${baseUrl}`);
      // console.log(`[DEBUG determineBaseUrl] Determined Remote URL: "${baseUrl}"`); // Keep debug log commented unless needed
      // Return the constructed base URL (usually ends in '/')
      return baseUrl;
    }
    // Handle other protocols (warn and return undefined)
    else if (inputPathOrUrl.includes('://') && !inputPathOrUrl.startsWith('file:')) {
      logger?.warn(
        `Input "${inputPathOrUrl}" looks like a URL but uses an unsupported protocol. Cannot determine base URL.`
      );
      // console.log(`[DEBUG determineBaseUrl] Unsupported protocol.`); // Keep debug log commented unless needed
      return undefined;
    }
    // Handle file paths and file: URLs
    else {
      let resourcePath: string; // Path to the actual file or dir input
      let isInputLikelyDirectory = false;

      // Convert input to an absolute path
      if (inputPathOrUrl.startsWith('file:')) {
        // Convert file URL to path
        resourcePath = fileURLToPath(inputPathOrUrl);
        // file: URLs ending in / strongly suggest a directory
        isInputLikelyDirectory = inputPathOrUrl.endsWith('/');
      } else {
        // Resolve relative/absolute file paths
        resourcePath = path.resolve(inputPathOrUrl);
        // Check if the resolved path *actually* exists and is a directory
        try {
          // Use statSync carefully - assumes it's available and works (or mocked)
          isInputLikelyDirectory = fs.statSync(resourcePath).isDirectory();
        } catch {
          // If stat fails (ENOENT, EACCES), assume it refers to a file path
          isInputLikelyDirectory = false;
        }
      }
      // console.log(`[DEBUG determineBaseUrl] resourcePath: "${resourcePath}", isInputLikelyDirectory: ${isInputLikelyDirectory}`); // Keep debug log commented unless needed

      // The base directory is the directory containing the resourcePath,
      // OR resourcePath itself if it was identified as a directory.
      const baseDirPath = isInputLikelyDirectory ? resourcePath : path.dirname(resourcePath);
      // console.log(`[DEBUG determineBaseUrl] Calculated baseDirPath: "${baseDirPath}"`); // Keep debug log commented unless needed

      // Convert base directory path back to a file URL ending in '/'
      let normalizedPathForURL = baseDirPath.replace(/\\/g, '/'); // Use forward slashes for URL consistency
      // Ensure leading slash for Windows file URLs (e.g., /C:/...)
      if (/^[A-Z]:\//i.test(normalizedPathForURL) && !normalizedPathForURL.startsWith('/')) {
        normalizedPathForURL = '/' + normalizedPathForURL;
      }
      // Ensure trailing slash for the directory URL
      if (!normalizedPathForURL.endsWith('/')) {
        normalizedPathForURL += '/';
      }

      // Create the final file URL object and get its string representation
      const fileUrl = new URL('file://' + normalizedPathForURL);
      const fileUrlString = fileUrl.href;

      logger?.debug(
        `Determined base URL: ${fileUrlString} (from: ${inputPathOrUrl}, resolved base dir: ${baseDirPath})`
      );
      // console.log(`[DEBUG determineBaseUrl] Determined File URL: "${fileUrlString}"`); // Keep debug log commented unless needed
      return fileUrlString;
    }
  } catch (error: unknown) {
    // Handle any errors during base URL determination
    const message = error instanceof Error ? error.message : String(error);
    // console.error(`[DEBUG determineBaseUrl] Error determining base URL: ${message}`); // Keep debug log commented unless needed
    logger?.error(
      `💀 Failed to determine base URL for "${inputPathOrUrl}": ${message}${error instanceof Error && error.stack ? ` - Stack: ${error.stack}` : ''}`
    );
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
  // Trim whitespace from the URL
  const trimmedUrl = assetUrl?.trim();

  // Ignore empty URLs, data URIs, or fragment-only URLs
  if (!trimmedUrl || trimmedUrl.startsWith('data:') || trimmedUrl.startsWith('#')) {
    return null;
  }

  let resolvableUrl = trimmedUrl;

  // Handle protocol-relative URLs (e.g., //example.com/image.png)
  if (resolvableUrl.startsWith('//') && baseContextUrl) {
    try {
      // Prepend the protocol from the base context URL
      const base = new URL(baseContextUrl);
      resolvableUrl = base.protocol + resolvableUrl;
    } catch (e) {
      // Log a warning if the base protocol cannot be determined
      logger?.warn(
        `Could not extract protocol from base "${baseContextUrl}" for protocol-relative URL "${trimmedUrl}". Skipping.`
      );
      return null;
    }
  }

  try {
    // Use URL constructor for resolution. Handles absolute paths, relative paths, ../ etc.
    const resolved = new URL(resolvableUrl, baseContextUrl);

    // Skip assets with unsupported protocols (e.g., mailto:, ws:)
    if (!['http:', 'https:', 'file:'].includes(resolved.protocol)) {
      logger?.debug(`Skipping asset with unsupported protocol: ${resolved.href}`);
      return null;
    }
    // Return the resolved URL object
    return resolved;
  } catch (error: unknown) {
    // Log errors during URL parsing/resolution
    const message = error instanceof Error ? error.message : String(error);
    // Avoid redundant warnings for relative paths when no base context was provided (expected failure)
    if (!/^[a-z]+:/i.test(resolvableUrl) && !resolvableUrl.startsWith('/') && !baseContextUrl) {
      logger?.warn(
        `Cannot resolve relative URL "${resolvableUrl}" - Base context URL was not provided or determined.`
      );
    } else {
      // Log other resolution failures
      logger?.warn(
        `⚠️ Failed to parse/resolve URL "${resolvableUrl}" ${baseContextUrl ? 'against base "' + baseContextUrl + '"' : '(no base provided)'}: ${message}`
      );
    }
    // Return null if resolution fails
    return null;
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
  // console.log(`[DEBUG resolveCssRelativeUrl] Input: relative="${relativeUrl}", base="${cssBaseContextUrl}"`); // Keep debug log commented unless needed

  // Ignore empty, data URIs, or fragments
  if (!relativeUrl || relativeUrl.startsWith('data:') || relativeUrl.startsWith('#')) {
    return null;
  }

  try {
    // Use the URL constructor which correctly handles relative paths including ../
    // relative to the base URL provided (the CSS file's URL).
    const resolvedUrl = new URL(relativeUrl, cssBaseContextUrl);
    // console.log(`[DEBUG resolveCssRelativeUrl] Resolved URL object href: "${resolvedUrl.href}"`); // Keep debug log commented unless needed
    // Return the resolved absolute URL string
    return resolvedUrl.href;
  } catch (error) {
    // Log warning if URL resolution fails
    logger?.warn(
      `Failed to resolve CSS URL: "${relativeUrl}" relative to "${cssBaseContextUrl}": ${String(error)}`
    );
    // console.error(`[DEBUG resolveCssRelativeUrl] Error resolving: ${String(error)}`); // Keep debug log commented unless needed
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
async function fetchAsset(
  resolvedUrl: URL,
  logger?: Logger,
  timeout: number = 10000
): Promise<Buffer | null> {
  // console.log(`[DEBUG fetchAsset] Attempting fetch for URL: ${resolvedUrl.href}`); // Keep debug log commented unless needed
  logger?.debug(`Attempting to fetch asset: ${resolvedUrl.href}`);
  const protocol = resolvedUrl.protocol;

  try {
    // Handle HTTP and HTTPS protocols
    if (protocol === 'http:' || protocol === 'https:') {
      // Use axios to fetch remote content as an ArrayBuffer
      const response: AxiosResponse<ArrayBuffer> = await axiosNs.default.get(resolvedUrl.href, {
        responseType: 'arraybuffer', // Fetch as binary data
        timeout: timeout, // Apply network timeout
      });
      logger?.debug(
        `Workspaceed remote asset ${resolvedUrl.href} (Status: ${response.status}, Type: ${response.headers['content-type'] || 'N/A'}, Size: ${response.data?.byteLength ?? 0} bytes)`
      );
      // Return the fetched data as a Node.js Buffer
      return Buffer.from(response.data);
    }
    // Handle file protocol
    else if (protocol === 'file:') {
      let filePath: string;
      try {
        // Convert file URL to a system file path
        // IMPORTANT: This strips query params and fragments from the URL
        filePath = fileURLToPath(resolvedUrl);
      } catch (e: any) {
        logger?.error(
          `Could not convert file URL to path: ${resolvedUrl.href}. Error: ${e.message}`
        );
        return null; // Return null if conversion fails
      }

      const normalizedForLog = path.normalize(filePath);

      // Read file content using fs/promises
      const data = await readFile(filePath); // This call uses the mock in tests
      logger?.debug(`Read local file ${filePath} (${data.byteLength} bytes)`);
      // Return the file content as a Buffer
      return data;
    }
    // Handle unsupported protocols
    else {
      // console.log(`[DEBUG fetchAsset] Unsupported protocol: ${protocol}`); // Keep debug log commented unless needed
      logger?.warn(`Unsupported protocol "${protocol}" in URL: ${resolvedUrl.href}`);
      return null;
    }
  } catch (error: unknown) {
    // --- Handle Errors During Fetch/Read ---
    const failedId =
      protocol === 'file:' ? path.normalize(fileURLToPath(resolvedUrl)) : resolvedUrl.href;
    if ((protocol === 'http:' || protocol === 'https:') && (error as any)?.isAxiosError === true) {
      const axiosError = error as AxiosError; // Cast for easier property access
      const status = axiosError.response?.status ?? 'N/A';
      const code = axiosError.code ?? 'N/A'; // e.g., ECONNABORTED for timeout
      // Use the specific log format
      const logMessage = `⚠️ Failed to fetch remote asset ${resolvedUrl.href}: ${axiosError.message} (Code: ${code})`;
      logger?.warn(logMessage);
    }
    // Check for file system errors *next*
    else if (protocol === 'file:' && error instanceof Error) {
      let failedPath = resolvedUrl.href;
      try {
        failedPath = fileURLToPath(resolvedUrl);
      } catch {
        /* ignore */
      }
      failedPath = path.normalize(failedPath);

      if ((error as NodeJSErrnoException).code === 'ENOENT') {
        logger?.warn(`⚠️ File not found (ENOENT) for asset: ${failedPath}.`);
      } else if ((error as NodeJSErrnoException).code === 'EACCES') {
        // Log ONLY the specific EACCES message
        logger?.warn(`⚠️ Permission denied (EACCES) reading asset: ${failedPath}.`);
      } else {
        logger?.warn(`⚠️ Failed to read local asset ${failedPath}: ${error.message}`);
      }
    }
    // Generic fallback for *other* types of Errors (that are not Axios or known FS errors)
    else if (error instanceof Error) {
      logger?.warn(
        `⚠️ An unexpected error occurred processing asset ${resolvedUrl.href}: ${error.message}`
      );
    }
    // Fallback for non-Error throws (e.g., strings, numbers)
    else {
      logger?.warn(
        `⚠️ An unknown and unexpected error occurred processing asset ${resolvedUrl.href}: ${String(error)}`
      );
    }
    // Return null on ANY error
    return null;
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
  // Array to hold assets discovered within this CSS content
  const newlyDiscovered: Asset[] = [];
  // Set to track URLs processed within this specific CSS file to avoid adding duplicates from the same file
  const processedInThisParse = new Set<string>();

  // Regex for url(...) patterns, handling optional quotes (non-greedy match for URL)
  const urlRegex = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  // Regex for @import rules, handling url() or bare string, optional quotes (non-greedy match for URL)
  const importRegex = /@import\s+(?:url\(\s*(['"]?)(.*?)\1\s*\)|(['"])(.*?)\3)\s*;/gi;

  /** Internal helper to process a found URL string */
  const processFoundUrl = (rawUrl: string | undefined, ruleType: '@import' | 'url()') => {
    // Skip if URL is empty, undefined, a data URI, or only a fragment
    if (!rawUrl || rawUrl.trim() === '' || rawUrl.startsWith('data:') || rawUrl.startsWith('#'))
      return;

    // Resolve the potentially relative URL against the CSS file's base URL
    const resolvedUrl = resolveCssRelativeUrl(rawUrl, cssBaseContextUrl, logger);

    // If successfully resolved and not already found *in this specific CSS file*
    if (resolvedUrl && !processedInThisParse.has(resolvedUrl)) {
      // Mark this resolved URL as processed for this CSS file
      processedInThisParse.add(resolvedUrl);
      // Guess the asset type (css, image, font, etc.) based on the resolved URL
      const { assetType } = guessMimeType(resolvedUrl);

      // Add the discovered asset to the list for this CSS file
      newlyDiscovered.push({
        type: assetType,
        url: resolvedUrl, // Store the resolved absolute URL string
        content: undefined, // Content will be fetched later if needed
      });
      logger?.debug(
        `Discovered nested ${assetType} asset (${ruleType}) in CSS ${cssBaseContextUrl}: ${resolvedUrl}`
      );
    }
  };

  // Find all url(...) matches in the CSS content
  let match;
  while ((match = urlRegex.exec(cssContent)) !== null) {
    // Group 2 captures the URL part inside url()
    processFoundUrl(match[2], 'url()');
  }

  // Find all @import matches in the CSS content
  // Reset lastIndex as we're reusing the regex object implicitly
  importRegex.lastIndex = 0;
  while ((match = importRegex.exec(cssContent)) !== null) {
    // Group 2 captures url('...'), Group 4 captures bare "..."
    processFoundUrl(match[2] || match[4], '@import');
  }

  // Return the list of assets discovered within this CSS content
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
  logger?.info(
    `🚀 Starting asset extraction! Embed: ${embedAssets}. Input: ${inputPathOrUrl || '(HTML content only)'}`
  );

  // Get the initial list of assets found directly in the HTML
  const initialAssets: Asset[] = parsed.assets || [];
  // Stores the final result: Map<resolved URL string, Asset object> to ensure uniqueness
  const finalAssetsMap = new Map<string, Asset>();
  // Queue holds assets whose content needs to be processed (fetched/analyzed)
  let assetsToProcess: Asset[] = [];
  // Set to track URLs that are either already fully processed (in finalAssetsMap)
  // OR currently in the processing queue (assetsToProcess) to prevent reprocessing/loops.
  const processedOrQueuedUrls = new Set<string>();

  // --- Determine Base URL Context for the HTML ---
  const htmlBaseContextUrl = determineBaseUrl(inputPathOrUrl || '', logger);
  // Warn if no base URL could be found and there are relative paths in the initial assets
  if (
    !htmlBaseContextUrl &&
    initialAssets.some(
      a =>
        !/^[a-z]+:/i.test(a.url) &&
        !a.url.startsWith('data:') &&
        !a.url.startsWith('#') &&
        !a.url.startsWith('/')
    )
  ) {
    logger?.warn(
      '🚨 No valid base path/URL determined for the HTML source! Resolution of relative asset paths from HTML may fail.'
    );
  } else if (htmlBaseContextUrl) {
    logger?.debug(`Using HTML base context URL: ${htmlBaseContextUrl}`);
  }

  // --- Initial Queue Population from HTML assets ---
  logger?.debug(`Queueing ${initialAssets.length} initial assets parsed from HTML...`);
  for (const asset of initialAssets) {
    // Resolve the initial asset URL against the HTML base context
    const resolvedUrlObj = resolveAssetUrl(asset.url, htmlBaseContextUrl, logger);

    // Skip if URL is invalid, data URI, fragment, or unsupported protocol
    if (!resolvedUrlObj) {
      logger?.debug(` -> Skipping initial asset with unresolvable/ignorable URL: ${asset.url}`);
      continue;
    }
    // Get the resolved absolute URL string
    const urlToQueue = resolvedUrlObj.href;

    // Check if this URL is already tracked (processed or queued)
    if (!processedOrQueuedUrls.has(urlToQueue)) {
      // Mark as queued (add to set *before* adding to array)
      processedOrQueuedUrls.add(urlToQueue);

      // Guess type from the resolved/original URL if not provided initially
      const { assetType: guessedType } = guessMimeType(urlToQueue);
      const initialType = asset.type ?? guessedType; // Use provided type or fallback to guessed type

      // Add the resolved asset to the processing queue
      assetsToProcess.push({
        url: urlToQueue, // Use the resolved URL
        type: initialType,
        content: undefined, // Content is initially undefined
      });
      logger?.debug(` -> Queued initial asset: ${urlToQueue} (Original raw: ${asset.url})`);
    } else {
      logger?.debug(` -> Skipping already processed/queued initial asset: ${urlToQueue}`);
    }
  }

  // --- Main processing loop (continues as long as there are assets to process) ---
  let iterationCount = 0;
  while (assetsToProcess.length > 0) {
    iterationCount++;
    // Prevent potential infinite loops
    if (iterationCount > MAX_ASSET_EXTRACTION_ITERATIONS) {
      logger?.error(
        `🛑 Asset extraction loop limit hit (${MAX_ASSET_EXTRACTION_ITERATIONS})! Aborting.`
      );
      const remainingUrls = assetsToProcess
        .map(a => a.url)
        .slice(0, 10)
        .join(', ');
      logger?.error(
        `Remaining queue sample (${assetsToProcess.length} items): ${remainingUrls}...`
      );
      // Add assets remaining in queue to final map without content before breaking
      assetsToProcess.forEach(asset => {
        if (!finalAssetsMap.has(asset.url)) {
          finalAssetsMap.set(asset.url, { ...asset, content: undefined });
        }
      });
      assetsToProcess = []; // Clear queue to stop the loop
      break; // Exit loop
    }

    // Take a snapshot of the current queue to process in this iteration
    const currentBatch = [...assetsToProcess];
    // Clear the main queue; new assets found in this batch will be added here for the *next* iteration
    assetsToProcess = [];

    logger?.debug(`--- Processing batch ${iterationCount}: ${currentBatch.length} asset(s) ---`);

    // Process each asset in the current batch
    for (const asset of currentBatch) {
      // Double-check: Skip if this asset somehow got fully processed in a previous iteration (shouldn't happen with current logic, but safe check)
      if (finalAssetsMap.has(asset.url)) {
        logger?.debug(`Skipping asset already in final map: ${asset.url}`);
        continue;
      }

      let assetContentBuffer: Buffer | null = null; // To store fetched binary content
      let finalContent: string | undefined = undefined; // Final content (text or data URI) for the Asset object
      let cssContentForParsing: string | undefined = undefined; // Text content specifically for parsing CSS

      // --- Determine if fetching is needed ---
      // Fetch if we need to embed all assets OR if it's CSS (we need content to parse for nested assets)
      const needsFetching = embedAssets || asset.type === 'css';
      let assetUrlObj: URL | null = null; // URL object needed for fetchAsset

      if (needsFetching) {
        // --- Create URL object for fetching ---
        try {
          // Asset URL should be absolute at this point
          assetUrlObj = new URL(asset.url);
        } catch (urlError) {
          // Log error if creating URL object fails
          logger?.warn(
            `Cannot create URL object for "${asset.url}", skipping fetch. Error: ${urlError instanceof Error ? urlError.message : String(urlError)}`
          );
          // Store asset without content in the final map
          finalAssetsMap.set(asset.url, { ...asset, content: undefined });
          // Skip to next asset in the current batch
          continue;
        }

        // --- Fetch Asset ---
        if (assetUrlObj) {
          // Call fetchAsset (which handles http/https/file and errors)
          assetContentBuffer = await fetchAsset(assetUrlObj, logger);
          // fetchAsset returns null on failure
        }
      } // End if(needsFetching)

      // --- If fetching was required but failed, store asset without content and continue ---
      if (needsFetching && assetContentBuffer === null) {
        logger?.debug(`Storing asset ${asset.url} without content due to fetch failure.`);
        // Add to final map with undefined content
        finalAssetsMap.set(asset.url, { ...asset, content: undefined });
        // Skip to the next asset in the current batch
        continue;
      }

      // --- Prepare Content for Storing/Embedding (if fetched successfully) ---
      if (assetContentBuffer) {
        // Only proceed if content was fetched
        // Guess MIME type based on the asset's URL extension
        const mimeInfo = guessMimeType(asset.url);
        // Use the guessed MIME type or fallback to a generic binary type
        const effectiveMime = mimeInfo.mime || 'application/octet-stream';

        // Handle TEXT types (CSS, JS)
        if (TEXT_ASSET_TYPES.has(asset.type)) {
          let textContent: string | undefined;
          let wasLossy = false;
          try {
            // Try decoding the buffer as UTF-8
            textContent = assetContentBuffer.toString('utf-8');
            // Check if the decoding process lost information (e.g., invalid sequences replaced)
            wasLossy = isUtf8DecodingLossy(assetContentBuffer, textContent);
          } catch (e) {
            // Decoding itself failed
            textContent = undefined;
            wasLossy = true;
          }

          // If decoding was successful and not lossy
          if (!wasLossy && textContent !== undefined) {
            // If embedding, store the text content
            if (embedAssets) {
              finalContent = textContent;
            } else {
              finalContent = undefined; // Not embedding text, store undefined
            }
            // If it's CSS, store its text content for parsing regardless of embedding option
            if (asset.type === 'css') {
              cssContentForParsing = textContent;
            }
          } else {
            // Decoding failed or was lossy
            logger?.warn(
              `Could not decode ${asset.type} asset ${asset.url} as valid UTF-8 text.${embedAssets ? ' Falling back to base64 data URI.' : ''}`
            );
            cssContentForParsing = undefined; // Cannot parse CSS if decoding failed
            // Embed as base64 data URI if requested, using the effective MIME type
            if (embedAssets) {
              finalContent = `data:${effectiveMime};base64,${assetContentBuffer.toString('base64')}`;
            } else {
              finalContent = undefined; // Not embedding
            }
          }
        }
        // Handle BINARY types (image, font, video, audio)
        else if (BINARY_ASSET_TYPES.has(asset.type)) {
          // Embed as base64 data URI if requested
          if (embedAssets) {
            finalContent = `data:${effectiveMime};base64,${assetContentBuffer.toString('base64')}`;
          } else {
            finalContent = undefined; // Not embedding
          }
          cssContentForParsing = undefined; // Not CSS, so no parsing needed
        }
        // Handle 'other' or unknown types
        else {
          cssContentForParsing = undefined; // Assume not parseable as CSS
          // If embedding, attempt to store as text, fallback to base64 if invalid UTF-8
          if (embedAssets) {
            try {
              const attemptedTextContent = assetContentBuffer.toString('utf-8');
              if (isUtf8DecodingLossy(assetContentBuffer, attemptedTextContent)) {
                // If text decoding is lossy, warn and use base64
                logger?.warn(
                  `Couldn't embed unclassified asset ${asset.url} as text due to invalid UTF-8 sequences. Falling back to base64 (octet-stream).`
                );
                finalContent = `data:application/octet-stream;base64,${assetContentBuffer.toString('base64')}`;
              } else {
                // Store as text if decoding worked
                finalContent = attemptedTextContent;
                logger?.debug(`Successfully embedded unclassified asset ${asset.url} as text.`);
              }
            } catch (decodeError) {
              // If toString fails, warn and use base64
              logger?.warn(
                `Error during text decoding for unclassified asset ${asset.url}: ${decodeError instanceof Error ? decodeError.message : String(decodeError)}. Falling back to base64.`
              );
              finalContent = `data:application/octet-stream;base64,${assetContentBuffer.toString('base64')}`;
            }
          } else {
            finalContent = undefined; // Not embedding
          }
        }
      } else {
        // Content was not fetched (e.g., embedAssets=false and not CSS)
        finalContent = undefined;
        cssContentForParsing = undefined;
      }

      // --- Store the final processed asset in the map ---
      // Use the resolved URL as the key and ensure the asset object also uses the resolved URL
      finalAssetsMap.set(asset.url, { ...asset, url: asset.url, content: finalContent });
      // Note: URL was already added to processedOrQueuedUrls when initially queued or discovered in CSS

      // --- Process CSS for nested assets ---
      // Only if it's CSS and we successfully decoded its content for parsing
      if (asset.type === 'css' && cssContentForParsing) {
        // Determine the base URL *for this specific CSS file* to resolve its relative links
        const cssBaseContextUrl = determineBaseUrl(asset.url, logger); // CSS URL is absolute here
        logger?.debug(
          `CSS base context for resolving nested assets within ${asset.url}: ${cssBaseContextUrl}`
        );

        if (cssBaseContextUrl) {
          // Extract URLs found within this CSS content
          const newlyDiscoveredAssets = extractUrlsFromCSS(
            cssContentForParsing,
            cssBaseContextUrl, // Use the CSS file's own URL as the base
            logger
          );

          // If new assets were found in the CSS
          if (newlyDiscoveredAssets.length > 0) {
            logger?.debug(
              `Discovered ${newlyDiscoveredAssets.length} nested assets in CSS ${asset.url}. Checking against queue...`
            );
            // Process each newly discovered asset
            for (const newAsset of newlyDiscoveredAssets) {
              // CHECK: Add to the main processing queue only if this resolved URL hasn't been processed OR queued before.
              if (!processedOrQueuedUrls.has(newAsset.url)) {
                processedOrQueuedUrls.add(newAsset.url); // Mark as queued now
                assetsToProcess.push(newAsset); // Add to the queue for the *next* iteration
                logger?.debug(` -> Queued new nested asset: ${newAsset.url}`);
              } else {
                // Skip if already handled
                logger?.debug(
                  ` -> Skipping already processed/queued nested asset: ${newAsset.url}`
                );
              }
            }
          }
        } else {
          // Warn if the base URL for the CSS file couldn't be determined (shouldn't happen if asset.url was valid)
          logger?.warn(
            `Could not determine base URL context for CSS file ${asset.url}. Cannot resolve nested relative paths within it.`
          );
        }
      } // End if(asset.type === 'css' && cssContentForParsing)
    } // End for loop over currentBatch
  } // End while loop (assetsToProcess.length > 0)

  // Log completion summary
  const finalIterationCount =
    iterationCount > MAX_ASSET_EXTRACTION_ITERATIONS
      ? `${MAX_ASSET_EXTRACTION_ITERATIONS}+ (limit hit)`
      : iterationCount;
  logger?.info(
    `✅ Asset extraction COMPLETE! Found ${finalAssetsMap.size} unique assets in ${finalIterationCount} iterations.`
  );

  // Return the original HTML content and the final list of processed assets from the map
  return {
    htmlContent: parsed.htmlContent,
    assets: Array.from(finalAssetsMap.values()),
  };
}
