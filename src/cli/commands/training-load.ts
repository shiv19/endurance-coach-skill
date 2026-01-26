import { initDatabase, queryJson } from "../../db/client.js";
import type { TrainingLoadArgs } from "../args.js";
import { formatTable } from "../utils/format-table.js";

const DEFAULT_WEEKS = 12;

/**
 * Normalize a numeric input to a positive integer, using a fallback for invalid values.
 *
 * @param value - The number to coerce; treated as invalid if `undefined`, `NaN`, or <= 0
 * @param fallback - The integer to return when `value` is invalid
 * @returns The integer part of `value` (floor) when `value` > 0, otherwise `fallback`
 */
function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

/**
 * Print a titled console section with the given output.
 *
 * Trims `output`, prints a header line `# <title>`, then prints the trimmed content or
 * "(no results)" when the trimmed output is empty.
 *
 * @param title - Section title printed after the `#` prefix
 * @param output - Section content; whitespace-only content is treated as empty
 */
function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

/**
 * Initialize the database and print weekly aggregated training load for the last N weeks.
 *
 * @param args - Command arguments.
 *   - `weeks`: Number of weeks to include in the lookback window; values <= 0 or invalid default to 12.
 *   - `json`: If true, output is printed as a JSON object `{ trainingLoad: ... }`; otherwise a formatted table is printed.
 */
export async function runTrainingLoad(args: TrainingLoadArgs): Promise<void> {
  await initDatabase();

  const weeks = toPositiveInt(args.weeks, DEFAULT_WEEKS);
  const days = weeks * 7;

  const sql = `
    SELECT week, weekly_load, total_hours
    FROM (
      SELECT
        strftime('%Y-W%W', start_date) AS week,
        strftime('%Y', start_date) AS year_num,
        strftime('%W', start_date) AS week_num,
        SUM(suffer_score) AS weekly_load,
        ROUND(SUM(moving_time) / 3600.0, 1) AS total_hours
      FROM activities
      WHERE start_date >= date('now', '-${days} days')
      GROUP BY year_num, week_num, week
    )
    ORDER BY year_num, week_num;
  `;

  if (args.json) {
    console.log(JSON.stringify({ trainingLoad: queryJson(sql) }, null, 2));
    return;
  }

  const rows = queryJson<Record<string, unknown>>(sql);
  const table = formatTable(
    rows,
    ["Week", "Weekly load", "Total hours"],
    ["week", "weekly_load", "total_hours"]
  );
  printSection(`Weekly training load (last ${weeks} weeks)`, table);
}