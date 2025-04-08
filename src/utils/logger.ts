/**
 * @file src/utils/logger.ts
 * @description Provides a standardized logging utility with configurable levels (based on an enum)
 * to control output verbosity throughout the application (core, API, CLI).
 */

// FIX: Use a regular import for the enum, not 'import type'
import { LogLevel } from '../types';
// Assuming LogLevel enum is defined and exported in '../types' like:
// export enum LogLevel { NONE = 0, ERROR = 1, WARN = 2, INFO = 3, DEBUG = 4 }

/**
 * Optional configuration for creating a Logger instance.
 * (Note: Currently constructor only accepts LogLevel directly)
 */
export interface LoggerOptions {
    level?: LogLevel;
}

/**
 * A simple logger class that allows filtering messages based on severity levels.
 * Uses standard console methods (debug, info, warn, error) for output.
 */
export class Logger {
    /** The current minimum log level required for a message to be output. */
    public level: LogLevel;

    /**
     * Creates a new Logger instance.
     * Defaults to LogLevel.INFO if no level is provided.
     *
     * @param {LogLevel} [level=LogLevel.INFO] - The initial log level for this logger instance.
     * Must be one of the values from the LogLevel enum.
     */
    constructor(level: LogLevel = LogLevel.INFO) { // Defaulting to INFO level using the enum value
        // Ensure a valid LogLevel enum member is provided or default correctly
        this.level = (level !== undefined && LogLevel[level] !== undefined)
            ? level
            : LogLevel.INFO; // Use the enum value for default
    }

    /**
     * Updates the logger's current level. Messages below this level will be suppressed.
     *
     * @param {LogLevel} level - The new log level to set. Must be a LogLevel enum member.
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }

    /**
     * Logs a debug message if the current log level is DEBUG or higher.
     *
     * @param {string} message - The debug message string.
     */
    debug(message: string): void {
        // Use enum member for comparison
        if (this.level >= LogLevel.DEBUG) {
            console.debug(`[DEBUG] ${message}`);
        }
    }

    /**
     * Logs an informational message if the current log level is INFO or higher.
     *
     * @param {string} message - The informational message string.
     */
    info(message: string): void {
        // Use enum member for comparison
        if (this.level >= LogLevel.INFO) {
            console.info(`[INFO] ${message}`);
        }
    }

    /**
     * Logs a warning message if the current log level is WARN or higher.
     *
     * @param {string} message - The warning message string.
     */
    warn(message: string): void {
        // Use enum member for comparison
        if (this.level >= LogLevel.WARN) {
            console.warn(`[WARN] ${message}`);
        }
    }

    /**
     * Logs an error message if the current log level is ERROR or higher.
     *
     * @param {string} message - The error message string.
     */
    error(message: string): void {
        // Use enum member for comparison
        if (this.level >= LogLevel.ERROR) {
            console.error(`[ERROR] ${message}`);
        }
    }

    /**
     * Static factory method to create a Logger instance based on a simple boolean `verbose` flag.
     *
     * @static
     * @param {{ verbose?: boolean }} [options={}] - An object potentially containing a `verbose` flag.
     * @returns {Logger} A new Logger instance set to LogLevel.DEBUG if options.verbose is true,
     * otherwise set to LogLevel.INFO.
     */
    static fromVerboseFlag(options: { verbose?: boolean } = {}): Logger {
        // Use enum members for assignment
        return new Logger(options.verbose ? LogLevel.DEBUG : LogLevel.INFO);
    }

     /**
      * Static factory method to create a Logger instance based on a LogLevel string name.
      * Useful for creating a logger from config files or environments variables.
      *
      * @static
      * @param {string | undefined} levelName - The name of the log level (e.g., 'debug', 'info', 'warn', 'error', 'silent'/'none'). Case-insensitive.
      * @param {LogLevel} [defaultLevel=LogLevel.INFO] - The level to use if levelName is invalid or undefined.
      * @returns {Logger} A new Logger instance set to the corresponding LogLevel.
      */
     static fromLevelName(levelName?: string, defaultLevel: LogLevel = LogLevel.INFO): Logger {
         if (!levelName) {
             return new Logger(defaultLevel);
         }
         switch (levelName.toLowerCase()) {
             // Return enum members
             case 'debug': return new Logger(LogLevel.DEBUG);
             case 'info': return new Logger(LogLevel.INFO);
             case 'warn': return new Logger(LogLevel.WARN);
             case 'error': return new Logger(LogLevel.ERROR);
             case 'silent':
             case 'none': return new Logger(LogLevel.NONE);
             default:
                 // Use console.warn directly here as logger might not be ready
                 console.warn(`[Logger] Invalid log level name "${levelName}". Defaulting to ${LogLevel[defaultLevel]}.`);
                 return new Logger(defaultLevel);
         }
     }
}