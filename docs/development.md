# 🛠️ PortaPack Development Guide

## 📋 Prerequisites

- **Node.js**: v18+ (recommended v20)
- **npm**: v9+
- **Git**

### Optional Tools

```bash
# Install Commitizen CLI globally
npm install -g commitizen
```

## 🚀 Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/manicinc/portapack.git
   cd portapack
   ```

2. Install dependencies:
   ```bash
   # Recommended for clean installs
   npm ci
   # or
   npm install
   ```

## ⚙️ Development Workflow

### Primary Development Command

```bash
npm run dev
```

This command simultaneously runs:
- TypeScript rebuild watcher
- Documentation server
- Test runner

### Specific Development Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev:build` | Watch and rebuild TypeScript |
| `npm run dev:docs` | Start documentation server |
| `npm run dev:test` | Run tests in watch mode |

## 🧪 Testing Strategies

### Test Runners

```bash
# Full test suite with coverage
npm test

# Interactive test watch mode
npm run dev:test

# Targeted test debugging
npm run dev:test:debug -- tests/specific/file.test.ts

# Clear Jest cache
npm run test:clear
```

## 🧰 Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Check formatting
npm run format:check
```

## 📦 Building

```bash
# Build project
npm run build
```

Builds include:
- TypeScript compilation
- API documentation generation
- Documentation site build

## 📚 Documentation

```bash
# Start documentation development
npm run docs:dev

# Generate API docs
npm run docs:api

# Build documentation
npm run docs:build
```

## 💬 Committing Changes

```bash
# Stage changes
git add .

# Use commit helper
npm run commit
```

Follow the Conventional Commits specification guided by Commitizen.

## 🤝 Contribution Workflow

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/your-feature
   ```
3. Make changes
4. Run tests
   ```bash
   npm test
   npm run lint
   npm run format
   ```
5. Commit using `npm run commit`
6. Push to your fork
7. Open a Pull Request

## 📁 Project Structure

```
portapack/
├── .github/       # GitHub Actions
├── dist/          # Compiled output
├── docs/          # Documentation source
├── examples/      # Example scripts
├── src/           # Source code
│   ├── cli/       # CLI logic
│   ├── core/      # Core bundling logic
│   └── utils/     # Utility functions
├── tests/         # Test files
└── package.json   # Project configuration
```

## 🚨 Troubleshooting

- Clear Jest cache: `npm run test:clear`
- Ensure Node.js and npm versions match prerequisites
- Verify dependencies with `npm ci`

## 🌍 Community & Support

- [GitHub Repository](https://github.com/manicinc/portapack)
- [Issue Tracker](https://github.com/manicinc/portapack/issues)

## 📄 License

MIT License - Built by Manic Agency