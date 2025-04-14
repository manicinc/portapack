/**
 * @file types.ts
 *
 * @description
 * Centralized types used across the PortaPack CLI, API, core modules, and bundling pipeline.
 *
 * This file defines:
 * - Asset structure
 * - HTML parsing result
 * - Bundling options and metadata
 * - Page structures for recursive bundling
 * - CLI execution output format
 */

/**
 * Represents a single discovered, downloaded, or embedded asset.
 * This includes JS, CSS, images, fonts, etc.
 */
export interface Asset {
  type: 'css' | 'js' | 'image' | 'font' | 'video' | 'audio' | 'other'; // Add video and audio

  /** The resolved or original URL of the asset */
  url: string;

  /** Inlined or fetched content */
  content?: string; // Content is optional as it might not be embedded

  /** Font-specific metadata for font-face usage */
  fontMeta?: {
    familyName: string;
    weight?: number;
    style?: 'normal' | 'italic' | 'oblique';
    format?: string;
  };
}

/**
 * Represents raw HTML and any linked/discovered assets.
 * Result of the parsing stage.
 */
export interface ParsedHTML {
  htmlContent: string;
  assets: Asset[]; // List of assets found in the HTML
}

/**
 * Represents a single page crawled during recursive bundling.
 * Used as input for the multi-page bundler.
 */
export interface PageEntry {
  /** Full resolved URL of the crawled page */
  url: string;

  /** Raw HTML content of the crawled page */
  html: string;
}

/**
 * Configuration options provided by the user via CLI or API call.
 * Controls various aspects of the bundling process.
 */
export interface BundleOptions {
  /** Embed all discovered assets as data URIs (default: true) */
  embedAssets?: boolean;

  /** Enable HTML minification using html-minifier-terser (default: true) */
  minifyHtml?: boolean;

  /** Enable CSS minification using clean-css (default: true) */
  minifyCss?: boolean;

  /** Enable JavaScript minification using terser (default: true) */
  minifyJs?: boolean;

  /** Base URL for resolving relative links, especially for remote fetches or complex local structures */
  baseUrl?: string;

  /** Enable verbose logging during CLI execution */
  verbose?: boolean;

  /** Skip writing output file to disk (CLI dry-run mode) */
  dryRun?: boolean;

  /** Enable recursive crawling. If a number, specifies max depth. If true, uses default depth. */
  recursive?: number | boolean;

  /** Optional output file path override (CLI uses this) */
  output?: string;

  /** Log level for the internal logger */
  logLevel?: LogLevel;
}

// --- LogLevel Enum ---
// Defines available log levels as a numeric enum for comparisons.
export enum LogLevel {
  NONE = 0, // No logging (equivalent to 'silent')
  ERROR = 1, // Only errors
  WARN = 2, // Errors and warnings
  INFO = 3, // Errors, warnings, and info (Default)
  DEBUG = 4, // All messages (Verbose)
}

// --- String Literal Type for LogLevel Names (Optional, useful for CLI parsing) ---
export type LogLevelName = 'debug' | 'info' | 'warn' | 'error' | 'silent' | 'none';

/**
 * Summary statistics and metadata returned after the packing/bundling process completes.
 */
export interface BundleMetadata {
  /** Source HTML file path or URL */
  input: string;

  /** Total number of unique assets discovered (CSS, JS, images, fonts etc.) */
  assetCount: number; // Kept as required - should always be calculated or defaulted (e.g., to 0)

  /** Final output HTML size in bytes */
  outputSize: number;

  /** Elapsed build time in milliseconds */
  buildTimeMs: number;

  /** If recursive bundling was performed, the number of pages successfully crawled and included */
  pagesBundled?: number; // Optional, only relevant for recursive mode

  /** Any non-critical errors or warnings encountered during bundling (e.g., asset fetch failure) */
  errors?: string[]; // Optional array of error/warning messages
}

/**
 * Standard result object returned from the main public API functions.
 */
export interface BuildResult {
  /** The final generated HTML string */
  html: string;
  /** Metadata summarizing the build process */
  metadata: BundleMetadata;
}

/** CLI-specific options extending BundleOptions. */
export interface CLIOptions extends BundleOptions {
  /** Input file or URL (positional). */
  input?: string;
  /** Max depth for recursive crawling (numeric alias for recursive). */
  maxDepth?: number; // Used by commander, then merged into 'recursive'
  minify?: boolean; // Minify assets (defaults to true)
}

/**
 * Result object specifically for the CLI runner, capturing output streams and exit code.
 */
export interface CLIResult {
  /** Captured content written to stdout */
  stdout?: string;

  /** Captured content written to stderr */
  stderr?: string;

  /** Final exit code intended for the process (0 for success, non-zero for errors) */
  exitCode: number;
}
