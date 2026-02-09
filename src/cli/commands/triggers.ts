import { initDatabase, getDb } from "../../db/client.js";
import type { TriggersArgs } from "../args.js";
import { formatTable } from "../utils/format-table.js";
import { log } from "../../lib/logging.js";

const VALID_TRIGGER_TYPES = [
  "hr_drift",
  "pace_deviation",
  "lap_variability",
  "early_fade",
] as const;
const VALID_UNITS = ["percent", "bpm", "seconds"] as const;

type TriggerType = (typeof VALID_TRIGGER_TYPES)[number];
type Unit = (typeof VALID_UNITS)[number];

interface TriggerRecord {
  id: number;
  trigger_type: string;
  threshold_value: number;
  threshold_unit: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function isValidTriggerType(value: string): value is TriggerType {
  return VALID_TRIGGER_TYPES.includes(value as TriggerType);
}

function isValidUnit(value: string): value is Unit {
  return VALID_UNITS.includes(value as Unit);
}

function seedDefaultTriggers(): void {
  const db = getDb();

  const count = db.prepare("SELECT COUNT(*) as count FROM interview_triggers").get() as {
    count: number;
  };

  if (count.count > 0) {
    return;
  }

  const defaultTriggers = [
    { trigger_type: "hr_drift", threshold_value: 10, threshold_unit: "percent", enabled: 0 },
    { trigger_type: "pace_deviation", threshold_value: 15, threshold_unit: "percent", enabled: 0 },
    { trigger_type: "lap_variability", threshold_value: 20, threshold_unit: "percent", enabled: 0 },
    { trigger_type: "early_fade", threshold_value: 10, threshold_unit: "percent", enabled: 0 },
  ];

  const stmt = db.prepare(
    "INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit, enabled) VALUES (?, ?, ?, ?)"
  );

  for (const trigger of defaultTriggers) {
    stmt.run(
      trigger.trigger_type,
      trigger.threshold_value,
      trigger.threshold_unit,
      trigger.enabled
    );
  }

  log.info("Seeded default interview triggers (disabled by default)");
}

function listTriggers(): TriggerRecord[] {
  const db = getDb();
  const triggers = db
    .prepare("SELECT * FROM interview_triggers ORDER BY trigger_type")
    .all() as TriggerRecord[];
  return triggers;
}

function setTrigger(
  type: string,
  threshold: number,
  unit: string,
  enabled: boolean = true
): TriggerRecord {
  if (!isValidTriggerType(type)) {
    throw new Error(
      `Invalid trigger type: ${type}. Must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`
    );
  }

  if (!isValidUnit(unit)) {
    throw new Error(`Invalid unit: ${unit}. Must be one of: ${VALID_UNITS.join(", ")}`);
  }

  if (threshold <= 0) {
    throw new Error("Threshold must be a positive number");
  }

  const db = getDb();

  const stmt = db.prepare(
    `INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit, enabled, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(trigger_type) DO UPDATE SET
       threshold_value = excluded.threshold_value,
       threshold_unit = excluded.threshold_unit,
       enabled = excluded.enabled,
       updated_at = datetime('now')
     RETURNING *`
  );

  const result = stmt.get(type, threshold, unit, enabled ? 1 : 0) as TriggerRecord;

  if (!result) {
    throw new Error("Failed to insert or update trigger");
  }

  return result;
}

function disableTrigger(type: string): TriggerRecord {
  if (!isValidTriggerType(type)) {
    throw new Error(
      `Invalid trigger type: ${type}. Must be one of: ${VALID_TRIGGER_TYPES.join(", ")}`
    );
  }

  const db = getDb();

  const stmt = db.prepare(
    "UPDATE interview_triggers SET enabled = 0, updated_at = datetime('now') WHERE trigger_type = ? RETURNING *"
  );

  const result = stmt.get(type) as TriggerRecord | undefined;

  if (!result) {
    throw new Error(`Trigger '${type}' not found`);
  }

  return result;
}

export async function runTriggers(args: TriggersArgs): Promise<void> {
  await initDatabase();
  seedDefaultTriggers();

  switch (args.subcommand) {
    case "list": {
      const triggers = listTriggers();

      if (triggers.length === 0) {
        log.info("No triggers configured");
        return;
      }

      const rows = triggers.map((t) => ({
        type: t.trigger_type,
        threshold: `${t.threshold_value} ${t.threshold_unit}`,
        enabled: t.enabled ? "Yes" : "No",
        updated: t.updated_at,
      }));

      const table = formatTable(
        rows,
        ["Type", "Threshold", "Enabled", "Updated"],
        ["type", "threshold", "enabled", "updated"]
      );

      console.log(table);
      break;
    }

    case "set": {
      const enabled = args.enabled !== undefined ? args.enabled : true;
      const trigger = setTrigger(args.type!, args.threshold!, args.unit!, enabled);

      log.success(
        `Trigger '${args.type}' set to ${args.threshold}${args.unit} (enabled: ${enabled ? "Yes" : "No"})`
      );
      break;
    }

    case "disable": {
      const trigger = disableTrigger(args.type!);
      log.success(`Trigger '${args.type}' disabled`);
      break;
    }
  }
}
