/**
 * @file tests/unit/core/minifier.test.ts
 * @description Unit tests for the Minifier module (minifyAssets function).
 */

// --- Imports ---
// Import types from the libraries being mocked
import type { Options as HtmlMinifyOptions } from 'html-minifier-terser';
import type { OptionsOutput as CleanCSSOptions, Output as CleanCSSOutput } from 'clean-css'; // Use OptionsOutput for constructor options type
import type { MinifyOptions, MinifyOutput } from 'terser';
// Import local types
import type { ParsedHTML, BundleOptions, Asset } from '../../../src/types';
import { Logger } from '../../../src/utils/logger';
import { LogLevel } from '../../../src/types';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// =================== MOCK SETUP ===================

// --- Define TOP-LEVEL mock functions WITH EXPLICIT TYPES ---
const mockHtmlMinifierMinifyFn =
  jest.fn<(text: string, options?: HtmlMinifyOptions) => Promise<string>>();
const mockCleanCSSInstanceMinifyFn =
  jest.fn<
    (
      source: string | Record<string, string> | Array<string | Record<string, string>>
    ) => CleanCSSOutput
  >();
const mockCleanCSSConstructorFn = jest
  .fn<() => { minify: typeof mockCleanCSSInstanceMinifyFn }>() // Type the constructor mock
  .mockImplementation(() => ({
    // Provide implementation immediately
    minify: mockCleanCSSInstanceMinifyFn,
  }));
const mockTerserMinifyFn =
  jest.fn<
    (
      code: string | Record<string, string> | string[],
      options?: MinifyOptions
    ) => Promise<MinifyOutput>
  >();

// --- Mock the dependencies using standard jest.mock and factories ---
jest.mock('html-minifier-terser', () => ({
  __esModule: true,
  minify: mockHtmlMinifierMinifyFn,
}));
jest.mock('clean-css', () => ({
  __esModule: true,
  // Mock the default export which is the class constructor
  default: mockCleanCSSConstructorFn,
}));
jest.mock('terser', () => ({
  __esModule: true,
  minify: mockTerserMinifyFn,
}));
// ====================================================

// Import the module under test *after* mocks are set up
import { minifyAssets } from '../../../src/core/minifier';

// Helper function (keep as is)
const simpleMockCssMinify = (css: string): string => {
  return css
    .replace(/\/\*.*?\*\//g, '')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .replace(/;}/g, '}')
    .trim();
};

describe('🧼 Minifier', () => {
  let mockLogger: Logger;
  let mockLoggerWarnFn: jest.SpiedFunction<typeof Logger.prototype.warn>;
  let mockLoggerDebugFn: jest.SpiedFunction<typeof Logger.prototype.debug>;

  const sampleHtmlContent =
    '<html> <head> <title> Test </title> </head> <body> Test Content </body> </html>';
  const minifiedHtmlContent =
    '<html><head><title>Test</title></head><body>Test Content</body></html>';
  const sampleCssContent = ' body { color: blue; /* comment */ } ';
  const minifiedCssContent = 'body{color:blue}';
  const sampleJsContent =
    ' function hello ( name ) { console.log("hello", name ); alert ( 1 ) ; } ';
  const minifiedJsContent = 'function hello(o){console.log("hello",o),alert(1)}';

  const sampleParsedInput: ParsedHTML = {
    htmlContent: sampleHtmlContent,
    assets: [
      { type: 'css', url: 'style.css', content: sampleCssContent },
      { type: 'js', url: 'script.js', content: sampleJsContent },
      { type: 'image', url: 'logo.png', content: 'data:image/png;base64,abc' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks(); // Clear mocks between tests

    // Set up logger spies
    mockLogger = new Logger(LogLevel.WARN);
    mockLoggerWarnFn = jest.spyOn(mockLogger, 'warn');
    mockLoggerDebugFn = jest.spyOn(mockLogger, 'debug');

    // --- Configure Mock Implementations using the *typed* mocks ---
    // These should now type-check correctly
    mockHtmlMinifierMinifyFn.mockImplementation(async (_html, _options) => minifiedHtmlContent);

    mockCleanCSSInstanceMinifyFn.mockImplementation((css): CleanCSSOutput => {
      if (typeof css !== 'string') css = '// Mocked non-string CSS input'; // Handle non-string input for mock
      const minifiedStyles = simpleMockCssMinify(css);
      const stats = {
        originalSize: css.length,
        minifiedSize: minifiedStyles.length,
        efficiency: css.length > 0 ? (css.length - minifiedStyles.length) / css.length : 0,
        timeSpent: 1,
      };
      return { styles: minifiedStyles, errors: [], warnings: [], stats: stats };
    });

    mockTerserMinifyFn.mockImplementation(async (_js, _options) => {
      return Promise.resolve({ code: minifiedJsContent, error: undefined });
    });
  });

  // --- Tests (Assertions use the explicitly typed mock functions) ---
  describe('Basic functionality', () => {
    it('✅ leaves content unchanged when minification is disabled', async () => {
      const options: BundleOptions = { minifyHtml: false, minifyCss: false, minifyJs: false };
      const result = await minifyAssets(sampleParsedInput, options, mockLogger);

      expect(mockHtmlMinifierMinifyFn).not.toHaveBeenCalled();
      expect(mockCleanCSSConstructorFn).not.toHaveBeenCalled(); // Check constructor
      expect(mockCleanCSSInstanceMinifyFn).not.toHaveBeenCalled(); // Check instance method
      expect(mockTerserMinifyFn).not.toHaveBeenCalled();

      expect(result.htmlContent).toBe(sampleHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
    });

    it('🔧 minifies HTML, CSS, and JS with all options enabled (default)', async () => {
      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockCleanCSSConstructorFn).toHaveBeenCalledTimes(1); // Constructor should be called once
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);

      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
    });
  });

  describe('Error handling', () => {
    it('💥 handles broken HTML minification gracefully', async () => {
      const htmlError = new Error('HTML parse error!');
      // Use mockImplementationOnce to override for this test
      mockHtmlMinifierMinifyFn.mockImplementationOnce(async () => {
        throw htmlError;
      });

      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

      expect(result.htmlContent).toBe(sampleHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
      expect(mockLoggerWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(`HTML minification failed: ${htmlError.message}`)
      );
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
    });

    it('💥 handles CSS minifier failure (returning errors array)', async () => {
      const cssErrorMsg = 'Invalid CSS syntax';
      // Use mockReturnValueOnce for the instance method
      mockCleanCSSInstanceMinifyFn.mockReturnValueOnce({
        errors: [cssErrorMsg],
        warnings: [],
        styles: '',
        stats: {
          originalSize: sampleCssContent.length,
          minifiedSize: 0,
          efficiency: 0,
          timeSpent: 0,
        },
      });

      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent);
      expect(mockLoggerWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(`CleanCSS failed for style.css: ${cssErrorMsg}`)
      );
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
    });

    it('💥 handles CSS minifier failure (throwing exception)', async () => {
      const cssError = new Error('CleanCSS crashed!');
      mockCleanCSSInstanceMinifyFn.mockImplementationOnce(() => {
        throw cssError;
      });

      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent);
      expect(mockLoggerWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to minify asset style.css (css): ${cssError.message}`)
      );
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
    });

    it('💥 handles JS minifier failure (returning error object)', async () => {
      const jsError = new Error('Terser parse error!');
      // Use mockImplementationOnce for the async function
      mockTerserMinifyFn.mockImplementationOnce(async () => ({ code: undefined, error: jsError }));

      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
      expect(mockLoggerWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(`Terser failed for script.js: ${jsError.message}`)
      );
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
    });

    it('💥 handles JS minifier failure (throwing exception)', async () => {
      const jsError = new Error('Terser crashed!');
      // Use mockImplementationOnce to reject the promise
      mockTerserMinifyFn.mockImplementationOnce(async () => {
        throw jsError;
      });

      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
      expect(mockLoggerWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(`Failed to minify asset script.js (js): ${jsError.message}`)
      );
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
    });

    it('🧼 skips minification for assets without content or empty content', async () => {
      const inputWithMissingContent: ParsedHTML = {
        htmlContent: sampleHtmlContent,
        assets: [
          { type: 'css', url: 'style.css', content: sampleCssContent },
          { type: 'js', url: 'missing.js' },
          { type: 'css', url: 'empty.css', content: '' },
          { type: 'js', url: 'script2.js', content: sampleJsContent },
        ],
      };
      const result = await minifyAssets(inputWithMissingContent, {}, mockLogger);

      expect(result.assets.find(a => a.url === 'style.css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.url === 'missing.js')?.content).toBeUndefined();
      expect(result.assets.find(a => a.url === 'empty.css')?.content).toBe('');
      expect(result.assets.find(a => a.url === 'script2.js')?.content).toBe(minifiedJsContent);
      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1); // Only for style.css
      expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1); // Only for script2.js
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Selective minification', () => {
    // These tests should remain the same, checking which mocks are called
    it('🎛 only minifies CSS + HTML, leaves JS unchanged', async () => {
      const options: BundleOptions = { minifyHtml: true, minifyCss: true, minifyJs: false };
      const result = await minifyAssets(sampleParsedInput, options, mockLogger);
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).not.toHaveBeenCalled();
      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
    });
    it('🎛 only minifies JS + CSS, leaves HTML unchanged', async () => {
      const options: BundleOptions = { minifyHtml: false, minifyCss: true, minifyJs: true };
      const result = await minifyAssets(sampleParsedInput, options, mockLogger);
      expect(mockHtmlMinifierMinifyFn).not.toHaveBeenCalled();
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
      expect(result.htmlContent).toBe(sampleHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
    });
    it('🎛 only minifies HTML, leaves CSS/JS unchanged', async () => {
      const options: BundleOptions = { minifyHtml: true, minifyCss: false, minifyJs: false };
      const result = await minifyAssets(sampleParsedInput, options, mockLogger);
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockCleanCSSInstanceMinifyFn).not.toHaveBeenCalled();
      expect(mockTerserMinifyFn).not.toHaveBeenCalled();
      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
    });
  });

  describe('Content types', () => {
    it('📦 only processes css/js types, skips image/font/other', async () => {
      const inputWithVariousTypes: ParsedHTML = {
        htmlContent: sampleHtmlContent,
        assets: [
          { type: 'css', url: 'style.css', content: sampleCssContent },
          { type: 'js', url: 'script.js', content: sampleJsContent },
          { type: 'image', url: 'logo.png', content: 'data:image/png;base64,abc' },
          { type: 'font', url: 'font.woff2', content: 'data:font/woff2;base64,def' },
          { type: 'other', url: 'data.json', content: '{"a":1}' },
        ],
      };
      const result = await minifyAssets(inputWithVariousTypes, {}, mockLogger);
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
      expect(result.assets.find(a => a.type === 'image')?.content).toBe(
        'data:image/png;base64,abc'
      );
      expect(result.assets.find(a => a.type === 'font')?.content).toBe(
        'data:font/woff2;base64,def'
      );
      expect(result.assets.find(a => a.type === 'other')?.content).toBe('{"a":1}');
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
      expect(result.htmlContent).toBe(minifiedHtmlContent);
    });
  });

  describe('Edge Cases', () => {
    it('💨 handles empty input object gracefully', async () => {
      const emptyInput: ParsedHTML = { htmlContent: '', assets: [] };
      const result = await minifyAssets(emptyInput, {}, mockLogger);

      expect(result.htmlContent).toBe('');
      expect(result.assets).toEqual([]);
      expect(mockHtmlMinifierMinifyFn).not.toHaveBeenCalled();
      expect(mockCleanCSSConstructorFn).not.toHaveBeenCalled(); // Check constructor
      expect(mockTerserMinifyFn).not.toHaveBeenCalled();
      // Check debug log for skipping due to no content
      expect(mockLoggerDebugFn).toHaveBeenCalledWith('Minification skipped: No content.');
    });

    it('💨 handles input with assets but empty HTML content string', async () => {
      const input: ParsedHTML = {
        htmlContent: '',
        assets: [{ type: 'css', url: 'style.css', content: sampleCssContent }],
      };
      const result = await minifyAssets(input, {}, mockLogger);

      expect(result.htmlContent).toBe('');
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(mockHtmlMinifierMinifyFn).not.toHaveBeenCalled();
      expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockTerserMinifyFn).not.toHaveBeenCalled();
    });

    it('💨 handles input with HTML but empty assets array', async () => {
      const input: ParsedHTML = { htmlContent: sampleHtmlContent, assets: [] };
      const result = await minifyAssets(input, {}, mockLogger);

      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets).toEqual([]);
      expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
      expect(mockCleanCSSInstanceMinifyFn).not.toHaveBeenCalled();
      expect(mockTerserMinifyFn).not.toHaveBeenCalled();
    });

    it('⚠️ handles CleanCSS returning no styles without errors', async () => {
      // Use mockReturnValueOnce for the instance method mock
      mockCleanCSSInstanceMinifyFn.mockReturnValueOnce({
        errors: [],
        warnings: [],
        styles: '',
        stats: {
          originalSize: sampleCssContent.length,
          minifiedSize: 0,
          efficiency: 0,
          timeSpent: 0,
        },
      });

      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);
      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
      expect(mockLoggerWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(
          'CleanCSS produced no styles but reported no errors for style.css. Keeping original.'
        )
      );
    });

    it('⚠️ handles Terser returning no code without errors', async () => {
      // Use mockImplementationOnce for the async function
      mockTerserMinifyFn.mockImplementationOnce(async () => ({
        code: undefined,
        error: undefined,
      }));

      const result = await minifyAssets(sampleParsedInput, {}, mockLogger);
      expect(result.htmlContent).toBe(minifiedHtmlContent);
      expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
      expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
      expect(mockLoggerWarnFn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Terser produced no code but reported no errors for script.js. Keeping original.'
        )
      );
    });
  });
});
