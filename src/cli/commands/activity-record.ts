import Database from "better-sqlite3";
import { getDb } from "../../db/client.js";
import { log } from "../../lib/logging.js";
import type { ActivityRecordArgs } from "../args.js";

const VALID_SPORT_TYPES = ["Swim", "Bike", "Run", "Strength", "Brick"];

function capitalizeSportType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function generateSyntheticId(db: Database.Database): number {
  const result = db.prepare("SELECT MIN(id) as minId FROM activities").get() as {
    minId: number | null;
  };
  const currentMin = result.minId ?? 0;
  return currentMin <= 0 ? currentMin - 1 : -1;
}

export function recordManualActivity(args: ActivityRecordArgs): void {
  log.start("Recording manual activity...");

  const db = getDb();

  const sportType = capitalizeSportType(args.type);
  if (!VALID_SPORT_TYPES.includes(sportType)) {
    log.error(`Invalid sport type: ${args.type}`);
    log.info(`Valid types: ${VALID_SPORT_TYPES.join(", ")}`);
    process.exit(1);
  }

  const elapsedSeconds = args.duration * 60;
  const startDate = new Date().toISOString();

  let distanceMeters: number | null = null;
  let averageSpeed: number | null = null;

  if (args.distance !== undefined) {
    distanceMeters = args.distance * 1000;
    averageSpeed = distanceMeters / elapsedSeconds;
  }

  const activityId = generateSyntheticId(db);

  const manualData = {
    structure: args.structure ?? null,
    notes: args.notes ?? null,
  };

  const insert = db.prepare(`
    INSERT INTO activities (
      id, name, sport_type, start_date, elapsed_time, moving_time,
      distance, average_speed, source, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insert.run(
    activityId,
    `Manual: ${sportType}`,
    sportType,
    startDate,
    elapsedSeconds,
    elapsedSeconds,
    distanceMeters,
    averageSpeed,
    "manual",
    JSON.stringify(manualData)
  );

  const result = {
    id: activityId,
    message: "Manual activity recorded successfully",
  };

  console.log(JSON.stringify(result, null, 2));
  log.success(`Recorded manual activity with ID: ${activityId}`);
}
