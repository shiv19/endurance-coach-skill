# Releasing Endurance Coach

This document describes how to release a new version of Endurance Coach.

## Prerequisites

- npm account with publish access to `endurance-coach`
- GitHub account with push access to the repository
- GitHub CLI (`gh`) installed and authenticated

## Release Steps

### 1. Update Version

Update the version number in `package.json`:

```bash
npm version patch  # or minor, or major
```

This will:

- Bump the version in package.json
- Create a git commit
- Create a git tag

The About tab automatically reads the version from package.json at build time.

### 2. Build Everything

```bash
# Build the viewer (creates templates/plan-viewer.html)
npm run build:viewer

# Build the skill zip (creates dist/endurance-coach-skill.zip)
npm run build:skill
```

### 3. Publish to npm

```bash
npm publish
```

This publishes the package to npm, making it available via `npx endurance-coach`.

### 4. Push to GitHub

```bash
git push origin main --tags
```

### 5. Create GitHub Release

Create a new release on GitHub with the skill zip attached:

```bash
# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")

# Create the release with the skill zip
gh release create "v$VERSION" \
  --title "v$VERSION" \
  --notes "See [CHANGELOG.md](CHANGELOG.md) for details." \
  dist/endurance-coach-skill.zip
```

Or manually:

1. Go to https://github.com/shiv19/endurance-coach-skill/releases/new
2. Choose the tag you just pushed (e.g., `v0.1.0`)
3. Set the release title (e.g., `v0.1.0`)
4. Add release notes
5. Attach `dist/endurance-coach-skill.zip` as a binary
6. Click "Publish release"

## Quick Release Script

For convenience, here's a one-liner (after updating version):

```bash
npm run build:viewer && \
npm run build:skill && \
npm publish && \
git push origin main --tags && \
VERSION=$(node -p "require('./package.json').version") && \
gh release create "v$VERSION" --title "v$VERSION" --generate-notes dist/endurance-coach-skill.zip
```

## What Gets Released

| Artifact    | Destination                       | Contents                                             |
| ----------- | --------------------------------- | ---------------------------------------------------- |
| npm package | npmjs.com/package/endurance-coach | CLI tool, viewer builder                             |
| Skill zip   | GitHub Releases                   | `endurance-coach-skill/` directory for AI assistants |

## Verification

After releasing:

1. **npm**: Run `npx endurance-coach --help` to verify the CLI works
2. **Skill**: Download the zip from GitHub releases, install in Claude.ai, and test
