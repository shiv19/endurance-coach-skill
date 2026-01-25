import { initDatabase, query, queryJson } from "../../db/client.js";
import type { FoundationArgs } from "../args.js";

const DEFAULT_TOP_WEEKS = 5;

function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

export async function runFoundation(args: FoundationArgs): Promise<void> {
  await initDatabase();

  const topWeeks = toPositiveInt(args.topWeeks, DEFAULT_TOP_WEEKS);

  const raceHistorySql = `
    SELECT
      strftime('%Y-%m', start_date) AS month,
      name,
      sport_type,
      ROUND(distance / 1000.0, 1) AS km,
      ROUND(moving_time / 3600.0, 1) AS hours
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

  printSection("Race history (workout_type = 1)", query(raceHistorySql));
  printSection("Lifetime peaks by sport", query(lifetimePeaksSql));
  printSection(`Peak training weeks (top ${topWeeks})`, query(peakWeeksSql));
  printSection("Training history depth", query(historyDepthSql));
}
