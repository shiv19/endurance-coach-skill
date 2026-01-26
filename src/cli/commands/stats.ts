import { initDatabase, queryJson } from "../../db/client.js";
import type { StatsArgs } from "../args.js";
import { formatTable } from "../utils/format-table.js";

const DEFAULT_WEEKS = 8;
const DEFAULT_LONGEST_WEEKS = 12;

function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

export async function runStats(args: StatsArgs): Promise<void> {
  await initDatabase();

  const weeks = toPositiveInt(args.weeks, DEFAULT_WEEKS);
  const longestWeeks = toPositiveInt(args.longestWeeks, DEFAULT_LONGEST_WEEKS);
  const days = weeks * 7;
  const longestDays = longestWeeks * 7;

  const weeklyVolumeSql = `
    SELECT week, sport_type, sessions, hours, km
    FROM (
      SELECT
        strftime('%Y-W%W', start_date) AS week,
        strftime('%Y', start_date) AS year_num,
        strftime('%W', start_date) AS week_num,
        sport_type,
        COUNT(*) AS sessions,
        ROUND(SUM(moving_time) / 3600.0, 1) AS hours,
        ROUND(SUM(distance) / 1000.0, 1) AS km
      FROM activities
      WHERE start_date >= date('now', '-${days} days')
      GROUP BY year_num, week_num, week, sport_type
    )
    ORDER BY year_num, week_num, sport_type;
  `;

  const longestSessionsSql = `
    SELECT sport_type,
      ROUND(MAX(moving_time) / 3600.0, 1) AS longest_hours,
      ROUND(MAX(distance) / 1000.0, 1) AS longest_km
    FROM activities
    WHERE start_date >= date('now', '-${longestDays} days')
    GROUP BY sport_type;
  `;

  const averagesSql = `
    SELECT sport_type,
      ROUND(AVG(moving_time) / 60.0, 0) AS avg_minutes,
      ROUND(AVG(distance) / 1000.0, 1) AS avg_km,
      COUNT(*) AS total_sessions
    FROM activities
    WHERE start_date >= date('now', '-${days} days')
    GROUP BY sport_type;
  `;

  if (args.json) {
    const output = {
      weeklyVolume: queryJson(weeklyVolumeSql),
      longestSessions: queryJson(longestSessionsSql),
      averageSessionDuration: queryJson(averagesSql),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const weeklyVolumeRows = queryJson<Record<string, unknown>>(weeklyVolumeSql);
  const weeklyVolumeTable = formatTable(
    weeklyVolumeRows,
    ["Week", "Sport", "Sessions", "Hours", "Km"],
    ["week", "sport_type", "sessions", "hours", "km"]
  );
  printSection(`Weekly volume (last ${weeks} weeks)`, weeklyVolumeTable);

  const longestSessionsRows = queryJson<Record<string, unknown>>(longestSessionsSql);
  const longestSessionsTable = formatTable(
    longestSessionsRows,
    ["Sport", "Longest hours", "Longest km"],
    ["sport_type", "longest_hours", "longest_km"]
  );
  printSection(`Longest recent sessions (last ${longestWeeks} weeks)`, longestSessionsTable);

  const averageSessionRows = queryJson<Record<string, unknown>>(averagesSql);
  const averageSessionTable = formatTable(
    averageSessionRows,
    ["Sport", "Avg minutes", "Avg km", "Total sessions"],
    ["sport_type", "avg_minutes", "avg_km", "total_sessions"]
  );
  printSection(`Average session duration (last ${weeks} weeks)`, averageSessionTable);
}
