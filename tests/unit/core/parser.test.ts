/**
 * @file parser.test.ts
 * @description Unit tests for parseHTML. Uses jest.unstable_mockModule for mocking fs.readFile.
 */
import type { ParsedHTML, Asset } from '../../../src/types.js';
// FIX: Remove SpiedFunction from import, use jest.SpiedFunction instead
import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { Logger } from '../../../src/utils/logger.js';
import { LogLevel } from '../../../src/types.js';
import type { readFile as ReadFileOriginal } from 'fs/promises';

// --- Define Type Alias for Mock ---
type ReadFileFn = (
    path: Parameters<typeof ReadFileOriginal>[0],
    options?: Parameters<typeof ReadFileOriginal>[1]
) => Promise<string | Buffer>;


// --- Mock Setup ---
// FIX: Apply the explicit type alias to jest.fn()
const mockReadFileFn = jest.fn<ReadFileFn>();

// Mock the 'fs/promises' module *before* importing the module under test
jest.unstable_mockModule('fs/promises', () => ({
    readFile: mockReadFileFn,
}));

// --- Import Module Under Test ---
// Import ONCE, AFTER mocks are configured
const { parseHTML } = await import('../../../src/core/parser.js');

// --- Test Suite ---
describe('🧠 HTML Parser - parseHTML()', () => {
    let logger: Logger;
    // FIX: Use SpiedFunction<typeof specificLoggerMethod> for correct spy typing
    let loggerDebugSpy: jest.SpiedFunction<typeof logger.debug>;
    let loggerInfoSpy: jest.SpiedFunction<typeof logger.info>;
    let loggerErrorSpy: jest.SpiedFunction<typeof logger.error>;

    // --- FIX: Define Helper Function at Describe Scope ---
    /** Helper function to check assets flexibly without relying on order */
    const expectAssetsToContain = (actualAssets: Asset[], expectedAssets: Partial<Asset>[]) => {
        expect(actualAssets).toHaveLength(expectedAssets.length);
        expectedAssets.forEach(expected => {
            // Checks if an object with *at least* the expected properties/values exists in the array
            expect(actualAssets).toContainEqual(expect.objectContaining(expected));
        });
    };

    const mockHtmlPath = 'mock.html';
    const emptyHtmlPath = 'empty.html';
    const assetsHtmlPath = 'assets.html';
    const brokenHtmlPath = 'broken.html';
    const srcsetHtmlPath = 'srcset.html';
    const styleInlineHtmlPath = 'style-inline.html';
    const specialcharsHtmlPath = 'specialchars.html';
    const dedupeHtmlPath = 'dedupe.html';
    const typesHtmlPath = 'types.html';
    const emptySrcHtmlPath = 'empty-src.html';
    const trickySrcsetHtmlPath = 'tricky-srcset.html';


    beforeEach(() => {
        mockReadFileFn.mockClear();
        // FIX: This mockResolvedValue call should now type-check correctly
        mockReadFileFn.mockResolvedValue(''); // Default mock implementation

        logger = new Logger(LogLevel.WARN);
        // Spies are created after logger instance exists
        loggerDebugSpy = jest.spyOn(logger, 'debug');
        loggerInfoSpy = jest.spyOn(logger, 'info');
        loggerErrorSpy = jest.spyOn(logger, 'error');
    });

    describe('📄 File Reading', () => {
        it('✅ reads the specified file with utf-8 encoding', async () => {
            const htmlContent = '<html>Test</html>';
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(htmlContent);

            await parseHTML(mockHtmlPath, logger);

            expect(mockReadFileFn).toHaveBeenCalledTimes(1);
            expect(mockReadFileFn).toHaveBeenCalledWith(mockHtmlPath, 'utf-8');
            expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Parsing HTML file: ${mockHtmlPath}`));
            expect(loggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully read HTML file'));
        });

        it('✅ handles empty HTML files gracefully', async () => {
             // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce('');
            const result = await parseHTML(emptyHtmlPath, logger);

            expect(mockReadFileFn).toHaveBeenCalledWith(emptyHtmlPath, 'utf-8');
            expect(result.htmlContent).toBe('');
            expect(result.assets).toEqual([]);
            expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('HTML parsing complete. Discovered 0 unique asset links.'));
        });

        it('❌ throws a wrapped error if reading the file fails', async () => {
            const readError = new Error('Permission denied');
             // FIX: This mockRejectedValueOnce call should now type-check correctly
            mockReadFileFn.mockRejectedValueOnce(readError);

            await expect(parseHTML('unreadable.html', logger)).rejects.toThrowError(
                expect.objectContaining({
                    message: 'Could not read input HTML file: unreadable.html',
                    cause: readError
                })
            );
            expect(mockReadFileFn).toHaveBeenCalledWith('unreadable.html', 'utf-8');
            expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to read HTML file "unreadable.html": ${readError.message}`));
        });
    });

    describe('📦 Asset Discovery', () => {
        // Helper function is now defined above

        it('✅ extracts stylesheets, scripts, images, and media sources', async () => {
            const mockAssetsHtml = `...`; // Keep your HTML string
             // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(mockAssetsHtml);
            const result = await parseHTML(assetsHtmlPath, logger);

            const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
            expectAssetsToContain(result.assets, expected); // Use helper
            // ... (other specific assertions)
        });

        it('✅ deduplicates identical asset URLs', async () => {
            const htmlContent = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(htmlContent);
            const result = await parseHTML(dedupeHtmlPath, logger);

            const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
            expectAssetsToContain(result.assets, expected); // Use helper
            // ... (other specific assertions)
        });

        it('✅ categorizes asset types correctly (incl. guessing)', async () => {
            const htmlContent = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(htmlContent);
            const result = await parseHTML(typesHtmlPath, logger);

            const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
            expectAssetsToContain(result.assets, expected); // Use helper
            // ... (other specific assertions)
        });
    });

    describe('🧪 Edge Cases & Robustness', () => {
        it('✅ ignores data URIs', async () => {
            const html = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(html);
            const result = await parseHTML('datauri.html', logger);
            expect(result.assets).toEqual([]);
        });

         it('✅ ignores empty or missing src/href/srcset attributes', async () => {
            const html = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(html);
            const result = await parseHTML(emptySrcHtmlPath, logger);
            expect(result.assets).toEqual([]);
         });

         it('✅ handles tricky srcset values with extra spaces/commas', async () => {
             const html = `...`; // Keep your HTML string
             // FIX: This mockResolvedValueOnce call should now type-check correctly
             mockReadFileFn.mockResolvedValueOnce(html);
             const result = await parseHTML(trickySrcsetHtmlPath, logger);
             const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
             expectAssetsToContain(result.assets, expected); // Use helper
         });


        it('✅ supports malformed or partial tags (best effort by cheerio)', async () => {
            const mockBrokenHtml = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(mockBrokenHtml);
            const result = await parseHTML(brokenHtmlPath, logger);
            const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
            expectAssetsToContain(result.assets, expected); // Use helper
        });

        it('✅ parses img srcset and nested <source> elements correctly', async () => {
            const mockSrcsetHtml = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(mockSrcsetHtml);
            const result = await parseHTML(srcsetHtmlPath, logger);
            const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
            expectAssetsToContain(result.assets, expected); // Use helper
        });

        it('✅ handles inline <style> and <script> tags without extracting them as assets', async () => {
            const mockInlineHtml = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(mockInlineHtml);
            const result = await parseHTML(styleInlineHtmlPath, logger);
            const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
            expectAssetsToContain(result.assets, expected); // Use helper
            // ... (other specific assertions)
        });

        it('✅ handles URLs with spaces, queries, and special chars preserving encoding', async () => {
            const specialUrl = 'image%20with%20spaces.png?query=1&special=%C3%A4%C3%B6%C3%BC';
            const mockSpecialCharsHtml = `...`; // Keep your HTML string
            // FIX: This mockResolvedValueOnce call should now type-check correctly
            mockReadFileFn.mockResolvedValueOnce(mockSpecialCharsHtml);
            const result = await parseHTML(specialcharsHtmlPath, logger);
            const expected: Partial<Asset>[] = [/*...*/]; // Keep your expected assets
            expectAssetsToContain(result.assets, expected); // Use helper
        });
    });
});