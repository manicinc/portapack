/**
 * @file src/core/extractor.test.ts
 * @description Unit tests for asset extraction logic (extractAssets function)
 */

// === Imports ===
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath, pathToFileURL, URL } from 'url';
// Use specific imports from 'fs' and 'fs/promises' where needed
import * as fsPromises from 'fs/promises'; // For mocking readFile
import * as fs from 'fs'; // For mocking statSync etc.
import type { PathLike } from 'fs';
import type { FileHandle } from 'fs/promises';
import type { OpenMode, Stats, StatSyncOptions, BigIntStats } from 'node:fs'; // Use node: prefix
// Import types from the project
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
  InternalAxiosRequestConfig,
} from 'axios';
import * as axiosNs from 'axios'; // Namespace import
import { AxiosHeaders } from 'axios'; // Import AxiosHeaders class if used directly

// =================== MOCK SETUP ===================

// --- Apply Mocks (Using jest.mock at top level) ---
// Mock the entire 'fs/promises', 'fs', and 'axios' modules
jest.mock('fs/promises');
jest.mock('fs');
jest.mock('axios');

// --- Define Mock Function Variable Types ---
// Use jest.MockedFunction for type safety with mocked modules
type MockedReadFileFn = jest.MockedFunction<typeof fsPromises.readFile>;
type MockedStatSyncFn = jest.MockedFunction<typeof fs.statSync>;
type MockedAxiosGetFn = jest.MockedFunction<typeof axiosNs.default.get>;

// --- Declare Mock Function Variables (assigned in beforeEach) ---
// These will hold the mocked functions retrieved via jest.requireMock
let mockReadFile: MockedReadFileFn;
let mockStatSync: MockedStatSyncFn;
let mockAxiosGet: MockedAxiosGetFn;

// --- Import Module Under Test ---
// Import after mocks are defined
import { extractAssets } from '../../../src/core/extractor'; // Adjust path as needed

// ================ TEST SETUP (Constants & Mock Data - Defined Globally) ================

// Determine if running on Windows for path handling
const isWindows = process.platform === 'win32';
// Define a mock base directory path based on OS
const mockBaseDirPath = path.resolve(isWindows ? 'C:\\mock\\base\\dir' : '/mock/base/dir');
// Create the corresponding file URL for the base directory
const mockBaseFileUrl = pathToFileURL(mockBaseDirPath + path.sep).href; // Ensure trailing slash
// Define a mock HTTP base URL
const mockBaseHttpUrl = 'https://example.com/base/dir/';

// Helper function to normalize paths for consistent comparisons
const normalizePath = (filePath: string): string => path.normalize(filePath);

// Define paths for various mock files used in tests
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
  iterationStartCss: path.join(mockBaseDirPath, 'start.css'), // For loop test
  complexUrlCss: path.join(mockBaseDirPath, 'complex-url.css'), // CSS containing URL with query/fragment
};

// --- Mock Data ---
// Buffer containing invalid UTF-8 sequence
const invalidUtf8Buffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x80, 0x6f]); // Contains 0x80 which is invalid in UTF-8

// Map normalized file paths to their mock content (string or Buffer)
const mockFileContents: Record<string, string | Buffer> = {
  [normalizePath(filePaths.styleCss)]:
    '@import url("./css/deep.css");\nbody { background: url("images/bg.png"); @font-face { src: url("font/font.woff2"); } }',
  [normalizePath(filePaths.scriptJs)]: 'console.log("mock script");',
  [normalizePath(filePaths.deepCss)]: 'h1 { background: url("../images/nested-img.png"); }', // Contains nested relative path
  [normalizePath(filePaths.fontFile)]: Buffer.from('mock-font-data'), // Binary data
  [normalizePath(filePaths.bgImage)]: Buffer.from('mock-image-data'), // Binary data
  [normalizePath(filePaths.nestedImage)]: Buffer.from('mock-nested-image-data'), // Binary data for nested image
  [normalizePath(filePaths.invalidUtf8)]: invalidUtf8Buffer, // Invalid UTF-8 buffer
  [normalizePath(filePaths.dataUriCss)]:
    'body { background: url(data:image/png;base64,SHORT_DATA_URI); }', // CSS containing a data URI
  [normalizePath(filePaths.cycle1Css)]: '@import url("cycle2.css");', // CSS for circular import test
  [normalizePath(filePaths.cycle2Css)]: '@import url("cycle1.css");', // CSS for circular import test
  [normalizePath(filePaths.iterationStartCss)]: '@import url("gen_1.css");', // Start file for iteration test
  [normalizePath(filePaths.complexUrlCss)]:
    'body { background: url("images/bg.png?v=123#section"); }', // CSS with query/fragment URL
  [normalizePath(filePaths.unreadable)]: Buffer.from(''), // Empty buffer for the unreadable file (content doesn't matter, error is simulated)
  // Note: nonexistent file doesn't need content, its absence is simulated by the mock
};

// --- Mock Directory/File Structure ---
// Set of directories that should exist in the mock structure
const mockDirs = new Set<string>(
  [
    mockBaseDirPath,
    path.dirname(filePaths.deepCss),
    path.dirname(filePaths.fontFile),
    path.dirname(filePaths.bgImage),
  ].map(normalizePath)
);
// Set of files that should exist in the mock structure (used by statSync mock)
const mockFiles = new Set<string>(
  // Get all keys (paths) from mockFileContents
  Object.keys(mockFileContents)
    // Add paths for files that should exist but might cause read errors
    .concat([filePaths.unreadable].map(normalizePath))
  // Note: filePaths.nonexistent is *not* added here, so statSync will fail for it
);

// --- Helpers ---
// Helper to resolve URLs consistently within tests
const resolveUrl = (relativePath: string, baseUrl: string): string => {
  try {
    return new URL(relativePath, baseUrl).href;
  } catch (e) {
    console.error(`Resolve URL error in test helper: ${relativePath} / ${baseUrl}`);
    return `ERROR_RESOLVING_${relativePath}`;
  }
};

// Type definition for expected asset structure in assertions
type ExpectedAsset = { type: Asset['type']; url: string; content?: any };

// Helper function to assert that the actual assets contain the expected assets
function expectAssetsToContain(actualAssets: Asset[], expectedAssets: ExpectedAsset[]): void {
  // Check if the number of found assets matches the expected number
  expect(actualAssets).toHaveLength(expectedAssets.length);
  // Check each expected asset
  expectedAssets.forEach(expected => {
    // Find the corresponding asset in the actual results by type and URL
    const found = actualAssets.find(
      asset => asset.type === expected.type && asset.url === expected.url
    );
    // Assert that the asset was found
    expect(found).toBeDefined();
    // If content is expected, assert that it matches (using toEqual for deep comparison if needed)
    if (found && expected.content !== undefined) {
      expect(found.content).toEqual(expected.content);
    }
  });
}

// Interface for Node.js errors with a 'code' property
interface NodeJSErrnoException extends Error {
  code?: string;
}
// Interface to represent an Axios error structure for mocking
interface MockAxiosError extends AxiosError {
  isAxiosError: true;
}

// ================ MOCK IMPLEMENTATIONS (Defined Globally) ================

// Mock implementation for fsPromises.readFile
const readFileMockImplementation = async (
  filePathArg: PathLike | FileHandle,
  options?: BufferEncoding | ({ encoding?: null; flag?: OpenMode } & AbortSignal) | null // Match fsPromises.readFile signature
): Promise<Buffer | string> => {
  let normalizedPath: string = '';
  try {
    // Normalize the input path regardless of whether it's a string, URL, Buffer, or FileHandle
    if (filePathArg instanceof URL) {
      normalizedPath = normalizePath(fileURLToPath(filePathArg));
    } else if (typeof filePathArg === 'string') {
      normalizedPath = normalizePath(
        filePathArg.startsWith('file:') ? fileURLToPath(filePathArg) : filePathArg
      );
    } else if (Buffer.isBuffer(filePathArg)) {
      normalizedPath = normalizePath(filePathArg.toString());
    }
    // Rudimentary check for FileHandle-like object (adjust if using actual FileHandles)
    else if (typeof (filePathArg as any)?.read === 'function') {
      normalizedPath = normalizePath((filePathArg as any).path || String(filePathArg));
    } else {
      throw new Error('Unsupported readFile input type in mock');
    }
  } catch (e) {
    console.error('Error normalizing path in readFile mock:', filePathArg, e);
    throw e;
  }

  // console.log(`[DEBUG mockReadFileFn] Requesting normalized path: "${normalizedPath}"`); // Optional debug

  // Simulate ENOENT (file not found) error
  if (normalizedPath === normalizePath(filePaths.nonexistent)) {
    const error: NodeJSErrnoException = new Error(
      `ENOENT: no such file or directory, open '${normalizedPath}'`
    );
    error.code = 'ENOENT';
    throw error;
  }
  // Simulate EACCES (permission denied) error
  if (normalizedPath === normalizePath(filePaths.unreadable)) {
    const error: NodeJSErrnoException = new Error(
      `EACCES: permission denied, open '${normalizedPath}'`
    );
    error.code = 'EACCES';
    throw error;
  }

  // Retrieve mock content based on the normalized path
  const content = mockFileContents[normalizedPath];
  if (content !== undefined) {
    // console.log(`[DEBUG mockReadFileFn] FOUND content for: "${normalizedPath}".`); // Optional debug
    // Always return a Buffer, as the actual readFile would
    return Buffer.isBuffer(content) ? content : Buffer.from(content);
  }

  // If content not found in mock map, simulate ENOENT
  // console.log(`[DEBUG mockReadFileFn] NOT FOUND content for: "${normalizedPath}". Available keys: ${Object.keys(mockFileContents).join(', ')}`); // Optional debug
  const error: NodeJSErrnoException = new Error(
    `ENOENT (Mock): Content not found for ${normalizedPath}`
  );
  error.code = 'ENOENT';
  throw error;
};

// Mock implementation for fs.statSync
const statSyncMockImplementation = (
  pathToCheck: PathLike,
  options?:
    | (StatSyncOptions & { bigint?: false; throwIfNoEntry?: boolean })
    | { bigint: true; throwIfNoEntry?: boolean } // Match fs.statSync signature
): Stats | BigIntStats | undefined => {
  let normalizedPath: string = '';
  try {
    // Normalize the input path
    if (pathToCheck instanceof URL) {
      normalizedPath = normalizePath(fileURLToPath(pathToCheck));
    } else if (typeof pathToCheck === 'string') {
      normalizedPath = normalizePath(
        pathToCheck.startsWith('file:') ? fileURLToPath(pathToCheck) : pathToCheck
      );
    } else if (Buffer.isBuffer(pathToCheck)) {
      normalizedPath = normalizePath(pathToCheck.toString());
    } else {
      throw new Error(`Unsupported statSync input type in mock: ${typeof pathToCheck}`);
    }
  } catch (e) {
    console.error('Error normalizing path in statSync mock:', pathToCheck, e);
    // Handle throwIfNoEntry option if normalization fails
    if (options?.throwIfNoEntry === false) {
      return undefined;
    }
    throw e; // Re-throw normalization error if throwIfNoEntry is not false
  }

  // Helper to create a mock Stats or BigIntStats object
  const createStats = (isFile: boolean): Stats | BigIntStats => {
    // Base properties common to both Stats and BigIntStats
    const baseProps = {
      dev: 0,
      ino: 0,
      mode: isFile ? 33188 : 16877,
      /* file vs dir mode */ nlink: 1,
      uid: 0,
      gid: 0,
      rdev: 0,
      blksize: 4096,
      blocks: 8,
      atimeMs: Date.now(),
      mtimeMs: Date.now(),
      ctimeMs: Date.now(),
      birthtimeMs: Date.now(),
      atime: new Date(),
      mtime: new Date(),
      ctime: new Date(),
      birthtime: new Date(),
      isFile: () => isFile,
      isDirectory: () => !isFile,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isSymbolicLink: () => false,
      isFIFO: () => false,
      isSocket: () => false,
      // Calculate size based on mock content or default
      size: isFile ? (mockFileContents[normalizedPath]?.length ?? 100) : 4096,
    };

    // If bigint option is true, return a BigIntStats-compatible object
    if (options?.bigint) {
      return {
        isFile: baseProps.isFile,
        isDirectory: baseProps.isDirectory,
        isBlockDevice: baseProps.isBlockDevice,
        isCharacterDevice: baseProps.isCharacterDevice,
        isSymbolicLink: baseProps.isSymbolicLink,
        isFIFO: baseProps.isFIFO,
        isSocket: baseProps.isSocket,
        atime: baseProps.atime,
        mtime: baseProps.mtime,
        ctime: baseProps.ctime,
        birthtime: baseProps.birthtime,
        dev: BigInt(baseProps.dev),
        ino: BigInt(baseProps.ino),
        mode: BigInt(baseProps.mode),
        nlink: BigInt(baseProps.nlink),
        uid: BigInt(baseProps.uid),
        gid: BigInt(baseProps.gid),
        rdev: BigInt(baseProps.rdev),
        blksize: BigInt(baseProps.blksize),
        blocks: BigInt(baseProps.blocks),
        size: BigInt(baseProps.size),
        // Convert milliseconds to nanoseconds BigInt
        atimeNs: BigInt(Math.floor(baseProps.atimeMs * 1e6)),
        mtimeNs: BigInt(Math.floor(baseProps.mtimeMs * 1e6)),
        ctimeNs: BigInt(Math.floor(baseProps.ctimeMs * 1e6)),
        birthtimeNs: BigInt(Math.floor(baseProps.birthtimeMs * 1e6)),
      } as BigIntStats; // Cast to satisfy the type
    }
    // Otherwise, return a standard Stats-compatible object
    return baseProps as Stats;
  };

  // Check if the normalized path represents a mocked directory
  if (mockDirs.has(normalizedPath)) {
    return createStats(false);
  } // It's a directory
  // Check if the normalized path represents a mocked file (or generated file in loop test)
  if (mockFiles.has(normalizedPath) || path.basename(normalizedPath).startsWith('gen_')) {
    return createStats(true);
  } // It's a file

  // Path not found in mocks
  if (options?.throwIfNoEntry === false) {
    return undefined;
  } // Return undefined if not throwing
  // Throw ENOENT error if path not found and not suppressed
  const error: NodeJSErrnoException = new Error(
    `ENOENT (Mock): statSync path not found: ${normalizedPath}`
  );
  error.code = 'ENOENT';
  throw error;
};

// Mock implementation for axios.get
const axiosGetMockImplementation = async (
  url: string,
  config?: AxiosRequestConfig // Match axios.get signature
): Promise<AxiosResponse<Buffer>> => {
  // Return Buffer data
  // console.log(`[DEBUG mockAxiosGet] Requesting URL: "${url}"`); // Optional debug

  const { AxiosHeaders } = axiosNs; // Use the AxiosHeaders class from the namespace
  let dataBuffer: Buffer; // Content will be a Buffer
  let contentType = 'text/plain'; // Default content type
  let status = 200; // Default success status
  let statusText = 'OK'; // Default success status text

  // Helper to create mock Axios request headers
  const getRequestHeaders = (reqConfig?: AxiosRequestConfig): AxiosRequestHeaders => {
    const headers = new AxiosHeaders(); // Instantiate AxiosHeaders
    if (reqConfig?.headers) {
      // Copy headers from config if provided
      for (const key in reqConfig.headers) {
        if (Object.prototype.hasOwnProperty.call(reqConfig.headers, key)) {
          // Use AxiosHeaders methods for setting headers
          headers.set(key, reqConfig.headers[key] as AxiosHeaderValue);
        }
      }
    }
    return headers;
  };
  // Helper to create mock InternalAxiosRequestConfig
  const createInternalConfig = (reqConfig?: AxiosRequestConfig): InternalAxiosRequestConfig => {
    const requestHeaders = getRequestHeaders(reqConfig);
    // Construct the config object, ensuring headers is an AxiosHeaders instance
    // Need to satisfy the complex InternalAxiosRequestConfig type
    const internalConfig: InternalAxiosRequestConfig = {
      url: url,
      method: 'get',
      ...(reqConfig || {}), // Spread original config
      headers: requestHeaders, // Overwrite headers with AxiosHeaders instance
      // Add other potentially required fields with default values if needed
      // baseURL: reqConfig?.baseURL || '',
      // params: reqConfig?.params || {},
      // data: reqConfig?.data,
      // timeout: reqConfig?.timeout || 0,
      // responseType: reqConfig?.responseType || 'json',
      // ... add others based on Axios version and usage ...
    };
    return internalConfig;
  };

  // Simulate errors based on URL content
  if (url.includes('error')) {
    status = 404;
    statusText = 'Not Found';
  }
  // Simulate timeout using status code 408 and setting error code later
  if (url.includes('timeout')) {
    status = 408;
    statusText = 'Request Timeout';
  }

  // If simulating an error status
  if (status !== 200) {
    const errorConfig = createInternalConfig(config);
    // *** Create a plain object that mimics AxiosError ***
    const error: any = {
      // Use 'any' for flexibility in mock creation
      // Base Error properties (optional but good practice)
      name: 'Error', // Keep it generic or 'AxiosError'
      message:
        status === 404
          ? `Request failed with status code 404`
          : `Timeout of ${config?.timeout || 'unknown'}ms exceeded`,
      stack: new Error().stack, // Capture a stack trace

      // AxiosError specific properties
      isAxiosError: true, // Explicitly set the flag Axios checks
      code: status === 408 ? 'ECONNABORTED' : undefined, // Set code correctly
      config: errorConfig, // Attach the config
      request: {}, // Mock request object if needed
      response: {
        // Attach the mock response
        status,
        statusText,
        data: Buffer.from(statusText), // Mock data
        headers: new AxiosHeaders(),
        config: errorConfig,
      },
      // Add a basic toJSON if needed by any code consuming the error
      toJSON: function () {
        return { message: this.message, code: this.code };
      },
    };
    // console.log(`[DEBUG mockAxiosGet] Simulating ERROR object:`, error); // Optional debug
    throw error; // Throw the simulated error object
  }

  // Simulate successful responses with appropriate content and type based on URL
  if (url.includes('/styles/main.css')) {
    dataBuffer = Buffer.from('body { background: url("/images/remote-bg.jpg"); }');
    contentType = 'text/css';
  } else if (url.includes('/js/script.js')) {
    dataBuffer = Buffer.from('console.log("remote script");');
    contentType = 'application/javascript';
  } else if (url.includes('/js/lib.js')) {
    dataBuffer = Buffer.from('console.log("remote lib");');
    contentType = 'application/javascript';
  } // Handle protocol-relative case
  else if (url.includes('/images/remote-bg.jpg')) {
    dataBuffer = Buffer.from('mock-remote-image-data');
    contentType = 'image/jpeg';
  } else {
    dataBuffer = Buffer.from(`Mock content for ${url}`);
  } // Default fallback content

  // Create mock response configuration and headers
  const responseConfig = createInternalConfig(config);
  const responseHeaders = new AxiosHeaders({ 'content-type': contentType }); // Use AxiosHeaders

  // console.log(`[DEBUG mockAxiosGet] Simulating SUCCESS for URL: "${url}", ContentType: ${contentType}`); // Optional debug
  // Return the successful AxiosResponse object
  return {
    data: dataBuffer, // Data as Buffer
    status: 200,
    statusText: 'OK',
    headers: responseHeaders, // AxiosHeaders object
    config: responseConfig, // InternalAxiosRequestConfig object
    request: {}, // Mock request object (can be empty or more detailed if needed)
  };
};

// ================ TESTS ================

describe('extractAssets', () => {
  // Declare variables for logger and its spies
  let mockLogger: Logger;
  let mockLoggerWarnSpy: jest.SpiedFunction<typeof mockLogger.warn>;
  let mockLoggerErrorSpy: jest.SpiedFunction<typeof mockLogger.error>;

  beforeEach(() => {
    // --- Retrieve Mocked Functions from Modules ---
    // Use jest.requireMock to get the mocked versions of the modules
    // Cast to the specific mocked function type for type safety
    const fsPromisesMock = jest.requireMock('fs/promises') as typeof fsPromises;
    mockReadFile = fsPromisesMock.readFile as MockedReadFileFn;
    const fsMock = jest.requireMock('fs') as typeof fs;
    mockStatSync = fsMock.statSync as MockedStatSyncFn;
    const axiosMock = jest.requireMock('axios') as typeof axiosNs;
    mockAxiosGet = axiosMock.default.get as MockedAxiosGetFn;

    // --- Setup Logger and Spies ---
    // Create a new Logger instance for each test (set level low for debugging if needed)
    mockLogger = new Logger(LogLevel.WARN); // Or LogLevel.DEBUG
    // Spy on the warn and error methods of this logger instance
    mockLoggerWarnSpy = jest.spyOn(mockLogger, 'warn');
    mockLoggerErrorSpy = jest.spyOn(mockLogger, 'error');

    // --- Assign Mock Implementations ---
    // Set the implementation for the mocked functions for this test run
    // Use 'as any' to bypass strict type checking
    mockReadFile.mockImplementation(readFileMockImplementation as any);
    mockStatSync.mockImplementation(statSyncMockImplementation as any);
    mockAxiosGet.mockImplementation(axiosGetMockImplementation as any);
  });

  afterEach(() => {
    // Clear mock calls and reset implementations between tests
    jest.clearAllMocks();
    // Restore original implementations spied on with jest.spyOn (like the logger spies)
    jest.restoreAllMocks();
  });

  // ================ Test Cases ================

  it('should extract and embed assets from local HTML file', async () => {
    // Define the initial parsed HTML structure
    const parsed: ParsedHTML = {
      htmlContent: '<link href="style.css"><script src="script.js">',
      assets: [
        { type: 'css', url: 'style.css' },
        { type: 'js', url: 'script.js' },
      ], // Assets found directly in HTML
    };
    // Call the function under test
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger); // embedAssets = true
    // Define the expected final assets, including nested ones
    const expectedAssets: ExpectedAsset[] = [
      // Top-level CSS (content should be text)
      {
        type: 'css',
        url: resolveUrl('style.css', mockBaseFileUrl),
        content: expect.stringContaining('@import url("./css/deep.css");'),
      },
      // Top-level JS (content should be text)
      {
        type: 'js',
        url: resolveUrl('script.js', mockBaseFileUrl),
        content: 'console.log("mock script");',
      },
      // Nested CSS from style.css (content should be text)
      {
        type: 'css',
        url: resolveUrl('css/deep.css', mockBaseFileUrl),
        content: expect.stringContaining('nested-img.png'),
      },
      // Image referenced in style.css (content should be data URI)
      {
        type: 'image',
        url: resolveUrl('images/bg.png', mockBaseFileUrl),
        content: expect.stringMatching(/^data:image\/png;base64,/),
      },
      // Font referenced in style.css (content should be data URI)
      {
        type: 'font',
        url: resolveUrl('font/font.woff2', mockBaseFileUrl),
        content: expect.stringMatching(/^data:font\/woff2;base64,/),
      },
      // Image referenced in deep.css (content should be data URI)
      {
        type: 'image',
        url: resolveUrl('images/nested-img.png', mockBaseFileUrl),
        content: expect.stringMatching(/^data:image\/png;base64,/),
      },
    ];
    // Assert the final assets match the expected structure and content
    expectAssetsToContain(result.assets, expectedAssets);
    // Check how many times readFile was called (should be once for each unique file)
    expect(mockReadFile).toHaveBeenCalledTimes(6); // style.css, script.js, deep.css, bg.png, font.woff2, nested-img.png
  });

  it('should discover assets without embedding when embedAssets is false', async () => {
    // Initial HTML with one CSS link
    const parsed: ParsedHTML = {
      htmlContent: '<link href="style.css">',
      assets: [{ type: 'css', url: 'style.css' }],
    };
    // Call with embedAssets = false
    const result = await extractAssets(parsed, false, mockBaseFileUrl, mockLogger);
    // Expected assets should include all discovered URLs, but content should be undefined
    const expectedAssets: ExpectedAsset[] = [
      { type: 'css', url: resolveUrl('style.css', mockBaseFileUrl), content: undefined },
      { type: 'css', url: resolveUrl('css/deep.css', mockBaseFileUrl), content: undefined },
      { type: 'image', url: resolveUrl('images/bg.png', mockBaseFileUrl), content: undefined },
      { type: 'font', url: resolveUrl('font/font.woff2', mockBaseFileUrl), content: undefined },
      {
        type: 'image',
        url: resolveUrl('images/nested-img.png', mockBaseFileUrl),
        content: undefined,
      },
    ];
    // Assert the structure matches
    expectAssetsToContain(result.assets, expectedAssets);
    // readFile should only be called for CSS files (to parse them), not for images/fonts when not embedding
    expect(mockReadFile).toHaveBeenCalledTimes(2); // Only style.css, deep.css
  });

  it('should handle remote assets and their nested dependencies', async () => {
    // Define a remote base URL
    const remoteUrl = 'https://example.com/page.html';
    // Initial HTML structure with remote assets
    const parsed: ParsedHTML = {
      htmlContent: '<link href="styles/main.css"><script src="/js/script.js">', // Relative and absolute paths
      assets: [
        { type: 'css', url: 'styles/main.css' },
        { type: 'js', url: '/js/script.js' },
      ],
    };
    // Call with embedAssets = true
    const result = await extractAssets(parsed, true, remoteUrl, mockLogger);
    // Expected assets, including nested remote image from the mocked CSS content
    const expectedAssets: ExpectedAsset[] = [
      {
        type: 'css',
        url: resolveUrl('styles/main.css', remoteUrl),
        content: expect.stringContaining('background'),
      }, // Text content
      {
        type: 'js',
        url: resolveUrl('/js/script.js', remoteUrl),
        content: 'console.log("remote script");',
      }, // Text content
      {
        type: 'image',
        url: resolveUrl('/images/remote-bg.jpg', remoteUrl),
        content: expect.stringMatching(/^data:image\/jpeg;base64,/),
      }, // Data URI
    ];
    // Assert the results
    expectAssetsToContain(result.assets, expectedAssets);
    // Check that axios.get was called for each remote asset
    expect(mockAxiosGet).toHaveBeenCalledTimes(3); // main.css, script.js, remote-bg.jpg
    // Ensure local file reading was not attempted
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it('should handle ENOENT errors when reading local files', async () => {
    // HTML references a file that doesn't exist in the mock setup
    const parsed: ParsedHTML = {
      htmlContent: '<link href="nonexistent.file">',
      assets: [{ type: 'css', url: 'nonexistent.file' }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
    // Expect the asset list to contain the entry, but with undefined content
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].content).toBeUndefined();
    // Expect a warning log indicating the file was not found
    expect(mockLoggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `File not found (ENOENT) for asset: ${normalizePath(filePaths.nonexistent)}`
      )
    );
  });

  it('should handle permission denied errors when reading local files', async () => {
    // HTML references a file set up to trigger EACCES in the mock readFile
    const parsed: ParsedHTML = {
      htmlContent: '<link href="unreadable.file">',
      assets: [{ type: 'css', url: 'unreadable.file' }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
    // Expect the asset with undefined content
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].content).toBeUndefined();
    // *** CORRECTED EXPECTATION ***: Check for the specific EACCES warning message logged by the updated extractor.ts
    expect(mockLoggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Permission denied (EACCES) reading asset: ${normalizePath(filePaths.unreadable)}`
      )
    );
    // *** CORRECTED EXPECTATION ***: Verify readFile was called with ONLY the path argument
    expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.unreadable));
  });

  it('should handle HTTP errors when fetching remote assets', async () => {
    const remoteUrl = 'https://example.com/page.html';
    // Resolve the URL that will trigger a 404 in the axios mock
    const errorCssUrl = resolveUrl('styles/error.css', remoteUrl);
    // HTML referencing the error URL
    const parsed: ParsedHTML = {
      htmlContent: `<link href="${errorCssUrl}">`,
      assets: [{ type: 'css', url: errorCssUrl }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, remoteUrl, mockLogger);
    // Expect the asset with undefined content
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].content).toBeUndefined();
    expect(mockLoggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Failed to fetch remote asset ${errorCssUrl}: Request failed with status code 404 (Code: N/A)`
      ) // Changed undefined to N/A
    );
  });

  it('should handle timeout errors when fetching remote assets', async () => {
    const remoteUrl = 'https://example.com/page.html';
    // Resolve the URL that triggers a timeout (ECONNABORTED) in the axios mock
    const timeoutCssUrl = resolveUrl('styles/timeout.css', remoteUrl);
    // HTML referencing the timeout URL
    const parsed: ParsedHTML = {
      htmlContent: `<link href="${timeoutCssUrl}">`,
      assets: [{ type: 'css', url: timeoutCssUrl }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, remoteUrl, mockLogger);
    // Expect the asset with undefined content
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].content).toBeUndefined();
    // *** CORRECTED EXPECTATION ***: Check for the specific warning logged by the updated fetchAsset, including the code
    expect(mockLoggerWarnSpy).toHaveBeenCalledWith(
      // Match the simplified log format exactly
      expect.stringContaining(
        `Failed to fetch remote asset ${timeoutCssUrl}: Timeout of 10000ms exceeded (Code: ECONNABORTED)`
      )
    );
  });

  it('should handle invalid UTF-8 in CSS files by falling back to base64', async () => {
    // HTML referencing the CSS file with invalid UTF-8 content
    const parsed: ParsedHTML = {
      htmlContent: '<link href="invalid-utf8.css">',
      assets: [{ type: 'css', url: 'invalid-utf8.css' }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
    // Resolve the expected URL
    const expectedUrl = resolveUrl('invalid-utf8.css', mockBaseFileUrl);
    // Expect one asset in the result
    expect(result.assets).toHaveLength(1);
    // Expect the content to be a data URI containing the base64 representation of the original buffer
    expect(result.assets[0].content).toEqual(
      `data:text/css;base64,${invalidUtf8Buffer.toString('base64')}`
    );
    // *** CORRECTED EXPECTATION (from previous step) ***: Expect the single, combined warning message
    expect(mockLoggerWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Could not decode css asset ${expectedUrl} as valid UTF-8 text. Falling back to base64 data URI.`
      )
    );
    // Ensure only one warning related to this was logged
    expect(mockLoggerWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('should avoid circular references in CSS imports', async () => {
    // HTML referencing the start of a CSS import cycle
    const parsed: ParsedHTML = {
      htmlContent: '<link href="cycle1.css">',
      assets: [{ type: 'css', url: 'cycle1.css' }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
    // Expected assets: both cycle1.css and cycle2.css should be found, but the loop should terminate
    const expectedAssets: ExpectedAsset[] = [
      {
        type: 'css',
        url: resolveUrl('cycle1.css', mockBaseFileUrl),
        content: expect.stringContaining('@import url("cycle2.css");'),
      },
      {
        type: 'css',
        url: resolveUrl('cycle2.css', mockBaseFileUrl),
        content: expect.stringContaining('@import url("cycle1.css");'),
      }, // Should find cycle2
    ];
    // Assert the expected assets were found
    expectAssetsToContain(result.assets, expectedAssets);
    // Ensure no loop limit error was logged
    expect(mockLoggerErrorSpy).not.toHaveBeenCalled(); // Check error spy specifically
    // *** CORRECTED EXPECTATION ***: Verify both CSS files were read (with only one argument)
    expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.cycle1Css));
    expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.cycle2Css));
  });

  it('should enforce maximum iteration limit to prevent infinite loops', async () => {
    // *** CORRECTED MOCK IMPLEMENTATION ***: Mock readFile to generate new CSS files endlessly
    const iterationTestReadFileMock = async (
      filePathArg: PathLike | FileHandle
    ): Promise<Buffer | string> => {
      let normalizedPath: string = '';
      try {
        if (filePathArg instanceof URL) {
          normalizedPath = path.normalize(fileURLToPath(filePathArg));
        } else if (typeof filePathArg === 'string') {
          normalizedPath = path.normalize(
            filePathArg.startsWith('file:') ? fileURLToPath(filePathArg) : filePathArg
          );
        } else {
          throw new Error('Unsupported readFile input type in iteration mock');
        }
      } catch (e) {
        console.error('Error normalizing path in iteration mock:', filePathArg, e);
        throw e;
      }
      const filename = path.basename(normalizedPath);
      const match = filename.match(/gen_(\d+)\.css$/);
      const isStart = filename === 'start.css';
      if (match || isStart) {
        const currentNum = match ? parseInt(match[1], 10) : 0;
        const nextNum = currentNum + 1;
        const nextFileName = `gen_${nextNum}.css`;
        return Buffer.from(`@import url("${nextFileName}");`);
      }
      const error: NodeJSErrnoException = new Error(
        `ENOENT (Mock Iteration): Unexpected path ${normalizedPath}`
      );
      error.code = 'ENOENT';
      throw error;
    };
    mockReadFile.mockImplementation(iterationTestReadFileMock as any);

    const parsed: ParsedHTML = {
      htmlContent: '<link href="start.css">',
      assets: [{ type: 'css', url: 'start.css' }],
    };
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);

    expect(result.assets.length).toBeGreaterThan(0);
    // *** CORRECTED EXPECTATION ***: Check that the ERROR logger was called exactly TWICE
    expect(mockLoggerErrorSpy).toHaveBeenCalledTimes(2);
    // *** CORRECTED EXPECTATION ***: Check that the FIRST error message contains the loop limit text
    expect(mockLoggerErrorSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('Asset extraction loop limit hit')
    );
    // *** CORRECTED EXPECTATION ***: Check the SECOND error message contains the remaining queue text
    expect(mockLoggerErrorSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('Remaining queue sample')
    );
  });

  it('should handle data URIs in CSS without trying to fetch them', async () => {
    // HTML referencing CSS that contains a data URI
    const parsed: ParsedHTML = {
      htmlContent: '<link href="data-uri.css">',
      assets: [{ type: 'css', url: 'data-uri.css' }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
    // Expect only the CSS file itself to be in the final assets
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].url).toEqual(resolveUrl('data-uri.css', mockBaseFileUrl));
    // *** CORRECTED EXPECTATION ***: Verify the CSS file was read (with only one argument)
    expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.dataUriCss));
    // Crucially, verify that no HTTP request was made (axios mock shouldn't be called)
    expect(mockAxiosGet).not.toHaveBeenCalled();
  });

  it('should handle CSS URLs with query parameters and fragments correctly', async () => {
    // HTML referencing CSS which contains a URL with query/fragment
    const parsed: ParsedHTML = {
      htmlContent: '<link href="complex-url.css">',
      assets: [{ type: 'css', url: 'complex-url.css' }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, mockBaseFileUrl, mockLogger);
    // Define the expected resolved URLs
    const expectedCssUrl = resolveUrl('complex-url.css', mockBaseFileUrl);
    // The URL for the nested asset keeps the query/fragment
    const expectedBgUrlWithQuery = resolveUrl('images/bg.png?v=123#section', mockBaseFileUrl);
    // The path used to *fetch* the asset should NOT have the query/fragment
    const expectedBgFetchPath = normalizePath(filePaths.bgImage);
    // Define expected assets
    const expectedAssets: ExpectedAsset[] = [
      {
        type: 'css',
        url: expectedCssUrl,
        content: expect.stringContaining('images/bg.png?v=123#section'),
      }, // CSS content as text
      {
        type: 'image',
        url: expectedBgUrlWithQuery,
        content: expect.stringMatching(/^data:image\/png;base64,/),
      }, // Image as data URI
    ];
    // Assert results
    expectAssetsToContain(result.assets, expectedAssets);
    // *** CORRECTED EXPECTATION ***: Check that the correct files were read (with only one argument)
    expect(mockReadFile).toHaveBeenCalledWith(normalizePath(filePaths.complexUrlCss));
    // *** CORRECTED EXPECTATION ***: Verify the *fetch path* was used (with only one argument)
    expect(mockReadFile).toHaveBeenCalledWith(expectedBgFetchPath);
  });

  it('should properly resolve protocol-relative URLs using the base URL protocol', async () => {
    // Define an HTTPS base URL for the HTML
    const htmlBase = 'https://mysite.com/page.html';
    // HTML contains a protocol-relative script URL (starts with //)
    const parsed: ParsedHTML = {
      htmlContent: '<script src="//example.com/js/lib.js"></script>',
      assets: [{ type: 'js', url: '//example.com/js/lib.js' }],
    };
    // Call extractor
    const result = await extractAssets(parsed, true, htmlBase, mockLogger);
    // Expect the protocol-relative URL to be resolved using the base URL's protocol (https)
    const expectedUrl = 'https://example.com/js/lib.js';
    // Define expected assets
    const expectedAssets: ExpectedAsset[] = [
      { type: 'js', url: expectedUrl, content: 'console.log("remote lib");' }, // Content comes from Axios mock
    ];
    // Assert results
    expectAssetsToContain(result.assets, expectedAssets);
    // Verify axios was called with the correctly resolved HTTPS URL
    expect(mockAxiosGet).toHaveBeenCalledWith(expectedUrl, expect.anything());
  });
}); // End describe block
