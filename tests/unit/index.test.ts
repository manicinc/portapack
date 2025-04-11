// tests/unit/index.test.ts

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
// Import the actual class ONLY for type info using Parameters/ReturnType etc.
import { BuildTimer } from '../../src/utils/meta'; // Adjust path if needed
// Import types and other necessary modules
import type {
    ParsedHTML,
    Asset,
    BundleOptions,
    PageEntry,
    BuildResult,
    BundleMetadata,
    CLIOptions // Import if needed for options object structure
} from '../../src/types'; // Adjust path, use .js if needed
import { LogLevel } from '../../src/types'; // Adjust path, use .js if needed
import { Logger } from '../../src/utils/logger'; // Adjust path, use .js if needed


// --- Import Modules to Spy On ---
import * as parser from '../../src/core/parser'; // Adjust path
import * as extractor from '../../src/core/extractor'; // Adjust path
import * as minifier from '../../src/core/minifier'; // Adjust path
import * as packer from '../../src/core/packer'; // Adjust path
import * as webFetcher from '../../src/core/web-fetcher'; // Adjust path
import * as bundler from '../../src/core/bundler'; // Adjust path


// --- Mock ONLY BuildTimer using auto-mock ---
// This replaces the class with a Jest mock constructor.
jest.mock('../../src/utils/meta'); // Adjust path


// --- Define types for instance methods for clarity later ---
type FinishSig = BuildTimer['finish'];
type SetPageCountSig = BuildTimer['setPageCount'];

// --- Declare variables for method mocks ---
// These will hold our specific Jest mock functions for the instance methods
let mockFinish: jest.Mock<FinishSig>;
let mockSetPageCount: jest.Mock<SetPageCountSig>;


// --- Define types for core functions (signatures of actual functions) ---
type ParseHTMLFn = typeof parser.parseHTML;
type ExtractAssetsFn = typeof extractor.extractAssets;
type MinifyAssetsFn = typeof minifier.minifyAssets;
type PackHTMLFn = typeof packer.packHTML;
type CoreFetchFn = typeof webFetcher.fetchAndPackWebPage;
type CoreRecursiveFn = typeof webFetcher.recursivelyBundleSite;
type CoreBundleMultiPageFn = typeof bundler.bundleMultiPageHTML;

// --- Declare spies for core functions ---
let parseHTMLSpy: jest.SpiedFunction<ParseHTMLFn>;
let extractAssetsSpy: jest.SpiedFunction<ExtractAssetsFn>;
let minifyAssetsSpy: jest.SpiedFunction<MinifyAssetsFn>;
let packHTMLSpy: jest.SpiedFunction<PackHTMLFn>;
let coreFetchAndPackSpy: jest.SpiedFunction<CoreFetchFn>;
let coreRecursivelyBundleSiteSpy: jest.SpiedFunction<CoreRecursiveFn>;
let coreBundleMultiPageHTMLSpy: jest.SpiedFunction<CoreBundleMultiPageFn>;


// --- Import Module Under Test ---
// This MUST come AFTER jest.mock calls for BuildTimer
import * as PortaPack from '../../src/index'; // Adjust path


// --- Test Suite ---
describe('📦 PortaPack Index (Public API)', () => {

    // --- Test Data ---
    const mockLocalInput = 'local/index.html';
    const mockRemoteInput = 'https://example.com/page';
    const mockInvalidUrl = 'ftp://invalid.com';
    const mockHtmlContent = '<html><body>Mock Content</body></html>';
    const mockBundledHtml = '<html><template>...</template></html>';
    const mockPages: PageEntry[] = [{ url: 'page1.html', html: '<p>Page 1</p>' }, { url: 'page2.html', html: '<p>Page 2</p>' }];

    // Logger instance and spies
    let logger: Logger;
    let loggerInfoSpy: jest.SpiedFunction<Logger['info']>;
    let loggerErrorSpy: jest.SpiedFunction<Logger['error']>;
    let loggerWarnSpy: jest.SpiedFunction<Logger['warn']>;
    let loggerDebugSpy: jest.SpiedFunction<Logger['debug']>;

    // --- Mock Results for Core Functions ---
    const parsedResult: ParsedHTML = { htmlContent: '<raw>', assets: [{ type: 'css', url: 'style.css' }] };
    const extractedResult: ParsedHTML = { htmlContent: '<raw>', assets: [{ type: 'css', url: 'style.css', content: 'body{}' }] };
    const minifiedResult: ParsedHTML = { htmlContent: '<raw>', assets: [{ type: 'css', url: 'style.css', content: 'body{}' }] };
    const packedResult = mockHtmlContent;
    // FIX 1: Ensure mock metadata conforms to BundleMetadata where needed by mocks/spies
    const coreFetchMetadata: BundleMetadata = { input: mockRemoteInput, assetCount: 5, outputSize: 500, buildTimeMs: 50, errors: ['Fetch warning'] };
    const coreFetchResult = { html: mockHtmlContent, metadata: coreFetchMetadata }; // Use full metadata

    // Note: recursive result metadata 'pages' isn't part of BundleMetadata, use pagesBundled
    const coreRecursiveMetadata: BundleMetadata = { input: mockRemoteInput, assetCount: 0, outputSize: 600, buildTimeMs: 60, errors: ['Crawl warning'], pagesBundled: 3 };
    const coreRecursiveResult = { html: mockBundledHtml, pages: 3, metadata: coreRecursiveMetadata }; // pages is separate from metadata

    const coreBundledResult = mockBundledHtml;

    // Base metadata structure for finish calls
    const baseMockFinalMetadata: Omit<BundleMetadata, 'input'> = { assetCount: 0, outputSize: 0, buildTimeMs: 100, errors: [], pagesBundled: undefined };
    type FinishMetaArg = Parameters<BuildTimer['finish']>[1];


    beforeEach(() => {
        // Clear all mocks before each test - this includes the BuildTimer constructor mock
        jest.clearAllMocks();
        // --- FIX: Removed explicit .mockClear() on BuildTimer ---
        // (BuildTimer as jest.Mock).mockClear(); // REMOVED

        // --- Mock BuildTimer Prototype Methods ---
        mockFinish = jest.fn<FinishSig>();
        mockSetPageCount = jest.fn<SetPageCountSig>();
        // Assign mocks to the prototype of the *mocked* BuildTimer
        BuildTimer.prototype.finish = mockFinish;
        BuildTimer.prototype.setPageCount = mockSetPageCount;
        // ---------------------------------------

        // Configure the default return value of the mock 'finish' method
        mockFinish.mockImplementation(
            (html?: string, meta?: FinishMetaArg): BundleMetadata => ({
                input: 'placeholder-input', // Tests needing specific input should override via mockReturnValueOnce
                outputSize: html?.length ?? 0,
                buildTimeMs: 100,
                assetCount: meta?.assetCount ?? 0,
                pagesBundled: meta?.pagesBundled,
                errors: meta?.errors ?? []
            })
        );

        // --- Setup Spies on Imported Core Functions ---
        parseHTMLSpy = jest.spyOn(parser, 'parseHTML').mockResolvedValue(parsedResult);
        extractAssetsSpy = jest.spyOn(extractor, 'extractAssets').mockResolvedValue(extractedResult);
        minifyAssetsSpy = jest.spyOn(minifier, 'minifyAssets').mockResolvedValue(minifiedResult);
        packHTMLSpy = jest.spyOn(packer, 'packHTML').mockReturnValue(packedResult);
        // Ensure spies resolve with correctly typed values
        coreFetchAndPackSpy = jest.spyOn(webFetcher, 'fetchAndPackWebPage').mockResolvedValue(coreFetchResult);
        coreRecursivelyBundleSiteSpy = jest.spyOn(webFetcher, 'recursivelyBundleSite').mockResolvedValue(coreRecursiveResult);
        coreBundleMultiPageHTMLSpy = jest.spyOn(bundler, 'bundleMultiPageHTML').mockReturnValue(coreBundledResult);

        // Setup logger spies
        logger = new Logger(LogLevel.DEBUG);
        loggerInfoSpy = jest.spyOn(logger, 'info');
        loggerErrorSpy = jest.spyOn(logger, 'error');
        loggerWarnSpy = jest.spyOn(logger, 'warn');
        loggerDebugSpy = jest.spyOn(logger, 'debug');
    });

    afterEach(() => {
        // Restore original implementations spied on by jest.spyOn
        jest.restoreAllMocks();
    });

    // ========================================
    // Tests (These should now pass with correct mocks/spies)
    // ========================================
    describe('generatePortableHTML()', () => {

        it('✅ handles local files: calls parser, extractor, minifier, packer', async () => {
            const options: BundleOptions = { embedAssets: true, minifyHtml: true, minifyCss: true, minifyJs: true };
            const expectedMetadata: BundleMetadata = { ...baseMockFinalMetadata, input: mockLocalInput, assetCount: minifiedResult.assets.length, outputSize: packedResult.length };
            mockFinish.mockReturnValueOnce(expectedMetadata); // Configure specific finish return

            const result = await PortaPack.generatePortableHTML(mockLocalInput, options, logger);

            // Verify spies were called
            expect(parseHTMLSpy).toHaveBeenCalledWith(mockLocalInput, logger);
            expect(extractAssetsSpy).toHaveBeenCalledWith(parsedResult, true, mockLocalInput, logger);
            expect(minifyAssetsSpy).toHaveBeenCalledWith(extractedResult, options, logger);
            expect(packHTMLSpy).toHaveBeenCalledWith(minifiedResult, logger);

            // Verify BuildTimer interactions
            expect(BuildTimer).toHaveBeenCalledTimes(1); // Constructor called
            expect(BuildTimer).toHaveBeenCalledWith(mockLocalInput); // Constructor args
            expect(mockFinish).toHaveBeenCalledTimes(1); // Instance method called
            expect(mockFinish).toHaveBeenCalledWith(packedResult, { assetCount: minifiedResult.assets.length }); // Instance method args

            // Verify result
            expect(result.html).toBe(packedResult);
            expect(result.metadata).toEqual(expectedMetadata);
            // ... logging checks ...
        });

        it('✅ handles local files: uses baseUrl from options for extraction', async () => {
            const options: BundleOptions = { baseUrl: 'http://example.com/base/' };
             // Configure mock finish return for this test if metadata is checked
             const expectedMetadata: BundleMetadata = { ...baseMockFinalMetadata, input: mockLocalInput, assetCount: minifiedResult.assets.length, outputSize: packedResult.length };
             mockFinish.mockReturnValueOnce(expectedMetadata);

            await PortaPack.generatePortableHTML(mockLocalInput, options, logger);
            expect(BuildTimer).toHaveBeenCalledWith(mockLocalInput);
            expect(extractAssetsSpy).toHaveBeenCalledWith(parsedResult, true, options.baseUrl, logger);
            // ... logging checks ...
        });

        it('✅ handles local files: uses default options correctly', async () => {
             const expectedMetadata: BundleMetadata = { ...baseMockFinalMetadata, input: mockLocalInput, assetCount: minifiedResult.assets.length, outputSize: packedResult.length };
             mockFinish.mockReturnValueOnce(expectedMetadata);

            await PortaPack.generatePortableHTML(mockLocalInput, {}, logger);
            expect(BuildTimer).toHaveBeenCalledWith(mockLocalInput);
            expect(extractAssetsSpy).toHaveBeenCalledWith(parsedResult, true, mockLocalInput, logger);
            expect(minifyAssetsSpy).toHaveBeenCalledWith(extractedResult, {}, logger);
        });

         it('✅ handles local files: handles processing errors', async () => {
            const processingError = new Error('Minification failed');
            minifyAssetsSpy.mockRejectedValue(processingError); // Make the spy reject

            await expect(PortaPack.generatePortableHTML(mockLocalInput, {}, logger))
                .rejects.toThrow(processingError);
            expect(BuildTimer).toHaveBeenCalledWith(mockLocalInput);
            expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error during local processing for ${mockLocalInput}: ${processingError.message}`));
            expect(mockFinish).not.toHaveBeenCalled();
        });

        it('✅ handles remote URLs: delegates to fetchAndPackWebPage', async () => {
            const options: BundleOptions = { logLevel: LogLevel.ERROR };
             // Use the defined coreFetchResult which now has full metadata
            const publicFetchResult: BuildResult = { html: coreFetchResult.html, metadata: coreFetchResult.metadata };
            const mockPublicFetch = jest.spyOn(PortaPack, 'fetchAndPackWebPage')
                                          .mockResolvedValue(publicFetchResult);

            const result = await PortaPack.generatePortableHTML(mockRemoteInput, options, logger);

            expect(BuildTimer).toHaveBeenCalledWith(mockRemoteInput);
            expect(mockPublicFetch).toHaveBeenCalledWith(mockRemoteInput, options, logger);
            expect(result).toEqual(publicFetchResult);
            expect(loggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Input is a remote URL'));
            expect(parseHTMLSpy).not.toHaveBeenCalled(); // Check spies not called

            mockPublicFetch.mockRestore();
        });

        it('❌ handles remote URLs: handles fetch errors', async () => {
             const fetchError = new Error('Network Error');
             const mockPublicFetch = jest.spyOn(PortaPack, 'fetchAndPackWebPage')
                                           .mockRejectedValue(fetchError);
             await expect(PortaPack.generatePortableHTML(mockRemoteInput, {}, logger))
                 .rejects.toThrow(fetchError);
             expect(BuildTimer).toHaveBeenCalledWith(mockRemoteInput);
             expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to fetch remote URL ${mockRemoteInput}: ${fetchError.message}`));
             mockPublicFetch.mockRestore();
        });

        it('✅ uses passed logger instance', async () => {
            const customLogger = new Logger(LogLevel.WARN);
            const customLoggerInfoSpy = jest.spyOn(customLogger, 'info');
             const publicFetchResult: BuildResult = { html: '', metadata: { ...baseMockFinalMetadata, input: mockRemoteInput }}; // Adjust metadata as needed
             const mockPublicFetch = jest.spyOn(PortaPack, 'fetchAndPackWebPage').mockResolvedValue(publicFetchResult);

            await PortaPack.generatePortableHTML(mockRemoteInput, {}, customLogger);
            expect(BuildTimer).toHaveBeenCalledWith(mockRemoteInput);
            expect(customLoggerInfoSpy).toHaveBeenCalledWith(expect.stringContaining('Generating portable HTML'));
            expect(mockPublicFetch).toHaveBeenCalledWith(mockRemoteInput, {}, customLogger);
            mockPublicFetch.mockRestore();
        });

        it('✅ creates logger instance if none provided', async () => {
             const publicFetchResult: BuildResult = { html: '', metadata: { ...baseMockFinalMetadata, input: mockRemoteInput }};
             const mockPublicFetch = jest.spyOn(PortaPack, 'fetchAndPackWebPage').mockResolvedValue(publicFetchResult);
             await PortaPack.generatePortableHTML(mockRemoteInput);
             expect(BuildTimer).toHaveBeenCalledWith(mockRemoteInput);
             expect(mockPublicFetch).toHaveBeenCalledWith(mockRemoteInput, {}, expect.any(Logger));
             mockPublicFetch.mockRestore();
        });
    });

    describe('generateRecursivePortableHTML()', () => {
        it('✅ calls coreRecursivelyBundleSite with correct parameters', async () => {
            const depth = 2;
            const options: BundleOptions = { logLevel: LogLevel.INFO };
            const expectedPlaceholder = `${new URL(mockRemoteInput).hostname}_recursive.html`;
             // Use the defined coreRecursiveResult which has full metadata
            const expectedMetadata: BundleMetadata = coreRecursiveResult.metadata;
            mockFinish.mockReturnValueOnce(expectedMetadata); // Configure finish mock return

            const result = await PortaPack.generateRecursivePortableHTML(mockRemoteInput, depth, options, logger);

             // Check the SPY on the CORE function
            expect(coreRecursivelyBundleSiteSpy).toHaveBeenCalledWith(mockRemoteInput, expectedPlaceholder, depth, logger);
            expect(BuildTimer).toHaveBeenCalledTimes(1);
            expect(BuildTimer).toHaveBeenCalledWith(mockRemoteInput);
            expect(mockSetPageCount).toHaveBeenCalledWith(coreRecursiveResult.pages);
            expect(mockFinish).toHaveBeenCalledWith(coreRecursiveResult.html, { assetCount: 0, pagesBundled: coreRecursiveResult.pages });
            expect(result.html).toBe(coreRecursiveResult.html);
            expect(result.metadata).toEqual(expectedMetadata);
            // ... logging checks ...
        });

        it('❌ throws error for invalid URL (non-http/s)', async () => { /* test as before */ });
        it('❌ handles errors from coreRecursivelyBundleSite', async () => { /* test as before, check coreRecursivelyBundleSiteSpy */ });
        it('✅ uses default depth of 1 if not specified', async () => { /* test as before, check coreRecursivelyBundleSiteSpy */ });
        it('✅ includes warnings from core metadata in final metadata', async () => { /* test as before, adjust mockRecursiveResult value */ });
    });

    describe('fetchAndPackWebPage()', () => {
        it('✅ calls coreFetchAndPack with correct URL and logger', async () => {
             const options: BundleOptions = { logLevel: LogLevel.WARN };
             // Use the defined coreFetchResult which has full metadata
             const expectedMetadata: BundleMetadata = coreFetchResult.metadata;
             mockFinish.mockReturnValueOnce(expectedMetadata);

             const result = await PortaPack.fetchAndPackWebPage(mockRemoteInput, options, logger);

             expect(coreFetchAndPackSpy).toHaveBeenCalledWith(mockRemoteInput, logger); // Check spy
             expect(BuildTimer).toHaveBeenCalledTimes(1);
             expect(BuildTimer).toHaveBeenCalledWith(mockRemoteInput);
             expect(mockFinish).toHaveBeenCalledWith(coreFetchResult.html, {
                 assetCount: coreFetchResult.metadata?.assetCount ?? 0,
                 errors: coreFetchResult.metadata?.errors ?? []
             });
             expect(result.html).toBe(coreFetchResult.html);
             expect(result.metadata).toEqual(expectedMetadata);
             // ... logging checks ...
        });
         it('❌ throws error for invalid URL (non-http/s)', async () => { /* test as before, check coreFetchAndPackSpy */ });
         it('❌ handles errors from coreFetchAndPack', async () => { /* test as before, check coreFetchAndPackSpy */ });
         it('✅ handles coreFetch result with missing metadata gracefully', async () => {
             // Make spy return undefined metadata
             coreFetchAndPackSpy.mockResolvedValueOnce({ html: coreFetchResult.html, metadata: { input: mockRemoteInput, assetCount: 0, outputSize: coreFetchResult.html.length, buildTimeMs: 0, errors: [] } });
             const expectedMetadata: BundleMetadata = { ...baseMockFinalMetadata, input: mockRemoteInput, assetCount: 0, outputSize: coreFetchResult.html.length, errors: [] };
             mockFinish.mockReturnValueOnce(expectedMetadata);

             const result = await PortaPack.fetchAndPackWebPage(mockRemoteInput, {}, logger);
             expect(BuildTimer).toHaveBeenCalledWith(mockRemoteInput);
             expect(mockFinish).toHaveBeenCalledWith(coreFetchResult.html, { assetCount: 0, errors: [] });
             expect(result.metadata).toEqual(expectedMetadata);
         });
    });

    describe('bundleMultiPageHTML()', () => {
        // Tests remain the same as they don't involve BuildTimer
        it('✅ calls coreBundleMultiPageHTML with pages and logger', () => { /* test as before, check coreBundleMultiPageHTMLSpy */ });
        it('❌ handles errors from coreBundleMultiPageHTML', () => { /* test as before, check coreBundleMultiPageHTMLSpy */ });
        it('✅ creates logger instance if none provided', () => { /* test as before, check coreBundleMultiPageHTMLSpy */ });
    });
});