/**
 * @file tests/unit/utils/meta.test.ts
 * @description Unit tests for the bundle metadata.
 */
import { jest } from '@jest/globals';
import { BuildTimer } from '../../../src/utils/meta';

describe('BuildTimer', () => {
  const mockInput = 'input.html';

  it('initializes and returns correct metadata', () => {
    const timer = new BuildTimer(mockInput);

    // Use extra object in finish to set these, closer to real usage
    // timer.setAssetCount(5); // These might be set externally
    // timer.setPageCount(3); // These might be set externally
    timer.addError('Test warning 1');
    timer.addError('Test warning 2');

    const html = '<html><body>Test</body></html>';
    // Simulate passing extra metadata calculated elsewhere
    const metadata = timer.finish(html, {
        assetCount: 5,
        pagesBundled: 3,
        errors: ['External warning'] // Add an external error to test merging
    });


    expect(metadata.input).toBe(mockInput);
    expect(metadata.assetCount).toBe(5);
    expect(metadata.pagesBundled).toBe(3);
    // Check merged and deduplicated errors
    expect(metadata.errors).toEqual(['Test warning 1', 'Test warning 2', 'External warning']);
    expect(metadata.outputSize).toBe(Buffer.byteLength(html));
    expect(typeof metadata.buildTimeMs).toBe('number');
  });

  it('handles no errors or page count gracefully', () => {
    const timer = new BuildTimer(mockInput);
    // Simulate finish called without explicit counts/errors in 'extra'
    const result = timer.finish('<html></html>', { assetCount: 0 }); // Pass assetCount 0 explicitly

    // FIX: Expect errors to be undefined when none are added
    expect(result.errors).toBeUndefined(); // <<< CHANGED from toEqual([])
    expect(result.pagesBundled).toBeUndefined();
    expect(result.assetCount).toBe(0); // Check the explicitly passed 0
  });

   // Add a test case to check internal assetCount if not provided in extra
   it('uses internal asset count if not provided in extra', () => {
      const timer = new BuildTimer(mockInput);
      timer.setAssetCount(10); // Set internal count
      const result = timer.finish('html'); // Don't provide assetCount in extra
      expect(result.assetCount).toBe(10);
   });

    // Add a test case to check internal pageCount if not provided in extra
    it('uses internal page count if not provided in extra', () => {
      const timer = new BuildTimer(mockInput);
      timer.setPageCount(2); // Set internal count
      const result = timer.finish('html'); // Don't provide pageCount in extra
      expect(result.pagesBundled).toBe(2);
   });

    // Add a test case to check internal errors if not provided in extra
    it('uses internal errors if not provided in extra', () => {
      const timer = new BuildTimer(mockInput);
      timer.addError("Internal Error"); // Add internal error
      const result = timer.finish('html'); // Don't provide errors in extra
      expect(result.errors).toEqual(["Internal Error"]);
   });

});