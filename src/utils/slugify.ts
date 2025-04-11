/**
 * @file src/utils/slugify.ts
 * @description Converts any URL or string to a safe HTML slug usable in IDs, hashes, filenames, etc.
 */

/**
 * Converts a URL or path string into a clean slug suitable for use as an HTML ID or filename segment.
 * - Handles relative and absolute URLs.
 * - Removes common file extensions (.html, .htm, .php, etc.).
 * - Removes URL fragments (#...).
 * - Attempts to parse pathname and search parameters.
 * - Replaces spaces, slashes, and other unsafe characters with hyphens.
 * - Converts to lowercase.
 * - Collapses and trims hyphens.
 * - Returns 'index' for empty or invalid input.
 *
 * @param url - The raw URL or string to slugify.
 * @returns A safe, lowercase slug string.
 */
export function slugify(url: string): string {
    if (!url || typeof url !== 'string') return 'index';

    let cleaned = url.trim();
    let pathAndSearch = '';

    try {
        const urlObj = new URL(url, 'https://placeholder.base');
        pathAndSearch = (urlObj.pathname ?? '') + (urlObj.search ?? '');
    } catch {
        pathAndSearch = cleaned.split('#')[0]; // Remove fragment
    }

    // Decode URI components AFTER parsing from URL to handle %20 etc.
    try {
        cleaned = decodeURIComponent(pathAndSearch);
    } catch (e) {
        cleaned = pathAndSearch; // Proceed if decoding fails
    }

    cleaned = cleaned
        // Remove common web extensions FIRST
        .replace(/\.(html?|php|aspx?|jsp)$/i, '')
        // Replace path separators and common separators/spaces with a hyphen
        .replace(/[\s/?=&\\]+/g, '-') // Target spaces, /, ?, =, &, \
        // Remove any remaining characters that are not alphanumeric, hyphen, underscore, or period
        .replace(/[^\w._-]+/g, '')    // Allow word chars, '.', '_', '-'
        // Collapse consecutive hyphens
        .replace(/-+/g, '-')
        // Trim leading/trailing hyphens
        .replace(/^-+|-+$/g, '')
        // Convert to lowercase
        .toLowerCase();

    // Return 'index' if the process results in an empty string
    return cleaned || 'index';
}


/**
 * Converts a URL or path string into a clean slug suitable for use as an HTML ID.
 * Note: This implementation might be very similar or identical to slugify depending on exact needs.
 * This example uses the refined slugify logic. Consider consolidating if appropriate.
 *
 * @param rawUrl - The raw page URL or path.
 * @returns A safe, lowercase slug string (e.g. "products-item-1", "search-q-test-page-2")
 */
export function sanitizeSlug(rawUrl: string): string {
    // Re-use the improved slugify logic for consistency
    return slugify(rawUrl);
}