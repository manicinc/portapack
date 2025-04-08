/**
 * @file src/utils/mime.ts
 * @description Utilities for guessing MIME types and asset types from URLs/paths.
 */

import path from 'path';
import type { Asset } from '../types'; // Assuming types are in ../types

/**
 * Maps common file extensions to their corresponding MIME types and general Asset types.
 */
const MIME_MAP: Record<string, { mime: string; assetType: Asset['type'] }> = {
    // CSS
    '.css': { mime: 'text/css', assetType: 'css' },
    // JavaScript
    '.js': { mime: 'application/javascript', assetType: 'js' },
    '.mjs': { mime: 'application/javascript', assetType: 'js' },
    // Images
    '.png': { mime: 'image/png', assetType: 'image' },
    '.jpg': { mime: 'image/jpeg', assetType: 'image' },
    '.jpeg': { mime: 'image/jpeg', assetType: 'image' },
    '.gif': { mime: 'image/gif', assetType: 'image' },
    '.svg': { mime: 'image/svg+xml', assetType: 'image' },
    '.webp': { mime: 'image/webp', assetType: 'image' },
    '.ico': { mime: 'image/x-icon', assetType: 'image' },
    '.avif': { mime: 'image/avif', assetType: 'image' },
    // Fonts
    '.woff': { mime: 'font/woff', assetType: 'font' },
    '.woff2': { mime: 'font/woff2', assetType: 'font' },
    '.ttf': { mime: 'font/ttf', assetType: 'font' },
    '.otf': { mime: 'font/otf', assetType: 'font' },
    '.eot': { mime: 'application/vnd.ms-fontobject', assetType: 'font' },
    // Audio/Video (add more as needed)
    '.mp3': { mime: 'audio/mpeg', assetType: 'other' },
    '.ogg': { mime: 'audio/ogg', assetType: 'other' },
    '.wav': { mime: 'audio/wav', assetType: 'other' },
    '.mp4': { mime: 'video/mp4', assetType: 'other' },
    '.webm': { mime: 'video/webm', assetType: 'other' },
    // Other common web types
    '.json': { mime: 'application/json', assetType: 'other' },
    '.webmanifest': { mime: 'application/manifest+json', assetType: 'other' },
    '.xml': { mime: 'application/xml', assetType: 'other' },
    '.html': { mime: 'text/html', assetType: 'other' }, // Usually not needed as asset, but for completeness
    '.txt': { mime: 'text/plain', assetType: 'other' },
};

/**
 * Default MIME type and Asset type for unknown file extensions.
 */
const DEFAULT_MIME_TYPE = {
    mime: 'application/octet-stream',
    assetType: 'other' as Asset['type'] // Explicit cast needed
};

/**
 * Guesses the MIME type and general Asset type based on a URL or file path's extension.
 *
 * @param {string} urlOrPath - The URL or file path string.
 * @returns {{ mime: string; assetType: Asset['type'] }} An object containing the guessed MIME type
 * and the corresponding Asset type (e.g., 'image', 'font', 'css', 'js', 'other'). Returns a default
 * if the extension is unknown.
 */
export function guessMimeType(urlOrPath: string): { mime: string; assetType: Asset['type'] } {
    if (!urlOrPath) {
        return DEFAULT_MIME_TYPE;
    }
    // Extract the extension, handling potential query parameters or fragments
    let ext = '';
    try {
        // Use URL parsing first to handle URLs correctly
        const parsedUrl = new URL(urlOrPath);
        ext = path.extname(parsedUrl.pathname).toLowerCase();
    } catch {
        // If it's not a valid URL, treat it as a path
        ext = path.extname(urlOrPath).toLowerCase();
    }

    return MIME_MAP[ext] || DEFAULT_MIME_TYPE;
}

/**
 * Gets the appropriate font MIME type based on the file extension.
 * Deprecated: Prefer `guessMimeType`.
 * @deprecated Use guessMimeType instead.
 * @param {string} fontUrl - The URL or path of the font file.
 * @returns {string} The corresponding font MIME type or a default.
 */
export function getFontMimeType(fontUrl: string): string {
    return guessMimeType(fontUrl).mime; // Delegate to the main function
}