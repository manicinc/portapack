# ⚙️ PortaPack CLI Reference

PortaPack provides a powerful command-line interface (CLI) for bundling local HTML files and remote websites into single, portable HTML files.

## Installation

To use the CLI, install PortaPack globally using npm (or your preferred package manager):

```bash
npm install -g portapack
# or
# yarn global add portapack
# or
# pnpm add -g portapack
```

## Command Syntax

PortaPack supports two command styles for specifying input:

```bash
# Positional argument style (recommended)
portapack <path_or_url> [options]

# Named argument style
portapack --input <path_or_url> [options]
# or using shorthand
portapack -i <path_or_url> [options]
```

Both methods work identically - choose whichever you prefer.

## Options

| Option | Shorthand | Description | Default |
|--------|-----------|-------------|---------|
| `<path_or_url>` or `--input <path_or_url>` | `-i` | Required. Input local file path or remote URL (http/https) to process. | - |
| `--output <file>` | `-o` | Output file path for the bundled HTML. | `{input}.packed.html` |
| `--minify` | `-m` | Enable all minification (HTML, CSS, JS). | - |
| `--no-minify` | | Disable all asset minification (HTML, CSS, JS). | `false` |
| `--no-minify-html` | | Disable only HTML minification. | `false` |
| `--no-minify-css` | | Disable only CSS minification. | `false` |
| `--no-minify-js` | | Disable only JavaScript minification. | `false` |
| `--recursive [depth]` | `-r` | Recursively bundle links up to depth. If depth omitted, defaults to 1. Only applies to remote URLs. | - (disabled) |
| `--max-depth <n>` | | Set maximum depth for recursive crawling (alternative to `-r <n>`). | - |
| `--base-url <url>` | `-b` | Base URL for resolving relative URLs found in the input HTML. | Input path/URL |
| `--embed-assets` | `-e` | Embed external assets (CSS, JS, images, fonts) as data URIs or inline content. | `true` |
| `--no-embed-assets` | | Keep external assets as links (requires network access when viewing). | `false` |
| `--timeout <ms>` | `-t` | Network timeout in milliseconds for fetching remote resources. | `30000` (30 seconds) |
| `--user-agent <string>` | `-U` | Custom User-Agent string for network requests. | Default Node.js agent |
| `--include <glob>` | | Glob pattern for URLs to include during recursion (can be specified multiple times). | `**` (all) |
| `--exclude <glob>` | | Glob pattern for URLs to exclude during recursion (can be specified multiple times). | - |
| `--log-level <level>` | `-l` | Set logging level (debug, info, warn, error, silent). | `info` |
| `--verbose` | `-v` | Enable verbose logging (shortcut for `--log-level debug`). | `false` |
| `--config <path>` | `-c` | Path to a configuration file (e.g., `.portapackrc.json`) to load options from. | - |
| `--dry-run` | `-d` | Perform all steps except writing the output file. Logs intended actions. | `false` |
| `--help` | `-h` | Show help information and exit. | - |
| `--version` | | Show PortaPack CLI version number and exit. | - |

## Examples

### Basic Local File Bundling

Bundle `index.html` into `bundle.html`:

```bash
# Using positional argument style
portapack ./index.html -o bundle.html

# Using named argument style
portapack -i ./index.html -o bundle.html
```

Use default output name (`index.html.packed.html`):

```bash
# Using positional argument style
portapack ./index.html

# Using named argument style
portapack -i ./index.html
```

### Web Page Bundling

Bundle a single remote webpage:

```bash
# Using positional argument style
portapack https://example.com -o example-bundle.html

# Using named argument style
portapack -i https://example.com -o example-bundle.html
```

### Recursive Bundling

Bundle a website, following links 1 level deep:

```bash
portapack https://example.com -r -o site-bundle-depth1.html
```

Bundle a website, following links up to 2 levels deep:

```bash
portapack https://example.com -r 2 -o site-bundle-depth2.html
```

Alternative using `--max-depth` option:

```bash
portapack https://example.com --max-depth 2 -o site-bundle-depth2.html
```

Recursively bundle only blog posts, excluding images:

```bash
portapack https://example.com -r \
  --include "/blog/**" \
  --exclude "**/*.{jpg,png,gif}" \
  -o blog-bundle.html
```

### Asset Handling

Bundle without embedding assets (keep external links):

```bash
portapack ./index.html --no-embed-assets -o linked-assets.html
```

Default behavior is to embed assets (which you can make explicit):

```bash
portapack ./index.html --embed-assets -o embedded-assets.html
```

### Minification Control

Apply all minification:

```bash
portapack ./index.html -m -o min-bundle.html
```

Disable minification completely:

```bash
portapack ./index.html --no-minify -o unmin-bundle.html
```

Selectively control minification:

```bash
# Minify CSS and JS but not HTML
portapack ./index.html --no-minify-html -o selective-min.html

# Minify HTML and CSS but not JS
portapack ./index.html --no-minify-js -o no-js-min.html
```

### Advanced Network Options

Bundle a remote page with a longer timeout and custom user agent:

```bash
portapack https://example.com -t 60000 -U "MyCustomBot/1.0" -o example-custom.html
```

### Base URL for Relative Links

Process a local file as if it were hosted at https://example.com:

```bash
portapack ./docs/index.html -b https://example.com/docs/ -o bundle.html
```

### Logging and Debugging

Enable detailed debug logs:

```bash
portapack ./index.html -v -o bundle-debug.html
```

Only show errors:

```bash
portapack ./index.html --log-level error -o bundle-errors-only.html
```

### Dry Run

See what files and assets would be processed without saving:

```bash
portapack ./index.html --dry-run
```

### Using a Configuration File

Load options from a config file:

```bash
portapack -c ./.portapackrc.json
```

### NPX Usage

Use PortaPack without installing globally:

```bash
npx portapack ./index.html -o bundle.html
```

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General Error (e.g., invalid options, file IO) |
| 2 | Input Error (e.g., missing input, invalid URL) |
| 3 | Network Error (e.g., fetch failed, timeout) |
| 4 | Processing Error (e.g., parsing failed) |

(Note: Specific error codes might vary)

## Related Resources

- Getting Started (Link needs validation)
- API Reference (Link needs validation)
- Configuration Guide (Link needs validation)