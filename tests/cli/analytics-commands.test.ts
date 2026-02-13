import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runStats } from "../../src/cli/commands/stats.js";
import { runTrainingLoad } from "../../src/cli/commands/training-load.js";
import { runFoundation } from "../../src/cli/commands/foundation.js";
import { runStrength } from "../../src/cli/commands/strength.js";
import { runSchedulePreferences } from "../../src/cli/commands/schedule-preferences.js";
import { runHrZones } from "../../src/cli/commands/hr-zones.js";
import { runQuery } from "../../src/cli/commands/query.js";
import { initDatabase, getDb, resetDatabaseCache } from "../../src/db/client.js";

async function captureConsoleLogs(fn: () => Promise<void>): Promise<string[]> {
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await fn();
    return consoleSpy.mock.calls.map((call) => String(call[0]));
  } finally {
    consoleSpy.mockRestore();
  }
}

describe("analytics-style CLI commands", () => {
  const testDir = join(tmpdir(), "endurance-coach-analytics-test-" + Date.now());
  const originalEnv = { ...process.env };
  let nextActivityId = 1000;

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    process.env.ENDURANCE_COACH_CONFIG_DIR = testDir;
    resetDatabaseCache();
    await initDatabase();

    vi.mock("../../src/lib/freshness.js", async () => {
      const actual = await vi.importActual("../../src/lib/freshness.js");
      return {
        ...actual,
        ensureFreshData: vi.fn().mockResolvedValue({ synced: false, reason: "fresh" }),
      };
    });

    nextActivityId = 1000;
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDatabaseCache();
    rmSync(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  function insertSampleActivity(overrides: Record<string, unknown> = {}) {
    const db = getDb();
    const now = new Date();
    const activityId = (overrides.id as number) || nextActivityId++;
    const daysAgo = (overrides.daysAgo as number) || 0;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const startDateIso = startDate.toISOString();

    const defaultActivity = {
      name: "Morning Run",
      sport_type: "Run",
      start_date: startDateIso,
      elapsed_time: 3600,
      moving_time: 3600,
      distance: 10000,
      total_elevation_gain: 100,
      average_speed: 2.78,
      max_speed: 4.5,
      average_heartrate: 145,
      max_heartrate: 175,
      suffer_score: 100,
      workout_type: 2,
    };
    const { daysAgo: _daysAgo, ...overridesWithoutDaysAgo } = overrides;
    const activity = { ...defaultActivity, ...overridesWithoutDaysAgo };
    const columns = Object.keys(activity);
    const placeholders = columns.map(() => "?").join(",");
    const values = Object.values(activity);
    db.prepare(`INSERT INTO activities (id, ${columns.join(",")}) VALUES (?, ${placeholders})`).run(
      activityId,
      ...values
    );
  }

  describe("stats command", () => {
    it("outputs JSON with activity statistics", async () => {
      insertSampleActivity({ sport_type: "Run", distance: 15000, moving_time: 3600, daysAgo: 1 });
      insertSampleActivity({ sport_type: "Ride", distance: 40000, moving_time: 5400, daysAgo: 1 });
      insertSampleActivity({ sport_type: "Run", distance: 12000, moving_time: 2700, daysAgo: 8 });

      const [output] = await captureConsoleLogs(async () => {
        await runStats({
          command: "stats",
          json: true,
          weeks: 2,
          longestWeeks: 2,
          verbose: false,
          noSync: true,
        });
      });
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("weeklyVolume");
      expect(parsed).toHaveProperty("longestSessions");
      expect(parsed).toHaveProperty("averageSessionDuration");
      expect(parsed.weeklyVolume.length).toBeGreaterThan(0);
      expect(parsed.longestSessions.length).toBeGreaterThan(0);
      expect(parsed.averageSessionDuration.length).toBeGreaterThan(0);
    });

    it("prints formatted tables for statistics", async () => {
      insertSampleActivity({ sport_type: "Run", distance: 15000, moving_time: 3600 });

      const outputLines = await captureConsoleLogs(async () => {
        await runStats({
          command: "stats",
          json: false,
          weeks: 2,
          longestWeeks: 2,
          verbose: false,
          noSync: true,
        });
      });
      const output = outputLines.join("\n");
      expect(output).toContain("Weekly volume");
      expect(output).toContain("Longest recent sessions");
      expect(output).toContain("Average session duration");
    });

    it("prints no results message when no activities", async () => {
      const outputLines = await captureConsoleLogs(async () => {
        await runStats({
          command: "stats",
          json: false,
          weeks: 2,
          longestWeeks: 2,
          verbose: false,
          noSync: true,
        });
      });
      const output = outputLines.join("\n");
      expect(output).toContain("(no results)");
    });
  });

  describe("training-load command", () => {
    it("outputs JSON with weekly training load", async () => {
      insertSampleActivity({ suffer_score: 100, moving_time: 3600, daysAgo: 1 });
      insertSampleActivity({ suffer_score: 150, moving_time: 5400, daysAgo: 8 });

      const [output] = await captureConsoleLogs(async () => {
        await runTrainingLoad({
          command: "training-load",
          json: true,
          weeks: 2,
          verbose: false,
          noSync: true,
        });
      });
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("trainingLoad");
      expect(parsed.trainingLoad).toBeInstanceOf(Array);
      expect(parsed.trainingLoad.length).toBeGreaterThan(0);
    });

    it("uses default weeks when invalid", async () => {
      insertSampleActivity({ suffer_score: 100, moving_time: 3600 });

      const [output] = await captureConsoleLogs(async () => {
        await runTrainingLoad({
          command: "training-load",
          json: true,
          weeks: 0,
          verbose: false,
          noSync: true,
        });
      });
      const parsed = JSON.parse(output);

      expect(parsed.trainingLoad).toBeDefined();
    });
  });

  describe("foundation command", () => {
    it("outputs JSON with foundation analytics", async () => {
      insertSampleActivity({ workout_type: 1, distance: 21000 });
      insertSampleActivity({ id: 1002, sport_type: "Ride", distance: 90000 });

      const [output] = await captureConsoleLogs(async () => {
        await runFoundation({ command: "foundation", json: true, topWeeks: 5 });
      });
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("raceHistory");
      expect(parsed).toHaveProperty("lifetimePeaks");
      expect(parsed).toHaveProperty("peakTrainingWeeks");
      expect(parsed).toHaveProperty("trainingHistoryDepth");
    });

    it("uses default top weeks when invalid", async () => {
      insertSampleActivity({ workout_type: 1, distance: 21000 });

      const [output] = await captureConsoleLogs(async () => {
        await runFoundation({ command: "foundation", json: true, topWeeks: -2 });
      });
      const parsed = JSON.parse(output);

      expect(parsed.peakTrainingWeeks).toBeDefined();
    });
  });

  describe("strength command", () => {
    it("outputs JSON with strength analytics", async () => {
      insertSampleActivity({ average_heartrate: 140, moving_time: 4200, distance: 15000 });
      insertSampleActivity({
        id: 1002,
        sport_type: "Ride",
        average_heartrate: 130,
        moving_time: 5400,
        distance: 80000,
      });

      const [output] = await captureConsoleLogs(async () => {
        await runStrength({
          command: "strength",
          json: true,
          months: 6,
          longMonths: 12,
          easyHrMax: 145,
          longMinutes: 60,
          years: 2,
        });
      });
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("efficiency");
      expect(parsed).toHaveProperty("aerobicStrength");
      expect(parsed).toHaveProperty("lastActivity");
      expect(parsed).toHaveProperty("historicalPeaks");
    });

    it("uses default thresholds when invalid", async () => {
      insertSampleActivity({ average_heartrate: 140, moving_time: 4200, distance: 15000 });

      const [output] = await captureConsoleLogs(async () => {
        await runStrength({
          command: "strength",
          json: true,
          months: 0,
          longMonths: 0,
          easyHrMax: 0,
          longMinutes: 0,
          years: 0,
        });
      });
      const parsed = JSON.parse(output);

      expect(parsed.efficiency).toBeDefined();
    });
  });

  describe("schedule-preferences command", () => {
    it("outputs JSON with schedule preferences", async () => {
      insertSampleActivity({
        sport_type: "Ride",
        moving_time: 5400,
        daysAgo: 1,
      });
      insertSampleActivity({
        sport_type: "Run",
        moving_time: 3600,
        daysAgo: 1,
      });
      insertSampleActivity({
        sport_type: "Swim",
        moving_time: 1800,
        daysAgo: 1,
      });

      const [output] = await captureConsoleLogs(async () => {
        await runSchedulePreferences({
          command: "schedule-preferences",
          json: true,
          rideMinutes: 90,
          runMinutes: 60,
        });
      });
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("longRideDays");
      expect(parsed).toHaveProperty("longRunDays");
      expect(parsed).toHaveProperty("swimDays");
    });

    it("uses default thresholds when invalid", async () => {
      insertSampleActivity({ sport_type: "Ride", moving_time: 5400 });

      const outputLines = await captureConsoleLogs(async () => {
        await runSchedulePreferences({
          command: "schedule-preferences",
          json: false,
          rideMinutes: -1,
          runMinutes: 0,
        });
      });
      const output = outputLines.join("\n");
      expect(output).toContain("Preferred long ride days");
    });
  });

  describe("hr-zones command", () => {
    it("outputs JSON with heart rate zone analytics", async () => {
      insertSampleActivity({ average_heartrate: 145, max_heartrate: 175 });
      insertSampleActivity({
        id: 1002,
        sport_type: "Ride",
        average_heartrate: 130,
        max_heartrate: 165,
      });

      const [output] = await captureConsoleLogs(async () => {
        await runHrZones({ command: "hr-zones", json: true, weeks: 8, distributionWeeks: 12 });
      });
      const parsed = JSON.parse(output);

      expect(parsed).toHaveProperty("averageHeartRate");
      expect(parsed).toHaveProperty("distribution");
    });

    it("uses default week ranges when invalid", async () => {
      insertSampleActivity({ average_heartrate: 145, max_heartrate: 175 });

      const [output] = await captureConsoleLogs(async () => {
        await runHrZones({ command: "hr-zones", json: true, weeks: 0, distributionWeeks: 0 });
      });
      const parsed = JSON.parse(output);

      expect(parsed.averageHeartRate).toBeDefined();
    });
  });

  describe("query command", () => {
    it("outputs JSON for query results", async () => {
      insertSampleActivity({ sport_type: "Run", name: "Morning Run" });

      const [output] = await captureConsoleLogs(async () => {
        await runQuery({
          command: "query",
          sql: "SELECT sport_type, name FROM activities LIMIT 1",
          json: true,
        });
      });
      const parsed = JSON.parse(output);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0]).toHaveProperty("sport_type");
      expect(parsed[0]).toHaveProperty("name");
    });

    it("outputs formatted table for query results", async () => {
      insertSampleActivity({ sport_type: "Run", name: "Morning Run" });

      const outputLines = await captureConsoleLogs(async () => {
        await runQuery({
          command: "query",
          sql: "SELECT sport_type, name FROM activities LIMIT 1",
          json: false,
        });
      });
      const output = outputLines.join("\n");
      expect(output).toContain("sport_type");
      expect(output).toContain("name");
    });

    it("outputs nothing for empty query results", async () => {
      const outputLines = await captureConsoleLogs(async () => {
        await runQuery({
          command: "query",
          sql: "SELECT * FROM activities WHERE id = 99999",
          json: false,
        });
      });

      expect(outputLines.length).toBe(0);
    });
  });
});
