import { initDatabase, query, queryJson } from "../../db/client.js";
import type { TrainingLoadArgs } from "../args.js";

const DEFAULT_WEEKS = 12;

function toPositiveInt(value: number | undefined, fallback: number): number {
  if (!value || Number.isNaN(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function printSection(title: string, output: string): void {
  const trimmed = output.trim();
  console.log(`\n# ${title}`);
  console.log(trimmed ? trimmed : "(no results)");
}

export async function runTrainingLoad(args: TrainingLoadArgs): Promise<void> {
  await initDatabase();

  const weeks = toPositiveInt(args.weeks, DEFAULT_WEEKS);

  const sql = `
    SELECT
      strftime('%Y-W%W', start_date) AS week,
      SUM(suffer_score) AS weekly_load,
      ROUND(SUM(moving_time) / 3600.0, 1) AS total_hours
    FROM activities
    WHERE start_date >= date('now', '-${weeks} weeks')
    GROUP BY week
    ORDER BY week;
  `;

  if (args.json) {
    console.log(JSON.stringify({ trainingLoad: queryJson(sql) }, null, 2));
    return;
  }

  printSection(`Weekly training load (last ${weeks} weeks)`, query(sql));
}
