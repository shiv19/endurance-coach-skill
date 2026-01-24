import {
  configExists,
  loadConfig,
  promptForConfig,
  saveConfig,
  saveTokens,
  tokensExist,
  getDbPath,
  createConfig,
  type Tokens,
} from "./lib/config.js";
import { log } from "./lib/logging.js";
import { migrate } from "./db/migrate.js";
import { execute, initDatabase, query, queryJson } from "./db/client.js";
import { getValidTokens } from "./strava/oauth.js";
import { getAllActivities, getAthlete } from "./strava/api.js";
import type { StravaActivity, StravaTokenResponse } from "./strava/types.js";
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { ProxyAgent, setGlobalDispatcher } from "undici";
import { validatePlan, formatValidationErrors } from "./schema/training-plan.schema.js";
import type { TrainingPlan, TrainingDay, Workout } from "./schema/training-plan.js";
import {
  validateCompactPlan,
  formatCompactValidationErrors,
} from "./schema/compact-plan.schema.js";
import { loadTemplates, parseYaml, stringifyYaml } from "./templates/index.js";
import { expandPlan, validateWorkoutRefs } from "./expander/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// Proxy Configuration
// ============================================================================

// Configure proxy for fetch() if HTTP_PROXY or HTTPS_PROXY is set
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

// ============================================================================
// Argument Parsing
// ============================================================================

interface SyncArgs {
  command: "sync";
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  days?: number;
}

interface RenderArgs {
  command: "render";
  inputFile: string;
  outputFile?: string;
}

interface QueryArgs {
  command: "query";
  sql: string;
  json: boolean;
}

interface AuthArgs {
  command: "auth";
  clientId?: string;
  clientSecret?: string;
  code?: string;
}

interface HelpArgs {
  command: "help";
}

interface ValidateArgs {
  command: "validate";
  inputFile: string;
  compact?: boolean;
}

interface ExpandArgs {
  command: "expand";
  inputFile: string;
  outputFile?: string;
  format?: "json" | "yaml";
  verbose?: boolean;
}

interface TemplatesArgs {
  command: "templates";
  sport?: string;
  show?: string;
}

interface SchemaArgs {
  command: "schema";
}

interface ModifyArgs {
  command: "modify";
  backup: string;
  plan: string;
  output?: string;
}

type CliArgs =
  | SyncArgs
  | RenderArgs
  | QueryArgs
  | AuthArgs
  | HelpArgs
  | ModifyArgs
  | ValidateArgs
  | SchemaArgs
  | ExpandArgs
  | TemplatesArgs;

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "sync") {
    // Sync command (default)
    const syncArgs: SyncArgs = { command: "sync" };

    for (const arg of args) {
      if (arg.startsWith("--client-id=")) {
        syncArgs.clientId = arg.split("=")[1];
      } else if (arg.startsWith("--client-secret=")) {
        syncArgs.clientSecret = arg.split("=")[1];
      } else if (arg.startsWith("--access-token=")) {
        syncArgs.accessToken = arg.split("=")[1];
      } else if (arg.startsWith("--refresh-token=")) {
        syncArgs.refreshToken = arg.split("=")[1];
      } else if (arg.startsWith("--days=")) {
        syncArgs.days = parseInt(arg.split("=")[1]);
      }
    }

    return syncArgs;
  }

  if (args[0] === "render") {
    if (!args[1]) {
      log.error("render command requires an input file");
      process.exit(1);
    }

    const renderArgs: RenderArgs = {
      command: "render",
      inputFile: args[1],
    };

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--output" || args[i] === "-o") {
        renderArgs.outputFile = args[i + 1];
        i++;
      } else if (args[i].startsWith("--output=")) {
        renderArgs.outputFile = args[i].split("=")[1];
      } else if (!args[i].startsWith("-") && !renderArgs.outputFile) {
        // Accept positional output argument (helps when npm consumes -o)
        renderArgs.outputFile = args[i];
      }
    }

    return renderArgs;
  }

  if (args[0] === "query") {
    if (!args[1]) {
      log.error("query command requires a SQL statement");
      process.exit(1);
    }

    const queryArgs: QueryArgs = {
      command: "query",
      sql: args[1],
      json: args.includes("--json"),
    };

    return queryArgs;
  }

  if (args[0] === "auth") {
    const authArgs: AuthArgs = { command: "auth" };

    for (const arg of args) {
      if (arg.startsWith("--client-id=")) {
        authArgs.clientId = arg.slice("--client-id=".length);
      } else if (arg.startsWith("--client-secret=")) {
        authArgs.clientSecret = arg.slice("--client-secret=".length);
      } else if (arg.startsWith("--code=")) {
        authArgs.code = arg.slice("--code=".length);
      }
    }

    return authArgs;
  }

  if (args[0] === "validate") {
    if (!args[1]) {
      log.error("validate command requires an input file");
      process.exit(1);
    }

    const validateArgs: ValidateArgs = {
      command: "validate",
      inputFile: args[1],
      compact: args.includes("--compact") || args[1].endsWith(".yaml") || args[1].endsWith(".yml"),
    };

    return validateArgs;
  }

  if (args[0] === "expand") {
    if (!args[1]) {
      log.error("expand command requires an input file");
      process.exit(1);
    }

    const expandArgs: ExpandArgs = {
      command: "expand",
      inputFile: args[1],
    };

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--output" || args[i] === "-o") {
        expandArgs.outputFile = args[i + 1];
        i++;
      } else if (args[i].startsWith("--output=")) {
        expandArgs.outputFile = args[i].split("=")[1];
      } else if (args[i] === "--format") {
        expandArgs.format = args[i + 1] as "json" | "yaml";
        i++;
      } else if (args[i].startsWith("--format=")) {
        expandArgs.format = args[i].split("=")[1] as "json" | "yaml";
      } else if (args[i] === "--verbose" || args[i] === "-v") {
        expandArgs.verbose = true;
      }
    }

    return expandArgs;
  }

  if (args[0] === "templates") {
    const templatesArgs: TemplatesArgs = {
      command: "templates",
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--sport") {
        templatesArgs.sport = args[i + 1];
        i++;
      } else if (args[i].startsWith("--sport=")) {
        templatesArgs.sport = args[i].split("=")[1];
      } else if (args[i] === "show") {
        templatesArgs.show = args[i + 1];
        i++;
      }
    }

    return templatesArgs;
  }

  if (args[0] === "schema") {
    return { command: "schema" };
  }

  if (args[0] === "modify") {
    if (!args[1] || !args[2]) {
      log.error("modify command requires --backup and --plan arguments");
      process.exit(1);
    }

    const modifyArgs: ModifyArgs = {
      command: "modify",
      backup: "",
      plan: "",
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--backup" || args[i] === "-b") {
        modifyArgs.backup = args[i + 1];
        i++;
      } else if (args[i].startsWith("--backup=")) {
        modifyArgs.backup = args[i].split("=")[1];
      } else if (args[i] === "--plan" || args[i] === "-p") {
        modifyArgs.plan = args[i + 1];
        i++;
      } else if (args[i].startsWith("--plan=")) {
        modifyArgs.plan = args[i].split("=")[1];
      } else if (args[i] === "--output" || args[i] === "-o") {
        modifyArgs.output = args[i + 1];
        i++;
      } else if (args[i].startsWith("--output=")) {
        modifyArgs.output = args[i].split("=")[1];
      }
    }

    if (!modifyArgs.backup || !modifyArgs.plan) {
      log.error("Both --backup and --plan are required");
      process.exit(1);
    }

    return modifyArgs;
  }
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { command: "help" };
  }

  log.error(`Unknown command: ${args[0]}`);
  process.exit(1);
}

function printHelp(): void {
  console.log(`
Endurance Coach - Training Plan Tools

Usage: npx endurance-coach <command> [options]

Commands:
  sync              Sync activities from Strava
  auth              Get Strava authorization URL or exchange code for tokens
  schema            Print the YAML v2.0 plan format reference
  validate <file>   Validate a training plan against the schema
  expand <file>     Expand a compact YAML plan to full JSON format
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

Validate Options:
  --compact             Force compact plan validation (auto-detected for .yaml files)

Expand Options:
  --output, -o FILE     Output file (default: stdout)
  --format json|yaml    Output format (default: json)
  --verbose, -v         Show template resolution details

Templates Options:
  --sport SPORT         Filter by sport (run, bike, swim)
  show <template-id>    Show details of a specific template

Render Options:
  --output, -o FILE     Output HTML file (default: <input>.html)

Query Options:
  --json                Output as JSON (default: plain text)

Modify Options:
  --backup, -b FILE     Backup JSON file (exported from Settings)
  --plan, -p FILE       Training plan JSON file to modify
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

  # Validate a training plan JSON
  npx endurance-coach validate plan.json

  # Render a training plan to HTML (includes validation)
  npx endurance-coach render plan.json --output my-plan.html

  # Query the database
  npx endurance-coach query "SELECT * FROM weekly_volume LIMIT 5"
  
  # Apply backup changes to a training plan
  npx endurance-coach modify --backup backup.json --plan plan.json

  # Save modified plan to a new file
  npx endurance-coach modify -b backup.json -p plan.json -o modified_plan.json
`);
}

// ============================================================================
// Auth Command (for headless/Claude environments)
// ============================================================================

const REDIRECT_PORT = 8765;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";

async function runAuth(args: AuthArgs): Promise<void> {
  // If code is provided, exchange it for tokens
  if (args.code) {
    if (!configExists()) {
      log.error("No configuration found. Run 'auth' with --client-id and --client-secret first.");
      process.exit(1);
    }

    // Extract code from full URL if user pasted the entire redirect URL
    let code = args.code;
    if (code.includes("localhost") || code.startsWith("http")) {
      try {
        const url = new URL(code);
        const extractedCode = url.searchParams.get("code");
        if (extractedCode) {
          code = extractedCode;
        } else {
          log.error("Could not find 'code' parameter in URL");
          process.exit(1);
        }
      } catch {
        // Not a valid URL, use as-is
      }
    }

    const config = loadConfig();
    log.start("Exchanging authorization code for tokens...");

    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: config.strava.client_id,
        client_secret: config.strava.client_secret,
        code: code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      log.error(`Token exchange failed: ${error}`);
      process.exit(1);
    }

    const data: StravaTokenResponse = await tokenResponse.json();

    const tokens: Tokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: data.athlete.id,
    };

    saveTokens(tokens);
    log.success(`Authenticated as ${data.athlete.firstname} ${data.athlete.lastname}`);
    log.ready("Now run: npx endurance-coach sync");
    return;
  }

  // Otherwise, generate and print the authorization URL
  if (!args.clientId || !args.clientSecret) {
    log.error("Required: --client-id and --client-secret");
    log.info("Get these from: https://www.strava.com/settings/api");
    process.exit(1);
  }

  // Save config for later use
  const config = createConfig(args.clientId, args.clientSecret, 730);
  saveConfig(config);

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", args.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", "activity:read_all");
  authUrl.searchParams.set("approval_prompt", "auto");

  console.log("\n📋 AUTHORIZATION URL:\n");
  console.log(authUrl.toString());
  console.log("\n📝 INSTRUCTIONS:");
  console.log("1. Open the URL above in a browser");
  console.log("2. Click 'Authorize' on Strava");
  console.log("3. You'll be redirected to a page that won't load (that's OK!)");
  console.log("4. Copy the ENTIRE URL from your browser's address bar");
  console.log("5. Paste it back to Claude\n");
}

// ============================================================================
// Sync Command
// ============================================================================

function escapeString(str: string | null | undefined): string {
  if (str == null) return "NULL";
  return `'${str.replace(/'/g, "''")}'`;
}

function insertActivity(activity: StravaActivity): void {
  const sql = `
    INSERT OR REPLACE INTO activities (
      id, name, sport_type, start_date, elapsed_time, moving_time,
      distance, total_elevation_gain, average_speed, max_speed,
      average_heartrate, max_heartrate, average_watts, max_watts,
      weighted_average_watts, kilojoules, suffer_score, average_cadence,
      calories, description, workout_type, gear_id, raw_json, synced_at
    ) VALUES (
      ${activity.id},
      ${escapeString(activity.name)},
      ${escapeString(activity.sport_type)},
      ${escapeString(activity.start_date)},
      ${activity.elapsed_time ?? "NULL"},
      ${activity.moving_time ?? "NULL"},
      ${activity.distance ?? "NULL"},
      ${activity.total_elevation_gain ?? "NULL"},
      ${activity.average_speed ?? "NULL"},
      ${activity.max_speed ?? "NULL"},
      ${activity.average_heartrate ?? "NULL"},
      ${activity.max_heartrate ?? "NULL"},
      ${activity.average_watts ?? "NULL"},
      ${activity.max_watts ?? "NULL"},
      ${activity.weighted_average_watts ?? "NULL"},
      ${activity.kilojoules ?? "NULL"},
      ${activity.suffer_score ?? "NULL"},
      ${activity.average_cadence ?? "NULL"},
      ${activity.calories ?? "NULL"},
      ${escapeString(activity.description)},
      ${activity.workout_type ?? "NULL"},
      ${escapeString(activity.gear_id)},
      ${escapeString(JSON.stringify(activity))},
      datetime('now')
    );
  `;

  execute(sql);
}

function insertAthlete(athlete: {
  id: number;
  firstname: string;
  lastname: string;
  weight?: number;
  ftp?: number;
}): void {
  const sql = `
    INSERT OR REPLACE INTO athlete (id, firstname, lastname, weight, ftp, raw_json, updated_at)
    VALUES (
      ${athlete.id},
      ${escapeString(athlete.firstname)},
      ${escapeString(athlete.lastname)},
      ${athlete.weight ?? "NULL"},
      ${athlete.ftp ?? "NULL"},
      ${escapeString(JSON.stringify(athlete))},
      datetime('now')
    );
  `;
  execute(sql);
}

async function runSync(args: SyncArgs): Promise<void> {
  log.box("Endurance Coach - Strava Sync");

  // Step 0: Initialize SQLite backend
  await initDatabase();

  const syncDays = args.days || 730;

  // Step 1: Handle token-based auth (no browser needed)
  if (args.accessToken && args.refreshToken) {
    log.info("Using provided access tokens...");

    // Save tokens - we'll get athlete_id after fetching profile
    // Set expiry to 1 hour from now (we have refresh token for renewal)
    const tempTokens = {
      access_token: args.accessToken,
      refresh_token: args.refreshToken,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      athlete_id: 0, // Will be updated after fetching athlete
    };
    saveTokens(tempTokens);

    // Create minimal config if needed
    if (!configExists()) {
      // Token-based auth doesn't need client credentials for initial sync
      // but we need them for token refresh - use placeholders
      const config = createConfig("token-auth", "token-auth", syncDays);
      saveConfig(config);
    }

    // Initialize database
    migrate();

    // Fetch athlete to get ID and validate tokens
    log.start("Validating tokens and fetching athlete profile...");
    const athlete = await getAthlete(tempTokens);

    // Update tokens with real athlete ID
    const tokens = { ...tempTokens, athlete_id: athlete.id };
    saveTokens(tokens);

    insertAthlete(athlete);
    log.success(`Authenticated as ${athlete.firstname} ${athlete.lastname}`);

    // Fetch activities
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - syncDays);
    const activities = await getAllActivities(tokens, afterDate);

    // Store activities
    log.start("Storing activities in database...");
    let count = 0;
    for (const activity of activities) {
      insertActivity(activity);
      count++;
      if (count % 50 === 0) {
        log.progress(`   Stored ${count}/${activities.length}...`);
      }
    }
    log.progressEnd();
    log.success(`Stored ${activities.length} activities`);

    execute(`
      INSERT INTO sync_log (started_at, completed_at, activities_synced, status)
      VALUES (datetime('now'), datetime('now'), ${activities.length}, 'success');
    `);

    log.info(`Database: ${getDbPath()}`);
    log.ready("Sync complete! You can now create training plans.");
    return;
  }

  // Step 2: OAuth-based auth (requires browser)
  if (!configExists()) {
    if (args.clientId && args.clientSecret) {
      log.info("Creating configuration from command line arguments...");
      const config = createConfig(args.clientId, args.clientSecret, syncDays);
      saveConfig(config);
      log.success("Configuration saved");
    } else {
      log.info("No configuration found. Let's set things up.");
      const config = await promptForConfig();
      saveConfig(config);
      log.success("Configuration saved");
    }
  }

  const config = loadConfig();
  const configSyncDays = args.days || config.sync_days || 730;

  // Initialize database
  migrate();

  // Authenticate with Strava (opens browser)
  const tokens = await getValidTokens();

  // Step 4: Fetch and store athlete profile
  log.start("Fetching athlete profile...");
  const athlete = await getAthlete(tokens);
  insertAthlete(athlete);
  log.success(`Athlete: ${athlete.firstname} ${athlete.lastname}`);

  // Step 5: Fetch activities
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - configSyncDays);

  const activities = await getAllActivities(tokens, afterDate);

  // Step 6: Store activities
  log.start("Storing activities in database...");
  let count = 0;
  for (const activity of activities) {
    insertActivity(activity);
    count++;
    if (count % 50 === 0) {
      log.progress(`   Stored ${count}/${activities.length}...`);
    }
  }
  log.progressEnd();
  log.success(`Stored ${activities.length} activities`);

  // Step 7: Log sync
  execute(`
    INSERT INTO sync_log (started_at, completed_at, activities_synced, status)
    VALUES (datetime('now'), datetime('now'), ${activities.length}, 'success');
  `);

  log.info(`Database: ${getDbPath()}`);
  log.ready(`Query with: sqlite3 -json "${getDbPath()}" "SELECT * FROM weekly_volume"`);
}

// ============================================================================
// Render Command
// ============================================================================

function getTemplatePath(): string {
  // Look for template in multiple locations
  const locations = [
    join(__dirname, "..", "templates", "plan-viewer.html"),
    join(__dirname, "..", "..", "templates", "plan-viewer.html"),
    join(process.cwd(), "templates", "plan-viewer.html"),
  ];

  for (const loc of locations) {
    try {
      readFileSync(loc);
      return loc;
    } catch {
      // Continue to next location
    }
  }

  throw new Error("Could not find plan-viewer.html template");
}

function runRender(args: RenderArgs): void {
  log.start("Rendering training plan...");

  const isCompact = args.inputFile.endsWith(".yaml") || args.inputFile.endsWith(".yml");

  // Read the plan file
  let planContent: string;
  try {
    planContent = readFileSync(args.inputFile, "utf-8");
  } catch {
    log.error(`Could not read input file: ${args.inputFile}`);
    process.exit(1);
  }

  let planJson: string;

  if (isCompact) {
    // Handle compact YAML plan
    log.info("Detected compact YAML plan, expanding...");

    // Parse YAML
    let compactData: unknown;
    try {
      compactData = parseYaml(planContent);
    } catch {
      log.error("Input file is not valid YAML");
      process.exit(1);
    }

    // Validate compact plan
    const compactValidation = validateCompactPlan(compactData);
    if (!compactValidation.success) {
      log.error("Compact plan validation failed:");
      console.error(formatCompactValidationErrors(compactValidation.errors));
      process.exit(1);
    }

    // Load templates and expand
    const templates = loadTemplates();
    const expanded = expandPlan(compactValidation.data, templates);

    log.success("Plan expanded successfully");
    planJson = JSON.stringify(expanded, null, 2);
  } else {
    // Handle full JSON plan
    let planData: unknown;
    try {
      planData = JSON.parse(planContent);
    } catch {
      log.error("Input file is not valid JSON");
      process.exit(1);
    }

    // Validate against schema
    const validation = validatePlan(planData);
    if (!validation.success) {
      log.error("Training plan validation failed:");
      console.error(formatValidationErrors(validation.errors));
      process.exit(1);
    }
    log.success("Plan schema validated successfully");
    planJson = planContent;
  }

  // Read the template
  const templatePath = getTemplatePath();
  let template = readFileSync(templatePath, "utf-8");

  // Replace the plan data in the template
  const planDataRegex = /<script type="application\/json" id="plan-data">[\s\S]*?<\/script>/;
  const newPlanData = `<script type="application/json" id="plan-data">\n${planJson}\n</script>`;
  template = template.replace(planDataRegex, newPlanData);

  // Output
  if (args.outputFile) {
    writeFileSync(args.outputFile, template);
    log.success(`Training plan rendered to: ${args.outputFile}`);
  } else {
    // Output to stdout
    console.log(template);
  }
}

// ============================================================================
// Query Command
// ============================================================================

async function runQuery(args: QueryArgs): Promise<void> {
  await initDatabase();

  if (args.json) {
    const results = queryJson(args.sql);
    console.log(JSON.stringify(results, null, 2));
  } else {
    const result = query(args.sql);
    console.log(result);
  }
}

// ============================================================================
// Validate Command
// ============================================================================

function runValidate(args: ValidateArgs): void {
  const isCompact = args.compact;
  log.start(`Validating ${isCompact ? "compact" : "full"} training plan...`);

  // Read the plan file
  let planContent: string;
  try {
    planContent = readFileSync(args.inputFile, "utf-8");
  } catch {
    log.error(`Could not read input file: ${args.inputFile}`);
    process.exit(1);
  }

  // Parse content (YAML or JSON)
  let planData: unknown;
  try {
    if (args.inputFile.endsWith(".yaml") || args.inputFile.endsWith(".yml")) {
      planData = parseYaml(planContent);
    } else {
      planData = JSON.parse(planContent);
    }
  } catch (err) {
    log.error(`Input file is not valid ${isCompact ? "YAML" : "JSON"}`);
    process.exit(1);
  }

  if (isCompact) {
    // Validate against compact schema
    const validation = validateCompactPlan(planData);
    if (!validation.success) {
      log.error("Compact plan validation failed:");
      console.error(formatCompactValidationErrors(validation.errors));
      process.exit(1);
    }

    // Also validate template references
    const templates = loadTemplates();
    const templateErrors = validateWorkoutRefs(validation.data, templates);
    if (templateErrors.length > 0) {
      log.warn("Template reference warnings:");
      templateErrors.forEach((e) => console.error(`  - ${e}`));
    }

    log.success("Compact plan is valid!");
  } else {
    // Validate against full schema
    const validation = validatePlan(planData);
    if (!validation.success) {
      log.error("Validation failed:");
      console.error(formatValidationErrors(validation.errors));
      process.exit(1);
    }

    log.success("Plan is valid!");
  }
}

// ============================================================================
// Expand Command
// ============================================================================

function runExpand(args: ExpandArgs): void {
  log.start("Expanding compact plan...");

  // Read the compact plan
  let planContent: string;
  try {
    planContent = readFileSync(args.inputFile, "utf-8");
  } catch {
    log.error(`Could not read input file: ${args.inputFile}`);
    process.exit(1);
  }

  // Parse YAML
  let planData: unknown;
  try {
    planData = parseYaml(planContent);
  } catch {
    log.error("Input file is not valid YAML");
    process.exit(1);
  }

  // Validate compact plan
  const validation = validateCompactPlan(planData);
  if (!validation.success) {
    log.error("Compact plan validation failed:");
    console.error(formatCompactValidationErrors(validation.errors));
    process.exit(1);
  }

  // Load templates
  const templates = loadTemplates();
  if (args.verbose) {
    log.info(`Loaded ${templates.ids().length} templates`);
  }

  // Validate template references
  const templateErrors = validateWorkoutRefs(validation.data, templates);
  if (templateErrors.length > 0) {
    log.warn("Template reference warnings:");
    templateErrors.forEach((e) => console.error(`  - ${e}`));
  }

  // Expand the plan
  const expanded = expandPlan(validation.data, templates);

  if (args.verbose) {
    log.info(`Expanded ${expanded.weeks.length} weeks`);
  }

  // Format output
  let output: string;
  if (args.format === "yaml") {
    output = stringifyYaml(expanded);
  } else {
    output = JSON.stringify(expanded, null, 2);
  }

  // Write output
  if (args.outputFile) {
    writeFileSync(args.outputFile, output);
    log.success(`Expanded plan written to: ${args.outputFile}`);
  } else {
    console.log(output);
  }
}

// ============================================================================
// Templates Command
// ============================================================================

function runTemplates(args: TemplatesArgs): void {
  const templates = loadTemplates();

  if (args.show) {
    // Show details of a specific template
    const template = templates.get(args.show);
    if (!template) {
      log.error(`Template not found: ${args.show}`);
      console.log("\nAvailable templates:");
      templates.ids().forEach((id) => console.log(`  - ${id}`));
      process.exit(1);
    }

    console.log(`\n${template.name} (${template.id})`);
    console.log(`${"=".repeat(template.name.length + template.id.length + 3)}`);
    console.log(`\nSport: ${template.sport}`);
    console.log(`Category: ${template.category}`);
    console.log(`Type: ${template.type}`);

    if (template.targetZone) {
      console.log(`Target Zone: ${template.targetZone}`);
    }
    if (template.rpe) {
      console.log(`RPE: ${template.rpe}`);
    }
    if (template.estimatedDuration) {
      console.log(`Estimated Duration: ${template.estimatedDuration} min`);
    }

    if (template.params && Object.keys(template.params).length > 0) {
      console.log("\nParameters:");
      for (const [name, param] of Object.entries(template.params)) {
        const required = param.required ? " (required)" : "";
        const defaultVal = param.default !== undefined ? ` [default: ${param.default}]` : "";
        console.log(`  - ${name}: ${param.type}${required}${defaultVal}`);
        if (param.description) {
          console.log(`    ${param.description}`);
        }
      }
    }

    console.log("\nUsage examples:");
    const paramNames = template.params ? Object.keys(template.params) : [];
    if (paramNames.length === 0) {
      console.log(`  ${template.id}`);
    } else {
      const defaults = paramNames
        .filter((p) => template.params![p].default !== undefined)
        .map((p) => template.params![p].default);
      if (defaults.length > 0) {
        console.log(`  ${template.id}(${defaults.join(", ")})`);
      }
      console.log(`  ${template.id}(${paramNames.join(", ")})`);
    }

    console.log("\nWorkout description:");
    console.log(template.humanReadable);
  } else {
    // List all templates
    const sport = args.sport as "run" | "bike" | "swim" | undefined;
    const list = templates.list(sport);

    if (list.length === 0) {
      console.log("No templates found.");
      return;
    }

    console.log(`\nAvailable Templates${sport ? ` (${sport})` : ""}:`);
    console.log("=".repeat(40));

    // Group by category
    const byCategory = new Map<string, typeof list>();
    for (const t of list) {
      const cat = t.category;
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(t);
    }

    for (const [category, categoryTemplates] of byCategory) {
      console.log(`\n${category.toUpperCase()}:`);
      for (const t of categoryTemplates) {
        const params = t.params ? Object.keys(t.params) : [];
        const paramStr = params.length > 0 ? `(${params.join(", ")})` : "";
        console.log(`  ${t.id}${paramStr} - ${t.name}`);
      }
    }

    console.log(`\nTotal: ${list.length} templates`);
    console.log("\nUse 'endurance-coach templates show <id>' to see template details.");
  }
}

// ============================================================================
// Schema Command
// ============================================================================

function runSchema(): void {
  console.log(`
# YAML v2.0 Training Plan Format

## Complete Example

\`\`\`yaml
version: "2.0"

athlete:
  name: "Athlete Name"
  event: "Half Marathon"
  eventDate: "2026-05-15"
  paces:
    easy: "5:45/km"
    long: "6:00/km"
    tempo: "5:00/km"
    threshold: "4:30/km"
    r400: "1:35"           # For intervals.400()
    r800: "3:20"           # For intervals.800()
  zones:
    hr:
      lthr: 170            # Auto-calculates Z1-Z5
  unit: km                 # km or mi
  firstDayOfWeek: monday

assessment:
  foundation:
    foundationLevel: intermediate  # beginner|intermediate|advanced|elite
    yearsInSport: 2
  currentForm:
    weeklyVolume: { total: 4, run: 4 }
    consistency: 4

phases:
  - name: "Base"
    weeks: "1-4"
    focus: "Aerobic foundation"

weeks:
  - week: 1
    phase: Base
    focus: "Build consistency"
    workouts:
      Mon: tempo(20)
      Tue: rest
      Wed: easy(35)
      Thu: strides(40, 6)
      Fri: rest
      Sat: long(60)
      Sun: rest
\`\`\`

## Workout Templates

**Run** (default): easy(mins), recovery(mins), long(mins), tempo(mins),
threshold(mins), progression(mins), fartlek(mins), strides(mins, count),
intervals.400(reps), intervals.800(reps), intervals.1k(reps), hills(reps), rest

**Swim**: swim.easy(mins), swim.technique(mins), swim.aerobic(reps),
swim.threshold(reps), swim.vo2max(reps), swim.openwater(mins), swim.rest

**Bike**: bike.easy(mins), bike.endurance(mins), bike.tempo(mins),
bike.sweetspot(mins), bike.threshold(reps), bike.vo2max(reps), bike.rest

**Brick**: brick.sprint(bike_mins, run_mins), brick.olympic(bike_mins, run_mins)

**Strength**: strength.foundation(mins), strength.full(mins), strength.core(mins)

## Zone Auto-Calculation

Specify only threshold values - zones are calculated automatically:
- \`zones.hr.lthr: 170\` → HR zones derived from LTHR
- \`zones.power.ftp: 250\` → Power zones derived from FTP
- \`zones.swim.css: "1:45"\` → Swim zones derived from CSS

## Commands

\`\`\`bash
npx endurance-coach templates              # List all templates
npx endurance-coach templates show tempo   # Show template details
npx endurance-coach validate plan.yaml     # Validate plan
npx endurance-coach render plan.yaml -o plan.html  # Render to HTML
\`\`\`
`);
}

// Modify Command
// ============================================================================

interface PlanChanges {
  moved: Record<string, string>;
  edited: Record<string, Partial<Workout>>;
  deleted: string[];
  added: Record<string, { date: string; workout: Workout }>;
}

interface BackupData {
  [key: string]: string;
}

export interface ModifyOptions {
  backup: string;
  plan: string;
  output?: string;
}

/**
 * Extract plan ID, changes, and completed status from backup localStorage data
 */
function extractDataFromBackup(backupData: BackupData): {
  planId: string | null;
  changes: PlanChanges | null;
  completed: Record<string, boolean> | null;
} {
  // Find the changes key (format: "plan-{id}-changes")
  const changesKey = Object.keys(backupData).find((key) => key.endsWith("-changes"));

  if (!changesKey) {
    return { planId: null, changes: null, completed: null };
  }

  // Extract plan ID from key
  const planId = changesKey.replace(/^plan-/, "").replace(/-changes$/, "");

  // Parse the changes JSON
  let changes: PlanChanges | null = null;
  try {
    const changesJson = backupData[changesKey];
    changes = JSON.parse(changesJson) as PlanChanges;
  } catch (error) {
    console.error("Failed to parse changes:", error);
  }

  // Find and parse completed workouts
  const completedKey = `plan-${planId}-completed`;
  let completed: Record<string, boolean> | null = null;

  if (backupData[completedKey]) {
    try {
      completed = JSON.parse(backupData[completedKey]) as Record<string, boolean>;
    } catch (error) {
      console.error("Failed to parse completed data:", error);
    }
  }

  return { planId, changes, completed };
}

/**
 * Apply completed status to workouts in the plan
 */
function applyCompletedStatus(plan: TrainingPlan, completed: Record<string, boolean>): void {
  const completedCount = Object.keys(completed).filter((id) => completed[id]).length;
  console.log(`Applying completed status to ${completedCount} workouts...`);

  let appliedCount = 0;

  plan.weeks?.forEach((week) => {
    week.days?.forEach((day) => {
      day.workouts?.forEach((workout) => {
        if (completed[workout.id] !== undefined) {
          workout.completed = completed[workout.id];
          if (completed[workout.id]) {
            appliedCount++;
            console.log(`  - Marked ${workout.id} as completed`);
          }
        }
      });
    });
  });

  if (appliedCount > 0) {
    console.log(`Applied completed status to ${appliedCount} workouts`);
  }
}

/**
 * Apply changes to the training plan
 */
function applyChangesToPlan(plan: TrainingPlan, changes: PlanChanges): TrainingPlan {
  const modifiedPlan = JSON.parse(JSON.stringify(plan)) as TrainingPlan;

  // Track all workouts by ID for easy lookup
  const workoutMap = new Map<string, { weekIdx: number; dayIdx: number; workoutIdx: number }>();

  modifiedPlan.weeks?.forEach((week, weekIdx) => {
    week.days?.forEach((day, dayIdx) => {
      day.workouts?.forEach((workout, workoutIdx) => {
        workoutMap.set(workout.id, { weekIdx, dayIdx, workoutIdx });
      });
    });
  });

  // 1. Apply deleted workouts
  console.log(`Applying ${changes.deleted.length} deletions...`);
  changes.deleted.forEach((workoutId) => {
    const location = workoutMap.get(workoutId);
    if (location) {
      const { weekIdx, dayIdx, workoutIdx } = location;
      modifiedPlan.weeks![weekIdx].days![dayIdx].workouts!.splice(workoutIdx, 1);
      console.log(`  - Deleted workout: ${workoutId}`);
    }
  });

  // Rebuild workout map after deletions
  workoutMap.clear();
  modifiedPlan.weeks?.forEach((week, weekIdx) => {
    week.days?.forEach((day, dayIdx) => {
      day.workouts?.forEach((workout, workoutIdx) => {
        workoutMap.set(workout.id, { weekIdx, dayIdx, workoutIdx });
      });
    });
  });

  // 2. Apply edits to existing workouts
  const editCount = Object.keys(changes.edited).length;
  console.log(`Applying ${editCount} edits...`);
  Object.entries(changes.edited).forEach(([workoutId, edits]) => {
    const location = workoutMap.get(workoutId);
    if (location) {
      const { weekIdx, dayIdx, workoutIdx } = location;
      const workout = modifiedPlan.weeks![weekIdx].days![dayIdx].workouts![workoutIdx];
      Object.assign(workout, edits);
      console.log(`  - Edited workout: ${workoutId}`);
    }
  });

  // 3. Apply moved workouts
  const moveCount = Object.keys(changes.moved).length;
  console.log(`Applying ${moveCount} moves...`);
  Object.entries(changes.moved).forEach(([workoutId, newDate]) => {
    const location = workoutMap.get(workoutId);
    if (!location) return;

    const { weekIdx, dayIdx, workoutIdx } = location;

    // Remove workout from original location
    const [workout] = modifiedPlan.weeks![weekIdx].days![dayIdx].workouts!.splice(workoutIdx, 1);

    // Find the target day
    let targetDay: TrainingDay | null = null;
    let targetWeekIdx = -1;
    let targetDayIdx = -1;

    for (let wIdx = 0; wIdx < modifiedPlan.weeks!.length; wIdx++) {
      const week = modifiedPlan.weeks![wIdx];
      for (let dIdx = 0; dIdx < week.days!.length; dIdx++) {
        const day = week.days![dIdx];
        if (day.date === newDate) {
          targetDay = day;
          targetWeekIdx = wIdx;
          targetDayIdx = dIdx;
          break;
        }
      }
      if (targetDay) break;
    }

    if (targetDay) {
      // Add workout to new location
      if (!targetDay.workouts) {
        targetDay.workouts = [];
      }
      targetDay.workouts.push(workout);
      console.log(`  - Moved workout ${workoutId} to ${newDate}`);
    } else {
      console.warn(`  ! Could not find target date ${newDate} for workout ${workoutId}`);
    }
  });

  // 4. Add new workouts
  const addCount = Object.keys(changes.added).length;
  console.log(`Adding ${addCount} new workouts...`);
  Object.entries(changes.added).forEach(([workoutId, { date, workout }]) => {
    // Find the target day
    let targetDay: TrainingDay | null = null;

    for (const week of modifiedPlan.weeks || []) {
      for (const day of week.days || []) {
        if (day.date === date) {
          targetDay = day;
          break;
        }
      }
      if (targetDay) break;
    }

    if (targetDay) {
      if (!targetDay.workouts) {
        targetDay.workouts = [];
      }
      targetDay.workouts.push(workout);
      console.log(`  - Added workout ${workoutId} on ${date}`);
    } else {
      console.warn(`  ! Could not find date ${date} for new workout ${workoutId}`);
    }
  });

  // Update the plan's updatedAt timestamp
  modifiedPlan.meta.updatedAt = new Date().toISOString();

  return modifiedPlan;
}

export function modifyCommand(options: ModifyOptions): void {
  console.log("📝 Modifying training plan...\n");

  try {
    // 1. Read backup file
    console.log(`Reading backup: ${options.backup}`);
    const backupContent = readFileSync(options.backup, "utf-8");
    const backupData: BackupData = JSON.parse(backupContent);

    // 2. Extract changes and completed status from backup
    const { planId, changes, completed } = extractDataFromBackup(backupData);

    if (!changes) {
      console.error("❌ No changes found in backup file");
      process.exit(1);
    }

    console.log(`Found data for plan: ${planId}`);
    if (completed) {
      const completedCount = Object.keys(completed).filter((id) => completed[id]).length;
      console.log(`Found ${completedCount} completed workouts in backup`);
    }
    console.log();

    // 3. Read plan file
    console.log(`Reading plan: ${options.plan}`);
    const planContent = readFileSync(options.plan, "utf-8");
    const plan: TrainingPlan = JSON.parse(planContent);

    // Verify plan IDs match
    if (plan.meta.id !== planId) {
      console.warn(
        `⚠️  Warning: Plan ID mismatch!\n   Backup: ${planId}\n   Plan:   ${plan.meta.id}`
      );
      console.log("   Continuing anyway...\n");
    }

    // 4. Apply changes
    console.log("Applying changes:\n");
    const modifiedPlan = applyChangesToPlan(plan, changes);

    // 5. Apply completed status if available
    if (completed) {
      console.log();
      applyCompletedStatus(modifiedPlan, completed);
    }

    // 6. Write output
    const outputPath = options.output || options.plan;
    console.log(`\nWriting modified plan to: ${outputPath}`);
    writeFileSync(outputPath, JSON.stringify(modifiedPlan, null, 2));

    console.log("\n✅ Plan modified successfully!");
    console.log(`\nSummary:`);
    console.log(`  - Deleted: ${changes.deleted.length} workouts`);
    console.log(`  - Edited: ${Object.keys(changes.edited).length} workouts`);
    console.log(`  - Moved: ${Object.keys(changes.moved).length} workouts`);
    console.log(`  - Added: ${Object.keys(changes.added).length} workouts`);
    if (completed) {
      const completedCount = Object.keys(completed).filter((id) => completed[id]).length;
      console.log(`  - Completed: ${completedCount} workouts marked as done`);
    }
  } catch (error) {
    console.error("❌ Error modifying plan:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const args = parseArgs();

  switch (args.command) {
    case "help":
      printHelp();
      break;
    case "auth":
      await runAuth(args);
      break;
    case "sync":
      await runSync(args);
      break;
    case "schema":
      runSchema();
      break;
    case "validate":
      runValidate(args);
      break;
    case "expand":
      runExpand(args);
      break;
    case "templates":
      runTemplates(args);
      break;
    case "render":
      runRender(args);
      break;
    case "query":
      await runQuery(args);
      break;
    case "modify":
      modifyCommand(args);
      break;
  }
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
