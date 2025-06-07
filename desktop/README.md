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

---

## 🪪 License

Font: **Nunito** – licensed under the [SIL Open Font License v1.1](https://scripts.sil.org/OFL) (included in the repo).
