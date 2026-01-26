import { initDatabase, queryJson } from "../../db/client.js";
import type { FoundationArgs } from "../args.js";
import { formatTable } from "../utils/format-table.js";

const DEFAULT_TOP_WEEKS = 5;

/**
 * Normalize a numeric input to a positive integer using a fallback when the input is missing or invalid.
 *
 * @param value - The numeric input to normalize; may be `undefined`, `NaN`, or non-positive
 * @param fallback - The fallback positive integer to return when `value` is missing, `NaN`, or <= 0
 * @returns The floored integer of `value` when `value` is greater than 0, otherwise `fallback`
 */
function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

/**
 * Print a titled console section with trimmed content or a placeholder when empty.
 *
 * Trims whitespace from `output`, logs a header built from `title`, then logs the trimmed content or the string "(no results)" when the trimmed output is empty.
 *
 * @param title - Section title to display as a header
 * @param output - Raw section content; leading and trailing whitespace will be removed before printing
 */
function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

/**
 * Collects foundation analytics from the activities database and writes summarized metrics to the console.
 *
 * When `args.json` is truthy, emits a single JSON object containing `raceHistory`, `lifetimePeaks`,
 * `peakTrainingWeeks`, and `trainingHistoryDepth`. Otherwise prints human-readable tables for:
 * race history (workout_type = 1), lifetime peaks by sport, peak training weeks (top N), and training history depth.
 *
 * @param args - CLI options; `args.json` toggles JSON output, and `args.topWeeks` controls how many top training weeks are shown (defaults to 5 when not a positive integer)
 */
export async function runFoundation(args: FoundationArgs): Promise<void> {
  await initDatabase();

  const topWeeks = toPositiveInt(args.topWeeks, DEFAULT_TOP_WEEKS);

  const raceHistorySql = `
    SELECT
      strftime('%Y-%m', start_date) AS month,
      name,
      sport_type,
      ROUND(distance / 1000.0, 1) AS km,
      printf(
        '%02d:%02d:%02d',
        CAST(moving_time / 3600 AS INTEGER),
        CAST((moving_time % 3600) / 60 AS INTEGER),
        CAST(moving_time % 60 AS INTEGER)
      ) AS duration
    FROM activities
    WHERE workout_type = 1
    ORDER BY start_date DESC;
  `;

  const lifetimePeaksSql = `
    SELECT sport_type,
      ROUND(MAX(distance) / 1000.0, 1) AS max_km,
      ROUND(MAX(moving_time) / 3600.0, 1) AS max_hours
    FROM activities
    GROUP BY sport_type;
  `;

  const peakWeeksSql = `
    SELECT
      strftime('%Y-W%W', start_date) AS week,
      ROUND(SUM(moving_time) / 3600.0, 1) AS total_hours,
      COUNT(*) AS sessions
    FROM activities
    GROUP BY week
    ORDER BY total_hours DESC
    LIMIT ${topWeeks};
  `;

  const historyDepthSql = `
    SELECT sport_type,
      MIN(start_date) AS first_activity,
      MAX(start_date) AS last_activity,
      COUNT(*) AS total_activities,
      ROUND(SUM(distance) / 1000.0, 0) AS lifetime_km
    FROM activities
    GROUP BY sport_type;
  `;

  if (args.json) {
    const output = {
      raceHistory: queryJson(raceHistorySql),
      lifetimePeaks: queryJson(lifetimePeaksSql),
      peakTrainingWeeks: queryJson(peakWeeksSql),
      trainingHistoryDepth: queryJson(historyDepthSql),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const raceHistoryRows = queryJson<Record<string, unknown>>(raceHistorySql);
  const raceHistoryTable = formatTable(
    raceHistoryRows,
    ["Month", "Name", "Sport", "Km", "Duration"],
    ["month", "name", "sport_type", "km", "duration"]
  );
  printSection("Race history (workout_type = 1)", raceHistoryTable);

  const lifetimePeaksRows = queryJson<Record<string, unknown>>(lifetimePeaksSql);
  const lifetimePeaksTable = formatTable(
    lifetimePeaksRows,
    ["Sport", "Max km", "Max hours"],
    ["sport_type", "max_km", "max_hours"]
  );
  printSection("Lifetime peaks by sport", lifetimePeaksTable);

  const peakWeeksRows = queryJson<Record<string, unknown>>(peakWeeksSql);
  const peakWeeksTable = formatTable(
    peakWeeksRows,
    ["Week", "Total hours", "Sessions"],
    ["week", "total_hours", "sessions"]
  );
  printSection(`Peak training weeks (top ${topWeeks})`, peakWeeksTable);

  const historyDepthRows = queryJson<Record<string, unknown>>(historyDepthSql);
  const historyDepthTable = formatTable(
    historyDepthRows,
    ["Sport", "First activity", "Last activity", "Total activities", "Lifetime km"],
    ["sport_type", "first_activity", "last_activity", "total_activities", "lifetime_km"]
  );
  printSection("Training history depth", historyDepthTable);
}