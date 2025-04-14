# 🚀 Deployment Guide

## 🔁 Release Process

This project uses [`semantic-release`](https://github.com/semantic-release/semantic-release) to automate versioning and publishing to npm.

### Automatic Publishing

When changes are pushed to master, semantic-release will:

1. Analyze your commit messages (using [Conventional Commits](https://www.conventionalcommits.org/))
2. Automatically bump the version (`patch`, `minor`, `major`)
3. Generate or update `CHANGELOG.md`
4. Create a GitHub release
5. Publish the package to npm

### Release Types

| Commit Format                | Result           |
| ---------------------------- | ---------------- |
| `fix:`                       | 🔧 PATCH release |
| `feat:`                      | ✨ MINOR release |
| `feat:` + `BREAKING CHANGE:` | 🚨 MAJOR release |

## 📦 Manual Release (Optional Fallback)

```bash
# Build the project
npm run build

# Run tests and check coverage
npm test

# Publish to npm manually
npm run publish:npm
```

## 🔐 GitHub Actions + NPM Setup

### Required Secrets

In your GitHub repository:

1. Go to **Settings > Secrets and variables > Actions**
2. Add the following secrets:

- `NPM_TOKEN`

  - Create at npmjs.com > Access Tokens
  - Choose type: `Automation` (read + publish)
  - Paste into GitHub as `NPM_TOKEN`

- `GITHUB_TOKEN`
  - This is automatically available in GitHub Actions

### GitHub Repo Settings

1. Go to **Settings > Actions > General**
2. Under **Workflow Permissions**:
   - ✅ Enable: **Read and write permissions**

## 🧪 Test Coverage

### Tools Used

- Jest
- Coveralls

### CLI Usage

```bash
# Run all tests with coverage
npm test

# View interactive HTML coverage report
npm run coverage
# (opens coverage/lcov-report/index.html)

# Generate and copy coverage report to docs
npm run docs:coverage
```

### Coverage Badge Setup (Optional)

1. Go to https://coveralls.io/
2. Log in with GitHub
3. Enable your repo
4. Your GitHub Actions workflow (CI) will push coverage data automatically

Add badge to README:

```markdown
[![Coverage Status](https://coveralls.io/repos/github/YOUR_USERNAME/portapack/badge.svg?branch=master)](https://coveralls.io/github/YOUR_USERNAME/portapack?branch=master)
```

## 📊 VitePress Coverage Page

The project automatically generates a test coverage report and makes it accessible via VitePress:

- Coverage report is generated to `docs/test-coverage/`
- Accessible at `/test-coverage/` in your documentation site
- Automatically updated with each test run

## 🧼 Pre-commit Hooks

We use Husky + `lint-staged`:

- ✅ Auto-lint + format on commit
- ✅ Validate commit messages via Commitizen

## 🧯 Troubleshooting

### Commit Fails?

- Use `npm run commit` (or `git cz`) to follow the correct format
- Check Husky is installed (`.husky/` exists)
- Run `npm install` again to restore hooks

### Release Fails?

- Check GitHub Actions logs
- Ensure `NPM_TOKEN` secret is added
- Ensure commit messages follow Conventional Commits

## ✍️ Recommended Commit Format

```bash
npm run commit
```

### Examples

```
feat(fonts): add base64 embedding with MIME detection
fix(extractor): fallback on missing asset
chore(ci): enable docs deploy with GitHub Pages
```
