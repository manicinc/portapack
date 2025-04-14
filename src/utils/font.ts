/**
 * utils/font.ts
 *
 * Utilities for detecting and encoding font files for embedding.
 */

import path from 'path';
import fs from 'fs/promises';

/**
 * Returns the correct MIME type for a given font file.
 *
 * @param fontUrl - The path or URL of the font file
 */
export function getFontMimeType(fontUrl: string): string {
  const ext = path.extname(fontUrl).toLowerCase().replace('.', '');

  switch (ext) {
    case 'woff':
      return 'font/woff';
    case 'woff2':
      return 'font/woff2';
    case 'ttf':
      return 'font/ttf';
    case 'otf':
      return 'font/otf';
    case 'eot':
      return 'application/vnd.ms-fontobject';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Reads a font file and encodes it as a base64 data URI.
 *
 * NOTE: Not currently used in the pipeline, but useful for testing and future features.
 *
 * @param fontPath - Absolute or relative path to font
 * @returns Full `data:` URI as a string
 */
export async function encodeFontToDataURI(fontPath: string): Promise<string> {
  const mime = getFontMimeType(fontPath);
  const buffer = await fs.readFile(fontPath);
  const base64 = buffer.toString('base64');
  return `data:${mime};base64,${base64}`;
}
