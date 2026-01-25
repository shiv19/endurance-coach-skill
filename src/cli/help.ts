// ============================================================================
// Help Command
// ============================================================================

export function printHelp(): void {
  console.log(`
Endurance Coach - Training Plan Tools

Usage: npx endurance-coach <command> [options]

Commands:
  sync              Sync activities from Strava
  auth              Get Strava authorization URL or exchange code for tokens
  schema            Print the YAML v2.0 plan format reference
  validate <file>   Validate a training plan (YAML recommended)
  expand <file>     Expand a compact YAML plan to full format
  render <file>     Render a training plan to HTML
  templates         List available workout templates
  query <sql>       Run a SQL query against the database
  modify            Apply backup changes to a training plan
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

Modify Options:
  --backup, -b FILE     Backup JSON file (exported from Settings)
  --plan, -p FILE       Expanded plan JSON file to modify
  --output, -o FILE     Output file (default: overwrites plan file)

Examples:
  # Headless auth flow (for Claude/automated environments)
  npx endurance-coach auth --client-id=12345 --client-secret=abc123
  # User clicks URL, copies code from failed redirect
  npx endurance-coach auth --code=AUTHORIZATION_CODE
  npx endurance-coach sync

  # Interactive auth flow (opens browser)
  npx endurance-coach sync --client-id=12345 --client-secret=abc123

  # Get the YAML v2.0 format reference
  npx endurance-coach schema

  # Validate a compact YAML plan
  npx endurance-coach validate plan.yaml

  # Render a training plan to HTML
  npx endurance-coach render plan.yaml --output my-plan.html

  # Query the database
  npx endurance-coach query "SELECT * FROM weekly_volume LIMIT 5"

  # Apply backup changes to an expanded plan
  npx endurance-coach modify --backup backup.json --plan expanded.json

  # Save modified plan to a new file
  npx endurance-coach modify -b backup.json -p expanded.json -o modified.json
`);
}
