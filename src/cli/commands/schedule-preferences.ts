import { initDatabase, queryJson } from "../../db/client.js";
import type { SchedulePreferencesArgs } from "../args.js";
import { formatTable } from "../utils/format-table.js";

const DEFAULT_RIDE_MINUTES = 90;
const DEFAULT_RUN_MINUTES = 60;

/**
 * Normalize a numeric input to a positive integer, using a fallback when the input is invalid.
 *
 * @param value - The number to convert; treated as invalid if `undefined`, `NaN`, or less than or equal to zero.
 * @param fallback - The value to return when `value` is invalid.
 * @returns The floor of `value` when `value` is greater than zero, otherwise `fallback`.
 */
function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

/**
 * Print a titled console section with the provided content, or a placeholder when the content is empty.
 *
 * The output is trimmed; if the trimmed content is empty, the literal "(no results)" is printed.
 *
 * @param title - The section title printed as a heading
 * @param output - The section body text to print; trimmed before printing and replaced with "(no results)" if empty
 */
function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

/**
 * Generate and print preferred activity days based on minimum duration thresholds.
 *
 * Initializes the database, aggregates activity counts by weekday for long rides, long runs, and swims,
 * and outputs the results either as a JSON object or as human-readable tables.
 *
 * @param args - Command arguments controlling thresholds and output:
 *   - `rideMinutes`: minimum ride duration in minutes to count as a "long" ride (defaults to 90 if missing or invalid).
 *   - `runMinutes`: minimum run duration in minutes to count as a "long" run (defaults to 60 if missing or invalid).
 *   - `json`: when true, emit a JSON object with `longRideDays`, `longRunDays`, and `swimDays`; otherwise print formatted tables.
 */
export async function runSchedulePreferences(args: SchedulePreferencesArgs): Promise<void> {
  await initDatabase();

  const rideMinutes = toPositiveInt(args.rideMinutes, DEFAULT_RIDE_MINUTES);
  const runMinutes = toPositiveInt(args.runMinutes, DEFAULT_RUN_MINUTES);

  const rideSql = `
    SELECT
      CASE strftime('%w', start_date)
        WHEN '0' THEN 'Sunday'
        WHEN '1' THEN 'Monday'
        WHEN '2' THEN 'Tuesday'
        WHEN '3' THEN 'Wednesday'
        WHEN '4' THEN 'Thursday'
        WHEN '5' THEN 'Friday'
        WHEN '6' THEN 'Saturday'
      END AS day_name,
      COUNT(*) AS long_rides
    FROM activities
    WHERE sport_type = 'Ride'
      AND moving_time > ${rideMinutes * 60}
    GROUP BY strftime('%w', start_date)
    ORDER BY long_rides DESC;
  `;

  const runSql = `
    SELECT
      CASE strftime('%w', start_date)
        WHEN '0' THEN 'Sunday'
        WHEN '1' THEN 'Monday'
        WHEN '2' THEN 'Tuesday'
        WHEN '3' THEN 'Wednesday'
        WHEN '4' THEN 'Thursday'
        WHEN '5' THEN 'Friday'
        WHEN '6' THEN 'Saturday'
      END AS day_name,
      COUNT(*) AS long_runs
    FROM activities
    WHERE sport_type IN ('Run', 'Trail Run')
      AND moving_time > ${runMinutes * 60}
    GROUP BY strftime('%w', start_date)
    ORDER BY long_runs DESC;
  `;

  const swimSql = `
    SELECT
      CASE strftime('%w', start_date)
        WHEN '0' THEN 'Sunday'
        WHEN '1' THEN 'Monday'
        WHEN '2' THEN 'Tuesday'
        WHEN '3' THEN 'Wednesday'
        WHEN '4' THEN 'Thursday'
        WHEN '5' THEN 'Friday'
        WHEN '6' THEN 'Saturday'
      END AS day_name,
      COUNT(*) AS swim_sessions
    FROM activities
    WHERE sport_type = 'Swim'
    GROUP BY strftime('%w', start_date)
    ORDER BY swim_sessions DESC;
  `;

  if (args.json) {
    const output = {
      longRideDays: queryJson(rideSql),
      longRunDays: queryJson(runSql),
      swimDays: queryJson(swimSql),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const rideRows = queryJson<Record<string, unknown>>(rideSql);
  const rideTable = formatTable(rideRows, ["Day", "Long rides"], ["day_name", "long_rides"]);
  printSection(`Preferred long ride days (>${rideMinutes} min)`, rideTable);

  const runRows = queryJson<Record<string, unknown>>(runSql);
  const runTable = formatTable(runRows, ["Day", "Long runs"], ["day_name", "long_runs"]);
  printSection(`Preferred long run days (>${runMinutes} min)`, runTable);

  const swimRows = queryJson<Record<string, unknown>>(swimSql);
  const swimTable = formatTable(swimRows, ["Day", "Swim sessions"], ["day_name", "swim_sessions"]);
  printSection("Preferred swim days", swimTable);
}