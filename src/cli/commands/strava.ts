import {
  configExists,
  loadConfig,
  promptForConfig,
  saveConfig,
  saveTokens,
  getDbPath,
  createConfig,
  type Tokens,
} from "../../lib/config.js";
import { log } from "../../lib/logging.js";
import { migrate } from "../../db/migrate.js";
import { execute, getDb, initDatabase, transaction } from "../../db/client.js";
import { insertActivity, insertAthlete } from "../../db/storage.js";
import { getValidTokens } from "../../strava/oauth.js";
import { getActivityLaps, getAllActivities, getAthlete } from "../../strava/api.js";
import type { StravaTokenResponse } from "../../strava/types.js";
import type { ActivityLapsArgs, AuthArgs, SyncArgs } from "../args.js";

// ============================================================================
// MARK: Auth Command (for headless/Claude environments)
// ============================================================================

const REDIRECT_PORT = 8765;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const TOKEN_URL = "https://www.strava.com/oauth/token";

/**
 * Initiates Strava OAuth authorization flow or exchanges an authorization code for tokens.
 *
 * @param args - CLI authentication arguments. If `args.code` is provided, exchanges it (accepting either a raw code or a full redirect URL) for tokens and saves them; otherwise requires `args.clientId` and `args.clientSecret`, saves a configuration, and prints an authorization URL with step‑by‑step instructions.
 */
export async function runAuth(args: AuthArgs): Promise<void> {
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
// MARK: Sync Command
// ============================================================================

/**
 * Result type for sync operations
 */
export interface SyncResult {
  syncedCount: number;
  error?: string;
}

/**
 * Core sync logic - reusable by both CLI and auto-sync.
 *
 * @param tokens - Valid Strava tokens
 * @param days - Number of days to look back for activities
 * @param verbose - Whether to log detailed progress
 * @returns SyncResult with count and optional error
 */
export async function syncActivities(
  tokens: Tokens,
  days: number,
  verbose = false,
  preFetchedAthlete?: Awaited<ReturnType<typeof getAthlete>>
): Promise<SyncResult> {
  try {
    if (verbose) {
      log.start("Fetching athlete profile...");
    }
    const athlete = preFetchedAthlete ?? (await getAthlete(tokens));
    insertAthlete(athlete);
    if (verbose) {
      log.success(`Authenticated as ${athlete.firstname} ${athlete.lastname}`);
    }

    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - days);

    if (verbose) {
      log.info(`Fetching activities since ${afterDate.toISOString().split("T")[0]}...`);
    }
    const activities = await getAllActivities(tokens, afterDate);

    if (verbose) {
      log.start("Storing activities in database...");
    }
    transaction(() => {
      let count = 0;
      for (const activity of activities) {
        insertActivity(activity);
        count++;
        if (verbose && count % 50 === 0) {
          log.progress(`   Stored ${count}/${activities.length}...`);
        }
      }
    });
    if (verbose) {
      log.progressEnd();
      log.success(`Stored ${activities.length} activities`);
    }

    getDb()
      .prepare(
        `INSERT INTO sync_log (started_at, completed_at, activities_synced, status)
         VALUES (datetime('now'), datetime('now'), ?, 'success')`
      )
      .run(activities.length);

    return { syncedCount: activities.length };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (verbose) {
      log.error(`Sync failed: ${errorMessage}`);
    }
    return { syncedCount: 0, error: errorMessage };
  }
}

/**
 * Synchronizes Strava activities into the local SQLite database.
 *
 * Performs authentication either with provided access/refresh tokens or via an OAuth browser flow,
 * fetches athlete profile and activities for the configured lookback period, inserts or updates athlete and activity rows,
 * records a sync_log entry, and persists tokens and configuration as needed.
 *
 * @param args - Synchronization options. May include:
 *   - `accessToken` and `refreshToken`: use token-based auth (no browser).
 *   - `clientId` and `clientSecret`: create/save configuration when none exists.
 *   - `days`: number of days to sync (overrides stored config; defaults to 730).
 */
export async function runSync(args: SyncArgs): Promise<void> {
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

    // Create config if needed and credentials are provided
    const hadConfig = configExists();
    if (!hadConfig) {
      if (args.clientId && args.clientSecret) {
        log.info("Saving Strava client credentials for token refresh...");
        const config = createConfig(args.clientId, args.clientSecret, syncDays);
        saveConfig(config);
        log.success("Configuration saved");
      } else {
        log.warn(
          "No Strava client credentials found. Token refresh will fail without a client ID/secret."
        );
        log.info(
          "Provide --client-id and --client-secret or run `auth` to store credentials. Tokens are one-time only."
        );
      }
    }

    // Initialize database
    await migrate();

    // Fetch athlete to get ID and validate tokens
    log.start("Validating tokens and fetching athlete profile...");
    const athlete = await getAthlete(tempTokens);

    // Update tokens with real athlete ID
    const tokens = { ...tempTokens, athlete_id: athlete.id };
    saveTokens(tokens);

    const result = await syncActivities(tokens, syncDays, true, athlete);

    if (result.error) {
      log.error(`Sync failed: ${result.error}`);
      process.exit(1);
    }

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
  await migrate();

  // Authenticate with Strava (opens browser)
  const tokens = await getValidTokens();

  const result = await syncActivities(tokens, configSyncDays, true);

  if (result.error) {
    log.error(`Sync failed: ${result.error}`);
    process.exit(1);
  }

  log.info(`Database: ${getDbPath()}`);
  log.ready(`Query with: sqlite3 -json "${getDbPath()}" "SELECT * FROM weekly_volume"`);
}

// ============================================================================
// MARK: Activity Details Command
/**
 * Fetches lap segments for a Strava activity and writes the result as pretty-printed JSON to stdout.
 *
 * @param args - Command arguments containing the activity identifier
 * @param args.id - The Strava activity ID whose laps should be retrieved
 */

export async function runActivityLaps(args: ActivityLapsArgs): Promise<void> {
  const tokens = await getValidTokens();
  const laps = await getActivityLaps(tokens, args.id);
  console.log(JSON.stringify(laps, null, 2));
}
