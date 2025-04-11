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

## Documentation

Our documentation is automatically generated and hosted locally:

- 🌐 **Local Docs**: at `http://localhost:5173`
- 📦 **Auto-Generated API Docs**: Dynamically created from TypeDoc comments
- 🧩 **Sidebar Generation**: Intelligent, automated sidebar creation

### Running Documentation Locally

```bash
# Start documentation development server
npm run docs:dev
```

## Basic Usage

### CLI Quickstart

```bash
# Bundle a local HTML file
portapack -i ./index.html -o portable.html

# Bundle a remote website
portapack -i https://example.com --recursive -o site.html
```

### Node.js API Basic Example

```typescript
import { generatePortableHTML } from 'portapack';

// Simple usage with a string path
async function bundleLocalSite() {
  const portableHtml = await generatePortableHTML('./index.html');
  console.log(portableHtml);
}

// Advanced options using configuration object
async function bundleWithOptions() {
  const portableHtml = await generatePortableHTML({
    input: './index.html',
    minify: true,
    minifyLevel: 2,
    baseUrl: 'https://example.com'
  });
  
  // Use or save the bundled HTML
  console.log(portableHtml);
}
```

## Documentation Architecture

### Automatic Documentation Generation

PortaPack uses a custom sidebar generator (`buildDocsSidebar()`) to:
- Automatically scan TypeDoc-generated markdown files
- Create dynamic, organized documentation sidebars
- Support multiple documentation types (modules, classes, interfaces, etc.)

#### How It Works

1. TypeDoc generates markdown from source code comments
2. Custom sidebar generator reads generated files
3. VitePress renders dynamically generated sidebar

## Next Steps

- 📖 [Explore CLI Options](/cli)
- 🛠 [Advanced Configuration](/configuration)
- 💻 [API Reference](/api/README)

## Troubleshooting

Encountering issues? Check our [Troubleshooting Guide](/troubleshooting)

## Contributing

Interested in improving PortaPack? 
- [View Contributing Guidelines](/contributing)
- [Development Guide](/development)

## Support

- 🐛 [Report an Issue](https://github.com/manicinc/portapack/issues)
- 💬 [Community Support](https://discord.gg/DzNgXdYm)

Built by [Manic.agency](https://manic.agency)