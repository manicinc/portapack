# 🚀 Getting Started with PortaPack

## Prerequisites

- Node.js (v16.0.0+)
- npm (v8.0.0+)

## Quick Installation

```bash
# Global installation
npm install -g portapack

# Or as a project dependency
npm install --save-dev portapack
```

## Basic Usage

### CLI Quickstart

```bash
# Bundle a local HTML file
portapack ./index.html -o portable.html

# Bundle a remote website
portapack https://example.com --recursive -o site.html
```

### Node.js API Basic Example

```typescript
import { pack } from 'portapack';

// Simple usage with a string path
async function bundleLocalSite() {
  const result = await pack('./index.html');
  console.log(result.html);
  
  // Access metadata about the build
  console.log(`Output size: ${result.metadata.outputSize} bytes`);
  console.log(`Build time: ${result.metadata.buildTimeMs} ms`);
}

// Advanced options using configuration object
async function bundleWithOptions() {
  const result = await pack('./index.html', {
    minifyHtml: true,
    minifyCss: true,
    minifyJs: true,
    baseUrl: 'https://example.com',
    embedAssets: true
  });
 
  // Use or save the bundled HTML
  console.log(result.html);
}

// Recursive bundling of a website
async function bundleWebsite() {
  const result = await pack('https://example.com', {
    recursive: 2,  // Crawl up to 2 levels deep
    minifyHtml: true,
    minifyCss: true,
    minifyJs: true
  });
  
  console.log(`Bundled ${result.metadata.pagesBundled} pages`);
}
```

### Advanced API Usage

For more specific use cases, you can access individual components:

```typescript
import {
  generatePortableHTML,
  generateRecursivePortableHTML,
  bundleMultiPageHTML,
  fetchAndPackWebPage,
} from 'portapack';

// Bundle a single HTML file or URL
const singleResult = await generatePortableHTML('./index.html', {
  minifyHtml: true
});

// Recursively bundle a site
const recursiveResult = await generateRecursivePortableHTML('https://example.com', 2, {
  minifyCss: true
});

// Create multi-page bundle
const multiPageBundle = await bundleMultiPageHTML([
  { path: '/', html: '<html>...</html>' },
  { path: '/about', html: '<html>...</html>' }
]);
```

## Configuration

See our full [Configuration Guide](https://manicinc.github.io/portapack/configuration) for detailed options.

## CLI Options

PortaPack offers many command-line options for customizing the bundling process:

```bash
# Get full help
portapack --help
```

For details, see the [CLI Reference](https://manicinc.github.io/portapack/cli).

## Next Steps

- 📖 [Explore CLI Options](https://manicinc.github.io/portapack/cli)
- 🛠 [Advanced Configuration](https://manicinc.github.io/portapack/configuration)
- 💻 [API Reference](https://manicinc.github.io/portapack/api/)

## Troubleshooting

Encountering issues? Check our [Troubleshooting Guide](https://manicinc.github.io/portapack/troubleshooting)

## Contributing

Interested in improving PortaPack?
- [View Contributing Guidelines](https://manicinc.github.io/portapack/contributing)

## Support

- 🐛 [Report an Issue](https://github.com/manicinc/portapack/issues)
- 💬 [Community Support](https://discord.gg/DzNgXdYm)

Built by [Manic.agency](https://manic.agency)