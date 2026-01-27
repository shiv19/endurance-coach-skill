import { initDatabase, queryJson } from "../../db/client.js";
import type { HrZonesArgs } from "../args.js";
import { formatTable } from "../utils/format-table.js";
import { toPositiveInt } from "../utils/number-utils.js";
import { printSection } from "../utils/printSection.js";

const DEFAULT_WEEKS = 8;
const DEFAULT_DISTRIBUTION_WEEKS = 12;

/**
 * Generate and output heart-rate zone reports grouped by sport.
 *
 * Computes average and distribution statistics for activities over configurable
 * time windows and either prints formatted tables to stdout or emits a JSON
 * object when `args.json` is true.
 *
 * @param args - Command arguments. Recognized fields:
 *   - `weeks`: number of weeks for the average HR window (defaults to 8 when omitted or invalid)
 *   - `distributionWeeks`: number of weeks for the distribution window (defaults to 12 when omitted or invalid)
 *   - `json`: when true, output JSON with `averageHeartRate` and `distribution` instead of human-readable tables
 */
export async function runHrZones(args: HrZonesArgs): Promise<void> {
  await initDatabase();

  const weeks = toPositiveInt(args.weeks, DEFAULT_WEEKS);
  const distributionWeeks = toPositiveInt(args.distributionWeeks, DEFAULT_DISTRIBUTION_WEEKS);
  const days = weeks * 7;
  const distributionDays = distributionWeeks * 7;

  const avgHrSql = `
    SELECT
      sport_type,
      ROUND(AVG(average_heartrate), 0) AS avg_hr,
      ROUND(AVG(max_heartrate), 0) AS avg_max_hr,
      COUNT(*) AS sessions
    FROM activities
    WHERE average_heartrate IS NOT NULL
      AND start_date >= date('now', '-${days} days')
    GROUP BY sport_type;
  `;

  const distributionSql = `
    SELECT
      sport_type,
      ROUND(MIN(average_heartrate), 0) AS min_avg_hr,
      ROUND(AVG(average_heartrate), 0) AS mean_avg_hr,
      ROUND(MAX(average_heartrate), 0) AS max_avg_hr,
      ROUND(MAX(max_heartrate), 0) AS highest_max_hr
    FROM activities
    WHERE average_heartrate IS NOT NULL
      AND start_date >= date('now', '-${distributionDays} days')
    GROUP BY sport_type;
  `;

  if (args.json) {
    const output = {
      averageHeartRate: queryJson(avgHrSql),
      distribution: queryJson(distributionSql),
    };
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  const avgHrRows = queryJson<Record<string, unknown>>(avgHrSql);
  const avgHrTable = formatTable(
    avgHrRows,
    ["Sport", "Avg HR", "Avg max HR", "Sessions"],
    ["sport_type", "avg_hr", "avg_max_hr", "sessions"]
  );
  printSection(`Average HR by sport (last ${weeks} weeks)`, avgHrTable);

  const distributionRows = queryJson<Record<string, unknown>>(distributionSql);
  const distributionTable = formatTable(
    distributionRows,
    ["Sport", "Min avg HR", "Mean avg HR", "Max avg HR", "Highest max HR"],
    ["sport_type", "min_avg_hr", "mean_avg_hr", "max_avg_hr", "highest_max_hr"]
  );
  printSection(`HR distribution (last ${distributionWeeks} weeks)`, distributionTable);
}
