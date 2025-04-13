// tests/unit/index.test.ts

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import path from 'path';

// --- Import necessary types ---
import type {
    ParsedHTML,
    Asset,
    BundleOptions,
    PageEntry,
    BundleMetadata,
    BuildResult,
    // PackOptions, // Defined inline in index.ts, not exported here
} from '../../src/types';
import { LogLevel } from '../../src/types';
import { Logger } from '../../src/utils/logger';

// --- MOCK DEPENDENCIES FIRST ---

// --- Define PLAIN TOP-LEVEL mock functions ---
const mockParseHTMLFn = jest.fn();
const mockExtractAssetsFn = jest.fn();
const mockMinifyAssetsFn = jest.fn();
const mockPackHTMLFn = jest.fn();
const mockFetchAndPackWebPageFn = jest.fn();
const mockRecursivelyBundleSiteFn = jest.fn();
const mockBundleMultiPageHTMLFn = jest.fn();

// --- Define BuildTimer mock state variables ---
let mockFinishFn = jest.fn();
let mockSetPageCountFn = jest.fn();
const mockSetHtmlSizeFn = jest.fn();

// --- Explicitly Mock Modules with Factories ---
jest.mock('../../src/utils/meta', () => ({
    __esModule: true,
    BuildTimer: jest.fn().mockImplementation(() => ({
        finish: mockFinishFn,
        setPageCount: mockSetPageCountFn,
        setHtmlSize: mockSetHtmlSizeFn,
    })),
}));
jest.mock('../../src/core/parser', () => ({ __esModule: true, parseHTML: mockParseHTMLFn }));
jest.mock('../../src/core/extractor', () => ({ __esModule: true, extractAssets: mockExtractAssetsFn }));
jest.mock('../../src/core/minifier', () => ({ __esModule: true, minifyAssets: mockMinifyAssetsFn }));
jest.mock('../../src/core/packer', () => ({ __esModule: true, packHTML: mockPackHTMLFn }));
jest.mock('../../src/core/web-fetcher', () => ({
    __esModule: true,
    fetchAndPackWebPage: mockFetchAndPackWebPageFn,
    recursivelyBundleSite: mockRecursivelyBundleSiteFn,
}));
jest.mock('../../src/core/bundler', () => ({ __esModule: true, bundleMultiPageHTML: mockBundleMultiPageHTMLFn }));


// --- IMPORT MODULES ---
import { BuildTimer } from '../../src/utils/meta';
import { generatePortableHTML, generateRecursivePortableHTML, pack } from '../../src/index';

// --- TEST SETUP ---
describe('📦 PortaPack Index (Public API)', () => {
    const logger = new Logger(LogLevel.INFO);
    const mockHtmlPath = (global as any).__TEST_DIRECTORIES__?.sampleProject
        ? path.join((global as any).__TEST_DIRECTORIES__.sampleProject, 'index.html')
        : 'local/index.html';
    const mockRemoteUrl = 'https://example.com';
    const mockOutputPath = 'test-output.html'; // Define an output path

    const mockParsed: ParsedHTML = { htmlContent: '<html><body>Mock Parsed</body></html>', assets: [] };
    const mockPacked = '<html><body>packed!</body></html>';
    const mockBundledHtml = mockPacked;

    // Base metadata without input/outputFile
    const baseMetadata: Omit<BundleMetadata, 'input'> = { // FIX: Removed outputFile
        assetCount: 0, outputSize: mockPacked.length, buildTimeMs: 100, errors: [], pagesBundled: undefined
    };
    // Define expected metadata per test case
    let expectedLocalMetadata: BundleMetadata;
    let expectedRemoteMetadata: BundleMetadata;
    let expectedRecursiveMetadata: BundleMetadata;


    beforeEach(() => {
        jest.clearAllMocks();

        // Re-initialize mutable mock functions
        expectedLocalMetadata = { ...baseMetadata, input: mockHtmlPath };
        mockFinishFn = jest.fn().mockReturnValue(expectedLocalMetadata); // Default return
        mockSetPageCountFn = jest.fn();
        mockSetHtmlSizeFn.mockClear();

        // --- Configure mocks using CASTS ('as any') before configuration methods ---
        (mockParseHTMLFn as any).mockImplementation(() => Promise.resolve(mockParsed));
        (mockExtractAssetsFn as any).mockImplementation(() => Promise.resolve(mockParsed));
        (mockMinifyAssetsFn as any).mockImplementation(() => Promise.resolve(mockParsed));
        (mockPackHTMLFn as any).mockReturnValue(mockPacked);

        // FIX: Add string type hint and cast before mockImplementation
        (mockFetchAndPackWebPageFn as any).mockImplementation(async (url: string) => {
             // Return structure must match BuildResult
             return Promise.resolve({ html: mockPacked, metadata: { ...baseMetadata, input: url } as BundleMetadata });
        });

        // FIX: Cast before mockImplementation
        (mockRecursivelyBundleSiteFn as any).mockImplementation(
            async (/* startUrl, outputFile, maxDepth, logger */) => {
                 mockSetPageCountFn(3);
                 // Return structure expected by generateRecursivePortableHTML
                 // FIX: Cast return value to satisfy Promise<never> if needed, although mockImplementation often avoids this
                 return Promise.resolve({ html: mockPacked, pages: 3 });
            }
        );

        (mockBundleMultiPageHTMLFn as any).mockReturnValue(mockBundledHtml);
    });

    // --- Tests for pack() ---
    describe('pack()', () => {
        it('✅ delegates to generatePortableHTML for local files', async () => {
            expectedLocalMetadata = { ...baseMetadata, input: mockHtmlPath };
            mockFinishFn.mockReturnValueOnce(expectedLocalMetadata);
            // FIX: Use 'output' option
            const result = await pack(mockHtmlPath, { output: mockOutputPath, loggerInstance: logger });
            expect(mockParseHTMLFn).toHaveBeenCalledWith(mockHtmlPath, expect.any(Logger));
            expect(result.html).toBe(mockPacked);
            expect(result.metadata).toEqual(expectedLocalMetadata);
        });

        it('✅ uses fetchAndPackWebPage for remote non-recursive input', async () => {
            const remoteUrl = `${mockRemoteUrl}/page`;
            expectedRemoteMetadata = { ...baseMetadata, input: remoteUrl };
            mockFinishFn.mockReturnValueOnce(expectedRemoteMetadata);
            // FIX: Use mockImplementationOnce with cast for specific return value
            (mockFetchAndPackWebPageFn as any).mockImplementationOnce(async () => Promise.resolve({ html: mockPacked, metadata: { ...baseMetadata, input: remoteUrl } as BundleMetadata }));

            // FIX: Use 'output' option
            const result = await pack(remoteUrl, { recursive: false, output: mockOutputPath, loggerInstance: logger });

            expect(mockFetchAndPackWebPageFn).toHaveBeenCalledWith(remoteUrl, expect.any(Logger));
            expect(result.html).toBe(mockPacked);
            expect(result.metadata).toEqual(expectedRemoteMetadata);
        });

        it('✅ uses recursivelyBundleSite for recursive input', async () => {
            const remoteUrl = `${mockRemoteUrl}/site`;
            expectedRecursiveMetadata = { ...baseMetadata, input: remoteUrl, pagesBundled: 3 };
            mockFinishFn.mockReturnValueOnce(expectedRecursiveMetadata);

            // FIX: Use 'output' option
            const result = await pack(remoteUrl, { recursive: true, output: mockOutputPath, loggerInstance: logger });

            expect(mockRecursivelyBundleSiteFn).toHaveBeenCalledWith(remoteUrl, 'output.html', 1, expect.any(Logger));
            expect(result.html).toBe(mockPacked);
            expect(result.metadata).toEqual(expectedRecursiveMetadata);
        });

        it('✅ uses custom recursion depth if provided', async () => {
            const remoteUrl = `${mockRemoteUrl}/site`;
            expectedRecursiveMetadata = { ...baseMetadata, input: remoteUrl, pagesBundled: 3 };
            mockFinishFn.mockReturnValueOnce(expectedRecursiveMetadata);
            // FIX: Use 'output' option
            await pack(remoteUrl, { recursive: 5, output: mockOutputPath, loggerInstance: logger });

            expect(mockRecursivelyBundleSiteFn).toHaveBeenCalledWith(remoteUrl, 'output.html', 5, expect.any(Logger));
        });

        it('✅ throws on unsupported protocols (e.g., ftp)', async () => {
             // FIX: Use 'output' option
             await expect(pack('ftp://weird.site', { output: mockOutputPath })).rejects.toThrow(/unsupported protocol or input type/i);
             // ... other assertions ...
        });
    });


    // --- Tests for generatePortableHTML() ---
    describe('generatePortableHTML()', () => {
        it('✅ should bundle local HTML with all core steps', async () => {
            expectedLocalMetadata = { ...baseMetadata, input: mockHtmlPath };
            mockFinishFn.mockReturnValueOnce(expectedLocalMetadata);
            // FIX: Use 'output' option
            const result = await generatePortableHTML(mockHtmlPath, { output: mockOutputPath }, logger);

            expect(mockParseHTMLFn).toHaveBeenCalledWith(mockHtmlPath, logger);
            expect(mockExtractAssetsFn).toHaveBeenCalledWith(mockParsed, true, mockHtmlPath, logger);
            expect(mockMinifyAssetsFn).toHaveBeenCalledWith(mockParsed, { output: mockOutputPath }, logger);
            expect(mockPackHTMLFn).toHaveBeenCalledWith(mockParsed, logger);
            expect(mockFinishFn).toHaveBeenCalledWith(mockPacked, { assetCount: mockParsed.assets.length });
            expect(result.html).toBe(mockPacked);
            expect(result.metadata).toEqual(expectedLocalMetadata);
        });

       it('✅ should call fetchAndPackWebPage for remote input', async () => {
           const remoteUrl = `${mockRemoteUrl}/page2`;
           expectedRemoteMetadata = { ...baseMetadata, input: remoteUrl };
           mockFinishFn.mockReturnValueOnce(expectedRemoteMetadata);
           // Configure fetch mock to return specific metadata
           const fetcherReturnMetadata = { ...baseMetadata, input: remoteUrl };
           // FIX: Cast needed before configuration method
           (mockFetchAndPackWebPageFn as any).mockImplementationOnce(async () => Promise.resolve({ html: mockPacked, metadata: fetcherReturnMetadata }));

           // FIX: Use 'output' option
           const result = await generatePortableHTML(remoteUrl, { output: mockOutputPath }, logger);

           expect(mockFetchAndPackWebPageFn).toHaveBeenCalledWith(remoteUrl, logger);
           expect(mockFinishFn).toHaveBeenCalledWith(mockPacked, fetcherReturnMetadata);
           expect(result.html).toBe(mockPacked);
           expect(result.metadata).toEqual(expectedRemoteMetadata);
       });

      it('✅ should throw on bad input file', async () => {
        const badPath = '/non/existent/file.html';
        const mockError = new Error('File not found');
        // FIX: Cast before mockImplementationOnce
        (mockParseHTMLFn as any).mockImplementationOnce(() => Promise.reject(mockError));

        // FIX: Use 'output' option
        await expect(generatePortableHTML(badPath, { output: mockOutputPath }, logger)).rejects.toThrow(mockError);

        expect(mockParseHTMLFn).toHaveBeenCalledWith(badPath, logger);
        expect(mockFinishFn).not.toHaveBeenCalled();
      });
   });

    // --- Tests for generateRecursivePortableHTML() ---
    describe('generateRecursivePortableHTML()', () => {
        it('✅ should handle recursive remote bundling', async () => {
            const remoteUrl = `${mockRemoteUrl}/site2`;
            expectedRecursiveMetadata = { ...baseMetadata, input: remoteUrl, pagesBundled: 3 };
            mockFinishFn.mockReturnValueOnce(expectedRecursiveMetadata);
            // Configure the core function mock return value for this test
            // FIX: Cast before configuration method if needed for specific return
            (mockRecursivelyBundleSiteFn as any).mockResolvedValueOnce({ html: mockPacked, pages: 3 });

            // FIX: Use 'output' option
            const result = await generateRecursivePortableHTML(remoteUrl, 2, { output: mockOutputPath }, logger);

            expect(mockRecursivelyBundleSiteFn).toHaveBeenCalledWith(remoteUrl, 'output.html', 2, logger);
            expect(mockSetPageCountFn).toHaveBeenCalledWith(3);
            expect(mockFinishFn).toHaveBeenCalledWith(mockPacked, { assetCount: 0, pagesBundled: 3 });
            expect(result.html).toBe(mockPacked);
            expect(result.metadata).toEqual(expectedRecursiveMetadata);
        });
    });

});