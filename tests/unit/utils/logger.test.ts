/**
 * @file tests/unit/utils/logger.test.ts
 * @description Unit tests for the Logger module.
 */
import { Logger } from '../../../src/utils/logger';
import { LogLevel } from '../../../src/types';
import { jest, describe, it, beforeEach, afterEach, expect } from '@jest/globals'; // Ensure expect is imported

describe('Logger', () => {
  // Save original console methods
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  // Create mock functions for console methods
  let mockLog: jest.Mock;
  let mockWarn: jest.Mock;
  let mockError: jest.Mock;
  let mockInfo: jest.Mock;
  let mockDebug: jest.Mock;

  beforeEach(() => {
    // Setup mocks
    mockLog = jest.fn();
    mockWarn = jest.fn();
    mockError = jest.fn();
    mockInfo = jest.fn();
    mockDebug = jest.fn();

    // Override console methods
    console.log = mockLog;
    console.warn = mockWarn;
    console.error = mockError;
    console.info = mockInfo;
    console.debug = mockDebug;
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.debug = originalConsole.debug;
  });

  describe('Logger instantiation', () => {
    it('creates a logger with default log level INFO', () => {
      const logger = new Logger();
      expect(logger).toBeDefined();
      // REMOVED: @ts-expect-error Access private member for testing (No longer needed)
      expect((logger as any).level).toBe(LogLevel.INFO); // Cast to any if 'level' is truly private and inaccessible
      // Or make 'level' public/internal for testing if appropriate
    });

    it('creates a logger with specific log level', () => {
      const logger = new Logger(LogLevel.DEBUG);
      expect(logger).toBeDefined();
      expect((logger as any).level).toBe(LogLevel.DEBUG);
    });

    // Test constructor guards against invalid levels
    it('defaults to INFO if constructor receives invalid level', () => {
      // @ts-expect-error Testing invalid input (KEEP this one if Logger constructor expects LogLevel)
      const logger = new Logger(99);
      // REMOVED: @ts-expect-error Access private member for testing (No longer needed)
      expect((logger as any).level).toBe(LogLevel.INFO);
    });
    it('defaults to INFO if constructor receives undefined', () => {
      const logger = new Logger(undefined);
      // REMOVED: @ts-expect-error Access private member for testing (No longer needed)
      expect((logger as any).level).toBe(LogLevel.INFO);
    });
  });

  describe('Log methods', () => {
    // Existing tests for error, warn, info, debug, none are good... keep them

    it('logs error messages only when level >= ERROR', () => {
      const loggerError = new Logger(LogLevel.ERROR);
      const loggerNone = new Logger(LogLevel.NONE);

      loggerError.error('Test error');
      expect(mockError).toHaveBeenCalledTimes(1);
      expect(mockError).toHaveBeenCalledWith('[ERROR] Test error');

      loggerError.warn('Test warn'); // Should not log
      expect(mockWarn).not.toHaveBeenCalled();

      mockError.mockClear(); // Clear for next check
      loggerNone.error('Test error none'); // Should not log
      expect(mockError).not.toHaveBeenCalled();
    });

    it('logs warn messages only when level >= WARN', () => {
      const loggerWarn = new Logger(LogLevel.WARN);
      const loggerError = new Logger(LogLevel.ERROR); // Lower level

      loggerWarn.warn('Test warn');
      expect(mockWarn).toHaveBeenCalledTimes(1);
      expect(mockWarn).toHaveBeenCalledWith('[WARN] Test warn');
      loggerWarn.error('Test error'); // Should also log
      expect(mockError).toHaveBeenCalledTimes(1);

      mockWarn.mockClear();
      mockError.mockClear(); // Clear mockError too for the next check
      loggerError.warn('Test warn error level'); // Should not log
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('logs info messages only when level >= INFO', () => {
      const loggerInfo = new Logger(LogLevel.INFO);
      const loggerWarn = new Logger(LogLevel.WARN); // Lower level

      loggerInfo.info('Test info');
      expect(mockInfo).toHaveBeenCalledTimes(1);
      expect(mockInfo).toHaveBeenCalledWith('[INFO] Test info');
      loggerInfo.warn('Test warn'); // Should also log
      expect(mockWarn).toHaveBeenCalledTimes(1);

      mockInfo.mockClear();
      mockWarn.mockClear(); // Clear mockWarn too
      loggerWarn.info('Test info warn level'); // Should not log
      expect(mockInfo).not.toHaveBeenCalled();
    });

    it('logs debug messages only when level >= DEBUG', () => {
      const loggerDebug = new Logger(LogLevel.DEBUG);
      const loggerInfo = new Logger(LogLevel.INFO); // Lower level

      loggerDebug.debug('Test debug');
      expect(mockDebug).toHaveBeenCalledTimes(1);
      expect(mockDebug).toHaveBeenCalledWith('[DEBUG] Test debug');
      loggerDebug.info('Test info'); // Should also log
      expect(mockInfo).toHaveBeenCalledTimes(1);

      mockDebug.mockClear();
      mockInfo.mockClear(); // Clear mockInfo too
      loggerInfo.debug('Test debug info level'); // Should not log
      expect(mockDebug).not.toHaveBeenCalled();
    });

    it('does not log anything at NONE level', () => {
      const logger = new Logger(LogLevel.NONE);

      logger.error('Test error');
      logger.warn('Test warn');
      logger.info('Test info');
      logger.debug('Test debug');

      expect(mockError).not.toHaveBeenCalled();
      expect(mockWarn).not.toHaveBeenCalled();
      expect(mockInfo).not.toHaveBeenCalled();
      expect(mockDebug).not.toHaveBeenCalled();
    });
  });

  describe('setLevel method', () => {
    // Existing test for setLevel is good... keep it
    it('changes log level dynamically', () => {
      const logger = new Logger(LogLevel.NONE);

      // Nothing should log at NONE level
      logger.error('Test error 1');
      expect(mockError).not.toHaveBeenCalled();

      // Change to ERROR level
      logger.setLevel(LogLevel.ERROR);

      // Now ERROR should log
      logger.error('Test error 2');
      expect(mockError).toHaveBeenCalledTimes(1); // Called once now
      expect(mockError).toHaveBeenCalledWith('[ERROR] Test error 2');

      // But WARN still should not
      logger.warn('Test warn');
      expect(mockWarn).not.toHaveBeenCalled();

      // Change to DEBUG level
      logger.setLevel(LogLevel.DEBUG);

      // Now all levels should log
      logger.warn('Test warn 2');
      logger.info('Test info');
      logger.debug('Test debug');

      expect(mockWarn).toHaveBeenCalledTimes(1); // Called once now
      expect(mockWarn).toHaveBeenCalledWith('[WARN] Test warn 2');
      expect(mockInfo).toHaveBeenCalledTimes(1);
      expect(mockInfo).toHaveBeenCalledWith('[INFO] Test info');
      expect(mockDebug).toHaveBeenCalledTimes(1);
      expect(mockDebug).toHaveBeenCalledWith('[DEBUG] Test debug');
    });
  });

  // --- Tests for static factory methods ---
  describe('Static factory methods', () => {
    describe('Logger.fromVerboseFlag()', () => {
      it('creates logger with DEBUG level if verbose is true', () => {
        const logger = Logger.fromVerboseFlag({ verbose: true });
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.DEBUG);
      });

      it('creates logger with INFO level if verbose is false', () => {
        const logger = Logger.fromVerboseFlag({ verbose: false });
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.INFO);
      });

      it('creates logger with INFO level if verbose is undefined', () => {
        const logger = Logger.fromVerboseFlag({}); // Empty options
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.INFO);
      });

      it('creates logger with INFO level if options is undefined', () => {
        const logger = Logger.fromVerboseFlag(); // No options arg
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.INFO);
      });
    });

    describe('Logger.fromLevelName()', () => {
      it.each([
        ['debug', LogLevel.DEBUG],
        ['info', LogLevel.INFO],
        ['warn', LogLevel.WARN],
        ['error', LogLevel.ERROR],
        ['none', LogLevel.NONE],
        ['silent', LogLevel.NONE],
        ['DEBUG', LogLevel.DEBUG], // Case-insensitive
        ['InFo', LogLevel.INFO],
      ])('creates logger with correct level for valid name "%s"', (name, expectedLevel) => {
        const logger = Logger.fromLevelName(name);
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(expectedLevel);
        expect(mockWarn).not.toHaveBeenCalled(); // No warning for valid names
      });

      it('defaults to INFO level if levelName is undefined', () => {
        const logger = Logger.fromLevelName(undefined);
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.INFO);
        expect(mockWarn).not.toHaveBeenCalled();
      });

      it('uses provided defaultLevel if levelName is undefined', () => {
        const logger = Logger.fromLevelName(undefined, LogLevel.WARN);
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.WARN);
        expect(mockWarn).not.toHaveBeenCalled();
      });

      it('defaults to INFO level and logs warning for invalid name', () => {
        const logger = Logger.fromLevelName('invalidLevel');
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.INFO); // Falls back to default INFO
        // Check that console.warn was called *directly* by the static method
        expect(mockWarn).toHaveBeenCalledTimes(1);
        expect(mockWarn).toHaveBeenCalledWith(
          expect.stringContaining(
            '[Logger] Invalid log level name "invalidLevel". Defaulting to INFO.'
          )
        );
      });

      it('uses provided defaultLevel and logs warning for invalid name', () => {
        const logger = Logger.fromLevelName('invalidLevel', LogLevel.ERROR);
        // REMOVED: @ts-expect-error Access private member (No longer needed)
        expect((logger as any).level).toBe(LogLevel.ERROR); // Falls back to provided default ERROR
        // Check that console.warn was called *directly* by the static method
        expect(mockWarn).toHaveBeenCalledTimes(1);
        expect(mockWarn).toHaveBeenCalledWith(
          expect.stringContaining(
            '[Logger] Invalid log level name "invalidLevel". Defaulting to ERROR.'
          )
        );
      });
    });
  });
});
