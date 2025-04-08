/**
 * @file bundler.test.ts
 * @description Unit tests for HTML bundling logic (single and multi-page).
 */

import path from 'path';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import * as cheerio from 'cheerio';
import { Logger } from '../../../src/utils/logger.js';
import { LogLevel } from '../../../src/types.js';
import type { ParsedHTML, PageEntry, BundleOptions } from '../../../src/types.js';
import type { Mock } from 'jest-mock';

// === Mocked Modules ===
jest.unstable_mockModule('../../../src/core/extractor.js', () => ({
  extractAssets: jest.fn(),
}));
jest.unstable_mockModule('../../../src/core/minifier.js', () => ({
  minifyAssets: jest.fn(),
}));
jest.unstable_mockModule('../../../src/core/packer.js', () => ({
  packHTML: jest.fn(),
}));

// === Import After Mock Setup ===
const { extractAssets } = await import('../../../src/core/extractor.js');
const { minifyAssets } = await import('../../../src/core/minifier.js');
const { packHTML } = await import('../../../src/core/packer.js');
const { bundleSingleHTML, bundleMultiPageHTML } = await import('../../../src/core/bundler.js');


type ExtractAssetsFn = (parsed: ParsedHTML, embed: boolean, baseUrl: string, logger: Logger) => Promise<ParsedHTML>;
type MinifyAssetsFn = (parsed: ParsedHTML, opts: BundleOptions, logger: Logger) => Promise<ParsedHTML>;
type PackHTMLFn = (parsed: ParsedHTML, logger: Logger) => string;


// === Type Casted Mocks ===
const mockedExtractAssets = extractAssets as Mock<ExtractAssetsFn>;
const mockedMinifyAssets = minifyAssets as Mock<MinifyAssetsFn>;
const mockedPackHTML = packHTML as Mock<PackHTMLFn>;


describe('🧩 Core Bundler', () => {
  let mockLogger: Logger;
  let mockLoggerDebugSpy: ReturnType<typeof jest.spyOn>;
  let mockLoggerInfoSpy: ReturnType<typeof jest.spyOn>;
  let mockLoggerErrorSpy: ReturnType<typeof jest.spyOn>;
  let mockLoggerWarnSpy: ReturnType<typeof jest.spyOn>;

  const defaultParsed: ParsedHTML = {
    htmlContent: '<html><head><link href="style.css"></head><body><script src="app.js"></script></body></html>',
    assets: [
      { type: 'css', url: 'style.css' },
      { type: 'js', url: 'app.js' }
    ]
  };

  const defaultExtracted: ParsedHTML = {
    htmlContent: defaultParsed.htmlContent,
    assets: [
      { type: 'css', url: 'style.css', content: 'body{color:red}' },
      { type: 'js', url: 'app.js', content: 'console.log(1)' }
    ]
  };

  const defaultMinified: ParsedHTML = {
    htmlContent: '<html><head></head><body><h1>minified</h1></body></html>',
    assets: defaultExtracted.assets
  };

  const defaultPacked = '<!DOCTYPE html><html>...packed...</html>';

  const trickyPages: PageEntry[] = [
    { url: 'products/item-1%.html', html: 'Item 1' },
    { url: 'search?q=test&page=2', html: 'Search Results' },
    { url: '/ path / page .html ', html: 'Spaced Page' },
    { url: '/leading--and--trailing/', html: 'Leading Trailing' },
    { url: '///multiple////slashes///page', html: 'Multiple Slashes' }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockedExtractAssets.mockResolvedValue(defaultExtracted);
    mockedMinifyAssets.mockResolvedValue(defaultMinified);
    
    mockedPackHTML.mockReturnValue(defaultPacked);

    mockLogger = new Logger(LogLevel.WARN);
    mockLoggerDebugSpy = jest.spyOn(mockLogger, 'debug');
    mockLoggerInfoSpy = jest.spyOn(mockLogger, 'info');
    mockLoggerErrorSpy = jest.spyOn(mockLogger, 'error');
    mockLoggerWarnSpy = jest.spyOn(mockLogger, 'warn');
  });

  // ========================
  // === bundleSingleHTML ===
  // ========================
  describe('bundleSingleHTML()', () => {
    it('should call extract, minify, and pack in order', async () => {
      await bundleSingleHTML(defaultParsed, 'src/index.html', {}, mockLogger);
      expect(mockedExtractAssets).toHaveBeenCalledTimes(1);
      expect(mockedMinifyAssets).toHaveBeenCalledTimes(1);
      expect(mockedPackHTML).toHaveBeenCalledTimes(1);
    });

    it('should return packed HTML from packHTML()', async () => {
      const result = await bundleSingleHTML(defaultParsed, 'src/index.html', {}, mockLogger);
      expect(result).toBe(defaultPacked);
    });

    it('should determine and use correct file base URL if none provided', async () => {
      const inputPath = path.normalize('./some/dir/file.html');
      const absoluteDir = path.resolve(path.dirname(inputPath));
      const expectedBase = `file://${absoluteDir.replace(/\\/g, '/')}/`;

      await bundleSingleHTML(defaultParsed, inputPath, {}, mockLogger);

      expect(mockLoggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(`Determined local base URL:`));
      expect(mockedExtractAssets).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.stringContaining('file://'), mockLogger);
    });

    it('should determine and use correct HTTP base URL if none provided', async () => {
      const inputUrl = 'https://example.com/path/to/page.html?foo=bar';
      const expectedBase = 'https://example.com/path/to/';

      await bundleSingleHTML(defaultParsed, inputUrl, {}, mockLogger);

      expect(mockLoggerDebugSpy).toHaveBeenCalledWith(expect.stringContaining(expectedBase));
      expect(mockedExtractAssets).toHaveBeenCalledWith(expect.anything(), expect.anything(), expectedBase, mockLogger);
    });

    it('should propagate errors from extract/minify/pack', async () => {
      mockedPackHTML.mockImplementationOnce(() => { throw new Error('Boom'); });
      await expect(bundleSingleHTML(defaultParsed, 'file.html', {}, mockLogger)).rejects.toThrow('Boom');
      expect(mockLoggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error during single HTML bundling'));
    });
  });

  // ============================
  // === bundleMultiPageHTML ===
  // ============================
  describe('bundleMultiPageHTML()', () => {
        it('should sanitize tricky URLs into slugs', () => {
            const trickyPages: PageEntry[] = [ // Make sure this is the correct input array
            { url: 'products/item-1%.html', html: 'Item 1' },
            { url: 'search?q=test&page=2', html: 'Search Results' },
            { url: '/ path / page .html ', html: 'Spaced Page' }, // <--- Input for the failing assertion
            { url: '/leading--and--trailing/', html: 'Leading Trailing' },
            { url: '///multiple////slashes///page', html: 'Multiple Slashes' }
            ];
            const html = bundleMultiPageHTML(trickyPages, mockLogger);

            // ***** ADD THIS LOG *****
            // Remember: Run tests with DEBUG=true env var if console is mocked
            console.log('---- DEBUG: Generated MultiPage HTML for trickyPages ----\n', html, '\n--------------------------------------');
            // ***********************

            const $ = cheerio.load(html);

            expect($('template#page-products-item-1').length).toBe(1);
            expect($('template#page-searchqtestpage2').length).toBe(1);
            // Failing assertion:
            expect($('template#page-path-page').length).toBe(1); // Check the log above for this ID!
            expect($('template#page-leading-and-trailing').length).toBe(1);
            expect($('template#page-multipleslashes-page').length).toBe(1);
        });
        
        it('should include router script with navigateTo()', () => {
        const pages: PageEntry[] = [
          { url: 'index.html', html: '<h1>Hello</h1>' }
        ];
        const html = bundleMultiPageHTML(pages, mockLogger);
        const $ = cheerio.load(html);
      
        const routerScript = $('#router-script').html();
        expect(routerScript).toContain('function navigateTo');
        expect(routerScript).toContain("navigateTo(document.getElementById('page-' + initial)");
      });
      
      it('should set default page to first valid entry', () => {
        const pages: PageEntry[] = [
          { url: 'home.html', html: '<h1>Home</h1>' },
          { url: 'about.html', html: '<h2>About</h2>' }
        ];
        const html = bundleMultiPageHTML(pages, mockLogger);
        expect(html).toContain("navigateTo(document.getElementById('page-' + initial)");
      });
      
      
      it('should include router script with navigateTo()', () => {
        const pages: PageEntry[] = [
          { url: 'index.html', html: '<h1>Hello</h1>' }
        ];
        const html = bundleMultiPageHTML(pages, mockLogger);
        const $ = cheerio.load(html);
      
        const routerScript = $('#router-script').html();
        expect(routerScript).toContain('function navigateTo');
        expect(routerScript).toContain("navigateTo(document.getElementById('page-' + initial)");
      });
      
      it('should set default page to first valid entry', () => {
        const pages: PageEntry[] = [
          { url: 'home.html', html: '<h1>Home</h1>' },
          { url: 'about.html', html: '<h2>About</h2>' }
        ];
        const html = bundleMultiPageHTML(pages, mockLogger);
        expect(html).toContain("navigateTo(document.getElementById('page-' + initial)");
    });
  
    it('should throw if input is not an array', () => {
      // @ts-expect-error - invalid input
      expect(() => bundleMultiPageHTML(null, mockLogger)).toThrow(/must be an array/);
      expect(mockLoggerErrorSpy).toHaveBeenCalled();
    });
  
    it('should throw if all pages are invalid', () => {
      // @ts-expect-error - invalid input
      expect(() => bundleMultiPageHTML([null, undefined, {}], mockLogger)).toThrow(/No valid page entries/);
      expect(mockLoggerErrorSpy).toHaveBeenCalled();
    });
  
    it('should log warning and skip invalid entries', () => {
      const pages: any[] = [
        { url: 'one.html', html: '<h1>1</h1>' },
        null,
        {},
        { html: '<h3>3</h3>' },
        { url: 'two.html', html: '<h2>2</h2>' },
      ];
      const html = bundleMultiPageHTML(pages, mockLogger);
      const $ = cheerio.load(html);
      expect($('template').length).toBe(2);
      expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid page entry'));
    });
  
    it('should generate nav links and container', () => {
      const pages: PageEntry[] = [
        { url: 'index.html', html: 'Index' },
        { url: 'about.html', html: 'About' },
      ];
      const html = bundleMultiPageHTML(pages, mockLogger);
      const $ = cheerio.load(html);
      expect($('#main-nav a').length).toBe(2);
      expect($('#page-container').length).toBe(1);
      expect($('template#page-index').length).toBe(1);
      expect($('template#page-about').length).toBe(1);
    });
  
    it('should generate unique slugs on collision and log warning', () => {
      const pages: PageEntry[] = [
        { url: 'about.html', html: 'A1' },
        { url: '/about', html: 'A2' },
        { url: 'about.htm', html: 'A3' }
      ];
      const html = bundleMultiPageHTML(pages, mockLogger);
      const $ = cheerio.load(html);
  
      expect($('template#page-about').length).toBe(1);
      expect($('template#page-about-1').length).toBe(1);
      expect($('template#page-about-2').length).toBe(1);
      expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Slug collision'));
    });
  
    it('should include router script with navigateTo()', () => {
      const pages: PageEntry[] = [
        { url: 'index.html', html: '<h1>Hello</h1>' }
      ];
      const html = bundleMultiPageHTML(pages, mockLogger);
      const $ = cheerio.load(html);
  
      const routerScript = $('#router-script').html();
      expect(routerScript).toContain('function navigateTo');
      expect(routerScript).toContain('navigateTo(document.getElementById(\'page-\' + initial)');
    });
  
    it('should set default page to first valid entry', () => {
      const pages: PageEntry[] = [
        { url: 'home.html', html: '<h1>Home</h1>' },
        { url: 'about.html', html: '<h2>About</h2>' }
      ];
      const html = bundleMultiPageHTML(pages, mockLogger);
      expect(html).toContain("navigateTo(document.getElementById('page-' + initial) ? initial : 'home')");
    });
  });
});
