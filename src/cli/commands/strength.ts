import { initDatabase, query, queryJson } from "../../db/client.js";
import type { StrengthArgs } from "../args.js";

const DEFAULT_MONTHS = 6;
const DEFAULT_LONG_MONTHS = 12;
const DEFAULT_EASY_HR_MAX = 145;
const DEFAULT_LONG_MINUTES = 60;
const DEFAULT_YEARS = 2;

function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

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

  printSection(`Efficiency (last ${months} months)`, query(efficiencySql));
  printSection(
    `Aerobic strength (>${longMinutes} min, HR < ${easyHrMax}, last ${longMonths} months)`,
    query(aerobicStrengthSql)
  );
  printSection("Last activity by sport (last year)", query(lastActivitySql));
  printSection(`Historical peaks (last ${years} years)`, query(historicalPeaksSql));
}
