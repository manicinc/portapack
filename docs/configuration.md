# 🛠 PortaPack Configuration Guide

## 📝 Configuration Options

PortaPack provides multiple ways to configure its behavior:

### CLI Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `-i, --input` | String | Required | Input HTML file or URL |
| `-o, --output` | String | `{input}.packed.html` | Output file path |
| `-m, --minify` | Number | `2` | Minification level (0-3) |
| `--no-minify` | Flag | - | Disable minification |
| `-r, --recursive` | Boolean/Number | `false` | Crawl site recursively, optionally with depth |
| `-b, --base-url` | String | Detected | Base URL for resolving paths |
| `-d, --dry-run` | Flag | `false` | Preview without generating output |
| `-v, --verbose` | Flag | `false` | Enable verbose logging |

### Programmatic Configuration

```typescript
// Simple string input
await generatePortableHTML('./index.html');

// With options as second parameter
await generatePortableHTML('./index.html', {
  minify: true,
  minifyLevel: 2,
  baseUrl: 'https://example.com'
});

// Or with options object
await generatePortableHTML({
  input: './index.html',
  minify: true,
  minifyLevel: 2,
  baseUrl: 'https://example.com',
  
  // Asset handling
  embedAssets: true,
  embedLimit: 1000000,
  
  // Minification controls
  minifyHtml: true,
  minifyCss: true,
  minifyJs: true,
  
  // Advanced options
  removeComments: true,
  collapseWhitespace: true
});
```

## 🔧 Configuration Examples

### CLI Configuration

```bash
# Basic usage
portapack -i ./index.html -o bundled.html

# Maximum minification
portapack -i ./site -m 3 -o min.html

# Disable minification
portapack -i ./site --no-minify

# Set custom base URL
portapack -i ./local/site -b https://example.com

# Recursive crawling with depth
portapack -i https://site.com -r 2

# Dry run to preview
portapack -i https://example.com --dry-run -v
```

### Programmatic Configuration

```typescript
// Basic local file
const html = await generatePortableHTML('index.html');

// Remote URL with minification options
const html = await generatePortableHTML({
  input: 'https://example.com',
  minify: true,
  minifyLevel: 3,
  removeComments: true
});

// With custom base URL
const html = await generatePortableHTML({
  input: './index.html',
  baseUrl: 'https://example.com',
  embedAssets: true
});

// Recursive site bundling
await bundleSiteRecursively(
  'https://example.com',
  'output.html',
  2 // Depth
);
```

## 💡 Best Practices

- **Base URL Handling**: Always specify a `baseUrl` when working with relative paths
- **Asset Size**: Be mindful of embedding large assets; use `embedLimit` to set thresholds
- **Minification Levels**: Start with level 2 and adjust based on needs:
  - Level 0: No minification
  - Level 1: Basic whitespace removal
  - Level 2: Standard minification (recommended)
  - Level 3: Aggressive minification (may affect readability)
- **Testing**: Use `--dry-run -v` to preview configuration without generating files
- **Performance**: For large sites, increase Node's memory limit with `NODE_OPTIONS=--max-old-space-size=4096`

## 🚨 Configuration Warnings

- Deep recursive crawling can be resource-intensive
- Large sites may require increased memory allocation
- Some asset embedding might fail with complex dynamic sites
- External scripts with CORS restrictions may not embed properly

## 📂 File Types Supported

PortaPack automatically detects and processes:

- **HTML files**: Main content files
- **CSS stylesheets**: Both inline and external
- **JavaScript**: Script files and inline scripts
- **Images**: PNG, JPEG, GIF, SVG, WebP (converted to data URLs)
- **Fonts**: WOFF, WOFF2, TTF, EOT (embedded)
- **Other assets**: PDFs, JSON, text files, etc.

## 🔄 Environment Variables

PortaPack also supports configuration via environment variables:

- `PORTAPACK_BASE_URL`: Sets the base URL
- `PORTAPACK_MINIFY_LEVEL`: Sets minification level
- `PORTAPACK_NO_EMBED`: Disables asset embedding when set to "true"

## 📚 Related Documentation

- [CLI Reference](/cli)
- [API Reference](/api/README)
- [Getting Started Guide](/getting-started)
- [Troubleshooting](/troubleshooting)