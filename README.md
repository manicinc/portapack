# 📦 PortaPack

[![npm version](https://img.shields.io/npm/v/portapack.svg?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/portapack)
[![Build Status](https://img.shields.io/github/actions/workflow/status/manicinc/portapack/ci.yml?branch=master&style=for-the-badge&logo=github)](https://github.com/manicinc/portapack/actions)
[![Codecov](https://img.shields.io/codecov/c/github/manicinc/portapack?style=for-the-badge&logo=codecov)](https://codecov.io/gh/manicinc/portapack)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](./LICENSE)

<p align="center">
  <img src="https://raw.githubusercontent.com/manicinc/portapack/master/docs/public/portapack-transparent.png" alt="PortaPack Logo" width="200"/>
</p>

**PortaPack** bundles your entire website — HTML, CSS, JS, images, and fonts — into one self-contained HTML file. Perfect for snapshots, demos, testing, and offline apps.

_Minimal input. Maximal output._

## 📚 Documentation

- [📖 Getting Started](https://manicinc.github.io/portapack/getting-started)
- [⚙️ CLI Reference](https://manicinc.github.io/portapack/cli)
- [🛠 Configuration Guide](https://manicinc.github.io/portapack/configuration)
- [💻 API Reference](https://manicinc.github.io/portapack/api/)
- [🏛️ Architecture](https://manicinc.github.io/portapack/architecture/)
- [🚧 Roadmap](https://manicinc.github.io/portapack/roadmap/)
- [🤝 Contributing Guidelines](https://manicinc.github.io/portapack/contributing)

## 🚀 Quick Start

### 📦 Install

```bash
# Global CLI (recommended)
npm install -g portapack

# OR use npx (no install needed)
npx portapack ./index.html -o bundle.html
```

### 📋 CLI Examples

```bash
# Basic
portapack ./index.html
portapack https://example.com

# With output path
portapack ./page.html -o dist/output.html

# Full recursive bundle
portapack https://example.com --recursive 2 -o full.html

# Dev mode (no minify, verbose)
portapack ./src/index.html --no-minify -v

# Production mode (optimized)
portapack ./src/index.html -m -o dist/prod.html

# Dry run preview
portapack ./index.html --dry-run
```

## 📦 Node.js API

PortaPack is fully usable via code.

### Simple Usage

```typescript
import { pack } from 'portapack';

const result = await pack('./index.html'); // local or URL
console.log(result.html); // bundled HTML
```

### With Options

```typescript
import { pack, LogLevel } from 'portapack';
import fs from 'fs';

const result = await pack('https://example.com', {
  minifyCss: true,
  minifyJs: false,
  recursive: 2,
  output: 'site.html',
  logLevel: LogLevel.INFO,
});

// Save to disk
fs.writeFileSync('output.html', result.html);

### Advanced API Usage

You can access individual building blocks too:

```typescript
import {
  generatePortableHTML,
  generateRecursivePortableHTML,
  bundleMultiPageHTML
} from 'portapack';
```

| Function                          | Purpose                               |
| --------------------------------- | ------------------------------------- |
| `generatePortableHTML()`          | Bundle a single file or URL           |
| `generateRecursivePortableHTML()` | Crawl & bundle entire site            |
| `bundleMultiPageHTML()`           | Combine multiple HTMLs with router    |

## 📊 Project Health

| Metric      | Value                                                                                                                                                           |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📦 Version  | [![npm](https://img.shields.io/npm/v/portapack.svg)](https://www.npmjs.com/package/portapack)                                                                   |
| ✅ Build    | [![Build Status](https://img.shields.io/github/actions/workflow/status/manicinc/portapack/ci.yml?branch=master)](https://github.com/manicinc/portapack/actions) |
| 🧪 Coverage | [![Codecov](https://img.shields.io/codecov/c/github/manicinc/portapack)](https://codecov.io/gh/manicinc/portapack)                                              |

## 📄 License

MIT — Built by Manic.agency
