import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { recordManualActivity } from "../../src/cli/commands/activity-record.js";
import { initDatabase, getDb, resetDatabaseCache } from "../../src/db/client.js";
import type { ActivityRecordArgs } from "../../src/cli/args.js";

function withSilencedConsole(fn: () => void): ReturnType<typeof vi.spyOn> {
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    fn();
  } finally {
    consoleSpy.mockRestore();
  }
  return consoleSpy;
}

describe("activity-record command", () => {
  const testDir = join(tmpdir(), "endurance-coach-activity-record-test-" + Date.now());
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    process.env.ENDURANCE_COACH_CONFIG_DIR = testDir;
    resetDatabaseCache();
    await initDatabase();
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDatabaseCache();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("argument validation", () => {
    it("should record a basic activity with required fields", () => {
      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 30,
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const db = getDb();
      const activity = db
        .prepare("SELECT * FROM activities WHERE source = 'manual'")
        .get() as Record<string, unknown>;

      expect(activity).toBeDefined();
      expect(activity.sport_type).toBe("Run");
      expect(activity.elapsed_time).toBe(1800);
      expect(activity.source).toBe("manual");
      expect(activity.name).toBe("Manual: Run");
    });

    it("should capitalize sport type", () => {
      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "bike",
        duration: 45,
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const db = getDb();
      const activity = db
        .prepare("SELECT sport_type FROM activities WHERE source = 'manual'")
        .get() as { sport_type: string };

      expect(activity.sport_type).toBe("Bike");
    });

    it("should calculate average speed when distance is provided", () => {
      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 30,
        distance: 5,
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const db = getDb();
      const activity = db
        .prepare("SELECT distance, average_speed FROM activities WHERE source = 'manual'")
        .get() as { distance: number; average_speed: number };

      expect(activity.distance).toBe(5000);
      expect(activity.average_speed).toBeCloseTo(2.78, 2);
    });

    it("should not store Infinity average speed when duration is zero", () => {
      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 0,
        distance: 5,
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const db = getDb();
      const activity = db
        .prepare(
          "SELECT distance, average_speed, elapsed_time FROM activities WHERE source = 'manual'"
        )
        .get() as { distance: number; average_speed: number | null; elapsed_time: number };

      expect(activity.elapsed_time).toBe(0);
      expect(activity.distance).toBe(5000);
      expect(activity.average_speed).toBe(0);
    });

    it("should store structure and notes in raw_json", () => {
      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 30,
        structure: "2x10min tempo",
        notes: "Felt good, legs fresh",
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const db = getDb();
      const activity = db
        .prepare("SELECT raw_json FROM activities WHERE source = 'manual'")
        .get() as { raw_json: string };

      const rawJson = JSON.parse(activity.raw_json);
      expect(rawJson.structure).toBe("2x10min tempo");
      expect(rawJson.notes).toBe("Felt good, legs fresh");
    });

    it("should use negative ID for manual activities", () => {
      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 30,
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const db = getDb();
      const activity = db.prepare("SELECT id FROM activities WHERE source = 'manual'").get() as {
        id: number;
      };

      expect(activity.id).toBeLessThan(0);
    });

    it("should generate sequential negative IDs for multiple activities", () => {
      const db = getDb();
      db.prepare("DELETE FROM activities WHERE source = 'manual'").run();

      withSilencedConsole(() => {
        recordManualActivity({
          command: "activity-record",
          type: "run",
          duration: 30,
        });

        recordManualActivity({
          command: "activity-record",
          type: "bike",
          duration: 45,
        });
      });

      const activities = db
        .prepare("SELECT id FROM activities WHERE source = 'manual' ORDER BY id DESC")
        .all() as { id: number }[];

      expect(activities).toHaveLength(2);
      expect(activities[0].id).toBe(-1);
      expect(activities[1].id).toBe(-2);
    });

    it("should output JSON with activity ID", () => {
      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 30,
      };

      const logMessages: string[] = [];
      const consoleSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
        logMessages.push(args.join(" "));
      });
      try {
        recordManualActivity(args);

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"id":'));
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('"message":'));

        const output = logMessages[0];
        const result = JSON.parse(output);
        expect(result.id).toBeLessThan(0);
        expect(result.message).toBe("Manual activity recorded successfully");
      } finally {
        consoleSpy.mockRestore();
      }
    });
  });

  describe("synthetic ID generation", () => {
    it("should start with -1 when no activities exist", () => {
      const db = getDb();
      db.prepare("DELETE FROM activities WHERE source = 'manual'").run();

      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 30,
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const activity = db.prepare("SELECT id FROM activities WHERE source = 'manual'").get() as {
        id: number;
      };

      expect(activity.id).toBe(-1);
    });

    it("should continue from -1 when positive Strava activities exist", () => {
      const db = getDb();
      db.prepare("DELETE FROM activities WHERE source = 'manual'").run();
      db.prepare(
        "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, source) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(123456, "Strava Run", "Run", "2025-01-01T10:00:00Z", 1800, 1800, "strava");

      const args: ActivityRecordArgs = {
        command: "activity-record",
        type: "run",
        duration: 30,
      };

      withSilencedConsole(() => {
        recordManualActivity(args);
      });

      const activity = db.prepare("SELECT id FROM activities WHERE source = 'manual'").get() as {
        id: number;
      };

      expect(activity.id).toBe(-1);
    });
  });

  describe("sport type validation", () => {
    it("should accept valid sport types", () => {
      const validTypes = ["Swim", "Bike", "Run", "Strength", "Brick"];

      const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);

      validTypes.forEach((type) => {
        const args: ActivityRecordArgs = {
          command: "activity-record",
          type: type.toLowerCase(),
          duration: 30,
        };

        withSilencedConsole(() => {
          recordManualActivity(args);
        });

        const db = getDb();
        const count = db
          .prepare("SELECT COUNT(*) as count FROM activities WHERE source = 'manual'")
          .get() as { count: number };
        expect(count.count).toBeGreaterThan(0);

        db.prepare("DELETE FROM activities WHERE source = 'manual'").run();
      });

      exitSpy.mockRestore();
    });
  });
});
