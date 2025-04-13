// jest.setup.cjs
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
// const jest = require('@jest/globals'); // REMOVE THIS LINE

const TEST_RUN_ID = crypto.randomBytes(4).toString('hex');
const resolve = (...args) => path.resolve(__dirname, ...args);

// Use the *original* console.log temporarily for setup debugging
const originalSetupLog = console.log;

const ensureDir = async (dir) => {
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (e) {
        if (e.code !== 'EEXIST') {
            originalSetupLog(`[SETUP-ERROR] Failed to ensure directory ${dir}:`, e);
            throw e;
        }
    }
};

const tempDir = path.join(os.tmpdir(), 'portapack-tests', TEST_RUN_ID);
// *** Make sure baseDirs is defined ***
// (Assuming it was defined correctly before the placeholder comment)
const baseDirs = {
    root: resolve(), // Project root
    output: path.join(tempDir, 'test-output'), // General output
    fixtures: path.join(tempDir, '__fixtures__'), // Base for fixtures
    fixturesOutput: path.join(tempDir, '__fixtures__/output'), // Fixture output
    sampleProject: path.join(tempDir, 'sample-project') // Mock project dir
};
// **********************************


// --- Use Jest's GLOBAL beforeAll/afterAll/jest ---
// These are available globally in setup files
beforeAll(async () => {
    originalSetupLog(`[SETUP] Starting setup in: ${tempDir}`);

    originalSetupLog('[SETUP] Ensuring baseDirs...');
    // Make sure baseDirs is defined before using it
    if (!baseDirs || !baseDirs.output || !baseDirs.fixturesOutput) {
        throw new Error("baseDirs is not properly defined!");
    }
    await Promise.all([
        ensureDir(baseDirs.output),
        ensureDir(baseDirs.fixturesOutput)
    ]);
    originalSetupLog('[SETUP] BaseDirs ensured.');

    originalSetupLog('[SETUP] Creating runDirs...');
    const runDirs = {
        uniqueOutput: path.join(baseDirs.output, TEST_RUN_ID),
        uniqueFixturesOutput: path.join(baseDirs.fixturesOutput, TEST_RUN_ID)
    };
    await Promise.all([
        fs.mkdir(runDirs.uniqueOutput, { recursive: true }),
        fs.mkdir(runDirs.uniqueFixturesOutput, { recursive: true })
    ]);
    originalSetupLog('[SETUP] RunDirs created.');

    originalSetupLog('[SETUP] Setting globals...');
    global.__TEST_DIRECTORIES__ = { ...baseDirs, ...runDirs };
    global.getTestFilePath = (relPath) => path.join(global.__TEST_DIRECTORIES__.uniqueOutput, relPath);
    global.getTestFixturePath = (relPath) => path.join(global.__TEST_DIRECTORIES__.uniqueFixturesOutput, relPath);
    originalSetupLog('[SETUP] Globals set.');

    originalSetupLog('[SETUP] Ensuring mock font dirs...');
    if (!tempDir) throw new Error("tempDir is not defined before font dir creation!");
    await ensureDir(path.dirname(path.join(tempDir, 'font.woff2')));
    await ensureDir(path.dirname(path.join(tempDir, 'font.ttf')));
    originalSetupLog('[SETUP] Mock font dirs ensured.');

    originalSetupLog('[SETUP] Writing mock font files...');
    await fs.writeFile(path.join(tempDir, 'font.woff2'), 'mock woff2 data');
    await fs.writeFile(path.join(tempDir, 'font.ttf'), 'mock ttf data');
    global.__MOCK_FILE_PATH__ = tempDir;
    originalSetupLog('[SETUP] Mock font files written.');

    originalSetupLog('[SETUP] Ensuring sample project dir...');
    if (!baseDirs || !baseDirs.sampleProject) throw new Error("baseDirs.sampleProject is not defined!");
    await ensureDir(baseDirs.sampleProject);
    originalSetupLog('[SETUP] Sample project dir ensured.');

    originalSetupLog('[SETUP] Writing sample project files...');
    try {
        await Promise.all([
            fs.writeFile(path.join(baseDirs.sampleProject, 'index.html'), ``),
            fs.writeFile(path.join(baseDirs.sampleProject, 'styles.css'), '/* Mock CSS */'),
            fs.writeFile(path.join(baseDirs.sampleProject, 'script.js'), '// Mock JS'),
            fs.writeFile(path.join(baseDirs.sampleProject, 'logo.png'), 'fake image data')
        ]);
        originalSetupLog('[SETUP] Sample project files written.');
    } catch (writeError) {
        originalSetupLog('[SETUP-ERROR] Failed to write sample project files:', writeError);
        throw writeError;
    }

    originalSetupLog('[SETUP] Mocking console...');
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    // Use the GLOBAL `jest` object to access `fn`
    global.console.log = jest.fn((...args) => { if (process.env.DEBUG) originalLog(...args); });
    global.console.warn = jest.fn((...args) => { /* ... filtering logic ... */ if (process.env.DEBUG) originalWarn(...args); });
    global.console.error = jest.fn((...args) => { if (process.env.DEBUG) originalError(...args); });
    originalSetupLog('[SETUP] Console mocked.');

    originalSetupLog("[SETUP] Test setup complete.");
});

afterAll(async () => {
    originalSetupLog(`[SETUP] Cleaning up test environment in: ${tempDir}`);
    try {
        if (tempDir) {
            await fs.rm(tempDir, { recursive: true, force: true });
            originalSetupLog(`[SETUP] Successfully cleaned up: ${tempDir}`);
        } else {
            originalSetupLog(`[SETUP-WARN] tempDir variable was not defined during cleanup.`);
        }
    } catch (e) {
        if (e.code !== 'ENOENT') {
            originalSetupLog(`[SETUP-WARN] Could not fully clean test directory ${tempDir}:`, e.message);
        } else {
            originalSetupLog(`[SETUP] Test directory already removed: ${tempDir}`);
        }
    }
});