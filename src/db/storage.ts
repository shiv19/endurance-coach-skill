import { getDb } from "./client.js";
import type { StravaActivity } from "../strava/types.js";

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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `;

  const stmt = getDb().prepare(sql);
  stmt.run(
    activity.id,
    activity.name,
    activity.sport_type,
    activity.start_date,
    activity.elapsed_time ?? null,
    activity.moving_time ?? null,
    activity.distance ?? null,
    activity.total_elevation_gain ?? null,
    activity.average_speed ?? null,
    activity.max_speed ?? null,
    activity.average_heartrate ?? null,
    activity.max_heartrate ?? null,
    activity.average_watts ?? null,
    activity.max_watts ?? null,
    activity.weighted_average_watts ?? null,
    activity.kilojoules ?? null,
    activity.suffer_score ?? null,
    activity.average_cadence ?? null,
    activity.calories ?? null,
    activity.description ?? null,
    activity.workout_type ?? null,
    activity.gear_id ?? null,
    JSON.stringify(activity)
  );
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
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `;
  const stmt = getDb().prepare(sql);
  stmt.run(
    athlete.id,
    athlete.firstname,
    athlete.lastname,
    athlete.weight ?? null,
    athlete.ftp ?? null,
    JSON.stringify(athlete)
  );
}
