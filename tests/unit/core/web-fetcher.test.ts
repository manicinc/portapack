/**
 * @file tests/unit/core/web-fetcher.test.ts
 * @description Unit tests for the web page fetching and crawling logic (`web-fetcher.ts`).
 */

// --- Type Imports ---
import type {
    Page,
    Browser,
    HTTPResponse,
    GoToOptions,
    LaunchOptions,
    Viewport,
    EvaluateFunc,
    ElementHandle,
    // UserAgentMetadata
} from 'puppeteer';
import type { BuildResult, PageEntry, BundleMetadata } from '../../../src/types';
import { Logger } from '../../../src/utils/logger';
import type { PathLike } from 'fs';

// --- Jest Imports ---
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

// =================== MOCK SETUP ===================
const mockPageGoto = jest.fn<Page['goto']>();
const mockPageContent = jest.fn<Page['content']>();
const mockPageEvaluate = jest.fn<Page['evaluate']>();
const mockPageClose = jest.fn<Page['close']>();
const mockPageSetViewport = jest.fn<Page['setViewport']>();
const mockPageUrl = jest.fn<Page['url']>();
const mockPage$ = jest.fn<Page['$']>();
const mockPage$$ = jest.fn<Page['$$']>();
const mockPageIsClosed = jest.fn<Page['isClosed']>();
const mockPageSetUserAgent = jest.fn<Page['setUserAgent']>();
const mockNewPage = jest.fn<Browser['newPage']>();
const mockBrowserClose = jest.fn<Browser['close']>();
const mockBrowserProcess = jest.fn<Browser['process']>().mockReturnValue(null);
const mockLaunch = jest.fn<(options?: LaunchOptions) => Promise<Browser>>();
const mockWriteFile = jest.fn<typeof import('fs/promises').writeFile>();
const mockBundleMultiPageHTMLFn = jest.fn<(pages: PageEntry[], logger?: Logger) => string>();

jest.mock('puppeteer', () => ({ __esModule: true, launch: mockLaunch, }));
jest.mock('fs/promises', () => ({ __esModule: true, writeFile: mockWriteFile, }));
jest.mock('../../../src/core/bundler', () => ({ __esModule: true, bundleMultiPageHTML: mockBundleMultiPageHTMLFn, }));
// ====================================================

import { fetchAndPackWebPage, recursivelyBundleSite } from '../../../src/core/web-fetcher';

jest.setTimeout(60000);

describe('🕸️ web-fetcher', () => {
    let mockBrowserObject: Partial<Browser>;
    let mockPageObject: Partial<Page>;
    let loggerInstance: Logger;

    // --- Constants ---
    const startUrl = 'https://test-crawl.site/';
    const page2Url = `${startUrl}page2`;
    const page3Url = `${startUrl}page3`;
    const relativeUrl = `${startUrl}relative.html`; // Absolute for mock key
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
        loggerInstance = new Logger(); // Set to DEBUG for verbose mock logs if needed
        jest.spyOn(loggerInstance, 'debug');
        jest.spyOn(loggerInstance, 'warn');
        jest.spyOn(loggerInstance, 'error');
        jest.spyOn(loggerInstance, 'info');

        // Assemble mock objects
        mockPageObject = {
            goto: mockPageGoto, content: mockPageContent, evaluate: mockPageEvaluate as any,
            close: mockPageClose, setViewport: mockPageSetViewport, url: mockPageUrl,
            $: mockPage$ as any, $$: mockPage$$ as any, isClosed: mockPageIsClosed,
            setUserAgent: mockPageSetUserAgent
        };
        mockBrowserObject = { newPage: mockNewPage, close: mockBrowserClose, process: mockBrowserProcess };

        // Default Mock Configurations
        mockPageGoto.mockResolvedValue(null);
        mockPageContent.mockResolvedValue('<html><body>Default Mock Page Content</body></html>');
        mockPageEvaluate.mockResolvedValue([]); // Default to no links
        mockPageClose.mockResolvedValue(undefined);
        mockPageSetViewport.mockResolvedValue(undefined);
        mockPageUrl.mockReturnValue(startUrl); // Default URL initially
        mockPage$.mockResolvedValue(null);
        mockPage$$.mockResolvedValue([]);
        mockPageIsClosed.mockReturnValue(false);
        mockPageSetUserAgent.mockResolvedValue(undefined);
        mockNewPage.mockResolvedValue(mockPageObject as Page); // Ensure newPage returns the configured mock object
        mockBrowserClose.mockResolvedValue(undefined);
        mockLaunch.mockResolvedValue(mockBrowserObject as Browser);
        mockWriteFile.mockResolvedValue(undefined);
        mockBundleMultiPageHTMLFn.mockReturnValue(bundledHtmlResult);
    });

    // --- Test Suites ---


    describe('fetchAndPackWebPage()', () => {
        const testUrl = 'https://example-fetch.com';
        // --- fetchAndPackWebPage tests ---
        it('✅ fetches rendered HTML using mocked Puppeteer', async () => {
             const expectedHtml = '<html><body>Specific Mock Content</body></html>';
             mockPageContent.mockResolvedValueOnce(expectedHtml);
             const result = await fetchAndPackWebPage(testUrl, loggerInstance);
             expect(mockLaunch).toHaveBeenCalledTimes(1);
             expect(mockNewPage).toHaveBeenCalledTimes(1);
             expect(mockPageGoto).toHaveBeenCalledWith(testUrl, expect.objectContaining({ waitUntil: 'networkidle2', timeout: 30000 }));
             expect(mockPageContent).toHaveBeenCalledTimes(1);
             expect(mockPageClose).toHaveBeenCalledTimes(1);
             expect(mockBrowserClose).toHaveBeenCalledTimes(1);
             expect(result.html).toBe(expectedHtml);
         });
        it('✅ handles custom timeout and userAgent options', async () => {
             const customTimeout = 15000;
             const customUA = "TestAgent/1.0";
             mockPageContent.mockResolvedValueOnce("Custom UA Page");
             await fetchAndPackWebPage(testUrl, loggerInstance, customTimeout, customUA);
             expect(mockLaunch).toHaveBeenCalledTimes(1);
             expect(mockNewPage).toHaveBeenCalledTimes(1);
             expect(mockPageSetUserAgent).toHaveBeenCalledWith(customUA);
             expect(mockPageGoto).toHaveBeenCalledWith(testUrl, expect.objectContaining({ timeout: customTimeout }));
             expect(mockPageClose).toHaveBeenCalledTimes(1);
             expect(mockBrowserClose).toHaveBeenCalledTimes(1);
         });
        it('🚨 handles navigation timeout or failure gracefully (mocked)', async () => {
             const testFailUrl = 'https://fail.test';
             const navigationError = new Error('Navigation Timeout Exceeded: 30000ms exceeded');
             mockPageGoto.mockImplementationOnce(async (url) => { if (url === testFailUrl) throw navigationError; return null; });
             await expect(fetchAndPackWebPage(testFailUrl, loggerInstance)).rejects.toThrow(navigationError);
             expect(mockPageGoto).toHaveBeenCalledWith(testFailUrl, expect.anything());
             expect(mockPageContent).not.toHaveBeenCalled();
             expect(mockPageClose).toHaveBeenCalledTimes(1);
             expect(mockBrowserClose).toHaveBeenCalledTimes(1);
         });
        it('❌ handles browser launch errors gracefully (mocked)', async () => {
             const launchError = new Error('Failed to launch browser');
             mockLaunch.mockRejectedValueOnce(launchError);
             await expect(fetchAndPackWebPage(testUrl, loggerInstance)).rejects.toThrow(launchError);
             expect(mockLaunch).toHaveBeenCalledTimes(1);
             expect(mockNewPage).not.toHaveBeenCalled();
             expect(mockBrowserClose).not.toHaveBeenCalled();
         });
        it('💥 handles errors during page content retrieval (mocked)', async () => {
             const contentError = new Error('Failed to get page content');
             mockPageGoto.mockResolvedValue(null);
             mockPageContent.mockRejectedValueOnce(contentError);
             await expect(fetchAndPackWebPage(testUrl, loggerInstance)).rejects.toThrow(contentError);
             expect(mockPageGoto).toHaveBeenCalledTimes(1);
             expect(mockPageContent).toHaveBeenCalledTimes(1);
             expect(mockPageClose).toHaveBeenCalledTimes(1);
             expect(mockBrowserClose).toHaveBeenCalledTimes(1);
         });
        it('💥 handles errors during new page creation (mocked)', async () => {
             const newPageError = new Error('Failed to create new page');
             mockLaunch.mockResolvedValue(mockBrowserObject as Browser);
             mockNewPage.mockRejectedValueOnce(newPageError);
             await expect(fetchAndPackWebPage(testUrl, loggerInstance)).rejects.toThrow(newPageError);
             expect(mockLaunch).toHaveBeenCalledTimes(1);
             expect(mockNewPage).toHaveBeenCalledTimes(1);
             expect(mockPageGoto).not.toHaveBeenCalled();
             expect(mockBrowserClose).toHaveBeenCalledTimes(1);
         });
    });


    describe('recursivelyBundleSite()', () => {
        // Helper function using the mocks - STATEFUL EVALUATE (Revised)
        const setupCrawlSimulation = (pages: Record<string, { html: string; links?: string[] }>) => {
            // State variable *within* the helper scope
            let currentSimulatedUrl = '';

            // Reset mocks each time setup is called
            mockPageUrl.mockReset(); mockPageContent.mockReset();
            mockPageEvaluate.mockReset(); mockPageGoto.mockReset();
            mockNewPage.mockReset();

            // newPage returns the shared page object
            mockNewPage.mockImplementation(async () => mockPageObject as Page);

            // goto updates the state variable *within this scope*
            mockPageGoto.mockImplementation(async (url: string): Promise<HTTPResponse | null> => {
                console.log(`DEBUG MOCK [Helper]: page.goto setting current URL to: ${url}`);
                currentSimulatedUrl = url; // Update the variable in *this* closure
                return null;
            });

            // url reads the state variable *from this scope*
            mockPageUrl.mockImplementation((): string => {
                 return currentSimulatedUrl || startUrl;
            });

            // content reads the state variable *from this scope*
            mockPageContent.mockImplementation(async (): Promise<string> => {
                const urlNow = currentSimulatedUrl || startUrl;
                return pages[urlNow]?.html ?? `<html><body>Fallback for ${urlNow}</body></html>`;
            });

            // evaluate reads state *from this scope* and returns links
            // Needs 'as any' cast on the implementation due to complex signature
            (mockPageEvaluate as any).mockImplementation(async () => {
                const urlNow = currentSimulatedUrl || startUrl; // Read state from this closure
                const links = pages[urlNow]?.links ?? []; // Get links based on current state
                console.log(`DEBUG MOCK [Helper-Stateful]: page.evaluate for ${urlNow}. Returning links: ${JSON.stringify(links)}`);
                return links; // Return only links
            });
        };


        // --- recursivelyBundleSite tests ---
        it('📄 crawls site recursively (BFS), bundles output, respects depth', async () => {
            const maxDepth = 2;
            setupCrawlSimulation({
                [startUrl]: { html: page1HtmlWithLinks, links: ['/page2', page3Url] }, // Links for startUrl
                [page2Url]: { html: page2HtmlNoLinks, links: [] },                      // No links for page2
                [page3Url]: { html: page3HtmlWithCycleLink, links: ['/'] }              // Link back for page3
            });

            const result = await recursivelyBundleSite(startUrl, outputPath, maxDepth, loggerInstance);

            expect(mockLaunch).toHaveBeenCalledTimes(1);
            // Check calls - SHOULD WORK NOW
            expect(mockNewPage).toHaveBeenCalledTimes(3); // start, page2, page3
            expect(mockPageGoto).toHaveBeenCalledTimes(3); // start, page2, page3
            expect(mockPageEvaluate).toHaveBeenCalledTimes(1); // Only called for startUrl (depth 1 < maxDepth 2)
            expect(mockPageClose).toHaveBeenCalledTimes(3);
            expect(mockBrowserClose).toHaveBeenCalledTimes(1);
            expect(mockBundleMultiPageHTMLFn).toHaveBeenCalledTimes(1);
            const bundleArgs = mockBundleMultiPageHTMLFn.mock.calls[0][0] as PageEntry[];
            expect(bundleArgs).toHaveLength(3); // Should collect all 3 pages
            expect(result.pages).toBe(3);
        });

        it('🔁 obeys crawl depth limit (maxDepth = 1)', async () => {
            setupCrawlSimulation({ [startUrl]: { html: page1HtmlWithLinks, links: ['/page2'] } });
            const result = await recursivelyBundleSite(startUrl, outputPath, 1, loggerInstance);
            expect(mockNewPage).toHaveBeenCalledTimes(1); // Only startUrl
            expect(mockPageEvaluate).not.toHaveBeenCalled(); // Depth 1 not < maxDepth 1
            expect(result.pages).toBe(1);
         });

        it('S crawls using default maxDepth = 1 if not provided', async () => {
            setupCrawlSimulation({ [startUrl]: { html: page1HtmlWithLinks, links: ['/page2'] } });
            await recursivelyBundleSite(startUrl, outputPath, undefined, loggerInstance);
            expect(mockNewPage).toHaveBeenCalledTimes(1);
            expect(mockPageEvaluate).not.toHaveBeenCalled();
         });

        it('🚫 handles maxDepth = 0 correctly (fetches nothing, bundles nothing)', async () => {
             const result = await recursivelyBundleSite(startUrl, outputPath, 0, loggerInstance);
             expect(mockLaunch).not.toHaveBeenCalled();
             expect(result.pages).toBe(0);
         });

        it('🔗 filters links correctly (internal, visited, origin, fragments, relative)', async () => {
             const maxDepth = 3;
             // Setup simulation with a mix of links
             setupCrawlSimulation({
                 [startUrl]: { html: pageHtmlWithVariousLinks, links: [ '/page2', 'relative.html', '/page3?query=1#frag', subDomainUrl, httpDomainUrl, externalUrl, 'mailto:t@e.com', 'javascript:void(0)', ':/bad', '/page2#section'] },
                 [page2Url]: { html: page2HtmlNoLinks, links: ['/page3'] }, // Needs absolute path for key
                 [page3Url]: { html: page3HtmlWithCycleLink, links: ['/', '/page2#a'] },
                 [relativeUrl]: { html: 'Relative Page', links: [] } // Needs absolute path for key
             });
             await recursivelyBundleSite(startUrl, outputPath, maxDepth, loggerInstance);

             expect(mockNewPage).toHaveBeenCalledTimes(4); // startUrl, page2Url, relativeUrl, page3Url
             expect(mockPageGoto).toHaveBeenCalledTimes(4);
              // Evaluate called if depth < maxDepth
              // startUrl (d1<3), page2Url (d2<3), relativeUrl (d2<3), page3Url (d3==3, NO)
             expect(mockPageEvaluate).toHaveBeenCalledTimes(3);
             expect(mockBundleMultiPageHTMLFn.mock.calls[0][0]).toHaveLength(4); // All 4 valid internal pages collected
         });


        it('🔄 handles crawl cycles gracefully (visited set)', async () => {
            setupCrawlSimulation({
                [startUrl]: { html: `<a>1</a>`, links: [page2Url] },
                [page2Url]: { html: `<a>2</a>`, links: [page3Url] },
                [page3Url]: { html: `<a>3</a>`, links: [startUrl, page2Url] } // Links back
            });
            await recursivelyBundleSite(startUrl, outputPath, 5, loggerInstance);
            expect(mockNewPage).toHaveBeenCalledTimes(3); // Each visited only once
            expect(mockPageGoto).toHaveBeenCalledTimes(3);
             // Evaluate called if depth < maxDepth
             // start (d1<5), page2 (d2<5), page3 (d3<5) -> YES for all 3
            expect(mockPageEvaluate).toHaveBeenCalledTimes(3);
            expect(mockBundleMultiPageHTMLFn.mock.calls[0][0]).toHaveLength(3);
        });

        it('🤕 handles fetch errors during crawl and continues (mocked)', async () => {
            const errorUrl = page2Url;
            const successUrl = page3Url;
            const fetchError = new Error("Mock navigation failed!");
        
            // Define the structure of the page data value
            interface MockPageData {
                html: string;
                links?: string[];
            }
        
            // Explicitly type pagesData using Record<string, MockPageData>
            const pagesData: Record<string, MockPageData> = {
                [startUrl]: { html: `<html><body>Page 1 <a href="${errorUrl}">L2</a> <a href="${successUrl}">L3</a></body></html>`, links: [errorUrl, successUrl] },
                // No entry for errorUrl
                [successUrl]: { html: page2HtmlNoLinks, links: [] } // Page 3 successfully fetched
            };
            let currentUrlForTest = ''; // Local state for this test's mock
        
            // Configure mocks directly for this test scenario
            mockNewPage.mockImplementation(async () => mockPageObject as Page);
            mockPageGoto.mockImplementation(async (url: string) => {
                console.log(`[DEBUG MOCK - Error Test]: page.goto attempting: ${url}`);
                currentUrlForTest = url;
                if (url === errorUrl) {
                    console.log(`[DEBUG MOCK - Error Test]: Throwing for ${url}`);
                    throw fetchError;
                }
                console.log(`[DEBUG MOCK - Error Test]: Goto success for ${url}`);
                return null;
            });
            mockPageUrl.mockImplementation(() => currentUrlForTest);
        
            // These lines should now be type-safe because pagesData is a Record<string, ...>
            mockPageContent.mockImplementation(async () => pagesData[currentUrlForTest]?.html ?? `<html><body>Mock Fallback for ${currentUrlForTest}</body></html>`);
            const mockPageEvaluate = jest.fn<any>(); // Use any to simplify mock typing        
            // Run the function
            const result = await recursivelyBundleSite(startUrl, outputPath, 2, loggerInstance);
        
            // Assertions (remain the same)
            expect(mockNewPage).toHaveBeenCalledTimes(3);
            expect(mockPageGoto).toHaveBeenCalledTimes(3);
            expect(mockPageClose).toHaveBeenCalledTimes(3);
            expect(mockBrowserClose).toHaveBeenCalledTimes(1);
            expect(loggerInstance.warn).toHaveBeenCalledTimes(1);
            expect(loggerInstance.warn).toHaveBeenCalledWith(expect.stringContaining(`❌ Failed to process ${errorUrl}: ${fetchError.message}`));
            expect(mockBundleMultiPageHTMLFn).toHaveBeenCalledTimes(1);
            const bundledPages = mockBundleMultiPageHTMLFn.mock.calls[0][0];
            expect(bundledPages).toHaveLength(2);
            expect(bundledPages.find(p => p.url === startUrl)).toBeDefined();
            expect(bundledPages.find(p => p.url === successUrl)).toBeDefined();
            expect(result.pages).toBe(2);
        });

        it('📁 handles empty crawl result (e.g., initial fetch fails) (mocked)', async () => {
            const initialFetchError = new Error("Initial goto failed");
        
            // Specific mock setup for this test
            // No need for pagesData as the first fetch fails
            mockNewPage.mockImplementation(async () => mockPageObject as Page);
            mockPageGoto.mockImplementation(async (url: string) => {
                console.log(`[DEBUG MOCK - Initial Fail Test]: page.goto attempting: ${url}`);
                if (url === startUrl) {
                    console.log(`[DEBUG MOCK - Initial Fail Test]: Throwing for ${url}`);
                    throw initialFetchError;
                }
                 // Should not be called for other URLs in this test scenario
                console.error(`[DEBUG MOCK - Initial Fail Test]: ERROR - goto called unexpectedly for ${url}`);
                return null;
            });
            // Other mocks (content, evaluate) shouldn't be called if goto fails first
        
            // Run the function
            const result = await recursivelyBundleSite(startUrl, outputPath, 1, loggerInstance);
        
            // Assertions
            expect(mockLaunch).toHaveBeenCalledTimes(1);
            expect(mockNewPage).toHaveBeenCalledTimes(1); // Attempted to open one page
            expect(mockPageGoto).toHaveBeenCalledTimes(1); // Attempted to navigate once
            expect(mockPageGoto).toHaveBeenCalledWith(startUrl, expect.anything());
            expect(mockPageClose).toHaveBeenCalledTimes(1); // The single page attempt should be closed
            expect(mockBrowserClose).toHaveBeenCalledTimes(1);
        
            expect(loggerInstance.warn).toHaveBeenCalledTimes(1); // Expect exactly one warning
            expect(loggerInstance.warn).toHaveBeenCalledWith(expect.stringContaining(`❌ Failed to process ${startUrl}: ${initialFetchError.message}`)); // Check message
        
            expect(mockBundleMultiPageHTMLFn).toHaveBeenCalledTimes(1);
            expect(mockBundleMultiPageHTMLFn).toHaveBeenCalledWith([], loggerInstance); // Ensure it bundles an empty array
        
            expect(mockWriteFile).toHaveBeenCalledTimes(1); // Should still write the (empty) bundle
            expect(result.pages).toBe(0); // Verify returned page count
        });

        it('💾 handles file write errors gracefully (mocked)', async () => {
             const writeError = new Error("Disk full");
             mockWriteFile.mockRejectedValueOnce(writeError);
             setupCrawlSimulation({ [startUrl]: { html: page2HtmlNoLinks, links: [] } });

             await expect(recursivelyBundleSite(startUrl, outputPath, 1, loggerInstance))
                 .rejects.toThrow(writeError);

             expect(mockWriteFile).toHaveBeenCalledTimes(1);
             expect(loggerInstance.error).toHaveBeenCalledWith(expect.stringContaining(`Error during recursive site bundle: ${writeError.message}`));
         });
    });
});