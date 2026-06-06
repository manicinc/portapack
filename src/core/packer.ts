/**
 * @file src/core/packer.ts
 * @description Inlines CSS, JS, and images into an HTML document for full portability.
 * Uses Cheerio for safe DOM manipulation.
 */

import * as cheerio from 'cheerio';
// Import CheerioAPI type
import type { CheerioAPI } from 'cheerio';
import type { ParsedHTML, Asset } from '../types'; // Assuming correct path
import { Logger } from '../utils/logger'; // Assuming correct path
import { guessMimeType } from '../utils/mime'; // Assuming correct path
import { determineBaseUrl, resolveAssetUrl } from './extractor'; // Reuse the *exact* resolution logic used during extraction

/**
 * Escapes characters potentially problematic within inline `<script>` tags.
 */
function escapeScriptContent(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}

/**
 * Ensures a `<base href="./">` tag exists within the `<head>` of the HTML.
 * Creates <head> or even <html> if necessary using Cheerio.
 *
 * @param {CheerioAPI} $ - The Cheerio instance representing the HTML document.
 * @param {Logger} [logger] - Optional logger instance.
 */
function ensureBaseTag($: CheerioAPI, logger?: Logger): void {
  let head = $('head');

  // If <head> doesn't exist, create it, ensuring <html> exists first.
  if (head.length === 0) {
    logger?.debug('No <head> tag found. Creating <head> and ensuring <html> exists.');
    let htmlElement = $('html');

    // If <html> doesn't exist, create it and wrap the existing content.
    if (htmlElement.length === 0) {
      logger?.debug('No <html> tag found. Wrapping content in <html><body>...');
      const bodyContent = $.root().html() || '';
      $.root().empty();
      // FIX: Use 'as any' for type assertion
      htmlElement = $('<html>').appendTo($.root()) as any;
      // FIX: Use 'as any' for type assertion
      head = $('<head>').appendTo(htmlElement) as any;
      $('<body>').html(bodyContent).appendTo(htmlElement);
    } else {
      // If <html> exists but <head> doesn't, prepend <head> to <html>
      // FIX: Use 'as any' for type assertion
      head = $('<head>').prependTo(htmlElement) as any;
    }
  }

  // Now head should represent the head element selection.
  // Check if <base> exists within the guaranteed <head>.
  // Use type guard just in case head couldn't be created properly
  if (head && head.length > 0 && head.find('base[href]').length === 0) {
    logger?.debug('Prepending <base href="./"> to <head>.');
    head.prepend('<base href="./">');
  }
}

/**
 * Rewrites `url(...)` references inside a block of CSS text, replacing each one whose
 * target was fetched and embedded with the corresponding base64 data URI. This is what
 * pulls CSS-referenced images and `@font-face` fonts into the self-contained output.
 *
 * @param {string} cssContent - The raw CSS text to rewrite.
 * @param {string | undefined} cssBaseContextUrl - The absolute URL of the CSS (for a linked
 *   stylesheet, its own location; for an inline <style>, the host document's base) used to
 *   resolve relative `url(...)` targets to the same keys produced during extraction.
 * @param {Map<string, Asset>} assetMap - Map of resolved absolute URL → Asset (with content).
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {string} The CSS with embeddable `url(...)` targets replaced by data URIs.
 */
function rewriteCssUrls(
  cssContent: string,
  cssBaseContextUrl: string | undefined,
  assetMap: Map<string, Asset>,
  logger?: Logger
): string {
  if (!cssBaseContextUrl) return cssContent;
  const urlRegex = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
  return cssContent.replace(urlRegex, (match, quote, rawUrl) => {
    if (!rawUrl || rawUrl.startsWith('data:') || rawUrl.startsWith('#')) return match;
    const resolved = resolveAssetUrl(rawUrl, cssBaseContextUrl, logger);
    if (!resolved) return match;
    const asset = assetMap.get(resolved.href);
    if (asset?.content && typeof asset.content === 'string' && asset.content.startsWith('data:')) {
      return `url(${quote}${asset.content}${quote})`;
    }
    return match;
  });
}

/**
 * Inlines assets into the HTML document using Cheerio for safe DOM manipulation.
 */
function inlineAssets($: CheerioAPI, assets: Asset[], baseUrl?: string, logger?: Logger): void {
  logger?.debug(`Inlining ${assets.filter(a => a.content).length} assets with content...`);
  const assetMap = new Map<string, Asset>(assets.map(asset => [asset.url, asset]));

  // Assets discovered by the extractor are keyed by their *resolved absolute* URL,
  // but the HTML still references them by their *raw* (often relative) attribute value.
  // Resolve each raw reference against the same base the extractor used so the keys match.
  const htmlBaseContextUrl = baseUrl ? determineBaseUrl(baseUrl, logger) : undefined;

  /**
   * Finds the asset for a raw href/src attribute value. Tries a direct match first
   * (covers already-absolute URLs and content keyed by the raw value), then falls back
   * to resolving the raw value against the document base URL.
   */
  const findAsset = (rawUrl?: string): Asset | undefined => {
    if (!rawUrl) return undefined;
    const direct = assetMap.get(rawUrl);
    if (direct) return direct;
    if (htmlBaseContextUrl) {
      const resolved = resolveAssetUrl(rawUrl, htmlBaseContextUrl, logger);
      if (resolved) return assetMap.get(resolved.href);
    }
    return undefined;
  };

  // 0. Rewrite url() references inside pre-existing inline <style> blocks (background
  // images, @font-face fonts, etc.), resolving them against the host document's base URL.
  // Runs before link inlining so it only touches author-written inline styles, not the
  // <style> tags synthesized from linked stylesheets (those are handled in step 1).
  $('style').each((_, el) => {
    const styleEl = $(el);
    const css = styleEl.html();
    if (!css) return;
    const rewritten = rewriteCssUrls(css, htmlBaseContextUrl, assetMap, logger);
    if (rewritten !== css) {
      styleEl.text(rewritten);
    }
  });

  // 1. Inline CSS (<link rel="stylesheet" href="...">)
  $('link[rel="stylesheet"][href]').each((_, el) => {
    const link = $(el);
    const href = link.attr('href');
    const asset = findAsset(href);
    if (asset?.content && typeof asset.content === 'string') {
      if (asset.content.startsWith('data:')) {
        logger?.debug(`Replacing link with style tag using existing data URI: ${asset.url}`);
        const styleTag = $('<style>').text(`@import url("${asset.content}");`);
        link.replaceWith(styleTag);
      } else {
        logger?.debug(`Inlining CSS: ${asset.url}`);
        // Resolve url() targets relative to the stylesheet's own location, then embed them.
        const cssBase = determineBaseUrl(asset.url, logger);
        const rewritten = rewriteCssUrls(asset.content, cssBase, assetMap, logger);
        const styleTag = $('<style>').text(rewritten);
        link.replaceWith(styleTag);
      }
    } else if (href) {
      logger?.warn(`Could not inline CSS: ${href}. Content missing or invalid.`);
    }
  });

  // 2. Inline JS (<script src="...">)
  $('script[src]').each((_, el) => {
    const script = $(el);
    const src = script.attr('src');
    const asset = findAsset(src);
    if (asset?.content && typeof asset.content === 'string') {
      logger?.debug(`Inlining JS: ${asset.url}`);
      const inlineScript = $('<script>');
      inlineScript.text(escapeScriptContent(asset.content));
      Object.entries(script.attr() || {}).forEach(([key, value]) => {
        if (key.toLowerCase() !== 'src') inlineScript.attr(key, value);
      });
      script.replaceWith(inlineScript);
    } else if (src) {
      logger?.warn(`Could not inline JS: ${src}. Content missing or not string.`);
    }
  });

  // 3. Inline Images (<img src="...">, <video poster="...">, etc.)
  $('img[src], video[poster], input[type="image"][src]').each((_, el) => {
    const element = $(el);
    const srcAttr = element.is('video') ? 'poster' : 'src';
    const src = element.attr(srcAttr);
    const asset = findAsset(src);
    if (asset?.content && typeof asset.content === 'string' && asset.content.startsWith('data:')) {
      logger?.debug(`Inlining image via ${srcAttr}: ${asset.url}`);
      element.attr(srcAttr, asset.content);
    } else if (src) {
      logger?.warn(
        `Could not inline image via ${srcAttr}: ${src}. Content missing or not a data URI.`
      );
    }
  });

  // 4. Inline srcset attributes (<img srcset="...">, <source srcset="...">)
  $('img[srcset], source[srcset]').each((_, el) => {
    const element = $(el);
    const srcset = element.attr('srcset');
    if (!srcset) return;
    const newSrcsetParts: string[] = [];
    let changed = false;
    srcset.split(',').forEach(part => {
      const trimmedPart = part.trim();
      const [url, descriptor] = trimmedPart.split(/\s+/, 2);
      const asset = findAsset(url);
      if (
        asset?.content &&
        typeof asset.content === 'string' &&
        asset.content.startsWith('data:')
      ) {
        newSrcsetParts.push(`${asset.content}${descriptor ? ' ' + descriptor : ''}`);
        changed = true;
      } else {
        newSrcsetParts.push(trimmedPart);
      }
    });
    if (changed) {
      element.attr('srcset', newSrcsetParts.join(', '));
    }
  });

  // 5. Inline other asset types (video, audio sources)
  $('video[src], audio[src], video > source[src], audio > source[src]').each((_, el) => {
    const element = $(el);
    const src = element.attr('src');
    const asset = findAsset(src);
    if (asset?.content && typeof asset.content === 'string' && asset.content.startsWith('data:')) {
      logger?.debug(`Inlining media source: ${asset.url}`);
      element.attr('src', asset.content);
    }
  });

  logger?.debug('Asset inlining process complete.');
}

/**
 * Packs a ParsedHTML object into a single, self-contained HTML string.
 * This involves ensuring a base tag exists and inlining all assets
 * that have content available. Uses Cheerio for safe DOM manipulation.
 *
 * @export
 * @param {ParsedHTML} parsed - The parsed HTML document object, including its list of assets (which may have content).
 * @param {Logger} [logger] - Optional logger instance.
 * @param {string} [baseUrl] - The original source path/URL of the HTML, used to resolve raw asset
 *   references back to the resolved keys produced during extraction so they can be inlined.
 * @returns {string} The packed HTML string with assets inlined. Returns a minimal HTML structure if input is invalid.
 */
export function packHTML(parsed: ParsedHTML, logger?: Logger, baseUrl?: string): string {
  const { htmlContent, assets } = parsed;
  if (!htmlContent || typeof htmlContent !== 'string') {
    logger?.warn('Packer received empty or invalid htmlContent. Returning minimal HTML shell.');
    return '<!DOCTYPE html><html><head><base href="./"></head><body></body></html>';
  }

  logger?.debug('Loading HTML content into Cheerio for packing...');
  const $ = cheerio.load(htmlContent);

  logger?.debug('Ensuring <base> tag exists...');
  ensureBaseTag($, logger); // Ensure base tag safely

  logger?.debug('Starting asset inlining...');
  inlineAssets($, assets, baseUrl, logger); // Inline assets safely

  logger?.debug('Generating final packed HTML string...');
  const finalHtml = $.html();

  logger?.debug(`Packing complete. Final size: ${Buffer.byteLength(finalHtml)} bytes.`);
  return finalHtml;
}
