import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDatabase, resetDatabaseCache, getDb } from "../../src/db/client.js";
import { runInterview } from "../../src/cli/commands/interview.js";
import { saveInterview } from "../../src/cli/commands/interview-persistence.js";
import { recordManualActivity } from "../../src/cli/commands/activity-record.js";
import { listInterviews } from "../../src/cli/commands/interviews.js";
import { log } from "../../src/lib/logging.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

import * as configModule from "../../src/lib/config.js";
import * as oauthModule from "../../src/strava/oauth.js";
import * as apiModule from "../../src/strava/api.js";
import * as stravaModule from "../../src/cli/commands/strava.js";

vi.mock("../../src/lib/config.js", () => ({
  tokensExist: vi.fn(),
  getDbPath: vi.fn(() => "/tmp/test.db"),
}));

vi.mock("../../src/strava/oauth.js", () => ({
  getValidTokens: vi.fn(),
}));

vi.mock("../../src/strava/api.js", () => ({
  getActivityLaps: vi.fn(),
}));

vi.mock("../../src/cli/commands/strava.js", () => ({
  syncActivities: vi.fn(),
}));

describe("Interview Flow Integration Tests", () => {
  const testDir = join(tmpdir(), "endurance-coach-interview-flow-test-" + Date.now());
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    vi.clearAllMocks();
    mkdirSync(testDir, { recursive: true });
    process.env.ENDURANCE_COACH_CONFIG_DIR = testDir;
    resetDatabaseCache();
    await initDatabase();
    const db = getDb();

    db.exec("DELETE FROM activities");
    db.exec("DELETE FROM workout_interviews");
    db.exec("DELETE FROM preliminary_coach_notes");
    db.exec("DELETE FROM interview_triggers");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const today = new Date();

    db.prepare(
      "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(1, "Morning Run", "Run", yesterday.toISOString(), 3600, 3600, 8000, 150, 100, "strava");

    db.prepare(
      "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(2, "Evening Ride", "Ride", today.toISOString(), 3600, 3600, 25000, 140, 150, "strava");

    db.prepare(
      "INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit, enabled) VALUES (?, ?, ?, ?)"
    ).run("hr_drift", 5.0, "percent", 1);

    db.prepare(
      "INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit, enabled) VALUES (?, ?, ?, ?)"
    ).run("pace_deviation", 10.0, "percent", 1);
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDatabaseCache();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("Strava-enabled flow", () => {
    beforeEach(async () => {
      vi.mocked(configModule.tokensExist).mockReturnValue(true);
      vi.mocked(oauthModule.getValidTokens).mockResolvedValue({
        access_token: "test_token",
        refresh_token: "test_refresh",
        expires_at: Date.now() / 1000 + 3600,
        athlete_id: 123,
      });

      vi.mocked(apiModule.getActivityLaps).mockResolvedValue([
        {
          id: 1,
          resource_state: 2,
          name: "Lap 1",
          activity: { id: 1, resource_state: 1 },
          athlete: { id: 123, resource_state: 1 },
          elapsed_time: 1800,
          moving_time: 1800,
          start_date: new Date().toISOString(),
          start_date_local: new Date().toISOString(),
          distance: 4000,
          start_index: 0,
          end_index: 100,
          total_elevation_gain: 50,
          average_speed: 2.22,
          max_speed: 3.5,
          average_heartrate: 145,
          max_heartrate: 160,
          device_watts: false,
          lap_index: 0,
          split: 1,
        },
        {
          id: 2,
          resource_state: 2,
          name: "Lap 2",
          activity: { id: 1, resource_state: 1 },
          athlete: { id: 123, resource_state: 1 },
          elapsed_time: 1800,
          moving_time: 1800,
          start_date: new Date().toISOString(),
          start_date_local: new Date().toISOString(),
          distance: 4000,
          start_index: 100,
          end_index: 200,
          total_elevation_gain: 50,
          average_speed: 2.22,
          max_speed: 3.5,
          average_heartrate: 155,
          max_heartrate: 170,
          device_watts: false,
          lap_index: 1,
          split: 1,
        },
      ]);
    });

    describe("auto-sync behavior", () => {
      beforeEach(() => {
        const db = getDb();
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        db.exec("DELETE FROM activities");
        // Only insert yesterday's activity - tests that need today's activity will add it
        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          1,
          "Morning Run",
          "Run",
          yesterday.toISOString(),
          3600,
          3600,
          8000,
          150,
          100,
          "strava"
        );
      });

      it("should trigger auto-sync when latest activity date < today", async () => {
        vi.mocked(stravaModule.syncActivities).mockResolvedValue({ syncedCount: 5 });

        const { ensureFreshData } = await import("../../src/lib/freshness.js");
        const result = await ensureFreshData();
        expect(result.synced).toBe(true);
        expect(result.syncedCount).toBeGreaterThan(0);
      });

      it("should skip auto-sync when latest activity date = today", async () => {
        const db = getDb();
        const today = new Date();
        // Add an activity from today to make data "fresh"
        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          2,
          "Evening Ride",
          "Ride",
          today.toISOString(),
          3600,
          3600,
          25000,
          140,
          150,
          "strava"
        );

        const { ensureFreshData } = await import("../../src/lib/freshness.js");
        const result = await ensureFreshData();

        expect(result.synced).toBe(false);
        expect(result.reason).toBe("fresh");
      });

      it("should return cached data with warning on sync failure", async () => {
        vi.mocked(stravaModule.syncActivities).mockResolvedValue({
          syncedCount: 0,
          error: "Network error",
        });

        const { ensureFreshData } = await import("../../src/lib/freshness.js");
        const result = await ensureFreshData();
        expect(result.synced).toBe(false);
        expect(result.reason).toBe("error");
        expect(result.warning).toContain("Network error");
        expect(result.cached).toBe(true);
      });
    });

    describe("interview --list", () => {
      it("should return recent activities with expected fields", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "list",
          laps: false,
          json: false,
          days: 7,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls[0][0] as string;
        expect(output).toContain("Recent Activities");
        expect(output).toContain("1:");
        expect(output).toContain("2:");
        expect(output).toContain("Run");
        expect(output).toContain("Ride");
        expect(output).toContain("Morning Run");
        expect(output).toContain("Evening Ride");
        consoleLogSpy.mockRestore();
      });

      it("should include athlete_interview_count and preliminary_note_eligible", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "list",
          laps: false,
          json: true,
          days: 7,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("athlete_interview_count");
        expect(output).toHaveProperty("preliminary_note_eligible");
        consoleLogSpy.mockRestore();
      });
    });

    describe("interview --latest", () => {
      it("should return context without lap data by default", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "latest",
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("workout_metadata");
        expect(output).not.toHaveProperty("laps");
        expect(output.workout_metadata).toHaveProperty("id");
        expect(output.workout_metadata.id).toBe(2);
        consoleLogSpy.mockRestore();
      });

      it("should include lap data when --laps flag is set", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "latest",
          laps: true,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("laps");
        expect(output.laps).toBeInstanceOf(Array);
        expect(output.laps.length).toBeGreaterThan(0);
        expect(output).toHaveProperty("fired_triggers");
        consoleLogSpy.mockRestore();
      }, 10000);

      it("should handle lap fetch errors gracefully", async () => {
        const apiModule = await import("../../src/strava/api.js");
        vi.mocked(apiModule.getActivityLaps).mockRejectedValueOnce(new Error("API Error"));

        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "latest",
          laps: true,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("warning");
        expect(output.warning).toContain("Failed to fetch laps");
        consoleLogSpy.mockRestore();
      }, 10000);
    });

    describe("interview <id>", () => {
      it("should return context without lap data by default", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "specific",
          workoutId: 1,
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("workout_metadata");
        expect(output.workout_metadata).toHaveProperty("id");
        expect(output.workout_metadata.id).toBe(1);
        expect(output).not.toHaveProperty("laps");
        consoleLogSpy.mockRestore();
      });

      it("should include lap data when --laps flag is set", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "specific",
          workoutId: 1,
          laps: true,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("laps");
        expect(output.laps).toBeInstanceOf(Array);
        expect(output.laps.length).toBeGreaterThan(0);
        consoleLogSpy.mockRestore();
      }, 10000);

      it("should handle non-existent activity gracefully", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "specific",
          workoutId: 999,
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("warning");
        expect(output.warning).toContain("Activity 999 not found");
        consoleLogSpy.mockRestore();
      });
    });

    describe("interview-save", () => {
      it("should persist interview to database correctly", async () => {
        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Felt strong today",
          notes: "Good pace control throughout",
          confidence: "High",
        });

        const db = getDb();
        const interviews = db
          .prepare("SELECT * FROM workout_interviews WHERE workout_id = ?")
          .all(1) as {
          id: number;
          workout_id: number;
          athlete_reflection_summary: string;
          coach_notes: string;
          coach_confidence: string;
        }[];

        expect(interviews.length).toBe(1);
        expect(interviews[0].workout_id).toBe(1);
        expect(interviews[0].athlete_reflection_summary).toBe("Felt strong today");
        expect(interviews[0].coach_notes).toBe("Good pace control throughout");
        expect(interviews[0].coach_confidence).toBe("High");
      });

      it("should reject invalid confidence level", async () => {
        const originalExit = process.exit;
        let exitCalled = false;
        process.exit = () => {
          exitCalled = true;
          throw new Error("Exit called");
        };

        try {
          await expect(async () => {
            await saveInterview({
              command: "interview-save",
              workoutId: 1,
              reflection: "Test reflection",
              notes: "Test notes",
              confidence: "Invalid" as "Low" | "Medium" | "High",
            });
          }).rejects.toThrow("Exit called");
          expect(exitCalled).toBe(true);
        } finally {
          process.exit = originalExit;
        }
      });
    });
  });

  describe("Non-Strava (manual) flow", () => {
    beforeEach(async () => {
      const configModule = await import("../../src/lib/config.js");
      vi.mocked(configModule.tokensExist).mockReturnValue(false);
    });

    describe("interview --manual", () => {
      it("should return conversational capture prompt", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "manual",
          laps: false,
          json: false,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = consoleLogSpy.mock.calls[0][0] as string;
        expect(output).toContain("Manual Interview Mode");
        expect(output).toContain("Total interviews");
        consoleLogSpy.mockRestore();
      });

      it("should include athlete_interview_count in output", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "manual",
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("athlete_interview_count");
        expect(output).toHaveProperty("preliminary_note_eligible");
        consoleLogSpy.mockRestore();
      });

      it("should show warning when Strava not configured", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "manual",
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output.sync_status).toBe("manual");
        consoleLogSpy.mockRestore();
      });
    });

    describe("activity-record", () => {
      it("should create manual activity with synthetic ID", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        recordManualActivity({
          command: "activity-record",
          type: "run",
          duration: 45,
          distance: 8.5,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("id");
        expect(output.id).toBeLessThan(0);
        expect(output.message).toBe("Manual activity recorded successfully");

        const db = getDb();
        const activity = db.prepare("SELECT * FROM activities WHERE id = ?").get(output.id) as {
          id: number;
          sport_type: string;
          source: string;
        };

        expect(activity).toBeDefined();
        expect(activity.sport_type).toBe("Run");
        expect(activity.source).toBe("manual");
        consoleLogSpy.mockRestore();
      });

      it("should create synthetic negative IDs sequentially", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        recordManualActivity({
          command: "activity-record",
          type: "run",
          duration: 30,
        });
        recordManualActivity({
          command: "activity-record",
          type: "bike",
          duration: 60,
        });

        const db = getDb();
        const manualActivities = db
          .prepare("SELECT id FROM activities WHERE source = 'manual' ORDER BY id")
          .all() as { id: number }[];

        expect(manualActivities.length).toBe(2);
        expect(manualActivities[0].id).toBeLessThan(manualActivities[1].id);
        expect(manualActivities[0].id).toBeLessThan(0);
        expect(manualActivities[1].id).toBeLessThan(0);
      });

      it("should reject invalid sport type", async () => {
        const originalExit = process.exit;
        let exitCalled = false;
        process.exit = () => {
          exitCalled = true;
          throw new Error("Exit called");
        };

        try {
          await expect(async () => {
            recordManualActivity({
              command: "activity-record",
              type: "invalid_sport",
              duration: 30,
            });
          }).rejects.toThrow("Exit called");
          expect(exitCalled).toBe(true);
        } finally {
          process.exit = originalExit;
        }
      });
    });

    describe("interview-save with synthetic ID", () => {
      it("should save interview for manual activity", async () => {
        vi.spyOn(console, "log").mockImplementation(() => {});
        recordManualActivity({
          command: "activity-record",
          type: "run",
          duration: 45,
        });

        const db = getDb();
        const manualActivity = db
          .prepare("SELECT id FROM activities WHERE source = 'manual' LIMIT 1")
          .get() as { id: number };

        await saveInterview({
          command: "interview-save",
          workoutId: manualActivity.id,
          reflection: "Felt good",
          notes: "Solid workout",
          confidence: "Medium",
        });

        const interviews = db
          .prepare("SELECT * FROM workout_interviews WHERE workout_id = ?")
          .all(manualActivity.id) as { workout_id: number }[];

        expect(interviews.length).toBe(1);
        expect(interviews[0].workout_id).toBe(manualActivity.id);
      });
    });
  });

  describe("Cross-flow scenarios", () => {
    describe("multiple interviews per workout", () => {
      beforeEach(async () => {
        const configModule = await import("../../src/lib/config.js");
        vi.mocked(configModule.tokensExist).mockReturnValue(true);

        const oauthModule = await import("../../src/strava/oauth.js");
        vi.mocked(oauthModule.getValidTokens).mockResolvedValue({
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        });
      });
      it("should create separate rows for multiple interviews", async () => {
        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "First reflection",
          notes: "First notes",
          confidence: "High",
        });

        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Second reflection",
          notes: "Second notes",
          confidence: "Medium",
        });

        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Third reflection",
          notes: "Third notes",
          confidence: "Low",
        });

        const db = getDb();
        const interviews = db
          .prepare("SELECT * FROM workout_interviews WHERE workout_id = ? ORDER BY created_at")
          .all(1) as {
          id: number;
          workout_id: number;
          athlete_reflection_summary: string;
        }[];

        expect(interviews.length).toBe(3);
        expect(interviews[0].athlete_reflection_summary).toBe("First reflection");
        expect(interviews[1].athlete_reflection_summary).toBe("Second reflection");
        expect(interviews[2].athlete_reflection_summary).toBe("Third reflection");
      });

      it("should show previous interviews in context", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Previous reflection",
          notes: "Previous notes",
          confidence: "High",
        });

        consoleLogSpy.mockClear();

        const configModule = await import("../../src/lib/config.js");
        vi.mocked(configModule.tokensExist).mockReturnValue(true);

        const oauthModule = await import("../../src/strava/oauth.js");
        vi.mocked(oauthModule.getValidTokens).mockResolvedValue({
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        });

        await runInterview({
          command: "interview",
          mode: "specific",
          workoutId: 1,
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output).toHaveProperty("previous_interviews");
        expect(output.previous_interviews).toBeInstanceOf(Array);
        expect(output.previous_interviews.length).toBeGreaterThan(0);

        consoleLogSpy.mockRestore();
      });
    });

    describe("interview count tracking", () => {
      beforeEach(async () => {
        const configModule = await import("../../src/lib/config.js");
        vi.mocked(configModule.tokensExist).mockReturnValue(true);

        const oauthModule = await import("../../src/strava/oauth.js");
        vi.mocked(oauthModule.getValidTokens).mockResolvedValue({
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        });
      });
      it("should correctly count total interviews across all workouts", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Reflection 1",
          notes: "Notes 1",
          confidence: "High",
        });

        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Reflection 2",
          notes: "Notes 2",
          confidence: "Medium",
        });

        await saveInterview({
          command: "interview-save",
          workoutId: 2,
          reflection: "Reflection 3",
          notes: "Notes 3",
          confidence: "High",
        });

        consoleLogSpy.mockClear();

        const configModule = await import("../../src/lib/config.js");
        vi.mocked(configModule.tokensExist).mockReturnValue(true);

        const oauthModule = await import("../../src/strava/oauth.js");
        vi.mocked(oauthModule.getValidTokens).mockResolvedValue({
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        });

        await runInterview({
          command: "interview",
          mode: "specific",
          workoutId: 1,
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output.athlete_interview_count).toBe(3);

        consoleLogSpy.mockRestore();
      });
    });

    describe("preliminary note eligibility", () => {
      beforeEach(async () => {
        const configModule = await import("../../src/lib/config.js");
        vi.mocked(configModule.tokensExist).mockReturnValue(false);
      });

      it("should be false with fewer than 5 interviews", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Reflection",
          notes: "Notes",
          confidence: "High",
        });

        consoleLogSpy.mockClear();

        await runInterview({
          command: "interview",
          mode: "manual",
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output.preliminary_note_eligible).toBe(false);
        consoleLogSpy.mockRestore();
      });

      it("should be true with 5 or more interviews", async () => {
        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const db = getDb();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBefore = new Date(yesterday);
        dayBefore.setDate(dayBefore.getDate() - 1);

        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          3,
          "Test Workout 3",
          "Run",
          yesterday.toISOString(),
          3600,
          3600,
          8000,
          150,
          100,
          "strava"
        );

        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          4,
          "Test Workout 4",
          "Ride",
          yesterday.toISOString(),
          3600,
          3600,
          25000,
          140,
          150,
          "strava"
        );

        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          5,
          "Test Workout 5",
          "Run",
          dayBefore.toISOString(),
          3600,
          3600,
          8000,
          150,
          100,
          "strava"
        );

        for (let i = 0; i < 5; i++) {
          await saveInterview({
            command: "interview-save",
            workoutId: i + 1,
            reflection: `Reflection ${i}`,
            notes: `Notes ${i}`,
            confidence: "High",
          });
        }

        consoleLogSpy.mockClear();

        await runInterview({
          command: "interview",
          mode: "manual",
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output.preliminary_note_eligible).toBe(true);
        consoleLogSpy.mockRestore();
      });

      it("should be false with fewer than 5 interviews", async () => {
        await saveInterview({
          command: "interview-save",
          workoutId: 1,
          reflection: "Reflection",
          notes: "Notes",
          confidence: "High",
        });

        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "manual",
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output.preliminary_note_eligible).toBe(false);
        consoleLogSpy.mockRestore();
      });

      it("should be true with 5 or more interviews", async () => {
        const db = getDb();
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const dayBefore = new Date(yesterday);
        dayBefore.setDate(dayBefore.getDate() - 1);

        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          3,
          "Test Workout 3",
          "Run",
          yesterday.toISOString(),
          3600,
          3600,
          8000,
          150,
          100,
          "strava"
        );

        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          4,
          "Test Workout 4",
          "Ride",
          yesterday.toISOString(),
          3600,
          3600,
          25000,
          140,
          150,
          "strava"
        );

        db.prepare(
          "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time, distance, average_heartrate, suffer_score, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(
          5,
          "Test Workout 5",
          "Run",
          dayBefore.toISOString(),
          3600,
          3600,
          8000,
          150,
          100,
          "strava"
        );

        for (let i = 0; i < 5; i++) {
          await saveInterview({
            command: "interview-save",
            workoutId: i + 1,
            reflection: `Reflection ${i}`,
            notes: `Notes ${i}`,
            confidence: "High",
          });
        }

        const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        await runInterview({
          command: "interview",
          mode: "manual",
          laps: false,
          json: true,
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
        expect(output.preliminary_note_eligible).toBe(true);
        consoleLogSpy.mockRestore();
      });
    });
  });

  describe("Database migrations", () => {
    describe("fresh database", () => {
      it("should apply migrations cleanly to fresh database", async () => {
        const testDir2 = join(tmpdir(), "endurance-coach-migration-fresh-" + Date.now());
        mkdirSync(testDir2, { recursive: true });
        process.env.ENDURANCE_COACH_CONFIG_DIR = testDir2;
        resetDatabaseCache();

        await initDatabase();

        const db = getDb();
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
          .all() as { name: string }[];

        const expectedTables = [
          "activities",
          "schema_migrations",
          "streams",
          "athlete",
          "goals",
          "sync_log",
          "workout_interviews",
          "preliminary_coach_notes",
          "interview_triggers",
        ];

        for (const table of expectedTables) {
          expect(tables.some((t) => t.name === table)).toBe(true);
        }

        rmSync(testDir2, { recursive: true, force: true });
      });
    });

    describe("migration idempotency", () => {
      it("should be safe to run initDatabase multiple times", async () => {
        await initDatabase();

        const { getMigrationStatus } = await import("../../src/db/migrations.js");
        let status = getMigrationStatus();
        const initialCount = status.applied;

        await initDatabase();

        status = getMigrationStatus();
        expect(status.applied).toBe(initialCount);

        const db = getDb();
        const records = db.prepare("SELECT COUNT(*) as count FROM schema_migrations").get() as {
          count: number;
        };
        expect(records.count).toBe(initialCount);
      });
    });
  });

  describe("interviews list command", () => {
    beforeEach(async () => {
      await saveInterview({
        command: "interview-save",
        workoutId: 1,
        reflection: "Felt great today",
        notes: "Good pace control",
        confidence: "High",
      });
      await saveInterview({
        command: "interview-save",
        workoutId: 2,
        reflection: "Tough workout",
        notes: "Struggled with pace",
        confidence: "Medium",
      });
      await saveInterview({
        command: "interview-save",
        workoutId: 1,
        reflection: "Another interview",
        notes: "Consistency is key",
        confidence: "Low",
      });
    });

    it("should return saved interviews", async () => {
      const logSpy = vi.spyOn(log, "info");
      await listInterviews({
        command: "interviews",
        subcommand: "list",
      });

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.at(-1)![0] as string;
      expect(output).toContain("ID");
      expect(output).toContain("Workout");
      expect(output).toContain("Created At");
      expect(output).toContain("Confidence");
      logSpy.mockRestore();
    });

    it("should filter by workout ID", async () => {
      const logSpy = vi.spyOn(log, "info");
      await listInterviews({
        command: "interviews",
        subcommand: "list",
        workout: 1,
      });

      expect(logSpy).toHaveBeenCalled();
      const db = getDb();
      const filteredInterviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { count: number };
      expect(filteredInterviews.count).toBe(2);
      logSpy.mockRestore();
    });

    it("should respect limit parameter", async () => {
      const logSpy = vi.spyOn(log, "info");
      await listInterviews({
        command: "interviews",
        subcommand: "list",
        limit: 2,
      });

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.at(-1)![0] as string;
      const lines = output.split("\n").filter((line) => line.trim().length > 0);
      expect(lines.length).toBeLessThanOrEqual(4);
      logSpy.mockRestore();
    });
  });
});
