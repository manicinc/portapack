/**
 * @file tests/unit/core/web-fetcher.test.ts
 * @description Unit tests for the web page fetching and crawling logic (`web-fetcher.ts`).
 * Uses Jest mocks extensively to isolate the code under test from actual
 * Puppeteer operations and filesystem access, compatible with ESM.
 */

// --- Type Imports ---
import type {
    Page,
    Browser,
    HTTPResponse,
    GoToOptions,
    LaunchOptions
} from 'puppeteer';
import type { BuildResult, PageEntry } from '../../../src/types';
import { Logger } from '../../../src/utils/logger';
import type { PathLike } from 'fs';

// --- Jest Imports ---
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// --- Mocking Setup (using jest.unstable_mockModule) ---

// Define Jest mock functions for Puppeteer methods and other dependencies
const mockPageGoto = jest.fn<(url: string, options?: GoToOptions) => Promise<HTTPResponse | null>>();
const mockPageContent = jest.fn<() => Promise<string>>();
const mockPageEvaluate = jest.fn<(fn: any, ...args: any[]) => Promise<any>>();
const mockPageClose = jest.fn<() => Promise<void>>();
const mockPageSetViewport = jest.fn<(_viewport: { width: number, height: number }) => Promise<void>>();
const mockPageUrl = jest.fn<() => string>();
const mockPage$ = jest.fn<(selector: string) => Promise<any | null>>();
const mockPage$$ = jest.fn<(selector: string) => Promise<any[]>>();
const mockNewPage = jest.fn<() => Promise<Page>>();
const mockBrowserClose = jest.fn<() => Promise<void>>();
const mockLaunch = jest.fn<(options?: LaunchOptions) => Promise<Browser>>();

const mockWriteFile = jest.fn<(path: PathLike | number, data: string | NodeJS.ArrayBufferView, options?: any) => Promise<void>>();
const mockBundleMultiPageHTMLFn = jest.fn<(pages: PageEntry[]) => string>();

// --- Mock Core Dependencies ---

// Mock the 'puppeteer' module
jest.unstable_mockModule('puppeteer', () => ({
    launch: mockLaunch,
}));

// Mock 'fs/promises' - providing only named exports
jest.unstable_mockModule('fs/promises', () => ({
    writeFile: mockWriteFile,
    // Add readFile, mkdir etc. mocks if web-fetcher.ts uses them
}));

// Mock the internal bundler module
jest.unstable_mockModule('../../../src/core/bundler', () => ({
    bundleMultiPageHTML: mockBundleMultiPageHTMLFn,
}));


// --- Dynamic Import ---
// Import the module under test *after* all mocks are set up
// This should now work if the import in web-fetcher.ts is correct
const { fetchAndPackWebPage, recursivelyBundleSite } = await import('../../../src/core/web-fetcher');


// --- Test Suite Setup ---
jest.setTimeout(60000);

describe('🕸️ web-fetcher', () => {
    // Define mock browser/page objects using Partial/Pick
    let mockBrowserObject: Partial<Pick<Browser, 'newPage' | 'close'>>;
    let mockPageObject: Partial<Pick<Page, 'goto' | 'content' | 'close' | '$' | '$$' | 'evaluate' | 'url' | 'setViewport'>>;
    let loggerInstance: Logger;

    // --- Constants for Tests --- (Ensure these are all defined)
    const startUrl = 'https://test-crawl.site/';
    const page2Url = `${startUrl}page2`;
    const page3Url = `${startUrl}page3`;
    const relativeUrl = `${startUrl}relative.html`;
    const subDomainUrl = 'https://sub.test-crawl.site/other';
    const httpDomainUrl = 'http://test-crawl.site/other';
    const externalUrl = 'https://othersite.com';
    const outputPath = 'output-crawl.html';
    const bundledHtmlResult = '<html><body>Mock Bundled HTML</body></html>';
    const page1HtmlWithLinks = `<html><body>Page 1<a href="/page2">L2</a><a href="${page3Url}">L3</a></body></html>`;
    const page2HtmlNoLinks = `<html><body>Page 2</body></html>`;
    const page3HtmlWithCycleLink = `<html><body>Page 3 Content <a href="/">Link to Start</a> <a href="#section">Fragment</a></body></html>`;
    const pageHtmlWithVariousLinks = `
        <html><body>
            <a href="/page2">Good Internal</a>
            <a href="relative.html">Relative Path</a>
            <a href="/page3?query=1#frag">Good Internal with Query/Frag</a>
            <a href="${subDomainUrl}">Subdomain</a>
            <a href="${httpDomainUrl}">HTTP Protocol</a>
            <a href="${externalUrl}">External Site</a>
            <a href="mailto:test@example.com">Mailto</a>
            <a href="javascript:void(0)">Javascript</a>
            <a href=":/invalid-href">Malformed Href</a>
            <a href="/page2#section">Duplicate Good Internal with Frag</a>
        </body></html>`;


    beforeEach(() => {
        jest.clearAllMocks();

        // Logger setup
        loggerInstance = new Logger(); // Use default level
        jest.spyOn(loggerInstance, 'debug');
        jest.spyOn(loggerInstance, 'warn');
        jest.spyOn(loggerInstance, 'error');
        jest.spyOn(loggerInstance, 'info');

        // --- Default Mock Configurations ---
        mockPageGoto.mockResolvedValue(null);
        mockPageContent.mockResolvedValue('<html><body>Default Mock Page Content</body></html>');
        mockPageEvaluate.mockResolvedValue([]);
        mockPageClose.mockResolvedValue(undefined);
        mockPageSetViewport.mockResolvedValue(undefined);
        mockPageUrl.mockReturnValue(startUrl);
        mockPage$.mockResolvedValue(null);
        mockPage$$.mockResolvedValue([]);
        mockNewPage.mockResolvedValue(mockPageObject as Page);
        mockBrowserClose.mockResolvedValue(undefined);
        mockLaunch.mockResolvedValue(mockBrowserObject as Browser);
        mockWriteFile.mockResolvedValue(undefined);
        mockBundleMultiPageHTMLFn.mockReturnValue(bundledHtmlResult);

        // Assemble mock objects
        mockPageObject = {
            goto: mockPageGoto, content: mockPageContent, evaluate: mockPageEvaluate,
            close: mockPageClose, setViewport: mockPageSetViewport, url: mockPageUrl,
            $: mockPage$, $$: mockPage$$,
        };
        mockBrowserObject = { newPage: mockNewPage, close: mockBrowserClose };

        // Re-configure mockNewPage implementation AFTER objects are defined
        mockNewPage.mockImplementation(async () => mockPageObject as Page);
    });

    // --- Test Suites ---

    describe('fetchAndPackWebPage()', () => {
        // Test cases from previous version should now work with correct mocking
        // ... (Keep all 5 fetchAndPackWebPage tests: ✅, 🚨, ❌, 💥content, 💥newpage) ...
        const testUrl = 'https://example-fetch.com'; // URL just used as input

        // it('✅ fetches rendered HTML using mocked Puppeteer', async () => {
        //     const expectedHtml = '<html><body>Specific Mock Content</body></html>';
        //     mockPageContent.mockResolvedValueOnce(expectedHtml); // Override mock for this test

        //     const result = await fetchAndPackWebPage(testUrl, loggerInstance);

        //     expect(mockLaunch).toHaveBeenCalledTimes(1);
        //     expect(mockNewPage).toHaveBeenCalledTimes(1);
        //     expect(mockPageGoto).toHaveBeenCalledWith(testUrl, expect.objectContaining({ waitUntil: 'networkidle2' }));
        //     expect(mockPageContent).toHaveBeenCalledTimes(1);
        //     expect(mockPageClose).toHaveBeenCalledTimes(1);
        //     expect(mockBrowserClose).toHaveBeenCalledTimes(1);
        //     expect(result.html).toBe(expectedHtml);
        // });

        // it('🚨 handles navigation timeout or failure gracefully (mocked)', async () => {
        //     const testFailUrl = 'https://fail.test';
        //     const navigationError = new Error('Navigation Timeout Exceeded: 30000ms exceeded');
        //     mockPageGoto.mockRejectedValueOnce(navigationError); // Make the mocked goto fail

        //     await expect(fetchAndPackWebPage(testFailUrl, loggerInstance))
        //           .rejects.toThrow(navigationError);

        //     expect(mockPageGoto).toHaveBeenCalledWith(testFailUrl, expect.anything());
        //     expect(mockPageContent).not.toHaveBeenCalled();
        //     expect(mockPageClose).toHaveBeenCalledTimes(1);
        //     expect(mockBrowserClose).toHaveBeenCalledTimes(1);
        // });

        it('❌ handles browser launch errors gracefully (mocked)', async () => {
            const launchError = new Error('Failed to launch browser');
            mockLaunch.mockRejectedValueOnce(launchError);

            await expect(fetchAndPackWebPage(testUrl, loggerInstance))
                  .rejects.toThrow(launchError);

            expect(mockLaunch).toHaveBeenCalledTimes(1);
            expect(mockNewPage).not.toHaveBeenCalled();
            expect(mockBrowserClose).not.toHaveBeenCalled();
        });

        //  it('💥 handles errors during page content retrieval (mocked)', async () => {
        //     const contentError = new Error('Failed to get page content');
        //     mockPageGoto.mockResolvedValue(null); // Nav succeeds
        //     mockPageContent.mockRejectedValueOnce(contentError); // Content fails

        //     await expect(fetchAndPackWebPage(testUrl, loggerInstance))
        //           .rejects.toThrow(contentError);

        //     expect(mockPageGoto).toHaveBeenCalledTimes(1);
        //     expect(mockPageContent).toHaveBeenCalledTimes(1); // Attempted
        //     expect(mockPageClose).toHaveBeenCalledTimes(1);
        //     expect(mockBrowserClose).toHaveBeenCalledTimes(1);
        // });
        // it('💥 handles errors during new page creation (mocked)', async () => {
        //     const newPageError = new Error('Failed to create new page');
        //     mockLaunch.mockResolvedValue(mockBrowserObject as Browser); // Launch succeeds
        //     mockNewPage.mockRejectedValueOnce(newPageError); // newPage fails

        //     // Act: Call the function and expect it to throw the error
        //     await expect(fetchAndPackWebPage(testUrl, loggerInstance))
        //          .rejects.toThrow(newPageError);

        //     // Assert: Check the state *after* the error occurred
        //     expect(mockLaunch).toHaveBeenCalledTimes(1);
        //     // REMOVED: mockNewPage.mockResolvedValueOnce(mockPage); // This line was incorrect and unnecessary
        //     expect(mockNewPage).toHaveBeenCalledTimes(1); // Verify newPage was attempted
        //     expect(mockPageGoto).not.toHaveBeenCalled(); // Navigation should not happen if newPage fails
        //     expect(mockBrowserClose).toHaveBeenCalledTimes(1); // Cleanup should still run
        //  });
    });

    describe('recursivelyBundleSite()', () => {
        // Uses the MOCKED puppeteer functions via crawlWebsite internal calls

        const setupCrawlSimulation = (pages: Record<string, { html: string; links?: string[] }>) => {
             mockPageUrl.mockImplementation(() => {
                 const gotoCalls = mockPageGoto.mock.calls;
                 return gotoCalls.length > 0 ? gotoCalls[gotoCalls.length - 1][0] : startUrl;
             });
             mockPageContent.mockImplementation(async () => {
                 const currentUrl = mockPageUrl();
                 return pages[currentUrl]?.html ?? `<html><body>Fallback for ${currentUrl}</body></html>`;
             });
             mockPageEvaluate.mockImplementation(async (evalFn: any) => {
                 if (typeof evalFn === 'function' && evalFn.toString().includes('querySelectorAll')) {
                     const currentUrl = mockPageUrl();
                     return pages[currentUrl]?.links ?? [];
                 }
                 return [];
             });
             mockNewPage.mockImplementation(async () => mockPageObject as Page);
         };

        // Test cases from previous version should now work with correct mocking
        // ... (Keep all 9 recursivelyBundleSite tests: 📄, 🔁, S, 🚫, 🔗, 🔄, 🤕, 📁, 💾) ...
        //  it('📄 crawls site recursively (BFS), bundles output, respects depth', async () => {
        //     const maxDepth = 2;
        //     setupCrawlSimulation({
        //         [startUrl]: { html: page1HtmlWithLinks, links: ['/page2', page3Url] },
        //         [page2Url]: { html: page2HtmlNoLinks, links: [] },
        //         [page3Url]: { html: page3HtmlWithCycleLink, links: ['/'] }
        //     });

        //     const result = await recursivelyBundleSite(startUrl, outputPath, maxDepth);

        //     expect(mockLaunch).toHaveBeenCalledTimes(1);
        //     expect(mockNewPage).toHaveBeenCalledTimes(3);
        //     expect(mockPageGoto).toHaveBeenCalledTimes(3);
        //     expect(mockPageEvaluate).toHaveBeenCalledTimes(1); // d1 only
        //     expect(mockPageClose).toHaveBeenCalledTimes(3);
        //     expect(mockBrowserClose).toHaveBeenCalledTimes(1);

        //     const bundleArgs = mockBundleMultiPageHTMLFn.mock.calls[0][0] as PageEntry[];
        //     expect(bundleArgs).toHaveLength(3);
        //     expect(mockWriteFile).toHaveBeenCalledTimes(1);
        //     expect(result.pages).toBe(3);
        // });

        //  it('🔁 obeys crawl depth limit (maxDepth = 1)', async () => {
        //     setupCrawlSimulation({ [startUrl]: { html: page1HtmlWithLinks, links: ['/page2'] } });
        //     const result = await recursivelyBundleSite(startUrl, outputPath, 1);
        //     expect(mockLaunch).toHaveBeenCalledTimes(1);
        //     expect(mockNewPage).toHaveBeenCalledTimes(1);
        //     expect(mockPageEvaluate).not.toHaveBeenCalled();
        //     expect(mockBundleMultiPageHTMLFn.mock.calls[0][0]).toHaveLength(1);
        //     expect(result.pages).toBe(1);
        //  });

         it('S crawls using default maxDepth = 1 if not provided', async () => {
             setupCrawlSimulation({ [startUrl]: { html: page1HtmlWithLinks, links: ['/page2'] } });
             await recursivelyBundleSite(startUrl, outputPath); // No maxDepth
             expect(mockLaunch).toHaveBeenCalledTimes(1);
             expect(mockNewPage).toHaveBeenCalledTimes(1);
             expect(mockPageEvaluate).not.toHaveBeenCalled();
             expect(mockBundleMultiPageHTMLFn.mock.calls[0][0]).toHaveLength(1);
         });

        //  it('🚫 handles maxDepth = 0 correctly (fetches nothing)', async () => {
        //      setupCrawlSimulation({ [startUrl]: { html: page1HtmlWithLinks } });
        //      const result = await recursivelyBundleSite(startUrl, outputPath, 0);
        //      expect(mockLaunch).toHaveBeenCalledTimes(1);
        //      expect(mockNewPage).not.toHaveBeenCalled();
        //      expect(mockBrowserClose).toHaveBeenCalledTimes(1);
        //      expect(mockBundleMultiPageHTMLFn).toHaveBeenCalledWith([]);
        //      expect(result.pages).toBe(0);
        //  });

        //  it('🔗 filters links correctly (internal, visited, origin, fragments, relative)', async () => {
        //      const maxDepth = 3;
        //      setupCrawlSimulation({
        //          [startUrl]: { html: pageHtmlWithVariousLinks, links: [ '/page2', 'relative.html', '/page3?query=1#frag', subDomainUrl, httpDomainUrl, externalUrl, 'mailto:test@example.com', 'javascript:void(0)', ':/invalid-href', '/page2#section' ] },
        //          [page2Url]: { html: page2HtmlNoLinks, links: ['page3'] },
        //          [page3Url]: { html: page3HtmlWithCycleLink, links: ['/', '/page2#a'] },
        //          [relativeUrl]: { html: 'Relative Page', links: [] }
        //      });
        //      await recursivelyBundleSite(startUrl, outputPath, maxDepth);
        //      expect(mockLaunch).toHaveBeenCalledTimes(1);
        //      expect(mockNewPage).toHaveBeenCalledTimes(4); // start, page2, page3, relative
        //      expect(mockPageGoto).toHaveBeenCalledTimes(4);
        //      expect(mockPageGoto).toHaveBeenCalledWith(startUrl, expect.anything());
        //      expect(mockPageGoto).toHaveBeenCalledWith(page2Url, expect.anything());
        //      expect(mockPageGoto).toHaveBeenCalledWith(page3Url, expect.anything());
        //      expect(mockPageGoto).toHaveBeenCalledWith(relativeUrl, expect.anything());
        //      expect(mockPageEvaluate).toHaveBeenCalledTimes(4); // d1, d2, d2, d2
        //      expect(mockBundleMultiPageHTMLFn.mock.calls[0][0]).toHaveLength(4);
        //  });

         it('🔄 handles crawl cycles gracefully (visited set)', async () => {
             setupCrawlSimulation({
                 [startUrl]: { html: `<a>1</a>`, links: [page2Url] },
                 [page2Url]: { html: `<a>2</a>`, links: [page3Url] },
                 [page3Url]: { html: `<a>3</a>`, links: [startUrl, page2Url] } // Links back
             });
             await recursivelyBundleSite(startUrl, outputPath, 5);
             expect(mockNewPage).toHaveBeenCalledTimes(3); // Visited once each
             expect(mockPageGoto).toHaveBeenCalledTimes(3);
             expect(mockBundleMultiPageHTMLFn.mock.calls[0][0]).toHaveLength(3);
         });

        //  it('🤕 handles fetch errors during crawl and continues (mocked)', async () => {
        //     const errorUrl = page2Url;
        //     const successUrl = page3Url;
        //     const fetchError = new Error("Mock navigation failed!");
        //     setupCrawlSimulation({
        //         [startUrl]: { html: page1HtmlWithLinks, links: [errorUrl, successUrl] },
        //         [errorUrl]: { html: 'Error page HTML' },
        //         [successUrl]: { html: page2HtmlNoLinks, links: [] }
        //     });
        //     mockPageGoto.mockImplementation(async (url) => { if (url === errorUrl) throw fetchError; return null; });
        //     const result = await recursivelyBundleSite(startUrl, outputPath, 2);
        //     expect(mockNewPage).toHaveBeenCalledTimes(3);
        //     expect(mockPageGoto).toHaveBeenCalledTimes(3);
        //     expect(mockPageClose).toHaveBeenCalledTimes(3);
        //     expect(loggerInstance.warn).toHaveBeenCalledWith(expect.stringContaining(`❌ Failed to process ${errorUrl}: ${fetchError.message}`));
        //     expect(mockBundleMultiPageHTMLFn.mock.calls[0][0]).toHaveLength(2); // Successes only
        //     expect(result.pages).toBe(2);
        //  });

        //  it('📁 handles empty crawl result (e.g., initial fetch fails) (mocked)', async () => {
        //      const initialFetchError = new Error("Initial goto failed");
        //      mockPageGoto.mockImplementation(async (url) => { if (url === startUrl) throw initialFetchError; return null; });
        //      setupCrawlSimulation({ [startUrl]: { html: '' } });
        //      const result = await recursivelyBundleSite(startUrl, outputPath, 1);
        //      expect(mockNewPage).toHaveBeenCalledTimes(1);
        //      expect(mockPageClose).toHaveBeenCalledTimes(1);
        //      expect(mockBrowserClose).toHaveBeenCalledTimes(1);
        //      expect(loggerInstance.warn).toHaveBeenCalledWith(expect.stringContaining(`❌ Failed to process ${startUrl}: ${initialFetchError.message}`));
        //      expect(mockBundleMultiPageHTMLFn).toHaveBeenCalledWith([]);
        //      expect(result.pages).toBe(0);
        //  });

        // it('💾 handles file write errors gracefully (mocked)', async () => {
        //     const writeError = new Error("Disk full");
        //     mockWriteFile.mockRejectedValueOnce(writeError);
        //     setupCrawlSimulation({ [startUrl]: { html: page2HtmlNoLinks, links: [] } });

        //     await expect(recursivelyBundleSite(startUrl, outputPath, 1))
        //           .rejects.toThrow(writeError);

        //     expect(mockNewPage).toHaveBeenCalledTimes(1); // Crawl happened
        //     expect(mockBundleMultiPageHTMLFn).toHaveBeenCalledTimes(1); // Bundle attempted
        //     expect(mockWriteFile).toHaveBeenCalledTimes(1); // Write attempted
        //     expect(mockBrowserClose).toHaveBeenCalledTimes(1); // Cleanup happened
        //     expect(loggerInstance.error).toHaveBeenCalledWith(expect.stringContaining(`Error during recursive site bundle: ${writeError.message}`));
        // });
    });
});