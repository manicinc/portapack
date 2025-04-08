import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { getFontMimeType, encodeFontToDataURI } from '../../../src/utils/font';
import fs from 'fs/promises';
import path from 'path';

// Use the temp directory path from Jest setup
const getTempPath = (filePath: string) => path.join(global.__MOCK_FILE_PATH__ || '', filePath);

// Define type for the mock module
interface FSModule {
  readFile: typeof fs.readFile;
  [key: string]: any;
}

// Mock fs module
jest.mock('fs/promises', () => {
  const actual = jest.requireActual('fs/promises') as FSModule;
  
  return {
    // Use explicit types
    readFile: jest.fn(async (filePath: string) => {
      // If this is a test font file we prepared in setup, map it to our temp directory
      if (filePath.includes('font.woff2') || 
          filePath.includes('font.ttf') || 
          filePath.includes('missing.ttf')) {
        const fileName = path.basename(filePath);
        const tempPath = getTempPath(fileName);
        
        if (fileName === 'missing.ttf') {
          throw new Error('File system error: boom!');
        }
        
        return actual.readFile(tempPath);
      }
      
      return actual.readFile(filePath);
    }),
    // Copy other properties from original module
    mkdir: actual.mkdir,
    writeFile: actual.writeFile,
    // ...add other methods as needed
  };
});

describe('🖋️ Font Utils', () => {
  describe('getFontMimeType()', () => {
    it('returns correct MIME for common formats', () => {
      expect(getFontMimeType('font.woff')).toBe('font/woff');
      expect(getFontMimeType('font.woff2')).toBe('font/woff2');
      expect(getFontMimeType('font.ttf')).toBe('font/ttf');
      expect(getFontMimeType('font.otf')).toBe('font/otf');
      expect(getFontMimeType('font.eot')).toBe('application/vnd.ms-fontobject');
      expect(getFontMimeType('font.svg')).toBe('image/svg+xml');
    });

    it('handles uppercase extensions', () => {
      expect(getFontMimeType('font.WOFF2')).toBe('font/woff2');
      expect(getFontMimeType('font.TTF')).toBe('font/ttf');
    });

    it('handles file paths', () => {
      expect(getFontMimeType('/path/to/font.woff2')).toBe('font/woff2');
      expect(getFontMimeType('C:\\windows\\fonts\\font.ttf')).toBe('font/ttf');
    });

    it('returns octet-stream for unknown types', () => {
      expect(getFontMimeType('font.xyz')).toBe('application/octet-stream');
      expect(getFontMimeType('font')).toBe('application/octet-stream');
    });
  });

  describe('encodeFontToDataURI()', () => {
    const mockReadFileFn = fs.readFile as jest.MockedFunction<typeof fs.readFile>;

    beforeEach(() => {
      mockReadFileFn.mockClear();
    });

    it('encodes font file as base64 data URI', async () => {
      const result = await encodeFontToDataURI(getTempPath('font.woff2'));
      
      expect(mockReadFileFn).toHaveBeenCalled();
      expect(result).toMatch(/^data:font\/woff2;base64,/);
    });

    it('infers MIME type from extension', async () => {
      const result = await encodeFontToDataURI(getTempPath('font.ttf'));
      
      expect(mockReadFileFn).toHaveBeenCalled();
      expect(result).toMatch(/^data:font\/ttf;base64,/);
    });

    it('throws on file read failure', async () => {
      // This will throw a specific error from our mock
      await expect(encodeFontToDataURI(getTempPath('missing.ttf'))).rejects.toThrow('File system error: boom!');
      
      // Verify readFile was called
      expect(mockReadFileFn).toHaveBeenCalledTimes(1);
    });
  });
});