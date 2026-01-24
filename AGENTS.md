# Endurance Coach - Agent Guide

This guide helps AI agents work effectively in the Endurance Coach codebase - a TypeScript/Svelte application for creating personalized training plans.

## Project Overview

Endurance Coach is a dual-component system:

- **CLI Tool**: Generates training plans from compact YAML templates using a domain-specific language
- **Web Viewer**: Single-page Svelte application embedded in rendered HTML for viewing and managing plans

The system uses a contract-first, template-based architecture where AI agents compose plans from predefined workout templates rather than generating raw JSON.

## Essential Commands

### Development

```bash
# Run CLI directly (equivalent to npx endurance-coach)
npm start -- [command] [options]

# Watch mode for CLI development
npm run dev

# Development server for web viewer (Svelte)
npm run dev:viewer

# Run all tests (watch mode)
npm test

# Run tests once
npm run test:run
```

### Building

```bash
# Build everything (TypeScript + viewer + skill package)
npm run build

# Build only TypeScript
npm run build:ts

# Build only web viewer
npm run build:viewer

# Package skill for distribution
npm run build:skill
```

### Code Quality

```bash
# Type check without emitting
npm run typecheck

# Format all code with Prettier
npm run format

# Check formatting (fails if not formatted)
npm run format:check
```

### Testing Workflow

After making changes:

1. Run `npm run typecheck` to ensure types are correct
2. Run `npm test` to run tests in watch mode
3. Run `npm run format:check` before committing (pre-commit hook enforces this)

## Project Structure

```
src/
├── cli.ts              # Command-line interface (main entry point)
├── index.ts            # Public API exports
├── db/                 # SQLite database schema and client
│   ├── schema.sql      # Database schema and views
│   ├── client.ts       # SQLite connection and query functions
│   └── migrate.ts     # Database migration logic
├── lib/                # Shared utilities
│   ├── config.ts      # Configuration management
│   └── logging.ts     # CLI logging utilities
├── schema/             # Type schemas and validation (Zod)
│   ├── training-plan.schema.ts    # v1.0 full JSON schema
│   ├── compact-plan.schema.ts     # v2.0 YAML template schema
│   ├── training-plan.ts           # TypeScript types
│   └── compact-plan.ts           # Compact plan utilities
├── templates/          # Template loading and parsing
│   ├── loader.ts      # Load templates from filesystem
│   ├── yaml-parser.ts # YAML parsing wrapper
│   ├── interpolate.ts # Template variable interpolation
│   └── index.ts      # Public API exports
├── expander/           # Plan expansion logic
│   ├── expander.ts    # Core expansion (compact → full)
│   ├── zones.ts       # Heart rate, power, pace zone calculations
│   └── types.ts       # Expanded plan types
├── strava/             # Strava API integration
│   ├── api.ts         # Activity and athlete endpoints
│   ├── oauth.ts       # OAuth token management
│   └── types.ts       # Strava API types
└── viewer/             # Web-based plan viewer (Svelte 5)
    ├── App.svelte      # Main application
    ├── main.ts         # Entry point
    ├── components/     # Svelte components
    ├── lib/           # Export utilities (ICS, FIT, ZWO, ERG)
    └── stores/        # Svelte 5 runes state management

templates/              # Workout template definitions (YAML)
├── run/               # Running workouts
├── bike/              # Cycling workouts
├── swim/              # Swimming workouts
├── strength/          # Strength training
└── brick/             # Brick workouts (bike+run)

tests/                 # Test files (Vitest)
├── cli/               # CLI tests
└── viewer/            # Viewer tests
```

## Code Conventions

### TypeScript

- Use ES2022 target with `NodeNext` module resolution
- Strict mode enabled
- All exports must include type definitions
- Use `.js` extensions in imports (required by NodeNext)

### Svelte

- **Svelte 5 Runues**: Use `$state`, `$effect`, `$derived` for reactivity
  ```typescript
  let settings = $state(loadSettings());
  $effect(() => {
    document.documentElement.setAttribute("data-theme", settings.theme);
  });
  ```
- TypeScript with `<script lang="ts">` blocks
- Components use PascalCase (e.g., `WorkoutModal.svelte`)

### File Naming

- TypeScript files: kebab-case (e.g., `yaml-parser.ts`)
- Svelte components: PascalCase (e.g., `WorkoutModal.svelte`)
- Templates: lowercase with hyphens (e.g., `tempo.yaml`)

### Prettier Configuration

- Use double quotes (`"`)
- 2-space indentation
- Trailing commas: ES5
- Print width: 100 characters
- Semicolons: required

### Import Style

- Absolute imports from project root: `import { X } from "./module.js"`
- Use `.js` extensions for TypeScript files (NodeNext requirement)
- Group imports: external libraries first, then internal modules

## Architecture & Patterns

### Two-Format System

**v1.0 (Full JSON)**: Expanded format with complete workout details

```json
{
  "version": "1.0",
  "meta": { ... },
  "weeks": [
    {
      "week": 1,
      "days": [
        {
          "date": "2026-01-05",
          "workouts": [
            {
              "id": "w001",
              "sport": "run",
              "type": "tempo",
              "structure": {
                "warmup": [...],
                "main": [...],
                "cooldown": [...]
              }
            }
          }
        ]
      ]
    }
  ]
}
```

**v2.0 (Compact YAML)**: Template-based format using workout references

```yaml
version: "2.0"
athlete:
  name: "Athlete Name"
  eventDate: "2026-05-15"
  paces:
    easy: "5:45/km"
    tempo: "5:00/km"

weeks:
  - week: 1
    workouts:
      Mon: tempo(20)
      Tue: easy(35)
      Wed: rest
```

### Template System

Templates are YAML files with:

- **Metadata**: `id`, `name`, `sport`, `category`, `type`
- **Parameters**: Typed inputs with defaults, validation
- **Structure**: Workout segments (warmup, main, cooldown) with interpolated values
- **Human-readable**: Plain text description
- **Estimated duration**: Calculated from parameters

Template Schema is located in @src/schema/compact-plan.schema.ts

**Interpolation**: Uses `template()` function with context containing:

- `paces`: Athlete's pace values
- `zones`: Calculated heart rate/power zones
- Template parameters (e.g., `tempo_mins`)

### Schema Validation

Uses Zod for runtime validation:

- **Full schema**: `validatePlan()` validates v1.0 JSON
- **Compact schema**: `validateCompactPlan()` validates v2.0 YAML
- Both return structured errors with paths for debugging

**Always validate before expansion**:

```typescript
const validation = validateCompactPlan(data);
if (!validation.success) {
  console.error(formatCompactValidationErrors(validation.errors));
  process.exit(1);
}
```

### Plan Expansion Flow

1. **Parse YAML**: `parseYaml()` converts YAML to object
2. **Validate schema**: Ensures structure matches CompactPlanSchema
3. **Load templates**: `loadTemplates()` loads all workout templates
4. **Validate references**: `validateWorkoutRefs()` checks template IDs exist
5. **Expand**: `expandPlan()` replaces template references with full workouts
6. **Calculate zones**: `calculateAthleteZones()` computes HR, power, pace zones

### CLI Commands

The CLI (`src/cli.ts`) implements these commands:

- **`sync`**: Fetch activities from Strava, store in SQLite
- **`auth`**: OAuth flow for Strava access
- **`schema`**: Print YAML v2.0 format reference documentation
- **`validate <file>`**: Validate plan schema (auto-detects YAML vs JSON)
- **`expand <file>`**: Expand compact YAML to full JSON
- **`render <file>`**: Render plan to HTML with embedded viewer
- **`templates [--sport] [show <id>]`**: List/show workout templates
- **`query <sql>`**: Run SQL against activity database
- **`modify --backup <file> --plan <file>`**: Apply UI changes to plan
- **`help`**: Show command help

### Database Schema

SQLite database with tables:

- **activities**: Strava activity data (heart rate, power, distance, etc.)
- **streams**: Time-series data (HR, power, cadence over time)
- **athlete**: Athlete profile (FTP, weight, etc.)
- **goals**: Training goals and events
- **sync_log**: Sync history and status

Useful views:

- **weekly_volume**: Weekly training summary by sport
- **recent_activities**: Last 50 activities

### Svelte State Management

Uses Svelte 5 runes:

- **`$state`**: Reactive state (replaced `writable` stores)
- **`$effect`**: Side effects on state changes (replaced `onMount`)
- **`$derived`**: Computed values (replaced `derived` stores)

Example:

```typescript
let settings = $state(loadSettings());
let completed = $state(loadCompleted());

$effect(() => {
  // Runs when settings or completed changes
  document.documentElement.setAttribute("data-theme", settings.theme);
});

const filteredWorkouts = $derived(
  workouts.filter((w) => filters.sport === "all" || w.sport === filters.sport)
);
```

### Export Formats

The viewer can export workouts to:

- **ICS**: Calendar events (`.ics`)
- **FIT**: Garmin format (`.fit`)
- **ZWO**: Zwift format (`.zwo`)
- **ERG**: TrainerRoad format (`.mrc`)

All export functions are in `src/viewer/lib/export/`.

## Testing

### Test Framework

- **Vitest** for unit tests
- Tests in `tests/` directory mirror `src/` structure

### Test Patterns

```typescript
import { describe, it, expect } from "vitest";

describe("Feature name", () => {
  it("should do something", () => {
    const result = someFunction();
    expect(result).toBe(expectedValue);
  });
});
```

### Running Tests

```bash
# Watch mode (default)
npm test

# Single run
npm run test:run

# Run specific test file
npm test -- path/to/test.test.ts
```

### Test Data

Use factory functions to create test data:

```typescript
function createMockPlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    version: "1.0",
    meta: { ... },
    ...overrides
  };
}
```

## Important Gotchas

### Date Handling

- **Use `parseLocalDate()`** instead of `new Date()` for ISO dates to avoid timezone shifts
- Example: `new Date("2025-02-16")` creates a UTC date which may shift to previous day
- Solution: Parse year/month/day components and create local date

### Module Resolution

- Always use `.js` extensions for TypeScript imports (NodeNext requirement)
- Example: `import { foo } from "./module.js"` (not `.ts`)

### Template Interpolation

- Template variables are validated at expansion time
- Undefined variables cause expansion to fail
- Check template's `params` section for required variables

### Plan Expansion Order

Must expand **before** rendering to HTML:

```bash
# Correct: Expand then render
npm start -- expand plan.yaml -o plan.json
npm start -- render plan.json -o plan.html

# Render auto-detects and expands YAML files, but explicit expansion is clearer
```

### Database Path

Database is stored in user's data directory:

- Check with: `getDbPath()` from `src/db/client.ts`
- Default location varies by OS

### Strava Rate Limits

- Strava API has rate limits (200 requests/hour, 1000/day)
- Sync requests are batched to minimize calls
- Tokens expire after 6 hours but are auto-refreshed

### Svelte Dev Server Limitations

- `npm run dev:viewer` shows only the UI, not the training calendar
- To test full calendar: render a plan with actual data
- The dev server is for component development, not full plan testing

### TypeScript Strict Mode

- Project uses strict TypeScript (no implicit `any`)
- All types must be explicit
- Use `zod` for runtime type validation

### Git Hooks

- Pre-commit hook runs `npm run typecheck` and `npx lint-staged`
- Failing tests or type errors will block commits
- All files must be Prettier-formatted

### CLI Argument Parsing

- CLI uses custom parser in `src/cli.ts` (not a library)
- Arguments can be passed with `--flag=value` or `--flag value`
- For help: `npm start -- help`

### Template Resolution

- Templates are loaded from `templates/` directory
- Categories: `run`, `bike`, `swim`, `strength`, `brick`
- Template IDs are unique across all categories
- Use `templates show <id>` to view template details

## Key Files Reference

| File                                 | Purpose                           |
| ------------------------------------ | --------------------------------- |
| `src/cli.ts`                         | CLI entry point, command handlers |
| `src/index.ts`                       | Public API exports                |
| `src/schema/training-plan.schema.ts` | v1.0 JSON schema validation       |
| `src/schema/compact-plan.schema.ts`  | v2.0 YAML schema validation       |
| `src/expander/expander.ts`           | Plan expansion logic              |
| `src/templates/loader.ts`            | Template filesystem loading       |
| `src/viewer/App.svelte`              | Main web viewer component         |
| `src/db/client.ts`                   | SQLite connection and queries     |
| `src/strava/api.ts`                  | Strava API integration            |
| `package.json`                       | Scripts and dependencies          |
| `tsconfig.json`                      | TypeScript configuration          |

## Workflow Examples

### Adding a New Workout Template

1. Create YAML file in `templates/<sport>/<name>.yaml`
2. Define `id`, `name`, `params`, `structure`, `humanReadable`
3. Test template:
   ```bash
   npm start -- templates show <id>
   ```
4. Use in a plan and validate:
   ```bash
   npm start -- expand test-plan.yaml
   ```

### Modifying the CLI

1. Edit `src/cli.ts` (add command handler)
2. Update `parseArgs()` function
3. Run type check: `npm run typecheck`
4. Test: `npm start -- [new-command]`

### Updating the Web Viewer

1. Modify Svelte components in `src/viewer/`
2. Run dev server: `npm run dev:viewer`
3. For full testing, render a plan:
   ```bash
   npm run build:viewer
   npm start -- render plan.yaml -o test.html
   ```

### Running Full Build

```bash
# Type check first
npm run typecheck

# Build all components
npm run build

# Verify build output in dist/
```

## Common Tasks

### Validate a plan file

```bash
npm start -- validate plan.yaml
```

### Expand a compact plan

```bash
npm start -- expand plan.yaml -o plan.json
```

### Render to HTML

```bash
npm start -- render plan.yaml -o my-plan.html
```

### List available templates

```bash
# All templates
npm start -- templates

# By sport
npm start -- templates --sport run

# Show template details
npm start -- templates show tempo
```

### Query activity database

```bash
# Weekly volume summary
sqlite3 ~/.endurance-coach/activities.db "SELECT * FROM weekly_volume LIMIT 5"

# Or via CLI
npm start -- query "SELECT * FROM weekly_volume LIMIT 5"
```

## Environment & Dependencies

### Core Dependencies

- **TypeScript 5.7+**: Type system
- **Zod 4.x**: Schema validation
- **YAML**: Template parsing
- **Svelte 5**: Web UI framework
- **Vite**: Build tool
- **Vitest**: Test framework
- **SQLite**: Activity storage

### Node Version

- Node.js 22+ required (check `package.json` engines if specified)

### Build Outputs

- `dist/`: Compiled TypeScript and skill package
- `templates/plan-viewer.html`: Built Svelte viewer

### Configuration Files

- `tsconfig.json`: TypeScript configuration
- `svelte.config.js`: Svelte preprocessing
- `vite.config.viewer.ts`: Viewer build config
- `vitest.config.ts`: Test configuration
- `.prettierrc`: Code formatting rules
