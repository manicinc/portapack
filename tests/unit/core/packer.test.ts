/**
 * @file tests/unit/core/packer.test.ts
 * @description Unit tests for the HTML packer module (packHTML function).
 * Focuses on asset inlining, handling different HTML structures, and edge cases.
 */

import * as cheerio from 'cheerio';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { packHTML } from '../../../src/core/packer'; // Use .js if outputting JS
import { Logger } from '../../../src/utils/logger'; // Use .js if outputting JS
import { LogLevel } from '../../../src/types'; // Use .js if outputting JS
import type { ParsedHTML, Asset } from '../../../src/types'; // Use .js if outputting JS

/**
 * @describe Test suite for the packHTML function in the HTML Packer module.
 */
describe('📦 HTML Packer - packHTML()', () => {
    let mockLogger: Logger;
    let mockLoggerDebugFn: jest.SpiedFunction<typeof Logger.prototype.debug>;
    let mockLoggerWarnFn: jest.SpiedFunction<typeof Logger.prototype.warn>;

    // --- Test Constants ---
    const cssUrl = 'style.css';
    const jsUrl = 'script.js';
    const imgUrl = 'logo.png';
    const videoPosterUrl = 'poster.jpg';
    const videoSrcUrl = 'movie.mp4';
    const missingAssetUrl = 'not-found.css';
    const trickyJsUrl = 'tricky.js';

    const cssContent = 'body { background: blue; }';
    const jsContent = 'console.log("hello");';
    const jsWithScriptTag = 'console.log("</script>"); alert("hello");';
    const imgDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='; // 1x1 red pixel png
    const videoDataUri = 'data:video/mp4;base64,AAAAFGZ0eXBNNFYgAAACAGlzb21pc28yYXZjMQAAAAhmcmVlAAAAGm1kYXQ='; // Minimal mp4

    const sampleAssets: Asset[] = [
        { type: 'css', url: cssUrl, content: cssContent },
        { type: 'js', url: jsUrl, content: jsContent },
        { type: 'js', url: trickyJsUrl, content: jsWithScriptTag },
        { type: 'image', url: imgUrl, content: imgDataUri },
        { type: 'image', url: videoPosterUrl, content: imgDataUri }, // Using img for poster for simplicity
        { type: 'video', url: videoSrcUrl, content: videoDataUri },
        { type: 'css', url: missingAssetUrl, content: undefined }, // Asset without content
    ];

    const baseHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Test Page</title>
            <link rel="stylesheet" href="${cssUrl}">
            <link rel="stylesheet" href="${missingAssetUrl}">
        </head>
        <body>
            <h1>Hello</h1>
            <img src="${imgUrl}" alt="Logo">
            <video poster="${videoPosterUrl}" controls>
                  <source src="${videoSrcUrl}" type="video/mp4">
                  Your browser does not support the video tag.
            </video>
             <img srcset="${imgUrl} 1x, ${videoPosterUrl} 2x" alt="Srcset Image">
             <input type="image" src="${imgUrl}" alt="Input image">
            <script src="${jsUrl}"></script>
            <script src="non-existent.js"></script>
            <script> /* Inline script should be kept */ console.log('inline'); </script>
        </body>
        </html>
    `;

    const fragmentHtml = `
        <div>Just a div</div>
        <link rel="stylesheet" href="${cssUrl}">
        <script src="${jsUrl}"></script>
    `;

    /**
     * @beforeEach Resets mocks before each test.
     */
    beforeEach(() => {
        mockLogger = new Logger(LogLevel.WARN); // Use DEBUG level for tests
        mockLoggerDebugFn = jest.spyOn(mockLogger, 'debug');
        mockLoggerWarnFn = jest.spyOn(mockLogger, 'warn');
    });

    /**
     * @it Tests if packHTML correctly handles HTML fragments (input without <html>, <head>, <body>).
     * It verifies that Cheerio creates the basic structure, adds the base tag,
     * preserves original content, and correctly inlines assets (noting that link/script tags
     * from fragments often end up in the body during parsing).
     */
    it('handles missing <head> and <body> (HTML fragment)', () => {
        // Input is just a div, link, and script
        const parsedInput: ParsedHTML = { htmlContent: fragmentHtml, assets: sampleAssets };
        const result = packHTML(parsedInput, mockLogger);
        const $ = cheerio.load(result);

        // Verify Cheerio created the basic structure
        expect($('html').length).toBe(1);
        expect($('head').length).toBe(1);
        expect($('body').length).toBe(1);

        // Verify <base> tag was added to the created <head>
        expect($('head > base[href="./"]').length).toBe(1);

        // Verify the original div exists within the created <body>
        expect($('body > div:contains("Just a div")').length).toBe(1);

        // Verify assets were inlined into the structure where Cheerio placed the original tags.
        // NOTE: Cheerio often places fragment <link> and <script> tags into the <body> it creates.
        // The packer replaces them *in place*.
        expect($('body > style').length).toBe(1); // <<< FIXED: Check body for style tag from fragment link
        expect($('body > style').text()).toBe(cssContent); // <<< FIXED: Check body for style tag from fragment link

        // JS likely also goes in body when inlining based on original fragment script placement
        expect($('body > script:not([src])').length).toBe(1);
        expect($('body > script:not([src])').html()).toContain(jsContent); // jsContent is 'console.log("hello");'

        // Check relevant logs were called (ensureBaseTag logic)
        expect(mockLoggerDebugFn).toHaveBeenCalledWith(expect.stringContaining('Loading HTML content into Cheerio'));
        expect(mockLoggerDebugFn).toHaveBeenCalledWith(expect.stringContaining('Ensuring <base> tag exists...'));
        // Cheerio creates <head>, so the code finds it and adds the base tag.
        expect(mockLoggerDebugFn).toHaveBeenCalledWith(expect.stringContaining('Prepending <base href="./"> to <head>.'));
        expect(mockLoggerDebugFn).toHaveBeenCalledWith(expect.stringContaining('Starting asset inlining...'));
        // Verify the 'No <head> tag found' log IS NOT called, because Cheerio creates one.
        expect(mockLoggerDebugFn).not.toHaveBeenCalledWith(expect.stringContaining('No <head> tag found'));
    });

    /**
     * @it Tests if packHTML returns a minimal valid HTML shell when input htmlContent is empty or invalid.
     */
    it('returns minimal HTML shell if input htmlContent is empty or invalid', () => {
        const expectedShell = '<!DOCTYPE html><html><head><base href="./"></head><body></body></html>';

        // Test with empty string
        const emptyParsed: ParsedHTML = { htmlContent: '', assets: [] };
        const resultEmpty = packHTML(emptyParsed, mockLogger);
        expect(resultEmpty).toBe(expectedShell);
        expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining('Packer received empty or invalid htmlContent'));

        mockLoggerWarnFn.mockClear(); // Reset mock for next check

        // Test with null (simulating invalid input)
        // @ts-expect-error Testing invalid input type deliberately
        const nullParsed: ParsedHTML = { htmlContent: null, assets: [] };
        const resultNull = packHTML(nullParsed, mockLogger);
        expect(resultNull).toBe(expectedShell);
        expect(mockLoggerWarnFn).toHaveBeenCalledWith(expect.stringContaining('Packer received empty or invalid htmlContent'));
    });

    /**
     * @it Tests if closing script tags within JS content are correctly escaped to prevent breaking the HTML structure.
     */
    it('escapes closing script tags in JS content', () => {
        const assets: Asset[] = [{ type: 'js', url: trickyJsUrl, content: jsWithScriptTag }];
        const html = `<html><head></head><body><script src="${trickyJsUrl}"></script></body></html>`;
        const parsed: ParsedHTML = { htmlContent: html, assets };

        const result = packHTML(parsed, mockLogger);
        const $ = cheerio.load(result);

        const scriptContent = $('script:not([src])').html();
        expect(scriptContent).toContain('console.log("<\\/script>");'); // Check for escaped tag: <\/script>
        expect(scriptContent).toContain('alert("hello");');
        expect(scriptContent).not.toContain('</script>'); // Original unescaped should not be present
    });

    /**
     * @it Tests if attributes (other than 'src') on original script tags are preserved when the script is inlined.
     */
    it('preserves other attributes on inlined script tags', () => {
        const assets: Asset[] = [{ type: 'js', url: jsUrl, content: jsContent }];
        // Original script tag has type="module" and defer attributes
        const html = `<html><head></head><body><script src="${jsUrl}" type="module" defer></script></body></html>`;
        const parsed: ParsedHTML = { htmlContent: html, assets };
        const result = packHTML(parsed, mockLogger);
        const $ = cheerio.load(result);

        const scriptTag = $('script:not([src])');
        expect(scriptTag.length).toBe(1);
        expect(scriptTag.attr('type')).toBe('module'); // Check 'type' is preserved
        expect(scriptTag.attr('defer')).toBeDefined(); // Check 'defer' attribute presence
        expect(scriptTag.attr('src')).toBeUndefined(); // src should be removed
        expect(scriptTag.html()).toContain(jsContent); // Check content is inlined
    });

    // --- Potential Future Tests ---
    // - HTML without <html> tag initially (covered partly by fragment test)
    // - Assets with URLs containing special characters? (Cheerio/Map should handle)
    // - Very large assets? (Performance not tested here)
    // - Conflicting asset URLs? (Map uses last one - maybe test this explicitly?)
});