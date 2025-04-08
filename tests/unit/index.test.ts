// tests/unit/index.test.ts

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// --- Import necessary types ---
// Import types used in function signatures and test data
import type {
    ParsedHTML,
    Asset,
    BundleOptions,
    PageEntry,
    BuildResult,
    BundleMetadata
} from '../../src/types.js'; // Use .js extension
import { LogLevel } from '../../src/types.js'; // Use .js extension
import { Logger } from '../../src/utils/logger.js'; // Import Logger type if needed for mocks/assertions

// Define expected function signatures for type casting mocks
type ParseHTMLFn = (input: string, logger?: Logger) => Promise<ParsedHTML>;
type ExtractAssetsFn = (parsed: ParsedHTML, embed: boolean, basePath: string, logger?: Logger) => Promise<ParsedHTML>;
type MinifyAssetsFn = (parsed: ParsedHTML, options: BundleOptions, logger?: Logger) => Promise<ParsedHTML>;
type PackHTMLFn = (parsed: ParsedHTML, logger?: Logger) => string; // Sync
// Define assumed return types for core functions based on usage in src/index.ts
type CoreFetchReturn = { html: string, metadata?: Partial<BundleMetadata> };
type CoreFetchFn = (url: string, options?: BundleOptions, logger?: Logger) => Promise<CoreFetchReturn>;
type CoreRecursiveReturn = { html: string, pages: number, metadata?: Partial<BundleMetadata> };
type CoreRecursiveFn = (url: string, placeholderPath: string, depth: number, options?: BundleOptions, logger?: Logger) => Promise<CoreRecursiveReturn>;
type CoreBundleMultiPageFn = (pages: PageEntry[], options?: BundleOptions, logger?: Logger) => string; // Sync


// --- Mock Core Dependencies ---
// Apply explicit types to jest.fn()
const mockParseHTML = jest.fn<ParseHTMLFn>();
const mockExtractAssets = jest.fn<ExtractAssetsFn>();
const mockMinifyAssets = jest.fn<MinifyAssetsFn>();
const mockPackHTML = jest.fn<PackHTMLFn>();
const mockCoreFetchAndPack = jest.fn<CoreFetchFn>();
const mockCoreRecursivelyBundleSite = jest.fn<CoreRecursiveFn>();
const mockCoreBundleMultiPageHTML = jest.fn<CoreBundleMultiPageFn>();


// --- Configure Mocks with jest.unstable_mockModule ---
jest.unstable_mockModule('../../../src/core/parser.js', () => ({
    parseHTML: mockParseHTML,
}));
jest.unstable_mockModule('../../../src/core/extractor.js', () => ({
    extractAssets: mockExtractAssets,
}));
jest.unstable_mockModule('../../../src/core/minifier.js', () => ({
    minifyAssets: mockMinifyAssets,
}));
jest.unstable_mockModule('../../../src/core/packer.js', () => ({
    packHTML: mockPackHTML,
}));
jest.unstable_mockModule('../../../src/core/web-fetcher.js', () => ({
    fetchAndPackWebPage: mockCoreFetchAndPack,
    recursivelyBundleSite: mockCoreRecursivelyBundleSite,
}));
jest.unstable_mockModule('../../../src/core/bundler.js', () => ({
    bundleMultiPageHTML: mockCoreBundleMultiPageHTML,
}));

// --- Import Module Under Test ---
const PortaPack = await import('../../src/index.js');
// Logger type already imported above

// --- Test Suite ---

describe('📦 PortaPack Index (Public API)', () => {

    // --- Test Data ---
    const mockLocalInput = './test-data/local.html';
    const mockRemoteInput = 'https://example.com/remote-page';
    const mockBaseUrl = 'https://cdn.example.com/';
    const mockHtmlContent = '<html><body>Mock HTML Content</body></html>';
    const mockPackedHtml = '<!DOCTYPE html><html><body>Packed Mock</body></html>';
    const mockFetchedHtml = '<html><body>Fetched Content</body></html>';
    const mockRecursiveHtml = '<html><body>Recursive Bundle</body></html>';
    const mockMultiPageHtml = '<html><template>MultiPage</template></html>';

    // Example structures returned by mocked core functions (ensure they match types)
    const mockParsedData: ParsedHTML = { htmlContent: mockHtmlContent, assets: [] };
    const mockExtractedData: ParsedHTML = { htmlContent: mockHtmlContent, assets: [{ type: 'css', url: 'style.css', content: 'body{color:red}' } as Asset] }; // Added 'as Asset' for clarity
    const mockMinifiedData: ParsedHTML = { htmlContent: '<html><body>Minified</body></html>', assets: [{ type: 'css', url: 'style.css', content: 'body{color:red}' } as Asset] };
    // Ensure mock results match the defined return types for core functions
    const mockCoreFetchResult: CoreFetchReturn = { html: mockFetchedHtml, metadata: { assetCount: 5, errors: ['fetch warning'] } };
    const mockCoreRecursiveResult: CoreRecursiveReturn = { html: mockRecursiveHtml, pages: 3 };
    const mockPageEntries: PageEntry[] = [
        { url: 'page1.html', html: '<p>Page 1</p>' },
        { url: 'sub/page2.html', html: '<p>Page 2</p>' }
    ];

    beforeEach(() => {
        jest.clearAllMocks();

        // --- Default Mock Implementations (Happy Path) ---
        // These should now type-check correctly because the mocks have explicit types
        mockParseHTML.mockResolvedValue(mockParsedData);                  // Line 87 (fixed)
        mockExtractAssets.mockResolvedValue(mockExtractedData);           // Line 88 (fixed)
        mockMinifyAssets.mockResolvedValue(mockMinifiedData);             // Line 89 (fixed)
        mockPackHTML.mockReturnValue(mockPackedHtml);                     // Sync, no error previously
        mockCoreFetchAndPack.mockResolvedValue(mockCoreFetchResult);      // Line 91 (fixed)
        mockCoreRecursivelyBundleSite.mockResolvedValue(mockCoreRecursiveResult); // Line 92 (fixed)
        mockCoreBundleMultiPageHTML.mockReturnValue(mockMultiPageHtml);   // Sync, no error previously
    });

    // =============================
    // == generatePortableHTML Tests
    // =============================
    describe('generatePortableHTML', () => {
        it('🧪 should handle local files: call parse, extract, minify, pack', async () => {
            const options: BundleOptions = { embedAssets: true, logLevel: LogLevel.INFO };
            const result = await PortaPack.generatePortableHTML(mockLocalInput, options);

            expect(mockParseHTML).toHaveBeenCalledTimes(1);
            expect(mockParseHTML).toHaveBeenCalledWith(mockLocalInput, expect.any(Logger));

            expect(mockExtractAssets).toHaveBeenCalledTimes(1);
            expect(mockExtractAssets).toHaveBeenCalledWith(mockParsedData, true, mockLocalInput, expect.any(Logger));

            expect(mockMinifyAssets).toHaveBeenCalledTimes(1);
            expect(mockMinifyAssets).toHaveBeenCalledWith(mockExtractedData, options, expect.any(Logger));

            expect(mockPackHTML).toHaveBeenCalledTimes(1);
            expect(mockPackHTML).toHaveBeenCalledWith(mockMinifiedData, expect.any(Logger));

            expect(mockCoreFetchAndPack).not.toHaveBeenCalled();

            expect(result.html).toBe(mockPackedHtml);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.input).toBe(mockLocalInput);
            expect(result.metadata.outputSize).toBe(mockPackedHtml.length);
            expect(result.metadata.assetCount).toBe(mockMinifiedData.assets.length);
            expect(result.metadata.buildTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.metadata.errors).toEqual([]);
        });

        it('🧪 should respect embedAssets=false for local files', async () => {
            await PortaPack.generatePortableHTML(mockLocalInput, { embedAssets: false });
            expect(mockExtractAssets).toHaveBeenCalledWith(mockParsedData, false, mockLocalInput, expect.any(Logger));
        });

        it('🧪 should pass minify options correctly for local files', async () => {
            const minifyOptions: BundleOptions = { minifyHtml: false, minifyCss: true, minifyJs: false };
            await PortaPack.generatePortableHTML(mockLocalInput, minifyOptions);
            expect(mockMinifyAssets).toHaveBeenCalledWith(mockExtractedData, minifyOptions, expect.any(Logger));
        });

        it('🧪 should use options.baseUrl for local files if provided', async () => {
            await PortaPack.generatePortableHTML(mockLocalInput, { baseUrl: mockBaseUrl });
            expect(mockExtractAssets).toHaveBeenCalledWith(mockParsedData, true, mockBaseUrl, expect.any(Logger));
        });

        it('🌐 should handle remote URLs by calling fetchAndPackWebPage internally', async () => {
            const result = await PortaPack.generatePortableHTML(mockRemoteInput, {});

            expect(mockCoreFetchAndPack).toHaveBeenCalledTimes(1);
            expect(mockCoreFetchAndPack).toHaveBeenCalledWith(
                mockRemoteInput,
                {},
                expect.any(Logger)
            );

            expect(mockParseHTML).not.toHaveBeenCalled();
            expect(mockExtractAssets).not.toHaveBeenCalled();
            expect(mockMinifyAssets).not.toHaveBeenCalled();
            expect(mockPackHTML).not.toHaveBeenCalled();

            expect(result.html).toBe(mockFetchedHtml);
            expect(result.metadata).toBeDefined();
            expect(result.metadata.input).toBe(mockRemoteInput);
            expect(result.metadata.outputSize).toBe(mockFetchedHtml.length);
            expect(result.metadata.assetCount).toBe(mockCoreFetchResult.metadata?.assetCount);
            expect(result.metadata.errors).toEqual(mockCoreFetchResult.metadata?.errors);
            expect(result.metadata.buildTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('💥 should re-throw error from local pipeline failure (e.g., parser)', async () => {
            const parseError = new Error("Cannot read local file!");
            // This should now type-check correctly
            mockParseHTML.mockRejectedValueOnce(parseError); // Line 180 (fixed)

            await expect(PortaPack.generatePortableHTML(mockLocalInput))
                .rejects.toThrow(parseError);

            expect(mockExtractAssets).not.toHaveBeenCalled();
        });

        it('💥 should re-throw error from remote fetch failure', async () => {
            const fetchError = new Error("Remote host not found!");
            // This should now type-check correctly
            mockCoreFetchAndPack.mockRejectedValueOnce(fetchError); // Line 192 (fixed)

            await expect(PortaPack.generatePortableHTML(mockRemoteInput))
                .rejects.toThrow(fetchError);
        });
    });

    // ===================================
    // == generateRecursivePortableHTML Tests
    // ===================================
    describe('generateRecursivePortableHTML', () => {
        it('🧪 should call coreRecursivelyBundleSite with correct parameters', async () => {
            const depth = 2;
            const options: BundleOptions = { logLevel: LogLevel.DEBUG };
            const result = await PortaPack.generateRecursivePortableHTML(mockRemoteInput, depth, options);

            expect(mockCoreRecursivelyBundleSite).toHaveBeenCalledTimes(1);
            expect(mockCoreRecursivelyBundleSite).toHaveBeenCalledWith(
                mockRemoteInput,
                expect.stringContaining('example.com_recursive_bundle'), // Allow for timestamp variation
                depth,
                options,
                expect.any(Logger)
            );

            expect(result.html).toBe(mockRecursiveHtml);
            expect(result.metadata.input).toBe(mockRemoteInput);
            expect(result.metadata.outputSize).toBe(mockRecursiveHtml.length);
            expect(result.metadata.pagesBundled).toBe(mockCoreRecursiveResult.pages);
            expect(result.metadata.assetCount).toBe(0);
            expect(result.metadata.buildTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('🧪 should use default depth of 1 if not specified', async () => {
            await PortaPack.generateRecursivePortableHTML(mockRemoteInput);
            expect(mockCoreRecursivelyBundleSite).toHaveBeenCalledWith(
                mockRemoteInput,
                expect.any(String),
                1,
                {},
                expect.any(Logger)
            );
        });

        it('💥 should throw error for invalid (non-http) URL', async () => {
            const invalidUrl = 'ftp://invalid.com';
            await expect(PortaPack.generateRecursivePortableHTML(invalidUrl))
                .rejects.toThrow(/Invalid input URL.*Must start with http/);
            expect(mockCoreRecursivelyBundleSite).not.toHaveBeenCalled();
        });

        it('💥 should re-throw error from core recursive bundler failure', async () => {
            const crawlError = new Error("Crawling timeout!");
             // This should now type-check correctly
            mockCoreRecursivelyBundleSite.mockRejectedValueOnce(crawlError); // Line 247 (fixed)

            await expect(PortaPack.generateRecursivePortableHTML(mockRemoteInput))
                .rejects.toThrow(crawlError);
        });
    });

    // ==========================
    // == fetchAndPackWebPage Tests
    // ==========================
    describe('fetchAndPackWebPage', () => {
        it('🧪 should call coreFetchAndPack and finalize metadata', async () => {
            const options: BundleOptions = { logLevel: LogLevel.WARN };
            const result = await PortaPack.fetchAndPackWebPage(mockRemoteInput, options);

            expect(mockCoreFetchAndPack).toHaveBeenCalledTimes(1);
            expect(mockCoreFetchAndPack).toHaveBeenCalledWith(
                mockRemoteInput,
                options,
                expect.any(Logger)
            );

            expect(result.html).toBe(mockFetchedHtml);
            expect(result.metadata.input).toBe(mockRemoteInput);
            expect(result.metadata.outputSize).toBe(mockFetchedHtml.length);
            expect(result.metadata.assetCount).toBe(mockCoreFetchResult.metadata?.assetCount);
            expect(result.metadata.errors).toEqual(mockCoreFetchResult.metadata?.errors);
            expect(result.metadata.buildTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('💥 should throw error for invalid (non-http) URL', async () => {
            const invalidUrl = 'file:///local/page.html';
            await expect(PortaPack.fetchAndPackWebPage(invalidUrl))
                .rejects.toThrow(/Invalid input URL.*Must start with http/);
            expect(mockCoreFetchAndPack).not.toHaveBeenCalled();
        });

        it('💥 should re-throw error from core fetcher failure', async () => {
            const fetchError = new Error("404 Not Found!");
            // This should now type-check correctly
            mockCoreFetchAndPack.mockRejectedValueOnce(fetchError); // Line 288 (fixed)

            await expect(PortaPack.fetchAndPackWebPage(mockRemoteInput))
                .rejects.toThrow(fetchError);
        });
    });

    // ==========================
    // == bundleMultiPageHTML Tests
    // ==========================
    describe('bundleMultiPageHTML', () => {
        it('🧪 should call coreBundleMultiPageHTML with pages, options, and logger', () => {
            const options: BundleOptions = { logLevel: LogLevel.NONE };
            const result = PortaPack.bundleMultiPageHTML(mockPageEntries, options);

            expect(mockCoreBundleMultiPageHTML).toHaveBeenCalledTimes(1);
            expect(mockCoreBundleMultiPageHTML).toHaveBeenCalledWith(
                mockPageEntries,
                options,
                expect.any(Logger)
            );

            expect(result).toBe(mockMultiPageHtml);
        });

        it('🧪 should return empty string if pages array is empty', () => {
             const result = PortaPack.bundleMultiPageHTML([], {});
             expect(result).toBe('');
             expect(mockCoreBundleMultiPageHTML).not.toHaveBeenCalled();
         });

        it('🧪 should throw error if pages is not an array', () => {
             // Use ts-expect-error because we *expect* a type error on the next line
             // @ts-expect-error Testing invalid input type explicitly
             expect(() => PortaPack.bundleMultiPageHTML(null, {})) // Line 322 (fixed with ts-expect-error)
                 .toThrow("Invalid input: 'pages' must be an array."); // Assuming src/index throws this
             expect(mockCoreBundleMultiPageHTML).not.toHaveBeenCalled();
        });

        it('💥 should re-throw error from core multi-page bundler failure', () => {
            const bundleError = new Error("Invalid page entry format!");
            mockCoreBundleMultiPageHTML.mockImplementationOnce(() => { throw bundleError; });

            expect(() => PortaPack.bundleMultiPageHTML(mockPageEntries, {}))
                .toThrow(bundleError);
        });
    });

});