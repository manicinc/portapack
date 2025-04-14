/**
 * @file src/core/minifier.ts
 * @description
 * Provides the core functionality for minifying HTML, CSS, and JavaScript content
 * within the PortaPack bundling process. Uses `html-minifier-terser`, `clean-css`,
 * and `terser` libraries. Handles errors gracefully by logging warnings and returning
 * original content for the specific asset that failed minification.
 * Includes workarounds for apparent issues in @types/clean-css definitions.
 */

// --- Imports ---
import { minify as htmlMinify } from 'html-minifier-terser';
import type { Options as HtmlMinifyOptions } from 'html-minifier-terser';
import CleanCSS from 'clean-css';
// Import specific types from clean-css. Note: Using these directly caused issues.
import type { Options as CleanCSSOptions } from 'clean-css';
import { minify as jsMinify } from 'terser';
import type { MinifyOptions, MinifyOutput } from 'terser';
// Import necessary types from project - ensure these paths are correct and use .js extension
import type { ParsedHTML, BundleOptions, Asset } from '../types.js';
import { Logger } from '../utils/logger.js';

// --- Helper Interface for Workaround ---

/**
 * Represents the expected structure of the synchronous output from clean-css.
 * Used with type assertion as a workaround for problematic official type definitions.
 */
export interface CleanCSSSyncResult {
  // <<< MUST HAVE 'export'
  styles?: string;
  errors?: string[];
  warnings?: string[];
  stats?: {
    originalSize: number;
    minifiedSize: number;
  };
}

// --- Default Minification Options Constants ---

/**
 * Default options for html-minifier-terser.
 */
const HTML_MINIFY_OPTIONS: HtmlMinifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  conservativeCollapse: true,
  minifyCSS: false, // Handled separately
  minifyJS: false, // Handled separately
  removeAttributeQuotes: false,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
};

/**
 * Default options for clean-css.
 * Explicitly set returnPromise to false to ensure synchronous operation.
 */
const CSS_MINIFY_OPTIONS: CleanCSSOptions = {
  returnPromise: false, // <<< *** Ensures sync operation at runtime ***
  level: {
    1: {
      // Level 1 optimizations (safe transformations)
      optimizeBackground: true,
      optimizeBorderRadius: true,
      optimizeFilter: true,
      optimizeFontWeight: true,
      optimizeOutline: true,
    },
    2: {
      // Level 2 optimizations (structural changes, generally safe)
      mergeMedia: true,
      mergeNonAdjacentRules: true,
      removeDuplicateFontRules: true,
      removeDuplicateMediaBlocks: true,
      removeDuplicateRules: true,
      restructureRules: true,
    },
  },
  // Note: Type checking based on these options seems problematic with current @types/clean-css
};

/**
 * Default options for terser (JavaScript minifier).
 */
const JS_MINIFY_OPTIONS: MinifyOptions = {
  compress: {
    dead_code: true,
    drop_console: false,
    drop_debugger: true,
    ecma: 2020,
    keep_classnames: true,
    keep_fnames: true,
  },
  mangle: {
    keep_classnames: true,
    keep_fnames: true,
  },
  format: { comments: false },
};

// --- Main Minification Function ---

/**
 * Applies HTML, CSS, and JS minification conditionally based on BundleOptions.
 * Uses type assertion for clean-css result and @ts-ignore for its constructor
 * due to persistent type definition issues.
 * Creates and returns a *new* ParsedHTML object containing the potentially minified content.
 *
 * @param {ParsedHTML} parsed - Input ParsedHTML object.
 * @param {BundleOptions} [options={}] - Options controlling minification.
 * @param {Logger} [logger] - Optional logger instance.
 * @returns {Promise<ParsedHTML>} A Promise resolving to a new ParsedHTML object.
 */
export async function minifyAssets(
  parsed: ParsedHTML,
  options: BundleOptions = {},
  logger?: Logger
): Promise<ParsedHTML> {
  const { htmlContent, assets } = parsed;

  // Use optional chaining and nullish coalescing for safer access
  const currentHtmlContent = htmlContent ?? '';
  const currentAssets = assets ?? [];

  if (!currentHtmlContent && currentAssets.length === 0) {
    logger?.debug('Minification skipped: No content.');
    return { htmlContent: currentHtmlContent, assets: currentAssets };
  }

  const minifyFlags = {
    minifyHtml: options.minifyHtml !== false,
    minifyCss: options.minifyCss !== false,
    minifyJs: options.minifyJs !== false,
  };

  logger?.debug(`Minification flags: ${JSON.stringify(minifyFlags)}`);

  const minifiedAssets: Asset[] = await Promise.all(
    currentAssets.map(async (asset): Promise<Asset> => {
      // Make a shallow copy to avoid modifying the original asset object
      let processedAsset = { ...asset };

      if (typeof processedAsset.content !== 'string' || processedAsset.content.length === 0) {
        return processedAsset; // Return the copy
      }

      let newContent = processedAsset.content; // Work with the content of the copy
      const assetIdentifier = processedAsset.url || `inline ${processedAsset.type}`;

      try {
        // --- Minify CSS (Synchronous Call with Type Assertion Workaround) ---
        if (minifyFlags.minifyCss && processedAsset.type === 'css') {
          logger?.debug(`Minifying CSS: ${assetIdentifier}`);

          // @ts-ignore - Suppress error TS2769 due to likely faulty @types/clean-css constructor overload definitions for sync mode.
          const cssMinifier = new CleanCSS(CSS_MINIFY_OPTIONS); // <<< @ts-ignore HERE

          // WORKAROUND using Type Assertion
          const result = cssMinifier.minify(processedAsset.content) as CleanCSSSyncResult;

          // Access properties based on the asserted type
          if (result.errors && result.errors.length > 0) {
            logger?.warn(`⚠️ CleanCSS failed for ${assetIdentifier}: ${result.errors.join(', ')}`);
          } else {
            if (result.warnings && result.warnings.length > 0) {
              logger?.debug(
                `CleanCSS warnings for ${assetIdentifier}: ${result.warnings.join(', ')}`
              );
            }
            if (result.styles) {
              newContent = result.styles; // Update newContent
              logger?.debug(`CSS minified successfully: ${assetIdentifier}`);
            } else {
              logger?.warn(
                `⚠️ CleanCSS produced no styles but reported no errors for ${assetIdentifier}. Keeping original.`
              );
            }
          }
        }

        // --- Minify JS (Asynchronous Call) ---
        if (minifyFlags.minifyJs && processedAsset.type === 'js') {
          logger?.debug(`Minifying JS: ${assetIdentifier}`);
          const result: MinifyOutput = await jsMinify(processedAsset.content, JS_MINIFY_OPTIONS);
          if (result.code) {
            newContent = result.code; // Update newContent
            logger?.debug(`JS minified successfully: ${assetIdentifier}`);
          } else {
            const terserError = (result as any).error;
            if (terserError) {
              logger?.warn(
                `⚠️ Terser failed for ${assetIdentifier}: ${terserError.message || terserError}`
              );
            } else {
              logger?.warn(
                `⚠️ Terser produced no code but reported no errors for ${assetIdentifier}. Keeping original.`
              );
            }
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger?.warn(
          `⚠️ Failed to minify asset ${assetIdentifier} (${processedAsset.type}): ${errorMessage}`
        );
        // Keep original content if error occurs (newContent remains unchanged)
      }

      // Update the content property of the copied asset
      processedAsset.content = newContent;
      return processedAsset; // Return the modified copy
    })
  );

  // --- Minify the main HTML content itself ---
  let finalHtml = currentHtmlContent; // Start with potentially empty original HTML
  if (minifyFlags.minifyHtml && finalHtml.length > 0) {
    logger?.debug('Minifying HTML content...');
    try {
      finalHtml = await htmlMinify(finalHtml, {
        ...HTML_MINIFY_OPTIONS,
        minifyCSS: minifyFlags.minifyCss,
        minifyJS: minifyFlags.minifyJs,
      });
      logger?.debug('HTML minified successfully.');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger?.warn(`⚠️ HTML minification failed: ${errorMessage}`);
      // Keep original HTML (finalHtml already holds it)
    }
  } else if (finalHtml.length > 0) {
    logger?.debug('HTML minification skipped (disabled).');
  }

  // --- Return the final result object ---
  return {
    htmlContent: finalHtml,
    assets: minifiedAssets, // The array of processed asset copies
  };
}
