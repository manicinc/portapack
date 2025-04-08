# 🛠 PortaPack Troubleshooting Guide

## 🚨 Common Issues

### 1. Installation Problems

#### npm Install Fails
- **Symptom**: Error during `npm install`
- **Solutions**:
  ```bash
  # Clear npm cache
  npm cache clean --force

  # Reinstall dependencies
  rm -rf node_modules
  npm install
  ```

### 2. CLI Errors

#### Permission Denied
- **Symptom**: `EACCES` errors
- **Solutions**:
  ```bash
  # Use npm with sudo (not recommended long-term)
  sudo npm install -g portapack

  # Or fix npm permissions
  npm config set prefix ~/.npm
  npm install -g portapack
  ```

#### Asset Embedding Failures
- **Symptom**: Some assets not embedded
- **Possible Causes**:
  - Incorrect base URL
  - Network restrictions
  - Large file sizes

### 3. Performance Issues

#### Slow Recursive Crawling
- **Solution**: Limit crawl depth
  ```bash
  portapack -i https://site.com --recursive --max-depth 2
  ```

### 4. Minification Problems

#### CSS/JS Not Minifying
- **Check**:
  - Use `--no-minify-css` or `--no-minify-js` flags
  - Verify asset paths
  - Check file permissions

## 🔍 Debugging Techniques

### Verbose Logging
```bash
# Enable verbose output
portapack -i ./site --verbose
```

### Dry Run
```bash
# Preview bundling without generating file
portapack -i ./site --dry-run
```

## 🌐 Network & Security

### Proxy Configuration
```bash
# Set proxy for asset fetching
export HTTP_PROXY=http://proxy.example.com
portapack -i https://site.com
```

## 📊 Diagnostics

### Generate Diagnostic Report
```bash
# Create debug information
portapack --diagnostics > portapack-debug.log
```

## 🆘 Getting Help

1. Check [GitHub Issues](https://github.com/manicinc/portapack/issues)
2. Open a new issue with:
   - PortaPack version
   - Node.js version
   - Detailed error message
   - Reproduction steps

## 💡 Pro Tips

- Keep PortaPack updated
- Use the latest Node.js LTS
- Check network connectivity
- Validate input files/URLs

## 🚧 Known Limitations

- Limited support for complex Single Page Applications (SPAs)
- Some dynamic content may not embed correctly
- Large sites might require significant memory