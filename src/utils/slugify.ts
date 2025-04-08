/**
 * @file slugify.ts
 * @description Converts any URL or string to a safe HTML slug usable in IDs, hashes, filenames, etc.
 */

// slugify function remains the same...
export function slugify(url: string): string {
    // ... (existing implementation)
    let cleaned = url.trim();

    try {
        const urlObj = new URL(url, 'https://placeholder.test');
        // Keep both pathname and search (query string)
        cleaned = (urlObj.pathname || '') + (urlObj.search || '');
    } catch {
        // Fallback: remove fragment first, then split by '?' if it exists
        cleaned = cleaned.split('#')[0];
        // No need to split by '?' here as the regex below handles it
    }

    cleaned = cleaned
        .replace(/\.(html|htm|php|asp|aspx|jsp)$/i, '') // Remove common extensions
        .replace(/\/+/g, '/')                         // Collapse multiple slashes
        .replace(/^\/|\/$/g, '')                     // Trim leading/trailing slashes
        // --- MODIFICATION HERE ---
        // Replace non-alphanumeric chars (including ?, =, &) with a hyphen
        // Or, to match the test 'searchqtestpage2', remove them entirely:
        .replace(/[^\w.-]+/g, '') // Removes ?, =, & etc. completely
        // .replace(/[^\w.-]+/g, '-') // Alternative: replaces with hyphens (-> search-q-test-page-2)
        // --- END MODIFICATION ---
        .replace(/-+/g, '-')                         // Collapse consecutive hyphens
        .replace(/^-+|-+$/g, '')                     // Trim leading/trailing hyphens
        .toLowerCase();

    return cleaned || 'index';
}


/**
 * Converts a URL or path string into a clean slug suitable for use as an HTML ID.
 * - Supports relative and absolute URLs.
 * - Removes file extensions and fragments.
 * - Incorporates query string parameters.
 * - Replaces unsafe characters.
 *
 * @param rawUrl - The raw page URL or path.
 * @returns A safe, lowercase slug string (e.g. "products-item-1", "searchqtestpage2")
 */
export function sanitizeSlug(rawUrl: string): string {
    if (!rawUrl || typeof rawUrl !== 'string') return 'index';

    let pathPart = rawUrl.trim();
    let queryPart = '';

    try {
        // Use a base URL to handle relative paths/URLs correctly
        const urlObj = new URL(rawUrl, 'http://localhost/'); // Base is arbitrary but needed for constructor
        pathPart = urlObj.pathname;
        queryPart = urlObj.search; // Keep the search part separate
    } catch {
        // Fallback for non-standard strings that might not parse as URLs
        const hashSplit = pathPart.split('#'); // Remove fragment first
        pathPart = hashSplit[0];
        const querySplit = pathPart.split('?'); // Then split path and query
        pathPart = querySplit[0];
        queryPart = querySplit.length > 1 ? `?${querySplit[1]}` : '';
    }

    // Clean the path part: remove extension, collapse/trim slashes
    pathPart = pathPart
        .replace(/\.(html?|php|aspx?|jsp)$/i, '') // Strip known file extensions
        .replace(/\/+/g, '/')                   // Collapse repeated slashes
        .replace(/^\/|\/$/g, '');               // Trim leading/trailing slashes

    // Clean the query part - remove non-alphanumeric characters entirely
    // This matches the test expectation "searchqtestpage2"
    const cleanedQuery = queryPart.replace(/[^a-zA-Z0-9]/g, ''); // Remove ?, =, &, etc.

    // Combine cleaned path and query
    let combined = pathPart + cleanedQuery;

    // Final cleanup on the combined string: handle remaining non-word chars, collapse/trim dashes
    let slug = combined
        // No need to replace spaces, should be handled by previous steps or not present
        .replace(/[^\w-]+/g, '-')             // Replace any *other* remaining unsafe chars with hyphens (safer)
        .replace(/-+/g, '-')                 // Collapse consecutive hyphens
        .replace(/^-+|-+$/g, '')              // Trim leading/trailing hyphens
        .toLowerCase();

    return slug || 'index';
}