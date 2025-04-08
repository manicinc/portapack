# ⚙️ CLI Reference

PortaPack provides a powerful command-line interface for bundling HTML files and websites.

## Installation

To use the CLI, install PortaPack globally:

```bash
npm install -g portapack
```

## Command Syntax

The basic command structure is:

```bash
portapack [options]
```

## Options

| Option | Shorthand | Description | Default |
|--------|----------|------------|---------|
| `--input <path>` | `-i` | Input file or URL to process | - |
| `--output <file>` | `-o` | Output file path | `{input}.packed.html` |
| `--minify [level]` | `-m` | Minification level (0-3) | `2` |
| `--no-minify` | - | Disable minification | - |
| `--recursive [depth]` | `-r` | Recursively bundle links up to specified depth | - |
| `--base-url <url>` | `-b` | Base URL for resolving relative URLs | - |
| `--dry-run` | `-d` | Show what would be done without writing files | - |
| `--verbose` | `-v` | Enable verbose logging | - |
| `--help` | `-h` | Show help information | - |
| `--version` | - | Show version information | - |

## Examples

### Basic Usage

Bundle a local HTML file:

```bash
portapack -i ./index.html -o bundle.html
```

### Web Page Bundling

Bundle a remote website:

```bash
portapack -i https://example.com -o example-bundle.html
```

### Recursive Bundling

Bundle a website and follow its links to a depth of 2:

```bash
portapack -i https://example.com -r 2 -o site-bundle.html
```

### Minification Control

Apply maximum minification:

```bash
portapack -i ./index.html -m 3 -o min-bundle.html
```

Disable minification:

```bash
portapack -i ./index.html --no-minify -o unmin-bundle.html
```

### Base URL for Relative Links

Specify a base URL for resolving relative paths:

```bash
portapack -i ./index.html -b https://example.com -o bundle.html
```

### Dry Run

Preview what would be bundled without creating an output file:

```bash
portapack -i ./index.html --dry-run
```

### Verbose Logging

Enable detailed logs during bundling:

```bash
portapack -i ./index.html -v -o bundle.html
```

## Exit Codes

| Code | Description |
|------|-------------|
| `0` | Success |
| `1` | Error (missing input, invalid URL, processing error, etc.) |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `test` during testing to suppress console output |

## Related Resources

- [Getting Started](/getting-started)
- [API Reference](/api/README)
- [Configuration Guide](/configuration)