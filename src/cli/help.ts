// ============================================================================
// MARK: Help Command
// ============================================================================
/**
 * Print the CLI usage, command reference, options, auth flow, and examples for the Endurance Coach tools to the console.
 *
 * The help text covers available commands, per-command options (auth, sync, activity, expand, render, templates, stats,
 * training-load, foundation, strength, schedule-preferences, hr-zones, query, modify, etc.), headless and interactive auth
 * instructions, and example invocations.
 */

export function printHelp(): void {
  console.log(`
Endurance Coach - Training Plan Tools

Usage: npx endurance-coach <command> [options]

Commands:
  sync              Sync activities from Strava
  auth              Get Strava authorization URL or exchange code for tokens
  activity <id>     Fetch activity data from Strava (use subcommand flags)
  activity-record   Manually record an activity (bypassing Strava)
  schema            Print the YAML v2.0 plan format reference
  validate <file>   Validate a training plan (YAML recommended)
  expand <file>     Expand a compact YAML plan to full format
  render <file>     Render a training plan to HTML
  templates         List available workout templates
  stats             Current form stats (volume, longest, averages)
  training-load     Weekly training load trend
  foundation        Athletic foundation overview
  strength          Strength/limiter signals
  schedule-preferences  Preferred training days by sport
  hr-zones          HR summaries for zone estimation
  query <sql>       Run a SQL query against the database
  modify            Apply backup changes to a training plan
  interview         Interactive athlete interview
  interview-save    Save interview results for an activity
  preliminary-note-save  Save preliminary coach note for an activity
  interviews        List saved interviews
  triggers          Analyze training trigger patterns
  help              Show this help message

Auth Options (for headless/Claude environments):
  --client-id=ID        Strava API client ID
  --client-secret=SEC   Strava API client secret
  --code=URL_OR_CODE    Full redirect URL or just the authorization code

  Step 1: Run 'auth' with credentials to get authorization URL
  Step 2: User clicks URL, authorizes, copies entire redirect URL
  Step 3: Run 'auth --code=URL' to exchange for tokens
  Step 4: Run 'sync' to fetch activities

Sync Options:
  --client-id=ID        Strava API client ID (for OAuth flow)
  --client-secret=SEC   Strava API client secret (for OAuth flow)
  --days=N              Days of history to sync (default: 730)

Activity Options:
  --laps                Fetch activity laps for lap-by-lap analysis

Expand Options:
  --output, -o FILE     Output file (default: stdout)
  --format json|yaml    Output format (default: json)
  --verbose, -v         Show template resolution details

Templates Options:
  list                   List all templates (default)
    --sport SPORT        Filter by sport (run, bike, swim)
    --type TYPE          Filter by workout type
    --source SOURCE      Filter by source (user, builtin, all)
    --verbose, -v        Show additional columns
  show <template-id>     Show details of a specific template

Render Options:
  --output, -o FILE     Output HTML file (default: <input>.html)

Query Options:
  --json                Output as JSON (default: plain text)

Stats Options:
  --weeks N             Weeks for volume/averages (default: 8)
  --longest-weeks N     Weeks for longest sessions (default: 12)
  --json                Output as JSON

Training Load Options:
  --weeks N             Weeks for load trend (default: 12)
  --json                Output as JSON

Foundation Options:
  --top-weeks N         Number of peak weeks (default: 5)
  --json                Output as JSON

Strength Options:
  --months N            Window for efficiency (default: 6)
  --long-months N       Window for easy long sessions (default: 12)
  --easy-hr-max N       Max HR for easy long sessions (default: 145)
  --long-minutes N      Min minutes for long sessions (default: 60)
  --years N             Window for historical peaks (default: 2)
  --json                Output as JSON

Schedule Preferences Options:
  --ride-minutes N      Long ride threshold (default: 90)
  --run-minutes N       Long run threshold (default: 60)
  --json                Output as JSON

HR Zones Options:
  --weeks N             Window for avg HR (default: 8)
  --distribution-weeks N Window for HR distribution (default: 12)
  --json                Output as JSON

Modify Options:
  --backup, -b FILE     Backup JSON file (exported from Settings)
  --plan, -p FILE       Expanded plan JSON file to modify
  --output, -o FILE     Output file (default: overwrites plan file)

Interview Save Options:
  --reflection, -r TEXT   Athlete reflection summary
  --notes, -n TEXT       Coach notes
  --confidence, -c LEVEL Confidence level: Low, Medium, or High (default: Medium)

Preliminary Note Save Options:
  --note TEXT            Preliminary coach note

Examples:
  # Headless auth flow (for automated environments)
  npx endurance-coach auth --client-id=12345 --client-secret=abc123
  # User clicks URL, copies code from failed redirect
  npx endurance-coach auth --code=AUTHORIZATION_CODE
  # syncs last 730 days (2 years) by default
  npx endurance-coach sync
  # sync last 7 days only
  npx endurance-coach sync --days=7

  # Fetch activity laps (lap-by-lap analysis)
  npx endurance-coach activity 123456789 --laps

  # Interactive auth flow (opens browser)
  npx endurance-coach sync --client-id=12345 --client-secret=abc123

  # Get the YAML v2.0 format reference
  npx endurance-coach schema

  # Validate a compact YAML plan
  npx endurance-coach validate plan.yaml

  # Render a training plan to HTML
  npx endurance-coach render plan.yaml --output my-plan.html

  # Current form snapshot
  npx endurance-coach stats --weeks 8

  # Training load trend
  npx endurance-coach training-load --weeks 12

  # Athletic foundation overview
  npx endurance-coach foundation --top-weeks 5

  # Strength signals
  npx endurance-coach strength --months 6

  # Schedule preferences
  npx endurance-coach schedule-preferences --ride-minutes 90 --run-minutes 60

  # HR summaries for zone estimation
  npx endurance-coach hr-zones --weeks 8

  # Advanced: run a raw SQL query
  npx endurance-coach query "SELECT * FROM weekly_volume LIMIT 5"

  # Apply backup changes to an expanded plan
  npx endurance-coach modify --backup backup.json --plan expanded.json

  # Save modified plan to a new file
  npx endurance-coach modify -b backup.json -p expanded.json -o modified.json

  # Save interview results
  npx endurance-coach interview-save 123456 --reflection "Felt good today" --notes "Good pace control" --confidence High

  # Save preliminary coach note
  npx endurance-coach preliminary-note-save 123456 --note "Look at HR drift data"
`);
}
