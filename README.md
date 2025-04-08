# 📦 PortaPack

<div align="center">
    <img src="./public/logo.png" alt="PortaPack Logo" style="max-width: 100%; height: auto; margin-bottom: 20px;">
    
[![npm version](https://img.shields.io/npm/v/portapack.svg?style=for-the-badge&logo=npm&color=CB3837)](https://www.npmjs.com/package/portapack)
[![Build Status](https://img.shields.io/github/actions/workflow/status/manicinc/portapack/ci.yml?branch=master&style=for-the-badge&logo=github)](https://github.com/manicinc/portapack/actions)
[![Coverage Status](https://img.shields.io/coveralls/github/manicinc/portapack?style=for-the-badge&logo=codecov)](https://coveralls.io/github/manicinc/portapack)
</div>

## 🌟 Introduction

**PortaPack** is a powerful, lightning-fast HTML bundling tool that transforms websites into compact, portable files. Pack entire web experiences into a single, self-contained HTML document with minimal effort.

## 📚 Documentation

- [📖 Getting Started](https://manicinc.github.io/portapack/getting-started)
- [⚙️ CLI Reference](https://manicinc.github.io/portapack/cli)
- [🛠 Configuration Guide](https://manicinc.github.io/portapack/configuration)
- [💻 API Reference](https://manicinc.github.io/portapack/api/)
- [🤝 Contributing Guidelines](https://manicinc.github.io/portapack/contributing)

## ✨ Killer Features

| Feature | Description |
|---------|-------------|
| 🧩 **Recursive Packing** | Bundle entire websites into a single, portable file |
| 🎯 **Total Asset Embedding** | Inline CSS, JS, images, and fonts seamlessly |
| 🧼 **Smart Minification** | Optimize HTML, CSS, and JS for minimal file size |
| 🌐 **Universal Compatibility** | Works flawlessly with local and remote sites |
| 🚀 **Blazing Fast** | Lightweight, efficient, zero external dependencies |

## 🚀 Quick Start

### Installation

```bash
# Global install
npm install -g portapack

# Project dependency
npm install --save-dev portapack
```

### Basic Usage

```bash
# Bundle a local site
portapack -i ./index.html -o portable.html

# Crawl a remote website
portapack -i https://example.com --recursive -o site.html
```

## 💻 Advanced Examples

<details>
<summary>🔧 Detailed CLI Options</summary>

```bash
# Full-featured bundling
portapack -i ./site \
  --recursive \
  --max-depth 2 \
  --base-url https://myproject.com \
  --no-minify-css \
  -o packed-site.html
```
</details>

## 🛠 Node.js API

```typescript
import { generatePortableHTML } from 'portapack';

// Simple usage
const compactSite = await generatePortableHTML('./index.html');

// Advanced options
const compactSite = await generatePortableHTML({
  input: './index.html',
  minify: true,
  minifyLevel: 2,
  baseUrl: 'https://example.com'
});
```

## 🤝 Contribute & Support

[![GitHub Sponsors](https://img.shields.io/badge/Sponsor-Manic_Agency-red?style=for-the-badge&logo=github&logoColor=white)](https://github.com/sponsors/manicinc)
[![Discord](https://img.shields.io/discord/your-discord-invite?style=for-the-badge&logo=discord&logoColor=white&label=Join%20Community&color=5865F2)](https://discord.gg/manicinc)

1. Fork the repo
2. Create a feature branch
3. Commit with `npm run commit`
4. Push & open a PR

## 📊 Project Health

| Aspect | Status |
|--------|--------|
| **Tests** | [![Coverage](https://img.shields.io/codecov/c/github/manicinc/portapack?style=flat-square)](https://codecov.io/gh/manicinc/portapack) |
| **Code Quality** | [![Maintainability](https://img.shields.io/codeclimate/maintainability/manicinc/portapack?style=flat-square)](https://codeclimate.com/github/manicinc/portapack) |
| **Dependencies** | [![Dependencies](https://img.shields.io/librariesio/github/manicinc/portapack?style=flat-square)](https://libraries.io/github/manicinc/portapack) |

## 🌍 Connect

[![Twitter](https://img.shields.io/twitter/follow/manicinc?style=social)](https://twitter.com/manicinc)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Manic_Agency-0A66C2?style=flat-square&logo=linkedin)](https://www.linkedin.com/company/manicinc)

## 📄 License

**MIT** — Built by [Manic Agency](https://manicinc.com)

<div align="center">
    <sub>Open Source Empowering Designers and Developers 🖥️</sub>
</div>