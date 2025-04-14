/**
 * @file src/utils/meta.ts
 * @description Utility class for tracking bundle statistics like size, time,
 * asset counts, page counts, and errors during the build process.
 * Used by both CLI and API to return metadata consistently.
 */

import type { BundleMetadata } from '../types'; // Assuming types are in ../types

/**
 * Tracks build performance (timing, output size) and collects metadata
 * (asset counts, page counts, errors) during the HTML bundling process.
 */
export class BuildTimer {
  private startTime: number;
  private input: string;
  private pagesBundled?: number; // Tracks pages for recursive bundles
  private assetCount: number = 0; // Tracks discovered/processed assets
  private errors: string[] = []; // Collects warnings/errors

  /**
   * Creates and starts a build timer session for a given input.
   *
   * @param {string} input - The source file path or URL being processed.
   */
  constructor(input: string) {
    this.startTime = Date.now();
    this.input = input;
  }

  /**
   * Explicitly sets the number of assets discovered or processed.
   * This might be called after asset extraction/minification.
   *
   * @param {number} count - The total number of assets.
   */
  setAssetCount(count: number): void {
    this.assetCount = count;
  }

  /**
   * Records a warning or error message encountered during the build.
   * These are added to the final metadata.
   *
   * @param {string} message - The warning or error description.
   */
  addError(message: string): void {
    this.errors.push(message);
  }

  /**
   * Sets the number of pages bundled, typically used in multi-page
   * or recursive bundling scenarios.
   *
   * @param {number} count - The number of HTML pages included in the bundle.
   */
  setPageCount(count: number): void {
    this.pagesBundled = count;
  }

  /**
   * Stops the timer, calculates final metrics, and returns the complete
   * BundleMetadata object. Merges any explicitly provided metadata
   * (like assetCount calculated elsewhere) with the timer's tracked data.
   *
   * @param {string} finalHtml - The final generated HTML string, used to calculate output size.
   * @param {Partial<BundleMetadata>} [extra] - Optional object containing metadata fields
   * (like assetCount or pre-calculated errors) that should override the timer's internal values.
   * @returns {BundleMetadata} The finalized metadata object for the build process.
   */
  finish(html: string, extra?: Partial<BundleMetadata>): BundleMetadata {
    const buildTimeMs = Date.now() - this.startTime;
    const outputSize = Buffer.byteLength(html || '', 'utf-8');

    // Combine internal errors with any errors passed in 'extra', avoiding duplicates
    // FIX: Ensure extra.errors is treated as an empty array if undefined/null
    const combinedErrors = Array.from(new Set([...this.errors, ...(extra?.errors ?? [])]));

    const finalMetadata: BundleMetadata = {
      input: this.input,
      outputSize,
      buildTimeMs,
      assetCount: extra?.assetCount ?? this.assetCount,
      pagesBundled: extra?.pagesBundled ?? this.pagesBundled,
      // Assign the combined errors array
      errors: combinedErrors,
    };

    // Clean up optional fields if they weren't set/provided or are empty
    if (finalMetadata.pagesBundled === undefined) {
      delete finalMetadata.pagesBundled;
    }
    // Delete errors only if the *combined* array is empty
    if (finalMetadata.errors?.length === 0) {
      delete finalMetadata.errors;
    }

    return finalMetadata;
  }
}
