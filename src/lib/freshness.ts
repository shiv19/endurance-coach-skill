import { tokensExist } from "./config.js";
import { log } from "./logging.js";
import { initDatabase, queryJson } from "../db/client.js";
import { getValidTokens } from "../strava/oauth.js";
import { syncActivities } from "../cli/commands/strava.js";

/**
 * Result type for ensureFreshData function
 */
export interface FreshnessResult {
  synced: boolean;
  reason?: "not_configured" | "fresh" | "error";
  syncedCount?: number;
  warning?: string;
  cached?: boolean;
}

/**
 * Options for ensureFreshData
 */
export interface FreshnessOptions {
  verbose?: boolean;
  noSync?: boolean;
}

/**
 * Query the database for the most recent activity date.
 */
function getMostRecentActivityDate(): Date | null {
  try {
    const rows = queryJson<{ start_date: string }>(
      "SELECT start_date FROM activities ORDER BY start_date DESC LIMIT 1"
    );
    if (rows.length === 0) {
      return null;
    }
    return new Date(rows[0].start_date);
  } catch {
    return null;
  }
}

/**
 * Query the database for the most recent sync timestamp.
 */
function getMostRecentSyncTime(): Date | null {
  try {
    const rows = queryJson<{ completed_at: string }>(
      "SELECT completed_at FROM sync_log ORDER BY completed_at DESC LIMIT 1"
    );
    if (rows.length === 0) {
      return null;
    }
    // SQLite stores timestamps in UTC without 'Z' suffix
    // Append 'Z' to parse as UTC instead of local time
    return new Date(rows[0].completed_at + "Z");
  } catch {
    return null;
  }
}

/**
 * Ensure that activity data is fresh before any command reads it.
 *
 * This function:
 * 1. Checks if Strava is configured (tokens exist in database or config)
 * 2. If not configured → returns `{ synced: false, reason: 'not_configured' }`
 * 3. Queries date of most recent activity in local DB
 * 4. If latest date >= today → returns `{ synced: false, reason: 'fresh' }`
 * 5. Calculates sync window: `min(today - latestDate, 30)` days
 * 6. Calls existing sync logic internally
 * 7. On success → returns `{ synced: true, syncedCount: N }`
 * 8. On failure → returns `{ synced: false, reason: 'error', warning: string, cached: true }`
 *
 * @param options - Options for controlling sync behavior
 * @param options.verbose - If true, show detailed sync activity logs
 * @param options.noSync - If true, skip auto-sync even if data is stale
 * @returns A FreshnessResult indicating the sync status
 */
export async function ensureFreshData(options: FreshnessOptions = {}): Promise<FreshnessResult> {
  const { verbose = false, noSync = false } = options;

  if (!tokensExist()) {
    if (verbose) {
      log.warn("Strava tokens not configured. Run 'endurance-coach auth' to set up.");
    }
    return { synced: false, reason: "not_configured" };
  }

  await initDatabase();

  const latestDate = getMostRecentActivityDate();

  if (!latestDate) {
    if (verbose) {
      log.info("No activities found in database. Syncing...");
    }
    if (noSync) {
      return { synced: false, warning: "No cached data available", cached: false };
    }
    const tokens = await getValidTokens();
    const result = await syncActivities(tokens, 730, verbose);
    if (result.error) {
      return {
        synced: false,
        reason: "error",
        warning: result.error,
        cached: latestDate !== null,
      };
    }
    return { synced: true, syncedCount: result.syncedCount };
  }

  // Check when we last synced (supports multiple workouts per day)
  const lastSyncTime = getMostRecentSyncTime();
  const now = new Date();

  // Consider data fresh if we synced within the last 2 hours
  const FRESHNESS_THRESHOLD_HOURS = 2;
  if (lastSyncTime) {
    const hoursSinceSync = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceSync < FRESHNESS_THRESHOLD_HOURS) {
      if (verbose) {
        log.info(`Data is fresh (synced ${Math.round(hoursSinceSync * 60)} minutes ago).`);
      }
      return { synced: false, reason: "fresh" };
    }
  }

  // Calculate how many days back to sync based on latest activity date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const latestDateNormalized = new Date(latestDate);
  latestDateNormalized.setHours(0, 0, 0, 0);

  const daysDiff = Math.floor(
    (today.getTime() - latestDateNormalized.getTime()) / (1000 * 60 * 60 * 24)
  );
  const syncDays = Math.max(Math.min(daysDiff + 1, 30), 1); // At least 1 day to catch today's activities

  if (verbose) {
    if (lastSyncTime) {
      const hoursSinceSync = (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60);
      log.info(
        `Last sync was ${Math.round(hoursSinceSync * 60)} minutes ago. Syncing last ${syncDays} days...`
      );
    } else {
      log.info(`Latest activity is from ${daysDiff} days ago. Syncing last ${syncDays} days...`);
    }
  }

  if (noSync) {
    return {
      synced: false,
      warning: `Using cached data from ${daysDiff} days ago. Use --verbose to see sync details.`,
      cached: true,
    };
  }

  const tokens = await getValidTokens();
  const result = await syncActivities(tokens, syncDays, verbose);

  if (result.error) {
    return {
      synced: false,
      reason: "error",
      warning: result.error,
      cached: true,
    };
  }

  return { synced: true, syncedCount: result.syncedCount };
}
