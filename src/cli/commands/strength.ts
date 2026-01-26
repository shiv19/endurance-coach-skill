import { initDatabase, queryJson } from "../../db/client.js";
import type { StrengthArgs } from "../args.js";
import { formatTable } from "../utils/format-table.js";

const DEFAULT_MONTHS = 6;
const DEFAULT_LONG_MONTHS = 12;
const DEFAULT_EASY_HR_MAX = 145;
const DEFAULT_LONG_MINUTES = 60;
const DEFAULT_YEARS = 2;

/**
 * Converts a number to a positive integer, returning the fallback when the input is missing, NaN, or not greater than zero.
 *
 * @param value - The input number to convert.
 * @param fallback - The value to return when `value` is missing, NaN, or <= 0.
 * @returns The floored integer part of `value` when it is greater than zero, otherwise `fallback`.
 */
function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

/**
 * Print a titled section to the console containing the given content.
 *
 * @param title - The section title to display as a header.
 * @param output - The section content; whitespace is trimmed. If the trimmed content is empty, "(no results)" is printed.
 */
function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

/**
 * Generates strength-related analytics from stored activities and prints them as tables or JSON.
 *
 * Executes aggregated queries against the initialized activities database and outputs:
 * - efficiency metrics per sport over a recent window,
 * - summaries of long easy (aerobic) sessions,
 * - most recent session date and counts per sport for the last year,
 * - historical distance/time peaks over a configurable number of years.
 *
 * @param args - Options that control query windows and output format. Recognized fields include
 *   `months`, `longMonths`, `easyHrMax`, `longMinutes`, `years` (numeric thresholds with defaults)
 *   and `json` (when true, emits a combined JSON object instead of formatted tables).
 */
export async function runStrength(args: StrengthArgs): Promise<void> {
  await initDatabase();

  const months = toPositiveInt(args.months, DEFAULT_MONTHS);
  const longMonths = toPositiveInt(args.longMonths, DEFAULT_LONG_MONTHS);
  const easyHrMax = toPositiveInt(args.easyHrMax, DEFAULT_EASY_HR_MAX);
  const longMinutes = toPositiveInt(args.longMinutes, DEFAULT_LONG_MINUTES);
  const years = toPositiveInt(args.years, DEFAULT_YEARS);

  const efficiencySql = `
    SELECT sport_type,
      ROUND(AVG(distance) / 1000.0, 1) AS avg_km,
      ROUND(AVG(moving_time) / 60.0, 0) AS avg_minutes,
      ROUND(AVG(suffer_score), 0) AS avg_suffer,
      ROUND(AVG(suffer_score * 60.0 / moving_time), 2) AS suffer_per_minute,
      ROUND(AVG(average_heartrate), 0) AS avg_hr
    FROM activities
    WHERE start_date >= date('now', '-${months} months')
      AND moving_time > 1800
    GROUP BY sport_type
    ORDER BY suffer_per_minute ASC;
  `;

  const aerobicStrengthSql = `
    SELECT sport_type,
      COUNT(*) AS easy_long_sessions,
      ROUND(AVG(distance) / 1000.0, 1) AS avg_km,
      ROUND(AVG(moving_time) / 60.0, 0) AS avg_minutes,
      ROUND(AVG(average_heartrate), 0) AS avg_hr
    FROM activities
    WHERE moving_time > ${longMinutes * 60}
      AND average_heartrate < ${easyHrMax}
      AND start_date >= date('now', '-${longMonths} months')
    GROUP BY sport_type;
  `;

  const lastActivitySql = `
    SELECT sport_type,
      MAX(start_date) AS last_session,
      ROUND(julianday('now') - julianday(MAX(start_date)), 0) AS days_ago,
      COUNT(*) AS total_sessions_last_year
    FROM activities
    WHERE start_date >= date('now', '-1 year')
    GROUP BY sport_type
    ORDER BY last_session DESC;
  `;

  const historicalPeaksSql = `
    SELECT sport_type,
      ROUND(MAX(distance) / 1000.0, 1) AS peak_km,
      ROUND(MAX(moving_time) / 3600.0, 1) AS peak_hours,
      MAX(start_date) AS when_achieved
    FROM activities
    WHERE start_date >= date('now', '-${years} years')
    GROUP BY sport_type;
  `;

  if (args.json) {
    const output = {
      efficiency: queryJson(efficiencySql),
      aerobicStrength: queryJson(aerobicStrengthSql),
      lastActivity: queryJson(lastActivitySql),
      historicalPeaks: queryJson(historicalPeaksSql),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const efficiencyRows = queryJson<Record<string, unknown>>(efficiencySql);
  const efficiencyTable = formatTable(
    efficiencyRows,
    ["Sport", "Avg km", "Avg minutes", "Avg suffer", "Suffer/min", "Avg HR"],
    ["sport_type", "avg_km", "avg_minutes", "avg_suffer", "suffer_per_minute", "avg_hr"]
  );
  printSection(`Efficiency (last ${months} months)`, efficiencyTable);

  const aerobicStrengthRows = queryJson<Record<string, unknown>>(aerobicStrengthSql);
  const aerobicStrengthTable = formatTable(
    aerobicStrengthRows,
    ["Sport", "Easy long sessions", "Avg km", "Avg minutes", "Avg HR"],
    ["sport_type", "easy_long_sessions", "avg_km", "avg_minutes", "avg_hr"]
  );
  printSection(
    `Aerobic strength (>${longMinutes} min, HR < ${easyHrMax}, last ${longMonths} months)`,
    aerobicStrengthTable
  );

  const lastActivityRows = queryJson<Record<string, unknown>>(lastActivitySql);
  const lastActivityTable = formatTable(
    lastActivityRows,
    ["Sport", "Last session", "Days ago", "Total sessions"],
    ["sport_type", "last_session", "days_ago", "total_sessions_last_year"]
  );
  printSection("Last activity by sport (last year)", lastActivityTable);

  const historicalPeaksRows = queryJson<Record<string, unknown>>(historicalPeaksSql);
  const historicalPeaksTable = formatTable(
    historicalPeaksRows,
    ["Sport", "Peak km", "Peak hours", "When achieved"],
    ["sport_type", "peak_km", "peak_hours", "when_achieved"]
  );
  printSection(`Historical peaks (last ${years} years)`, historicalPeaksTable);
}