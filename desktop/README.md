# 📦 Portapack Desktop GUI – Documentation

## 📖 Overview

**Portapack Desktop GUI** is a Wails-based cross-platform desktop application with a Vue.js frontend. It provides a user-friendly graphical interface to the `portapack` CLI tool, allowing users to run it with various options through an intuitive UI.

**GitHub Repository:**
👉 [https://github.com/manicinc/portapack.git](https://github.com/manicinc/portapack.git)

---

## 🧰 Prerequisites

Install the following tools before using the application:

| Tool                          | Install Command                                            |
| ----------------------------- | ---------------------------------------------------------- |
| Go ≥ 1.20                     | [https://golang.org/dl/](https://golang.org/dl/)           |
| Node.js ≥ 18.x (includes npm) | [https://nodejs.org/](https://nodejs.org/)                 |
| Wails CLI                     | `go install github.com/wailsapp/wails/v2/cmd/wails@latest` |
| Portapack CLI                 | `npm install -g portapack`                                 |

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/manicinc/portapack.git
cd portapack/desktop
```

### 2. Run the App in Development Mode

```bash
wails dev
```

Wails will automatically install frontend dependencies and launch the app with hot-reloading.

---

## 🏗️ Build for Production

To generate a distributable binary:

```bash
wails build
```

This creates a standalone executable in `build/bin/` for your platform with all assets embedded.

---

## 🚢 Release Process

### Automated Releases via GitHub Actions

The project uses GitHub Actions to automatically build and release cross-platform binaries when specific commit messages are pushed to the `master` branch.

### Commit Message Format

To trigger an automated release, your commit message **must** follow this exact format:

```
desktop: release vX.X.X - description
```

**Examples:**
```bash
git commit -m "desktop: release v1.2.3 - Added dark mode support"
git commit -m "desktop: release v2.0.0 - Major UI redesign and performance improvements"
git commit -m "desktop: release v1.5.1 - Fixed critical bug in file handling"
```

### Release Workflow Details

When you push a commit with the correct format:

1. **Automatic Detection**: GitHub Actions detects the `desktop:` prefix and extracts the version tag (e.g., `v1.2.3`)
2. **Cross-Platform Build**: Builds binaries for:
   - Linux (amd64)
   - Windows (amd64) 
   - macOS (amd64)
3. **GitHub Release**: Creates a new GitHub release with the version tag
4. **Asset Upload**: Uploads all platform-specific zip files as release assets

### Version Tag Requirements

- Must follow semantic versioning: `vMAJOR.MINOR.PATCH`
- Examples: `v1.0.0`, `v2.1.5`, `v10.3.2`
- Invalid: `1.0.0`, `v1.0`, `version-1.0.0`

### Manual Release Steps

1. Ensure your changes are ready for release
2. Commit with the proper format:
   ```bash
   git add .
   git commit -m "desktop: release v1.2.3 - Your release description"
   git push origin master
   ```
3. Monitor the GitHub Actions tab for build progress
4. Once complete, the release will be available in the GitHub Releases section

---

## ⚙️ Features

* Full support for `portapack` CLI options via GUI
* Input/output paths, recursive crawling, and minification toggles
* Toggle dark/light mode
* View real-time command output
* Responsive, theme-aware layout

---

## 🎛️ CLI Options Mapped to UI

| UI Control              | CLI Flag(s)            |
| ----------------------- | ---------------------- |
| Input HTML/URL          | `<input>`              |
| Output File Path        | `-o`, `--output`       |
| Enable All Minification | `-m`, `--minify`       |
| Disable Minify (HTML)   | `--no-minify-html`     |
| Disable Minify (CSS)    | `--no-minify-css`      |
| Disable Minify (JS)     | `--no-minify-js`       |
| Embed Assets            | `-e`, `--embed-assets` |
| Recursive Crawl         | `-r`, `--recursive`    |
| Max Depth               | (argument to `-r`)     |
| Base URL                | `-b`, `--base-url`     |
| Dry Run                 | `-d`, `--dry-run`      |
| Verbose Logging         | `-v`, `--verbose`      |
| Log Level               | `--log-level <level>`  |

---

## 🐛 Troubleshooting

### Portapack not found?

Make sure it's globally installed:

```bash
npm install -g portapack
```

And accessible in your shell:

```bash
portapack --help
```

If it still fails, you may need to add the npm global bin directory to your PATH:

```bash
export PATH="$PATH:$(npm bin -g)"
```

### Release Build Failed?

If the automated release fails:

1. Check the GitHub Actions logs for specific error messages
2. Ensure your commit message exactly matches the required format
3. Verify that all dependencies are properly specified in the workflow
4. For Linux builds, make sure the required system libraries are installed in the CI environment

---

## 🪪 License

Font: **Nunito** – licensed under the [SIL Open Font License v1.1](https://scripts.sil.org/OFL) (included in the repo).