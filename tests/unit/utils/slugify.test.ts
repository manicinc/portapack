import { slugify,  sanitizeSlug  } from '../../../src/utils/slugify';

describe('slugify()', () => {
	it('should handle typical URLs', () => {
		expect(slugify('https://site.com/path/page.html')).toBe('path-page');
		expect(slugify('products/item-1.html')).toBe('products-item-1');
		expect(slugify(' search?q=test page 2 ')).toBe('search-q-test-page-2');
		expect(slugify('/path/with/slashes/')).toBe('path-with-slashes');
		expect(slugify('')).toBe('index');
	});
});

describe('🔧 sanitizeSlug()', () => {
  const tests: Array<[string, string]> = [
    // Basic pages
    ['about.html', 'about'],
    ['/contact.html', 'contact'],
    ['index.htm', 'index'],
    ['home.php', 'home'],

    // Complex paths
    ['/products/item-1.html', 'products-item-1'],
    ['search/q/test-page-2', 'search-q-test-page-2'],
    ['/path/with spaces/', 'path-with-spaces'],
    ['leading/trailing/', 'leading-trailing'],
    ['multiple////slashes//page', 'multiple-slashes-page'],

    // URL with query strings and fragments
    ['about.html?ref=123', 'about'],
    ['page.html#section', 'page'],
    ['dir/page.html?x=1#top', 'dir-page'],

    // Weird extensions
    ['weird.jsp', 'weird'],
    ['page.aspx', 'page'],
    ['form.asp', 'form'],

    // Already clean
    ['docs/getting-started', 'docs-getting-started'],

    // Empty or garbage
    ['', 'index'],
    ['    ', 'index'],
    ['?ref=abc', 'index'],
    ['#anchor', 'index'],

    // Slug collisions (the function itself doesn't track collisions, that's the caller's job)
    ['duplicate.html', 'duplicate'],
    ['duplicate.html?x=1', 'duplicate'],

    // URL-style strings
    ['https://example.com/about.html', 'about'],
    ['https://example.com/dir/page.html?ref=42#main', 'dir-page'],

    // Strange symbols
    ['some@strange!file$name.html', 'some-strange-file-name'],
    ['complex/path/with_underscores-and.dots.html', 'complex-path-with_underscores-and.dots']
  ];

  tests.forEach(([input, expected]) => {
    it(`should sanitize "${input}" to "${expected}"`, () => {
      expect(sanitizeSlug(input)).toBe(expected);
    });
  });
});
