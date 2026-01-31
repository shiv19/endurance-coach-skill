import { execute } from "./client.js";
import type { StravaActivity } from "../strava/types.js";

/**
 * Produce a SQL literal for a string value.
 */
export function escapeString(str: string | null | undefined): string {
  if (str == null) return "NULL";
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Insert or replace a Strava activity row into local `activities` table.
 *
 * The full activity object is saved in the `raw_json` column and `synced_at`
 * is set to the current timestamp.
 *
 * @param activity - The Strava activity to persist (will be stored and indexed by `id`)
 */
export function insertActivity(activity: StravaActivity): void {
  const sql = `
    INSERT OR REPLACE INTO activities (
      id, name, sport_type, start_date, elapsed_time, moving_time,
      distance, total_elevation_gain, average_speed, max_speed,
      average_heartrate, max_heartrate, average_watts, max_watts,
      weighted_average_watts, kilojoules, suffer_score, average_cadence,
      calories, description, workout_type, gear_id, raw_json, synced_at
    ) VALUES (
      ${activity.id},
      ${escapeString(activity.name)},
      ${escapeString(activity.sport_type)},
      ${escapeString(activity.start_date)},
      ${activity.elapsed_time ?? "NULL"},
      ${activity.moving_time ?? "NULL"},
      ${activity.distance ?? "NULL"},
      ${activity.total_elevation_gain ?? "NULL"},
      ${activity.average_speed ?? "NULL"},
      ${activity.max_speed ?? "NULL"},
      ${activity.average_heartrate ?? "NULL"},
      ${activity.max_heartrate ?? "NULL"},
      ${activity.average_watts ?? "NULL"},
      ${activity.max_watts ?? "NULL"},
      ${activity.weighted_average_watts ?? "NULL"},
      ${activity.kilojoules ?? "NULL"},
      ${activity.suffer_score ?? "NULL"},
      ${activity.average_cadence ?? "NULL"},
      ${activity.calories ?? "NULL"},
      ${escapeString(activity.description)},
      ${activity.workout_type ?? "NULL"},
      ${escapeString(activity.gear_id)},
      ${escapeString(JSON.stringify(activity))},
      datetime('now')
    );
  `;

  execute(sql);
}

/**
 * Inserts or replaces an athlete row in the local database.
 *
 * @param athlete - Athlete data to persist. Fields:
 *   - `id`: Strava athlete identifier
 *   - `firstname`: Athlete's first name
 *   - `lastname`: Athlete's last name
 *   - `weight` (optional): Athlete weight (if available)
 *   - `ftp` (optional): Athlete functional threshold power (if available)
 *
 * This stores the provided fields, the full athlete object as `raw_json`,
 * and sets `updated_at` to the current time.
 */
export function insertAthlete(athlete: {
  id: number;
  firstname: string;
  lastname: string;
  weight?: number;
  ftp?: number;
}): void {
  const sql = `
    INSERT OR REPLACE INTO athlete (id, firstname, lastname, weight, ftp, raw_json, updated_at)
    VALUES (
      ${athlete.id},
      ${escapeString(athlete.firstname)},
      ${escapeString(athlete.lastname)},
      ${athlete.weight ?? "NULL"},
      ${athlete.ftp ?? "NULL"},
      ${escapeString(JSON.stringify(athlete))},
      datetime('now')
    );
  `;
  execute(sql);
}
