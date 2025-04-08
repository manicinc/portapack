/**
 * @file jest.setup.cjs
 * @description Jest global setup script executed before test suites run (per file).
 * Responsible for creating temporary directories for test outputs and fixtures,
 * setting up mock data (like the sample project), and cleaning up afterwards.
 * Uses CommonJS syntax as Jest setup files often run in a CJS context.
 */

// Node.js core modules required for setup
const fs = require('fs/promises'); // Using promises API for async operations
const path = require('path');
const crypto = require('crypto');
const os = require('os');

// Generate a unique ID for each test execution session.
// This helps isolate test runs if running concurrently or prevents conflicts
// if cleanup fails on a previous run.
const TEST_RUN_ID = crypto.randomBytes(4).toString('hex');

// Helper function for resolving paths relative to this setup file's directory
// (usually the project root or a specific test config directory)
const resolve = (...args) => path.resolve(__dirname, ...args);

/**
 * Utility function to ensure a directory exists.
 * Creates the directory recursively if it doesn't exist.
 * Ignores 'EEXIST' error if the directory is already present.
 * @param {string} dir - The absolute path of the directory to ensure.
 * @returns {Promise<void>}
 * @throws {Error} Throws errors other than 'EEXIST' during directory creation.
 */
const ensureDir = async (dir) => {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {
        // If the error is simply that the directory already exists, ignore it.
        if (e.code !== 'EEXIST') {
            console.error(`Failed to ensure directory ${dir}:`, e); // Log unexpected errors
            throw e; // Re-throw other errors
        }
    }
};

// Define the base temporary directory using the OS's temp location and the unique run ID.
// Using os.tmpdir() is generally safer regarding permissions and OS conventions.
const tempDir = path.join(os.tmpdir(), 'portapack-tests', TEST_RUN_ID);

/**
 * Object containing base paths for various test-related directories.
 * These are constructed relative to the main temporary directory.
 */
const baseDirs = {
    root: resolve(), // Project root (where jest.config / setup file likely is)
    output: path.join(tempDir, 'test-output'), // General output for test artifacts
    fixtures: path.join(tempDir, '__fixtures__'), // Base for fixture data (if needed)
    fixturesOutput: path.join(tempDir, '__fixtures__/output'), // Output specifically related to fixtures
    sampleProject: path.join(tempDir, 'sample-project') // Directory for the mock HTML project
};

/**
 * Jest's global beforeAll hook. Runs once before any tests in a suite file execute.
 * Sets up the necessary directory structure and global variables/mocks for tests.
 */
beforeAll(async () => {
    console.log(`Setting up test environment in: ${tempDir}`); // Log setup start

    // Create essential output/fixture directories early.
    // Using Promise.all here is likely safe as they are independent paths.
    await Promise.all([
        ensureDir(baseDirs.output),
        ensureDir(baseDirs.fixturesOutput)
    ]);

    // Define paths specific to this test run using the TEST_RUN_ID for further isolation.
    const runDirs = {
        uniqueOutput: path.join(baseDirs.output, TEST_RUN_ID),
        uniqueFixturesOutput: path.join(baseDirs.fixturesOutput, TEST_RUN_ID)
    };

    // Create the run-specific directories.
    await Promise.all([
        fs.mkdir(runDirs.uniqueOutput, { recursive: true }),
        fs.mkdir(runDirs.uniqueFixturesOutput, { recursive: true })
    ]);

    // --- Set up global variables accessible within tests ---
    // This provides a consistent way for tests to access temporary paths.
    global.__TEST_DIRECTORIES__ = {
        ...baseDirs,
        ...runDirs
    };

    // Helper function for tests to get a path within the unique test output directory.
    global.getTestFilePath = (relPath) =>
        path.join(global.__TEST_DIRECTORIES__.uniqueOutput, relPath);

    // Helper function for tests to get a path within the unique fixture output directory.
    global.getTestFixturePath = (relPath) =>
        path.join(global.__TEST_DIRECTORIES__.uniqueFixturesOutput, relPath);

    // --- Create specific mock files needed by certain tests ---
    // Example: Creating virtual font files for font processing tests.
    await ensureDir(path.dirname(path.join(tempDir, 'font.woff2'))); // Ensure parent dir exists
    await ensureDir(path.dirname(path.join(tempDir, 'font.ttf')));
    // No need to ensureDir for 'missing.ttf' as we only need the path, not the file

    // Write mock content to the font files.
    await fs.writeFile(path.join(tempDir, 'font.woff2'), 'mock woff2 data');
    await fs.writeFile(path.join(tempDir, 'font.ttf'), 'mock ttf data');

    // Set up a global variable pointing to the temp directory for potential use in mocks.
    global.__MOCK_FILE_PATH__ = tempDir;

    // --- Create the stub/mock sample HTML project ---
    // **FIX APPLIED HERE:** Ensure directory exists *before* writing files into it
    // to prevent ENOENT race conditions.

    console.log(`Ensuring sample project directory exists: ${baseDirs.sampleProject}`);
    // 1. Ensure the sample project directory exists FIRST
    await ensureDir(baseDirs.sampleProject);

    // 2. THEN write all the files into it using Promise.all for concurrency (safe now).
    try {
        console.log(`Writing sample project files to ${baseDirs.sampleProject}...`);
        await Promise.all([
            fs.writeFile(
                path.join(baseDirs.sampleProject, 'index.html'),
                `<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><img src="logo.png"/><script src="script.js"></script></body></html>`
            ),
            fs.writeFile(path.join(baseDirs.sampleProject, 'styles.css'), 'body { margin: 0; }'),
            fs.writeFile(path.join(baseDirs.sampleProject, 'script.js'), `console.log('hello');`),
            fs.writeFile(path.join(baseDirs.sampleProject, 'logo.png'), 'fake image data') // Using string for simplicity
        ]);
        console.log(`Successfully wrote sample project files.`);
    } catch (writeError) {
        console.error(`Failed to write sample project files to ${baseDirs.sampleProject}:`, writeError);
        // Depending on setup needs, you might want to stop the tests here.
        throw writeError; // Re-throw to potentially fail the setup.
    }
    // --- End Fix ---

    // --- Mock console methods ---
    // This helps keep test output clean and allows assertions on console messages.
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Replace global console methods with Jest mocks.
    global.console.log = jest.fn((...args) => {
        // Only log to actual console if DEBUG environment variable is set.
        if (process.env.DEBUG) {
            originalLog(...args);
        }
    });

    global.console.warn = jest.fn((...args) => {
        // Optionally filter specific warnings you expect and don't want cluttering output.
        const msg = args.join(' ');
        if (
            msg.includes('Could not fetch asset') ||
            msg.includes('Error minifying')
            // Add other expected warning patterns here if needed
        ) {
            return; // Suppress specific known warnings
        }
        // Log other warnings, potentially only in debug mode.
        if (process.env.DEBUG) {
            originalWarn(...args);
        }
    });

    global.console.error = jest.fn((...args) => {
        // Always show errors, especially in debug mode.
        // Could add filtering if there are known, non-critical errors to ignore.
        if (process.env.DEBUG) {
            originalError(...args);
        }
        // Potentially log even without DEBUG for visibility during tests
        // originalError(...args);
    });

    console.log("Test setup complete."); // Log setup finish
});

/**
 * Jest's global afterAll hook. Runs once after all tests in a suite file have completed.
 * Cleans up the temporary directory created for the test run.
 */
afterAll(async () => {
    console.log(`Cleaning up test environment in: ${tempDir}`); // Log cleanup start
    const dirs = global.__TEST_DIRECTORIES__; // Retrieve paths from global scope
    if (!dirs) {
        console.warn("Global test directories not found during cleanup.");
        return;
    }

    try {
        // Recursively remove the entire temporary directory for this test run.
        // Using force: true helps ignore errors if files are missing (e.g., cleanup already ran partially).
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`Successfully cleaned up test directory: ${tempDir}`);
    } catch (e) {
        // Log errors during cleanup but don't fail the tests typically.
        // ENOENT means the directory was already gone, which is fine.
        if (e.code !== 'ENOENT') {
            console.warn(`Could not fully clean test directory ${tempDir}:`, e.message);
        } else {
            console.log(`Test directory already removed: ${tempDir}`);
        }
    }
});