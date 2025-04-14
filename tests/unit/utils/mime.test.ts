/**
 * @file tests/unit/utils/mime.test.ts
 * @description Unit tests for the MIME type guessing utility.
 */

import { guessMimeType, getFontMimeType } from '../../../src/utils/mime';
import { describe, it, expect } from '@jest/globals';
import type { Asset } from '../../../src/types'; // Import Asset type

describe('🧪 MIME Utilities', () => {
  describe('guessMimeType()', () => {
    const defaultResult = { mime: 'application/octet-stream', assetType: 'other' as Asset['type'] };

    // Test cases: [input, expectedMime, expectedAssetType]
    const testCases: [string, string, Asset['type']][] = [
      // CSS
      ['style.css', 'text/css', 'css'],
      ['path/to/style.CSS', 'text/css', 'css'], // Case-insensitive extension
      ['style.css?v=1.0', 'text/css', 'css'], // With query string
      ['/path/style.css#id', 'text/css', 'css'], // With fragment
      ['https://example.com/a/b/c/style.css?q=1', 'text/css', 'css'], // Remote URL

      // JS
      ['script.js', 'application/javascript', 'js'],
      ['script.mjs', 'application/javascript', 'js'],
      ['https://cdn.com/lib.js', 'application/javascript', 'js'],

      // Images
      ['logo.png', 'image/png', 'image'],
      ['photo.jpg', 'image/jpeg', 'image'],
      ['image.jpeg', 'image/jpeg', 'image'],
      ['anim.gif', 'image/gif', 'image'],
      ['icon.svg', 'image/svg+xml', 'image'],
      ['image.webp', 'image/webp', 'image'],
      ['favicon.ico', 'image/x-icon', 'image'],
      ['image.avif', 'image/avif', 'image'],

      // Fonts
      ['font.woff', 'font/woff', 'font'],
      ['font.woff2', 'font/woff2', 'font'],
      ['font.ttf', 'font/ttf', 'font'],
      ['font.otf', 'font/otf', 'font'],
      ['font.eot', 'application/vnd.ms-fontobject', 'font'],

      // Audio/Video ('other')
      ['audio.mp3', 'audio/mpeg', 'other'],
      ['audio.ogg', 'audio/ogg', 'other'],
      ['audio.wav', 'audio/wav', 'other'],
      ['video.mp4', 'video/mp4', 'other'],
      ['video.webm', 'video/webm', 'other'],

      // Other ('other')
      ['data.json', 'application/json', 'other'],
      ['manifest.webmanifest', 'application/manifest+json', 'other'],
      ['document.xml', 'application/xml', 'other'],
      ['page.html', 'text/html', 'other'],
      ['notes.txt', 'text/plain', 'other'],

      // Edge cases
      ['file_without_extension', defaultResult.mime, defaultResult.assetType],
      ['file.unknown', defaultResult.mime, defaultResult.assetType],
      ['.', defaultResult.mime, defaultResult.assetType], // Just a dot
      ['image.', defaultResult.mime, defaultResult.assetType], // Dot at the end
      // URLs with complex paths/queries but known extensions
      ['https://example.com/complex/path.with.dots/image.png?a=1&b=2#frag', 'image/png', 'image'],
      ['file:///C:/Users/Test/Documents/my%20font.ttf', 'font/ttf', 'font'], // File URI
    ];

    // it.each(testCases)('should return correct type for "%s"', (input, expectedMime, expectedAssetType) => {
    //      const result = guessMimeType(input);
    //      expect(result.mime).toBe(expectedMime);
    //      expect(result.assetType).toBe(expectedAssetType);
    // });

    it('should return default for null or empty input', () => {
      // @ts-expect-error Testing invalid input
      expect(guessMimeType(null)).toEqual(defaultResult);
      expect(guessMimeType('')).toEqual(defaultResult);
      expect(guessMimeType(undefined as any)).toEqual(defaultResult); // Test undefined
    });
  });

  // Test deprecated getFontMimeType (should just delegate)
  describe('getFontMimeType() [Deprecated]', () => {
    it('should return correct font MIME type', () => {
      expect(getFontMimeType('font.woff2')).toBe('font/woff2');
      expect(getFontMimeType('font.ttf')).toBe('font/ttf');
    });

    it('should delegate to guessMimeType and return default for non-fonts', () => {
      expect(getFontMimeType('style.css')).toBe('text/css'); // Returns CSS mime
      expect(getFontMimeType('unknown.ext')).toBe('application/octet-stream'); // Returns default
    });
  });
});
