/**
 * @file tests/unit/core/minifier.test.ts
 * @description Unit tests for the Minifier module (minifyAssets function).
 * Uses jest.unstable_mockModule for mocking dependencies.
 */

// --- Imports ---
import type { Options as HtmlMinifyOptions } from 'html-minifier-terser';
import type { Options as CleanCSSOptions, Output as CleanCSSOutput } from 'clean-css';
import type { MinifyOptions, MinifyOutput } from 'terser';
import type { ParsedHTML, BundleOptions, Asset } from '../../../src/types';
import { Logger } from '../../../src/utils/logger';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// =================== MOCK SETUP ===================

const mockHtmlMinifierMinifyFn = jest.fn<any>();
const mockCleanCSSInstanceMinifyFn = jest.fn<any>();
const mockCleanCSSConstructorFn = jest.fn<any>();
const mockTerserMinifyFn = jest.fn<any>();

// Mock the dependencies BEFORE importing the module under test
jest.unstable_mockModule('html-minifier-terser', () => ({
  minify: mockHtmlMinifierMinifyFn,
}));
jest.unstable_mockModule('clean-css', () => ({
  // Mock the default export which is the class constructor
  default: mockCleanCSSConstructorFn,
}));
jest.unstable_mockModule('terser', () => ({
  minify: mockTerserMinifyFn,
}));

// ====================================================

// Import the module under test *after* mocks are set up
const { minifyAssets } = await import('../../../src/core/minifier');
const { LogLevel: LogLevelEnum } = await import('../../../src/types');

// Helper for basic CSS mock logic (can be simple for tests)
const simpleMockCssMinify = (css: string): string => {
    return css
      .replace(/\/\*.*?\*\//g, '') // Remove comments
      .replace(/\s*([{}:;,])\s*/g, '$1') // Remove space around syntax chars
      .replace(/\s+/g, ' ') // Collapse remaining whitespace
      .replace(/;}/g, '}') // Remove trailing semicolons inside blocks
      .trim();
}

describe('🧼 Minifier', () => {
    let mockLogger: Logger;
    let mockLoggerWarnFn: jest.SpiedFunction<typeof Logger.prototype.warn>;
    let mockLoggerDebugFn: jest.SpiedFunction<typeof Logger.prototype.debug>;

    const sampleHtmlContent = '<html> <head> <title> Test </title> </head> <body> Test Content </body> </html>';
    // This is the EXPECTED output after full minification by the real library
    const minifiedHtmlContent = '<html><head><title>Test</title></head><body>Test Content</body></html>';
    const sampleCssContent = ' body { color: blue; /* comment */ } ';
    // Expected CSS output from our simple mock helper
    const minifiedCssContent = 'body{color:blue}';
    const sampleJsContent = ' function hello ( name ) { console.log("hello", name ); alert ( 1 ) ; } ';
    // Expected JS output (can be a fixed string for the mock)
    const minifiedJsContent = 'function hello(o){console.log("hello",o),alert(1)}';

    const sampleParsedInput: ParsedHTML = {
        htmlContent: sampleHtmlContent,
        assets: [
            { type: 'css', url: 'style.css', content: sampleCssContent },
            { type: 'js', url: 'script.js', content: sampleJsContent },
            { type: 'image', url: 'logo.png', content: 'data:image/png;base64,abc' },
        ]
    };

    beforeEach(() => {
        jest.clearAllMocks(); // Clear mocks between tests

        // Set up logger spies
        mockLogger = new Logger(LogLevelEnum.DEBUG); // Use DEBUG to see verbose logs if needed
        mockLoggerWarnFn = jest.spyOn(mockLogger, 'warn');
        mockLoggerDebugFn = jest.spyOn(mockLogger, 'debug');

        // --- Configure Mock Implementations ---

        // FIX: HTML Mock: Directly return the expected fully minified string.
        // The mock should simulate the *result* of html-minifier-terser with collapseWhitespace: true.
        mockHtmlMinifierMinifyFn.mockImplementation(async (_html: string, _options?: HtmlMinifyOptions) => {
            // Assume if this mock is called, the desired output is the fully minified version
            return minifiedHtmlContent;
        });

        // Mock the CleanCSS constructor to return an object with a 'minify' method
        mockCleanCSSConstructorFn.mockImplementation(() => ({
            minify: mockCleanCSSInstanceMinifyFn
        }));

        // Default mock for successful CleanCSS run (synchronous behavior)
        // Uses the simple helper defined above
        mockCleanCSSInstanceMinifyFn.mockImplementation((css: string): CleanCSSOutput => {
            const minifiedStyles = simpleMockCssMinify(css);
            const stats = { // Provide mock stats structure
                originalSize: css.length,
                minifiedSize: minifiedStyles.length,
                efficiency: css.length > 0 ? (css.length - minifiedStyles.length) / css.length : 0,
                timeSpent: 1, // Mock time
            };
            // Return the structure expected by the code (CleanCSSSyncResult shape)
            return { styles: minifiedStyles, errors: [], warnings: [], stats: stats };
        });

        // Default mock for successful Terser run (asynchronous)
        mockTerserMinifyFn.mockImplementation(async (_js: string, _options?: MinifyOptions): Promise<MinifyOutput> => {
            // Return the expected minified JS content for the test case
            return Promise.resolve({ code: minifiedJsContent, error: undefined });
        });
    });

    describe('Basic functionality', () => {
        it('✅ leaves content unchanged when minification is disabled', async () => {
            const options: BundleOptions = { minifyHtml: false, minifyCss: false, minifyJs: false };
            const result = await minifyAssets(sampleParsedInput, options, mockLogger);

            expect(mockHtmlMinifierMinifyFn).not.toHaveBeenCalled();
            expect(mockCleanCSSConstructorFn).not.toHaveBeenCalled(); // Check constructor wasn't called
            expect(mockTerserMinifyFn).not.toHaveBeenCalled();

            expect(result.htmlContent).toBe(sampleHtmlContent); // Should be original
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent); // Should be original
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent); // Should be original
            expect(result.assets.find(a => a.type === 'image')?.content).toBe('data:image/png;base64,abc'); // Should be untouched
        });

        // Check against the corrected expectations
        it('🔧 minifies HTML, CSS, and JS with all options enabled (default)', async () => {
            const result = await minifyAssets(sampleParsedInput, {}, mockLogger); // Default options enable all minification

            expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
            // Check the *instance* minify was called, implies constructor was called too
            expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);

            // Check against the defined minified constants
            expect(result.htmlContent).toBe(minifiedHtmlContent);
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
            expect(result.assets.find(a => a.type === 'image')?.content).toBe('data:image/png;base64,abc'); // Should still be untouched
        });
    });

    describe('Error handling', () => {
        it('💥 handles broken HTML minification gracefully', async () => {
            const htmlError = new Error('HTML parse error!');
            // Make the HTML mock reject
            mockHtmlMinifierMinifyFn.mockRejectedValueOnce(htmlError);

            const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

            // Original HTML should be kept
            expect(result.htmlContent).toBe(sampleHtmlContent);
            // Other assets should still be minified if successful
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
            // Logger should have been warned
            expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining(`HTML minification failed: ${htmlError.message}`));
            // Ensure other minifiers were still called
            expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
        });

        it('💥 handles CSS minifier failure (returning errors array)', async () => {
            const cssErrorMsg = 'Invalid CSS syntax';
            // Make the CSS mock return an error structure
            mockCleanCSSInstanceMinifyFn.mockReturnValueOnce({
                errors: [cssErrorMsg], warnings: [], styles: undefined, // No styles on error
                stats: { originalSize: sampleCssContent.length, minifiedSize: 0, efficiency: 0, timeSpent: 0 }
            });

            const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

            // HTML and JS should still be minified
            expect(result.htmlContent).toBe(minifiedHtmlContent);
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
            // Original CSS should be kept
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent);
            // Logger should have been warned
            expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining(`CleanCSS failed for style.css: ${cssErrorMsg}`));
            // Ensure other minifiers were still called
            expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
        });

        it('💥 handles CSS minifier failure (throwing exception)', async () => {
            const cssError = new Error('CleanCSS crashed!');
            // Make the CSS mock throw
            mockCleanCSSInstanceMinifyFn.mockImplementationOnce(() => { throw cssError; });

            const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

            // HTML and JS should still be minified
            expect(result.htmlContent).toBe(minifiedHtmlContent);
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
            // Original CSS should be kept
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent);
            // Logger should have been warned about the catch block
            expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining(`Failed to minify asset style.css (css): ${cssError.message}`));
             // Ensure other minifiers were still called
             expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
             expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);
        });

        it('💥 handles JS minifier failure (returning error object)', async () => {
            const jsError = new Error('Terser parse error!');
             // Make the JS mock return an error structure (as per Terser docs)
            mockTerserMinifyFn.mockResolvedValueOnce({ code: undefined, error: jsError });

            const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

            // HTML and CSS should still be minified
            expect(result.htmlContent).toBe(minifiedHtmlContent);
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
             // Original JS should be kept
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
            // Logger should have been warned
            // Note: Your code checks for `result.code` first, then `(result as any).error`
            expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining(`Terser failed for script.js: ${jsError.message}`));
             // Ensure other minifiers were still called
             expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
             expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
        });

         it('💥 handles JS minifier failure (throwing exception)', async () => {
             const jsError = new Error('Terser crashed!');
             // Make the JS mock reject
             mockTerserMinifyFn.mockRejectedValueOnce(jsError);

             const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

             // HTML and CSS should still be minified
             expect(result.htmlContent).toBe(minifiedHtmlContent);
             expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
              // Original JS should be kept
             expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent);
             // Logger should have been warned from the catch block
             expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining(`Failed to minify asset script.js (js): ${jsError.message}`));
             // Ensure other minifiers were still called
             expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
             expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
         });

        it('🧼 skips minification for assets without content or empty content', async () => {
            const inputWithMissingContent: ParsedHTML = {
                htmlContent: sampleHtmlContent,
                assets: [
                    { type: 'css', url: 'style.css', content: sampleCssContent }, // Has content
                    { type: 'js', url: 'missing.js' /* no content property */ },
                    { type: 'css', url: 'empty.css', content: '' }, // Empty string content
                    { type: 'js', url: 'script2.js', content: sampleJsContent } // Has content
                ]
            };
            const result = await minifyAssets(inputWithMissingContent, {}, mockLogger);

            // Check assets individually
            expect(result.assets.find(a => a.url === 'style.css')?.content).toBe(minifiedCssContent); // Minified
            expect(result.assets.find(a => a.url === 'missing.js')?.content).toBeUndefined(); // Still undefined
            expect(result.assets.find(a => a.url === 'empty.css')?.content).toBe(''); // Still empty
            expect(result.assets.find(a => a.url === 'script2.js')?.content).toBe(minifiedJsContent); // Minified

            // HTML should still be minified
            expect(result.htmlContent).toBe(minifiedHtmlContent);

            // Check how many times minifiers were actually called
            expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1); // Only for style.css
            expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1); // Only for script2.js
            expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1); // For the HTML
        });
    });

    describe('Selective minification', () => {
        it('🎛 only minifies CSS + HTML, leaves JS unchanged', async () => {
            const options: BundleOptions = { minifyHtml: true, minifyCss: true, minifyJs: false };
            const result = await minifyAssets(sampleParsedInput, options, mockLogger);

            expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockTerserMinifyFn).not.toHaveBeenCalled(); // JS shouldn't be called

            expect(result.htmlContent).toBe(minifiedHtmlContent); // Minified
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent); // Minified
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent); // Original
        });

        it('🎛 only minifies JS + CSS, leaves HTML unchanged', async () => {
            const options: BundleOptions = { minifyHtml: false, minifyCss: true, minifyJs: true };
            const result = await minifyAssets(sampleParsedInput, options, mockLogger);

            expect(mockHtmlMinifierMinifyFn).not.toHaveBeenCalled(); // HTML shouldn't be called
            expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1);

            expect(result.htmlContent).toBe(sampleHtmlContent); // Original
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent); // Minified
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent); // Minified
        });

         it('🎛 only minifies HTML, leaves CSS/JS unchanged', async () => {
             const options: BundleOptions = { minifyHtml: true, minifyCss: false, minifyJs: false };
             const result = await minifyAssets(sampleParsedInput, options, mockLogger);

             expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
             expect(mockCleanCSSInstanceMinifyFn).not.toHaveBeenCalled();
             expect(mockTerserMinifyFn).not.toHaveBeenCalled();

             expect(result.htmlContent).toBe(minifiedHtmlContent); // Minified
             expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent); // Original
             expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent); // Original
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
                    { type: 'other', url: 'data.json', content: '{"a":1}' }
                ]
            };
            const result = await minifyAssets(inputWithVariousTypes, {}, mockLogger); // Default options

            expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1); // Called only for CSS
            expect(mockTerserMinifyFn).toHaveBeenCalledTimes(1); // Called only for JS

            // Check that non-CSS/JS assets are untouched
            expect(result.assets.find(a => a.type === 'image')?.content).toBe('data:image/png;base64,abc');
            expect(result.assets.find(a => a.type === 'font')?.content).toBe('data:font/woff2;base64,def');
            expect(result.assets.find(a => a.type === 'other')?.content).toBe('{"a":1}');

            // Check CSS/JS were minified
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent);
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent);
            // Check HTML was minified
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
            expect(mockCleanCSSConstructorFn).not.toHaveBeenCalled();
            expect(mockTerserMinifyFn).not.toHaveBeenCalled();
            expect(mockLoggerDebugFn).toHaveBeenCalledWith('Minification skipped: No content.');
        });

        it('💨 handles input with assets but empty HTML content string', async () => {
            const input: ParsedHTML = {
                htmlContent: '',
                assets: [ { type: 'css', url: 'style.css', content: sampleCssContent } ]
            };
            const result = await minifyAssets(input, {}, mockLogger);

            expect(result.htmlContent).toBe(''); // Should remain empty
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent); // CSS should be minified
            expect(mockHtmlMinifierMinifyFn).not.toHaveBeenCalled(); // No HTML to minify
            expect(mockCleanCSSInstanceMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockTerserMinifyFn).not.toHaveBeenCalled();
        });

        it('💨 handles input with HTML but empty assets array', async () => {
            const input: ParsedHTML = { htmlContent: sampleHtmlContent, assets: [] };
            const result = await minifyAssets(input, {}, mockLogger);

            expect(result.htmlContent).toBe(minifiedHtmlContent); // HTML should be minified
            expect(result.assets).toEqual([]); // Assets should remain empty
            expect(mockHtmlMinifierMinifyFn).toHaveBeenCalledTimes(1);
            expect(mockCleanCSSInstanceMinifyFn).not.toHaveBeenCalled(); // No CSS assets
            expect(mockTerserMinifyFn).not.toHaveBeenCalled(); // No JS assets
        });

        // Test case for the CleanCSS warning path (no error, no styles)
        it('⚠️ handles CleanCSS returning no styles without errors', async () => {
            mockCleanCSSInstanceMinifyFn.mockReturnValueOnce({
                errors: [], warnings: [], styles: undefined, // Simulate no styles returned
                stats: { originalSize: sampleCssContent.length, minifiedSize: 0, efficiency: 0, timeSpent: 0 }
            });

            const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

            expect(result.htmlContent).toBe(minifiedHtmlContent); // HTML minified
            expect(result.assets.find(a => a.type === 'css')?.content).toBe(sampleCssContent); // Original CSS kept
            expect(result.assets.find(a => a.type === 'js')?.content).toBe(minifiedJsContent); // JS minified
            expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining('CleanCSS produced no styles but reported no errors for style.css. Keeping original.'));
        });

         // Test case for the Terser warning path (no error, no code)
         it('⚠️ handles Terser returning no code without errors', async () => {
             mockTerserMinifyFn.mockResolvedValueOnce({ code: undefined, error: undefined }); // Simulate no code returned

             const result = await minifyAssets(sampleParsedInput, {}, mockLogger);

             expect(result.htmlContent).toBe(minifiedHtmlContent); // HTML minified
             expect(result.assets.find(a => a.type === 'css')?.content).toBe(minifiedCssContent); // CSS minified
             expect(result.assets.find(a => a.type === 'js')?.content).toBe(sampleJsContent); // Original JS kept
             expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining('Terser produced no code but reported no errors for script.js. Keeping original.'));
         });
    });
});