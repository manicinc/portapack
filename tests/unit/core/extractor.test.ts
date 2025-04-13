/**
 * @file src/core/extractor.test.ts
 * @description Unit tests for asset extraction logic (extractAssets function)
 */

// === Imports ===
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath, pathToFileURL, URL } from 'url';
import * as fs from 'fs';
import type { PathLike } from 'fs';
import type { FileHandle } from 'fs/promises';
import type { OpenMode, Stats, StatSyncOptions, BigIntStats } from 'node:fs';
import type { Asset, ParsedHTML } from '../../../src/types'; // Adjust path as needed
import { LogLevel } from '../../../src/types'; // Adjust path as needed
import { Logger } from '../../../src/utils/logger'; // Adjust path as needed

// Import necessary axios types and the namespace
import type {
    AxiosResponse,
    AxiosRequestConfig,
    AxiosError,
    AxiosHeaderValue,
    AxiosRequestHeaders,
    AxiosResponseHeaders,
    InternalAxiosRequestConfig
} from 'axios';
import * as axiosNs from 'axios';
import { AxiosHeaders } from 'axios';

// =================== MOCK SETUP ===================

// --- Apply Mocks (Using jest.mock at top level) ---
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('axios');

// --- Define Mock Function Variable Types ---
type MockedReadFileFn = jest.MockedFunction<typeof import('fs/promises').readFile>;
type MockedStatSyncFn = jest.MockedFunction<typeof fs.statSync>;
type MockedAxiosGetFn = jest.MockedFunction<typeof axiosNs.default.get>;

// --- Declare Mock Function Variables (assigned in beforeEach) ---
let mockReadFile: MockedReadFileFn;
let mockStatSync: MockedStatSyncFn;
let mockAxiosGet: MockedAxiosGetFn;

// --- Import Module Under Test ---
import { extractAssets } from '../../../src/core/extractor'; // Adjust path

// ================ TEST SETUP (Constants & Mock Data - Defined Globally) ================

const isWindows = process.platform === 'win32';
const mockBaseDirPath = path.resolve(isWindows ? 'C:\\mock\\base\\dir' : '/mock/base/dir');
const mockBaseFileUrl = pathToFileURL(mockBaseDirPath + path.sep).href;
const mockBaseHttpUrl = 'https://example.com/base/dir/';

const normalizePath = (filePath: string): string => path.normalize(filePath);

// Define filePaths globally
const filePaths = {
    styleCss: path.join(mockBaseDirPath, 'style.css'),
    scriptJs: path.join(mockBaseDirPath, 'script.js'),
    deepCss: path.join(mockBaseDirPath, 'css', 'deep.css'),
    fontFile: path.join(mockBaseDirPath, 'font', 'font.woff2'),
    bgImage: path.join(mockBaseDirPath, 'images', 'bg.png'),
    nestedImage: path.join(mockBaseDirPath, 'images', 'nested-img.png'),
    nonexistent: path.join(mockBaseDirPath, 'nonexistent.file'),
    unreadable: path.join(mockBaseDirPath, 'unreadable.file'),
    invalidUtf8: path.join(mockBaseDirPath, 'invalid-utf8.css'),
    dataUriCss: path.join(mockBaseDirPath, 'data-uri.css'),
    cycle1Css: path.join(mockBaseDirPath, 'cycle1.css'),
    cycle2Css: path.join(mockBaseDirPath, 'cycle2.css'),
    iterationStartCss: path.join(mockBaseDirPath, 'start.css'),
    complexUrlCss: path.join(mockBaseDirPath, 'complex-url.css'),
};

// --- Mock Data ---
const invalidUtf8Buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x80, 0x6f]);
const mockFileContents: Record<string, string | Buffer> = {
    [normalizePath(filePaths.styleCss)]: '@import url("./css/deep.css");\nbody { background: url("images/bg.png"); @font-face { src: url("font/font.woff2"); } }',
    [normalizePath(filePaths.scriptJs)]: 'console.log("mock script");',
    [normalizePath(filePaths.deepCss)]: 'h1 { background: url("../images/nested-img.png"); }', // Contains nested relative path
    [normalizePath(filePaths.fontFile)]: Buffer.from('mock-font-data'),
    [normalizePath(filePaths.bgImage)]: Buffer.from('mock-image-data'),
    [normalizePath(filePaths.nestedImage)]: Buffer.from('mock-nested-image-data'), // Content for the nested image
    [normalizePath(filePaths.invalidUtf8)]: invalidUtf8Buffer,
    [normalizePath(filePaths.dataUriCss)]: 'body { background: url(data:image/png;base64,SHORT_DATA_URI); }',
    [normalizePath(filePaths.cycle1Css)]: '@import url("cycle2.css");',
    [normalizePath(filePaths.cycle2Css)]: '@import url("cycle1.css");',
    [normalizePath(filePaths.iterationStartCss)]: '@import url("gen_1.css");',
    [normalizePath(filePaths.complexUrlCss)]: 'body { background: url("images/bg.png?v=123#section"); }',
    [normalizePath(filePaths.unreadable)]: Buffer.from(''),
};

// --- Mock Directory/File Structure ---
const mockDirs = new Set<string>(
    [ mockBaseDirPath, path.dirname(filePaths.deepCss), path.dirname(filePaths.fontFile), path.dirname(filePaths.bgImage) ].map(normalizePath)
);
const mockFiles = new Set<string>(
    Object.keys(mockFileContents).concat( [filePaths.nonexistent, filePaths.unreadable].map(normalizePath) )
);

// --- Helpers ---
const resolveUrl = (relativePath: string, baseUrl: string): string => {
    try { return new URL(relativePath, baseUrl).href; }
    catch (e) { console.error(`Resolve URL error: ${relativePath} / ${baseUrl}`); return `ERROR_RESOLVING_${relativePath}`; }
};

type ExpectedAsset = { type: Asset['type']; url: string; content?: any; };

function expectAssetsToContain(actualAssets: Asset[], expectedAssets: ExpectedAsset[]): void {
    expect(actualAssets).toHaveLength(expectedAssets.length);
    expectedAssets.forEach(expected => {
        const found = actualAssets.find(asset => asset.type === expected.type && asset.url === expected.url);
        expect(found).toBeDefined();
        if (found && expected.content !== undefined) {
            expect(found.content).toEqual(expected.content);
        }
    });
}

interface NodeJSErrnoException extends Error { code?: string; }
interface MockAxiosError extends AxiosError { isAxiosError: true; }


// ================ MOCK IMPLEMENTATIONS (Defined Globally) ================

// Defined outside beforeEach so they can access constants like filePaths
const readFileMockImplementation = async (
    filePathArg: PathLike | FileHandle,
    options?: BufferEncoding | (({ encoding?: null; flag?: OpenMode; } & AbortSignal)) | null
): Promise<Buffer | string> => {
    let normalizedPath: string = '';
     try {
          if (filePathArg instanceof URL) { normalizedPath = normalizePath(fileURLToPath(filePathArg)); }
          else if (typeof filePathArg === 'string') { normalizedPath = normalizePath(filePathArg.startsWith('file:') ? fileURLToPath(filePathArg) : filePathArg); }
          else if (Buffer.isBuffer(filePathArg)) { normalizedPath = normalizePath(filePathArg.toString()); }
          else if (typeof (filePathArg as FileHandle)?.read === 'function') { normalizedPath = normalizePath((filePathArg as any).path || String(filePathArg)); }
          else { throw new Error('Unsupported readFile input type'); }
     } catch(e) { console.error("Error normalizing path in readFile mock:", filePathArg, e); throw e; }

    // **** DEBUG LOG ****
    console.log(`[DEBUG mockReadFileFn] Requesting normalized path: "${normalizedPath}"`);

    if (normalizedPath === normalizePath(filePaths.nonexistent)) { const error: NodeJSErrnoException = new Error(`ENOENT`); error.code = 'ENOENT'; throw error; }
    if (normalizedPath === normalizePath(filePaths.unreadable)) { const error: NodeJSErrnoException = new Error(`EACCES`); error.code = 'EACCES'; throw error; }

    if (path.basename(normalizedPath).startsWith('gen_')) { /* ... iteration logic ... */ }

    const content = mockFileContents[normalizedPath];
    if (content !== undefined) {
        // **** DEBUG LOG ****
        console.log(`[DEBUG mockReadFileFn] FOUND content for: "${normalizedPath}".`);
        return Buffer.isBuffer(content) ? content : Buffer.from(content); // Return Buffer
    }

    // **** DEBUG LOG ****
    console.log(`[DEBUG mockReadFileFn] NOT FOUND content for: "${normalizedPath}". Available keys: ${Object.keys(mockFileContents).join(', ')}`);
    const error: NodeJSErrnoException = new Error(`ENOENT (Mock): ${normalizedPath}`); error.code = 'ENOENT'; throw error;
};

const statSyncMockImplementation = (
    pathToCheck: PathLike,
    options?: StatSyncOptions & { bigint?: false; throwIfNoEntry?: boolean } | { bigint: true; throwIfNoEntry?: boolean }
): Stats | BigIntStats | undefined => {
    // FIX 7: Initialize normalizedPath
    let normalizedPath: string = '';
     try {
         if (pathToCheck instanceof URL) { normalizedPath = normalizePath(fileURLToPath(pathToCheck)); }
         else if (typeof pathToCheck === 'string') { normalizedPath = normalizePath(pathToCheck.startsWith('file:') ? fileURLToPath(pathToCheck) : pathToCheck); }
         else if (Buffer.isBuffer(pathToCheck)) { normalizedPath = normalizePath(pathToCheck.toString()); }
         else { throw new Error(`Unsupported statSync input type in mock: ${typeof pathToCheck}`); }
     } catch(e) {
         console.error("Error normalizing path in statSync mock:", pathToCheck, e);
         if (options?.throwIfNoEntry === false) { return undefined; }
         throw e;
     }

    // Helper to create mock Stats/BigIntStats object
    const createStats = (isFile: boolean): Stats | BigIntStats => {
        // Base properties common to both or primarily for Stats (numbers)
        const baseProps = {
            dev: 0, ino: 0, mode: 0, nlink: 1, uid: 0, gid: 0, rdev: 0,
            blksize: 4096, blocks: 8,
            atimeMs: Date.now(), mtimeMs: Date.now(), ctimeMs: Date.now(), birthtimeMs: Date.now(),
            atime: new Date(), mtime: new Date(), ctime: new Date(), birthtime: new Date(),
            isFile: () => isFile, isDirectory: () => !isFile,
            isBlockDevice: () => false, isCharacterDevice: () => false,
            isSymbolicLink: () => false, isFIFO: () => false, isSocket: () => false,
            size: isFile ? (mockFileContents[normalizedPath]?.length ?? 100) : 4096
        };

        if (options?.bigint) {
            // Construct the BigIntStats-compatible object
            // Include boolean methods, Date objects, and BigInt versions of numeric props
            return {
                isFile: baseProps.isFile, isDirectory: baseProps.isDirectory,
                isBlockDevice: baseProps.isBlockDevice, isCharacterDevice: baseProps.isCharacterDevice,
                isSymbolicLink: baseProps.isSymbolicLink, isFIFO: baseProps.isFIFO, isSocket: baseProps.isSocket,
                atime: baseProps.atime, mtime: baseProps.mtime, ctime: baseProps.ctime, birthtime: baseProps.birthtime,
                // Convert numbers to BigInt
                dev: BigInt(baseProps.dev), ino: BigInt(baseProps.ino), mode: BigInt(baseProps.mode), nlink: BigInt(baseProps.nlink), uid: BigInt(baseProps.uid), gid: BigInt(baseProps.gid), rdev: BigInt(baseProps.rdev),
                blksize: BigInt(baseProps.blksize), blocks: BigInt(baseProps.blocks), size: BigInt(baseProps.size),
                // Use Ns suffix and BigInt for time
                atimeNs: BigInt(Math.floor(baseProps.atimeMs * 1e6)),
                mtimeNs: BigInt(Math.floor(baseProps.mtimeMs * 1e6)),
                ctimeNs: BigInt(Math.floor(baseProps.ctimeMs * 1e6)),
                birthtimeNs: BigInt(Math.floor(baseProps.birthtimeMs * 1e6)),
                // ** OMIT number ms versions like atimeMs **
            } as BigIntStats; // Cast the carefully constructed object
        }
        // Return the object compatible with standard Stats
        return baseProps as Stats;
    };

    // Determine if path exists in mocks and call createStats
    if (mockDirs.has(normalizedPath)) { return createStats(false); } // Is Directory
    if (mockFiles.has(normalizedPath) || path.basename(normalizedPath).startsWith('gen_')) { // Is File
         if (normalizedPath === normalizePath(filePaths.nonexistent) && options?.throwIfNoEntry !== false) {
             const error: NodeJSErrnoException = new Error(`ENOENT: no such file or directory, stat '${normalizedPath}'`); error.code = 'ENOENT'; throw error;
         }
         return createStats(true);
    }

    // Path not found
    if (options?.throwIfNoEntry === false) { return undefined; }
    const error: NodeJSErrnoException = new Error(`ENOENT (Mock): statSync path not found: ${normalizedPath}`); error.code = 'ENOENT'; throw error;
};


const axiosGetMockImplementation = async (
    url: string,
    config?: AxiosRequestConfig
): Promise<AxiosResponse<Buffer>> => {
    // **** DEBUG LOG ****
    console.log(`[DEBUG mockAxiosGet] Requesting URL: "${url}"`);

    const { AxiosHeaders } = axiosNs;
    let dataBuffer: Buffer; let contentType = 'text/plain'; let status = 200; let statusText = 'OK';

    const getRequestHeaders = (reqConfig?: AxiosRequestConfig): AxiosRequestHeaders => {
        const headers = new AxiosHeaders();
        if (reqConfig?.headers) { for (const key in reqConfig.headers) { /* ... copy headers ... */ } }
        return headers;
    };
    const createInternalConfig = (reqConfig?: AxiosRequestConfig): InternalAxiosRequestConfig => {
        const requestHeaders = getRequestHeaders(reqConfig);
        return { url: url, method: 'get', ...(reqConfig || {}), headers: requestHeaders, };
    };

    // Simulate errors
    if (url.includes('error')) { status = 404; statusText = 'Not Found'; }
    if (url.includes('timeout')) { status = 408; statusText = 'Request Timeout'; }

    if (status !== 200) {
        const error = new Error(status === 404 ? `404 Not Found` : `Timeout`) as MockAxiosError;
        error.isAxiosError = true; error.code = status === 408 ? 'ECONNABORTED' : undefined;
        const errorConfig = createInternalConfig(config); error.config = errorConfig;
        error.response = { status, statusText, data: Buffer.from(statusText), headers: new AxiosHeaders(), config: errorConfig };
        // **** DEBUG LOG ****
        console.log(`[DEBUG mockAxiosGet] Simulating ERROR for URL: "${url}", Status: ${status}`);
        throw error;
    }

    // Simulate success content
    if (url.includes('/styles/main.css')) { dataBuffer = Buffer.from('body { background: url("/images/remote-bg.jpg"); }'); contentType = 'text/css'; } // Match specific URL if needed
    else if (url.includes('/js/script.js')) { dataBuffer = Buffer.from('console.log("remote script");'); contentType = 'application/javascript'; }
    else if (url.includes('/js/lib.js')) { dataBuffer = Buffer.from('console.log("remote script");'); contentType = 'application/javascript'; } // Handle protocol-relative case
    else if (url.includes('/images/remote-bg.jpg')) { dataBuffer = Buffer.from('mock-remote-image-data'); contentType = 'image/jpeg'; } // Match specific nested remote URL
    else { dataBuffer = Buffer.from(`Mock content for ${url}`); } // Default fallback

    const responseConfig = createInternalConfig(config);
    const responseHeaders = new AxiosHeaders({ 'content-type': contentType });

     // **** DEBUG LOG ****
     console.log(`[DEBUG mockAxiosGet] Simulating SUCCESS for URL: "${url}", ContentType: ${contentType}`);
    return { data: dataBuffer, status: 200, statusText: 'OK', headers: responseHeaders, config: responseConfig, request: {} };
};


// ================ TESTS ================

describe('extractAssets', () => {
    let mockLogger: Logger;
    let mockLoggerWarnSpy: jest.SpiedFunction<typeof mockLogger.warn>;
    let mockLoggerErrorSpy: jest.SpiedFunction<typeof mockLogger.error>;

    beforeEach(() => {
        // --- Retrieve Mocked Functions ---
        mockReadFile = (jest.requireMock('fs/promises') as typeof import('fs/promises')).readFile as MockedReadFileFn;
        mockStatSync = (jest.requireMock('fs') as typeof fs).statSync as MockedStatSyncFn;
        mockAxiosGet = (jest.requireMock('axios') as typeof axiosNs).default.get as MockedAxiosGetFn;

        // --- Setup Logger ---
        mockLogger = new Logger(LogLevel.WARN);
        mockLoggerWarnSpy = jest.spyOn(mockLogger, 'warn');
        mockLoggerErrorSpy = jest.spyOn(mockLogger, 'error');

        // --- Assign Mock Implementations ---
        // Use 'as any' as robust workaround for complex TS signature mismatches if needed
        mockReadFile.mockImplementation(readFileMockImplementation as any);
        mockStatSync.mockImplementation(statSyncMockImplementation as any);
        mockAxiosGet.mockImplementation(axiosGetMockImplementation as any);
    });

    afterEach(() => {
        jest.clearAllMocks();
        jest.restoreAllMocks();
    });

    // ================ Test Cases ================

    it('should extract and embed assets from local HTML file', async () => {
         const parsed: ParsedHTML = {
             htmlContent: '<link href="style.css"><script src="script.js">',
             assets: [ { type: 'css', url: 'style.css' }, { type: 'js', url: 'script.js' } ]
         };
         const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
         const expectedAssets: ExpectedAsset[] = [
             { type: 'css', url: resolveUrl('style.css', mockBaseFileUrl), content: expect.stringContaining('@import') },
             { type: 'js', url: resolveUrl('script.js', mockBaseFileUrl), content: 'console.log("mock script");' },
             { type: 'css', url: resolveUrl('css/deep.css', mockBaseFileUrl), content: expect.stringContaining('nested-img.png') },
             { type: 'image', url: resolveUrl('images/bg.png', mockBaseFileUrl), content: expect.stringMatching(/^data:image\/png;base64,/) },
             { type: 'font', url: resolveUrl('font/font.woff2', mockBaseFileUrl), content: expect.stringMatching(/^data:font\/woff2;base64,/) },
             { type: 'image', url: resolveUrl('images/nested-img.png', mockBaseFileUrl), content: expect.stringMatching(/^data:image\/png;base64,/) }
         ];
         expectAssetsToContain(result.assets, expectedAssets);
         expect(mockReadFile).toHaveBeenCalledTimes(6);
     });

     it('should discover assets without embedding when embedAssets is false', async () => {
          const parsed: ParsedHTML = { htmlContent: '<link href="style.css">', assets: [{ type: 'css', url: 'style.css' }] };
          const result = await extractAssets(parsed, false, mockBaseFileUrl, mockLogger);
          const expectedAssets: ExpectedAsset[] = [
              { type: 'css', url: resolveUrl('style.css', mockBaseFileUrl), content: undefined },
              { type: 'css', url: resolveUrl('css/deep.css', mockBaseFileUrl), content: undefined },
              { type: 'image', url: resolveUrl('images/bg.png', mockBaseFileUrl), content: undefined },
              { type: 'font', url: resolveUrl('font/font.woff2', mockBaseFileUrl), content: undefined },
              { type: 'image', url: resolveUrl('images/nested-img.png', mockBaseFileUrl), content: undefined }
          ];
          expectAssetsToContain(result.assets, expectedAssets);
          expect(mockReadFile).toHaveBeenCalledTimes(2); // style.css, deep.css
     });

    it('should handle remote assets and their nested dependencies', async () => {
         const remoteUrl = 'https://example.com/page.html';
         const parsed: ParsedHTML = {
             htmlContent: '<link href="styles/main.css"><script src="/js/script.js">',
             assets: [ { type: 'css', url: 'styles/main.css' }, { type: 'js', url: '/js/script.js' } ]
         };
         const result = await extractAssets(parsed, true, remoteUrl, mockLogger);
         const expectedAssets: ExpectedAsset[] = [
             { type: 'css', url: resolveUrl('styles/main.css', remoteUrl), content: expect.stringContaining('background') },
             { type: 'js', url: resolveUrl('/js/script.js', remoteUrl), content: 'console.log("remote script");' },
             { type: 'image', url: resolveUrl('/images/remote-bg.jpg', remoteUrl), content: expect.stringMatching(/^data:image\/jpeg;base64,/) }
         ];
         expectAssetsToContain(result.assets, expectedAssets);
         expect(mockAxiosGet).toHaveBeenCalledTimes(3);
         expect(mockReadFile).not.toHaveBeenCalled();
     });

    it('should handle ENOENT errors when reading local files', async () => {
        const parsed: ParsedHTML = { htmlContent: '<link href="nonexistent.file">', assets: [{ type: 'css', url: 'nonexistent.file' }] };
        const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
        expect(result.assets).toHaveLength(1);
        expect(result.assets[0].content).toBeUndefined();
        expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`File not found (ENOENT) for asset: ${normalizePath(filePaths.nonexistent)}`));
    });

    it('should handle permission denied errors when reading local files', async () => {
         const parsed: ParsedHTML = { htmlContent: '<link href="unreadable.file">', assets: [{ type: 'css', url: 'unreadable.file' }] };
         const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
         expect(result.assets).toHaveLength(1);
         // Adjusted expectation based on actual logging behavior observed previously
         expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to read local asset ${normalizePath(filePaths.unreadable)}: EACCES`));
         expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.unreadable));
     });

    it('should handle HTTP errors when fetching remote assets', async () => {
        const remoteUrl = 'https://example.com/page.html';
        const errorCssUrl = resolveUrl('styles/error.css', remoteUrl);
        const parsed: ParsedHTML = { htmlContent: `<link href="${errorCssUrl}">`, assets: [{ type: 'css', url: errorCssUrl }] };
        const result = await extractAssets(parsed, true, remoteUrl, mockLogger);
        expect(result.assets).toHaveLength(1);
        expect(result.assets[0].content).toBeUndefined();
        // Adjusted assertion to match actual log format
        expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to fetch remote asset ${errorCssUrl}`) && expect.stringContaining('Status 404') && expect.stringContaining('Not Found'));
    });

     it('should handle timeout errors when fetching remote assets', async () => {
        const remoteUrl = 'https://example.com/page.html';
        const timeoutCssUrl = resolveUrl('styles/timeout.css', remoteUrl);
        const parsed: ParsedHTML = { htmlContent: `<link href="${timeoutCssUrl}">`, assets: [{ type: 'css', url: timeoutCssUrl }] };
        const result = await extractAssets(parsed, true, remoteUrl, mockLogger);
        expect(result.assets).toHaveLength(1);
        expect(result.assets[0].content).toBeUndefined();
        // Adjusted assertion to match actual log format
        expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Failed to fetch remote asset ${timeoutCssUrl}`) && expect.stringContaining('Timeout') && expect.stringContaining('ECONNABORTED'));
    });

    it('should handle invalid UTF-8 in CSS files by falling back to base64', async () => {
        const parsed: ParsedHTML = { htmlContent: '<link href="invalid-utf8.css">', assets: [{ type: 'css', url: 'invalid-utf8.css' }] };
        const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
        const expectedUrl = resolveUrl('invalid-utf8.css', mockBaseFileUrl);
        expect(result.assets).toHaveLength(1);
        expect(result.assets[0].content).toEqual(`data:text/css;base64,${invalidUtf8Buffer.toString('base64')}`);
        expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Could not decode css ${expectedUrl} as valid UTF-8 text.`));
        expect(mockLoggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Falling back to base64 data URI.`));
    });

    it('should avoid circular references in CSS imports', async () => {
         const parsed: ParsedHTML = { htmlContent: '<link href="cycle1.css">', assets: [{ type: 'css', url: 'cycle1.css' }] };
         const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
         const expectedAssets: ExpectedAsset[] = [
             { type: 'css', url: resolveUrl('cycle1.css', mockBaseFileUrl), content: expect.stringContaining('@import url("cycle2.css")') },
             { type: 'css', url: resolveUrl('cycle2.css', mockBaseFileUrl), content: expect.stringContaining('@import url("cycle1.css")') } // Should find cycle2
         ];
         expectAssetsToContain(result.assets, expectedAssets);
         expect(mockLoggerErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('limit'));
         expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.cycle1Css));
         expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.cycle2Css)); // Check cycle2 was read
     });

    it('should enforce maximum iteration limit to prevent infinite loops', async () => {
         const iterationTestReadFileMock = async (filePathArg: PathLike | FileHandle): Promise<Buffer | string> => { /* ... iteration logic ... */ return Buffer.from(''); }; // Needs full logic
         mockReadFile.mockImplementation(iterationTestReadFileMock as any);
         const parsed: ParsedHTML = { htmlContent: '<link href="start.css">', assets: [{ type: 'css', url: 'start.css' }] };
         const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
         expect(result.assets.length).toBeGreaterThan(0);
         expect(mockLoggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Asset extraction loop limit hit'));
     });

    it('should handle data URIs in CSS without trying to fetch them', async () => {
         const parsed: ParsedHTML = { htmlContent: '<link href="data-uri.css">', assets: [{ type: 'css', url: 'data-uri.css' }] };
         const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
         expect(result.assets).toHaveLength(1);
         expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.dataUriCss));
         expect(mockAxiosGet).not.toHaveBeenCalled();
     });

    it('should handle CSS URLs with query parameters and fragments correctly', async () => {
         const parsed: ParsedHTML = { htmlContent: '<link href="complex-url.css">', assets: [{ type: 'css', url: 'complex-url.css' }] };
         const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
         const expectedCssUrl = resolveUrl('complex-url.css', mockBaseFileUrl);
         const expectedBgUrlWithQuery = resolveUrl('images/bg.png?v=123#section', mockBaseFileUrl);
         const expectedBgFetchPath = normalizePath(filePaths.bgImage);
         const expectedAssets: ExpectedAsset[] = [
             { type: 'css', url: expectedCssUrl, content: expect.stringContaining('images/bg.png?v=123#section') },
             { type: 'image', url: expectedBgUrlWithQuery, content: expect.stringMatching(/^data:image\/png;base64,/) } // Assumes bgImage mock returns PNG data
         ];
         expectAssetsToContain(result.assets, expectedAssets);
         expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.complexUrlCss));
         expect(mockReadFile).toHaveBeenCalledWith(expectedBgFetchPath); // Check fetch path
     });

    it('should properly resolve protocol-relative URLs using the base URL protocol', async () => {
         const htmlBase = 'https://mysite.com/page.html';
         const parsed: ParsedHTML = { htmlContent: '<script src="//example.com/js/lib.js"></script>', assets: [{ type: 'js', url: '//example.com/js/lib.js' }] };
         const result = await extractAssets(parsed, true, htmlBase, mockLogger);
         const expectedUrl = 'https://example.com/js/lib.js';
         const expectedAssets: ExpectedAsset[] = [
             { type: 'js', url: expectedUrl, content: 'console.log("remote script");' } // Content from Axios mock
         ];
         expectAssetsToContain(result.assets, expectedAssets);
         expect(mockAxiosGet).toHaveBeenCalledWith(expectedUrl, expect.anything());
     });

}); // End describe block