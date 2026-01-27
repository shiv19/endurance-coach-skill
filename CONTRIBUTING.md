# Contributing to Endurance Coach

Thank you for your interest in contributing to Endurance Coach! This project helps athletes create personalized training plans using AI, and we welcome contributions from the community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Areas for Contribution](#areas-for-contribution)

## Code of Conduct

This project adheres to a code of conduct that all contributors are expected to follow. Be respectful, inclusive, and professional in all interactions.

## Getting Started

Before contributing, please:

1. Read the [README.md](README.md) to understand the project
2. Check the [ROADMAP.md](ROADMAP.md) for planned features
3. Browse existing [issues](https://github.com/shiv19/endurance-coach-skill/issues) to see what needs work
4. Join discussions to understand ongoing work

## Development Setup

### Prerequisites

- Node.js 22+ and npm
- Git
- A code editor (VS Code recommended)

### Installation

1. Fork the repository
2. Clone your fork:

   ```bash
   git clone https://github.com/YOUR_USERNAME/endurance-coach-skill.git
   cd endurance-coach-skill
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Build the project:
   ```bash
   npm run build
   ```

### Development Workflow

**Working on the CLI:**

The main package is a CLI utility. To test your changes:

```bash
npm start -- [command] [options]
```

For example:

```bash
npm start -- templates             # List available workout templates
npm start -- templates run         # Show run templates
npm start -- validate plan.yaml    # Validate a training plan
npm start -- expand plan.yaml      # Expand a compact plan
```

**Working on the Viewer (Web UI):**

The viewer is embedded into generated plan HTML files and reads plan data from a `<script id="plan-data">` tag. For viewer development:

1. Start the development server (loads with placeholder data):

   ```bash
   npm run dev:viewer
   ```

2. For testing with real plan data:
   - Generate a plan HTML file: `npm start -- render examples/sample-plan.yaml -o examples/sample-plan.html`
   - Open the generated HTML file directly in your browser
   - Or build the viewer and re-render the plan: `npm run build:viewer && npm start -- render examples/sample-plan.yaml -o examples/sample-plan.html`

Note: `npm run dev:viewer` does not show the training calendar. For full testing, use the render workflow above.

**Working on Templates:**

Workout templates are YAML files in `templates/`. After modifying templates:

1. Test template syntax:

   ```bash
   npm start -- templates [sport] --show [template-name]
   ```

2. Validate in a plan:
   ```bash
   npm start -- expand your-test-plan.yaml
   ```

### Available Scripts

- `npm start -- [args]` - Run CLI with arguments
- `npm run build` - Build all components (TypeScript, viewer, skill)
- `npm run build:ts` - Build TypeScript only
- `npm run build:viewer` - Build web viewer
- `npm run dev:viewer` - Development server for viewer (requires generated plan)
- `npm test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:allTemplates` - Test all workout templates can be converted to HTML
- `npm run test:expandPlanToJson` - Test all workout templates can be converted to JSON
- `npm run typecheck` - Type check without emitting
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting

## Project Structure

```
src/
├── cli.ts              # Command-line interface
├── index.ts            # Main entry point
├── db/                 # Database schema and client
├── expander/           # Plan expansion logic
├── lib/                # Shared utilities
├── schema/             # Type schemas and validation
├── strava/             # Strava API integration
├── templates/          # Template loading and parsing
└── viewer/             # Web-based plan viewer (Svelte)

templates/              # Workout templates (YAML)
├── bike/
├── run/
├── swim/
├── strength/
└── brick/

tests/                  # Test files
```

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [issues](https://github.com/shiv19/endurance-coach-skill/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs. actual behavior
   - System information (OS, Node version)
   - Relevant logs or screenshots

### Suggesting Features

1. Check the [ROADMAP.md](ROADMAP.md) and existing issues
2. Open a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach (if you have ideas)

### Submitting Code

1. Create a new branch:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our [coding standards](#coding-standards)

3. Add or update tests as needed

4. Ensure all tests pass:

   ```bash
   npm test
   npm run typecheck
   npm run format:check
   ```

5. Commit your changes with clear, descriptive commit messages

6. Push to your fork and submit a pull request

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode checking
- Define proper types (avoid `any`)
- Use Zod schemas for runtime validation

### Code Style

- Follow the existing code style
- Use Prettier for formatting (runs automatically via `npm run format`)
- Lint-staged runs on commit to ensure formatting

### Documentation

- Add JSDoc comments for public APIs
- Update relevant markdown files (README, ROADMAP, etc.)
- Include inline comments for complex logic
- Update CLAUDE.md files in relevant directories to help AI assistants understand the code

### Commit Messages

- Use clear, descriptive commit messages
- Start with a verb in present tense (Add, Fix, Update, Remove)
- Reference issue numbers when applicable
- Examples:
  - `Add VO2max workout template for cycling`
  - `Fix zone calculation for threshold runs (#123)`
  - `Update schema to support brick workouts`

## Testing

### Running Tests

```bash
npm test              # Run all tests in watch mode
npm run test:run      # Run tests once
```

### Testing All Templates

When modifying workout templates, verify all templates can be converted and rendered:

```bash
npm run test:allTemplates
```

This script renders a test plan (`tests/test-all-templates.yaml`) that includes every built-in template. If conversion fails, it will show which template has the issue.

**Important**: After adding or modifying templates:

1. Run `npm run test:allTemplates` to ensure conversion works
2. Run `npm test` to verify unit tests still pass
3. Run `npm run typecheck` to ensure TypeScript types are correct

### Writing Tests

- Add tests for new features
- Ensure edge cases are covered
- Use descriptive test names
- Place tests in the `tests/` directory

## Submitting Changes

### Pull Request Process

1. Ensure your code follows all coding standards
2. Update documentation as needed
3. Make sure all tests pass
4. Write a clear PR description:
   - What changes you made
   - Why you made them
   - How to test them
   - Link related issues

5. Wait for review and address feedback

### Review Process

- Maintainers will review your PR
- Address requested changes promptly
- Be open to feedback and discussion
- Once approved, a maintainer will merge your PR

## Areas for Contribution

Here are some areas where contributions are especially welcome:

### Workout Templates

- Add more sport-specific workout templates in `templates/`
- Improve existing template variations
- Add documentation for template syntax

### Training Plans

- Create example plans for different sports/distances
- Improve periodization logic
- Enhance load management algorithms

### Integrations

- Improve Strava integration
- Add support for other platforms (TrainingPeaks, Garmin Connect, etc.)
- Enhance workout export formats

### Documentation

- Improve setup instructions
- Create video tutorials
- Translate documentation
- Add coaching tips and best practices

### Testing

- Increase test coverage
- Add integration tests
- Test edge cases

### UI/UX

- Improve the viewer interface
- Add mobile responsive design
- Enhance workout visualization
- Improve accessibility

### Performance

- Optimize plan generation
- Improve viewer loading time
- Reduce bundle size

## Questions?

If you have questions about contributing, feel free to:

- Open a discussion on GitHub
- Comment on relevant issues
- Reach out to the maintainers

Thank you for contributing to Endurance Coach! 🏃‍♂️🚴‍♀️🏊‍♂️
