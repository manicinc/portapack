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

### npm Authentication

The release job in `.github/workflows/ci.yml` publishes through the package's npm trusted publisher, which names `manicinc/portapack` and `ci.yml`. `@semantic-release/npm` 13 exchanges the job's GitHub OIDC token with the registry and logs `OIDC token exchange with the npm registry succeeded`, so a release needs no npm token. Trusted publishing needs Node 22.14.0 or later and npm 11.5.1 or later, which the release job sets up ([npm: trusted publishing](https://docs.npmjs.com/trusted-publishers)). semantic-release 23 loads `@semantic-release/npm` from its own dependencies before the project's, so `package.json`'s `overrides` give it the version `package.json` names.

In **Settings > Secrets and variables > Actions**:

- `NPM_TOKEN` (optional)
  - A fallback for the release step when the OIDC exchange fails
  - If set, a granular npm token limited to publishing this package

- `GITHUB_TOKEN`
  - This is automatically available in GitHub Actions; semantic-release uses it for the release commit, the tag and the GitHub release

To check a release without making one, run the CI workflow by hand with `dry_run` on, on any branch:

```bash
gh workflow run ci.yml --ref <branch> -f dry_run=true
```

The `release-dry-run` job runs `semantic-release --dry-run` with no npm token in reach. It checks push access, the OIDC exchange with npm and the commit analysis, and publishes, tags and pushes nothing.

The trusted publisher names no GitHub environment, so anyone with write access to this repository can publish through it. A GitHub environment that admits `master` only, named on the trusted publisher and in the release job, would narrow that to runs on `master`.

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

- Check GitHub Actions logs: `@semantic-release/npm` logs whether the OIDC token exchange with the npm registry succeeded, and the status when it failed
- If the exchange fails, check that the package's trusted publisher on npmjs.com names `manicinc/portapack` and `ci.yml`, then check with a dry run
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
