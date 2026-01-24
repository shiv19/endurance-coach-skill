# Endurance Coach - Agent Guide

This document helps agents work effectively in the Endurance Coach codebase.

## Project Overview

Endurance Coach is a TypeScript + Svelte project for creating personalized triathlon, marathon, and ultra-endurance training plans. It has three main components:

1. **CLI Tool** (`src/cli.ts`) - Syncs Strava data, validates plans, renders HTML
2. **Web Viewer** (`src/viewer/`) - Svelte 5 SPA for viewing/editing training plans in browser
3. **Endurance Coach Skill** (`endurance-coach-skill/`) - AI skill for training plan generation (works with any AI assistant)

### Architecture

- **Backend/CLI**: TypeScript with Node.js runtime
- **Frontend**: Svelte 5 (runes-based reactivity) compiled to single HTML file
- **Data**: SQLite database for Strava activity storage
- **Validation**: Zod schemas mirror TypeScript interfaces for runtime validation
- **Build**: Vite (viewer), tsc (CLI), custom scripts (skill packaging)

## Essential Commands

```bash
# Development
npm run dev              # Run CLI with tsx watch
npm run dev:viewer       # Start Vite dev server for viewer

# Building
npm run build            # Build everything (TS + viewer + skill)
npm run build:ts         # Compile TypeScript to dist/
npm run build:viewer     # Build Svelte viewer to templates/plan-viewer.html
npm run build:skill      # Package skill to dist/endurance-coach-skill.zip

# Testing
npm test                # Run tests in watch mode (Vitest)
npm run test:run        # Run tests once
npm run typecheck       # TypeScript type checking (no emit)

# Code Quality
npm run format          # Format all files with Prettier
npm run format:check    # Check formatting without changing files

# CLI Usage
npx endurance-coach sync              # Sync Strava activities
npx endurance-coach auth              # Strava OAuth flow
npx endurance-coach validate <file>   # Validate plan JSON
npx endurance-coach render <file>     # Render plan to HTML
npx endurance-coach query <sql>       # Query SQLite database
npx endurance-coach schema            # Print JSON schema reference
npx endurance-coach modify --backup b.json --plan p.json --o out.json
```

**Pre-commit hooks**: Automatically runs `npm run typecheck` and `npx lint-staged` on commit.

## Code Organization

```
src/
├── cli.ts                    # CLI entry point, command parsing, auth flow
├── index.ts                  # Public API exports
├── schema/
│   ├── training-plan.ts       # TypeScript type definitions
│   └── training-plan.schema.ts # Zod validation schemas
├── strava/
│   ├── api.ts               # Strava API client with retry logic
│   ├── oauth.ts             # OAuth token management
│   └── types.ts            # Strava response types
├── db/
│   ├── client.ts            # SQLite database interface
│   ├── migrate.ts           # Database migrations
│   └── schema.sql          # Table definitions & views
├── lib/
│   ├── config.ts            # Config file management
│   └── logging.ts          # Consola logger wrapper
└── viewer/
    ├── App.svelte          # Main Svelte component
    ├── main.ts             # Viewer entry point
    ├── components/         # Svelte components
    ├── stores/             # Svelte 5 stores (plan, settings, changes)
    └── lib/
        ├── export/         # Workout export (Zwift, Garmin, ICS)
        └── UpdatePlan.ts   # Apply local changes to plan
```

### Key Directories

- `dist/` - Compiled TypeScript output (CLI, schemas, SQL)
- `templates/` - Built viewer HTML (single-file embedded)
- `endurance-coach-skill/` - Skill definition for AI integration
- `tests/` - Vitest test files (mirrors src structure)

## Code Conventions

### TypeScript

- **ESM modules only**: Use `.js` extensions in imports (even for .ts files)
- **Strict mode**: TypeScript strict mode enabled
- **Module resolution**: NodeNext
- **Types**: Always include type annotations on function parameters and returns

```typescript
// Correct
import { validatePlan } from "./schema/training-plan.schema.js";

function runSync(args: SyncArgs): Promise<void> {
  // ...
}

// Incorrect
import { validatePlan } from "./schema/training-plan.schema"; // Missing .js

function runSync(args) {
  // Missing type annotation
  // ...
}
```

### Zod Schema Synchronization

Every TypeScript interface in `training-plan.ts` has a corresponding Zod schema in `training-plan.schema.ts`. Keep them in sync:

```typescript
// training-plan.ts
export interface Workout {
  id: string;
  sport: Sport;
  // ...
}

// training-plan.schema.ts
export const WorkoutSchema = z.object({
  id: z.string(),
  sport: SportSchema,
  // ...
});
```

### Svelte 5 (Runes)

- Use `$state` for reactive state (not stores)
- Use `$effect` for side effects
- All reactive state must be in `.svelte` files
- Stores export plain data/functions for components to create state

```svelte
<script lang="ts">
  let count = $state(0);
  let doubled = $derived(count * 2);

  $effect(() => {
    console.log("Count changed:", count);
  });

  function increment() {
    count += 1;
  }
</script>
```

### Error Handling

- Use the `log` helper from `lib/logging.ts` for CLI output
- Throw errors with descriptive messages
- Use `process.exit(1)` for fatal CLI errors

```typescript
import { log } from "./lib/logging.js";

if (!configExists()) {
  log.error("No configuration found");
  process.exit(1);
}

log.success("Operation completed");
```

### Logging Patterns

- `log.info()` - General information
- `log.success()` - Successful completion
- `log.warn()` - Warnings
- `log.error()` - Errors
- `log.debug()` - Debug output
- `log.start()` - Start of long operation
- `log.ready()` - Ready state / next instruction
- `log.box()` - Highlighted message
- `log.progress()` - In-place progress update (use with `log.progressEnd()`)

## Data Flow

### Plan Rendering Flow

1. CLI validates JSON against Zod schema
2. CLI embeds JSON into HTML template as `<script type="application/json" id="plan-data">`
3. Browser loads HTML, parses JSON from DOM
4. Svelte components render reactive UI from plan data
5. Local changes stored in localStorage (`plan-{id}-changes`, `plan-{id}-completed`)
6. Export/Apply uses `UpdatePlan.ts` to merge changes back into plan JSON

### Strava Sync Flow

1. OAuth token stored in `~/.endurance-coach/config.json`
2. Activities fetched from Strava API (paginated, 100 per page)
3. Stored in SQLite `~/.endurance-coach/coach.db`
4. Useful views: `weekly_volume`, `recent_activities`
5. Can query with `npx endurance-coach query "SELECT * FROM weekly_volume"`

## Important Gotchas

### CLI Argument Parsing

Arguments with `=` must use `slice()` not `split('=')[1]` to handle multiple `=` characters:

```typescript
// ✅ Correct
if (arg.startsWith("--code=")) {
  args.code = arg.slice("--code=".length);
}

// ❌ Wrong - truncates URLs with query params
if (arg.startsWith("--code=")) {
  args.code = arg.split("=")[1]; // Fails on "http://...?code=...&scope=..."
}
```

### Template Location

The plan viewer template is looked up in multiple locations:

```typescript
const locations = [
  join(__dirname, "..", "templates", "plan-viewer.html"),
  join(__dirname, "..", "..", "templates", "plan-viewer.html"),
  join(process.cwd(), "templates", "plan-viewer.html"),
];
```

After building with `npm run build:viewer`, the template is at `templates/plan-viewer.html`.

### Import Extensions

Always use `.js` extensions in TypeScript imports, even when importing `.ts` files:

```typescript
import { TrainingPlan } from "../schema/training-plan.js"; // ✅
import { TrainingPlan } from "../schema/training-plan"; // ❌ Won't compile
```

### SQLite Timestamps

Use SQLite's `datetime('now')` function for consistent ISO timestamps:

```typescript
execute(`
  INSERT INTO sync_log (started_at, completed_at, activities_synced, status)
  VALUES (datetime('now'), datetime('now'), ${count}, 'success');
`);
```

### Rate Limiting

Strava API rate limits (429 responses) are handled automatically in `strava/api.ts`:

- Respects `Retry-After` header
- Implements exponential backoff
- Up to 3 retries before failing

### Browser-Only Code

Some code only runs in browser environment (e.g., `localStorage`, DOM access):

```typescript
// In UpdatePlan.ts
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType }); // Browser API
  // ...
}
```

These modules are in `src/viewer/lib/` and should not be imported from CLI code.

## Training Plan Schema

The plan JSON structure is defined in `src/schema/training-plan.ts`. Key objects:

- **TrainingPlan** - Root object with version "1.0"
- **TrainingWeek** - 7 days with summary and phase info
- **TrainingDay** - Date, day of week, workout array
- **Workout** - Individual workout with sport, type, zones, optional structure
- **StructuredWorkout** - Device-structured workout (warmup, main, cooldown)
- **AthleteZones** - HR, power, pace, swim CSS zones
- **RaceStrategy** - Event info, pacing, nutrition, taper

All dates must be ISO 8601 format: `"2025-01-06"`.

## Export Formats

The viewer can export workouts to multiple formats:

- **ZWO** (`.zwo`) - Zwift workouts (bike/run only)
- **FIT** (`.fit`) - Garmin workouts (all sports)
- **MRC** (`.mrc`) - TrainerRoad/ERG workouts (bike only)
- **ICS** (`.ics`) - iCalendar full plan export

Each export format has a file in `src/viewer/lib/export/` with `generate*` functions.

## Testing

Tests use Vitest with globals enabled. Test files mirror source structure:

```
tests/
├── cli/           # CLI command tests
│   ├── args.test.ts
│   ├── config.test.ts
│   ├── db.test.ts
│   └── strava.test.ts
└── viewer/        # Viewer/export tests
    ├── export-*.test.ts
    ├── plan-validation.test.ts
    └── utils.test.ts
```

Run tests with `npm test` (watch) or `npm run test:run` (single pass).

## Configuration

### User Config

Stored in `~/.endurance-coach/config.json`:

```json
{
  "strava": {
    "client_id": "...",
    "client_secret": "...",
    "redirect_uri": "http://localhost:8765/callback"
  },
  "sync_days": 730
}
```

### Database Location

SQLite database: `~/.endurance-coach/coach.db`

Use `getDbPath()` from `lib/config.ts` to get the path dynamically.

## Formatting

Prettier config (`.prettierrc`):

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte"]
}
```

Format before committing with `npm run format`. Pre-commit hook runs `npx lint-staged` which auto-formats staged files.

## Skill Integration

The `endurance-coach-skill/` directory contains an AI agent skill for AI-powered plan generation. Key files:

- `SKILL.md` - Skill definition and instructions
- `reference/` - Domain knowledge (periodization, load management, etc.)

When working with the skill, note that it generates plan JSON that must conform to the Zod schema. Use `npx endurance-coach validate` to verify generated plans.

## Release Process

See `RELEASING.md` for full details. Quick release:

```bash
npm version patch  # or minor/major
npm run build:viewer
npm run build:skill
npm publish
git push origin main --tags
VERSION=$(node -p "require('./package.json').version")
gh release create "v$VERSION" --title "v$VERSION" dist/coach-skill.zip
```

## Common Tasks

### Adding a New Export Format

1. Create `src/viewer/lib/export/yourformat.ts`
2. Implement `generateYourFormat(workout, settings)` function
3. Add format to `ExportFormat` type in `index.ts`
4. Add case in `exportWorkout()` switch statement
5. Create tests in `tests/viewer/export-yourformat.test.ts`

### Modifying Plan Schema

1. Update TypeScript interface in `src/schema/training-plan.ts`
2. Update corresponding Zod schema in `src/schema/training-plan.schema.ts`
3. Update example workout if needed
4. Run tests to ensure no regressions
5. Update `npx endurance-coach schema` help text in `cli.ts` if needed

### Adding CLI Command

1. Add interface for command args in `cli.ts`
2. Add parsing logic to `parseArgs()`
3. Implement command handler function
4. Add case to `main()` switch statement
5. Update help text in `printHelp()`
6. Add tests in `tests/cli/your-command.test.ts`

### Adding Svelte Component

1. Create component in `src/viewer/components/YourComponent.svelte`
2. Use Svelte 5 runes (`$state`, `$derived`, `$effect`)
3. Import and use in parent component
4. Props passed as plain values (not reactive in Svelte 5)

## External APIs

### Strava API

- Base URL: `https://www.strava.com/api/v3`
- Auth endpoints handled in `strava/oauth.ts`
- Activity fetching in `strava/api.ts` with retry logic
- Required scope: `activity:read_all`

### Proxy Support

The CLI respects `HTTP_PROXY` / `HTTPS_PROXY` environment variables for corporate networks:

```typescript
const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
```

This is configured early in `cli.ts` using `undici`.
