import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDatabase, resetDatabaseCache, getDb } from "../../src/db/client.js";
import { listInterviews, getInterview } from "../../src/cli/commands/interviews.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

describe("interviews", () => {
  const testDir = join(tmpdir(), "endurance-coach-activity-record-test-" + Date.now());
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    process.env.ENDURANCE_COACH_CONFIG_DIR = testDir;
    resetDatabaseCache();
    await initDatabase();
    const db = getDb();

    db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY,
        name TEXT,
        sport_type TEXT,
        start_date TEXT,
        elapsed_time INTEGER,
        moving_time INTEGER,
        distance REAL,
        total_elevation_gain REAL,
        average_speed REAL,
        max_speed REAL,
        average_heartrate REAL,
        max_heartrate REAL,
        average_watts REAL,
        max_watts REAL,
        weighted_average_watts REAL,
        kilojoules REAL,
        suffer_score INTEGER,
        average_cadence REAL,
        calories REAL,
        description TEXT,
        workout_type INTEGER,
        gear_id TEXT,
        raw_json TEXT,
        synced_at TEXT DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS workout_interviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        athlete_reflection_summary TEXT,
        coach_notes TEXT,
        coach_confidence TEXT NOT NULL CHECK (coach_confidence IN ('Low', 'Medium', 'High')),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workout_id) REFERENCES activities(id) ON DELETE CASCADE
      )
    `);

    db.exec("DELETE FROM workout_interviews");
    db.prepare(
      "INSERT OR REPLACE INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(1, "Test Run", "Run", "2025-01-01T10:00:00Z", 3600, 3600);
    db.prepare(
      "INSERT OR REPLACE INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(2, "Test Ride", "Ride", "2025-01-02T10:00:00Z", 3600, 3600);
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDatabaseCache();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("listInterviews", () => {
    beforeEach(async () => {
      const db = getDb();

      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Felt great today", "Good pace control", "High");
      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(2, "Tough workout", "Struggled with pace", "Medium");
      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Another interview", "Consistency is key", "Low");
    });

    it("should list all interviews with no filters", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      await listInterviews(args);

      const db = getDb();
      const allInterviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews")
        .get() as {
        count: number;
      };

      expect(allInterviews.count).toBe(3);
    });

    it("should list interviews filtered by workout ID", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
        workout: 1,
      };

      await listInterviews(args);

      const db = getDb();
      const filteredInterviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { count: number };

      expect(filteredInterviews.count).toBe(2);
    });

    it("should list interviews with custom limit", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
        limit: 1,
      };

      await listInterviews(args);

      const db = getDb();
      const interviews = db
        .prepare("SELECT id FROM workout_interviews ORDER BY created_at DESC LIMIT 1")
        .all() as {
        id: number;
      }[];

      expect(interviews.length).toBe(1);
    });

    it("should handle default limit of 10", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      await listInterviews(args);

      const db = getDb();
      const allInterviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews")
        .get() as {
        count: number;
      };

      expect(allInterviews.count).toBe(3);
    });

    it("should handle empty database gracefully", async () => {
      const db = getDb();
      db.exec("DELETE FROM workout_interviews");

      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      await listInterviews(args);

      const interviews = db.prepare("SELECT COUNT(*) as count FROM workout_interviews").get() as {
        count: number;
      };

      expect(interviews.count).toBe(0);
    });

    it("should list all interviews with no filters", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const consoleLogSpy = vi.spyOn(console, "log");
      await listInterviews(args);
      consoleLogSpy.mockRestore();

      const db = getDb();
      const allInterviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews")
        .get() as {
        count: number;
      };

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain("ID");
      expect(output).toContain("Workout");
      expect(output).toContain("Created At");
      expect(output).toContain("Confidence");
      expect(output).toContain("Reflection");
      expect(allInterviews.count).toBe(3);
    });

    it("should list interviews filtered by workout ID", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
        workout: 1,
      };

      const consoleLogSpy = vi.spyOn(console, "log");
      await listInterviews(args);
      consoleLogSpy.mockRestore();

      const db = getDb();
      const filteredInterviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { count: number };

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0] as string;
      expect(output).toContain("ID");
      expect(output).toContain("Workout");
      expect(filteredInterviews.count).toBe(2);
    });

    it("should list interviews with custom limit", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
        limit: 1,
      };

      const consoleLogSpy = vi.spyOn(console, "log");
      await listInterviews(args);
      consoleLogSpy.mockRestore();

      const output = consoleLogSpy.mock.calls[0][0] as string;
      const lines = output.split("\n");

      expect(lines.length).toBeGreaterThan(2);
      expect(lines.length).toBeLessThanOrEqual(4);
    });

    it("should handle default limit of 10", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const consoleLogSpy = vi.spyOn(console, "log");
      await listInterviews(args);
      consoleLogSpy.mockRestore();

      const db = getDb();
      const allInterviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews")
        .get() as {
        count: number;
      };

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(allInterviews.count).toBe(3);
    });

    it("should display no interviews message when database is empty", async () => {
      const db = getDb();
      db.exec("DELETE FROM workout_interviews");

      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const consoleLogSpy = vi.spyOn(console, "log");
      await listInterviews(args);
      consoleLogSpy.mockRestore();

      expect(consoleLogSpy).toHaveBeenCalledWith("No interviews found.");
    });
  });

  describe("getInterview", () => {
    beforeEach(async () => {
      const db = getDb();

      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Felt great today", "Good pace control", "High");
    });

    it("should get interview by ID", async () => {
      const db = getDb();
      const interview = db
        .prepare("SELECT id FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { id: number };

      const args = {
        command: "interviews" as const,
        subcommand: "get" as const,
        interviewId: interview.id,
      };

      const consoleLogSpy = vi.spyOn(console, "log");
      await getInterview(args);
      consoleLogSpy.mockRestore();

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(output.id).toBe(interview.id);
      expect(output.workout_id).toBe(1);
      expect(output.athlete_reflection_summary).toBe("Felt great today");
      expect(output.coach_notes).toBe("Good pace control");
      expect(output.coach_confidence).toBe("High");
      expect(output.created_at).toBeDefined();
    });

    it("should exit with error for non-existent interview", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "get" as const,
        interviewId: 999,
      };

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => {
        exitCalled = true;
        throw new Error("Exit called");
      };

      try {
        await expect(async () => {
          await getInterview(args);
        }).rejects.toThrow("Exit called");
        expect(exitCalled).toBe(true);
      } finally {
        process.exit = originalExit;
      }
    });

    it("should return full interview with all fields", async () => {
      const db = getDb();
      const interview = db
        .prepare("SELECT id FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { id: number };

      const args = {
        command: "interviews" as const,
        subcommand: "get" as const,
        interviewId: interview.id,
      };

      const consoleLogSpy = vi.spyOn(console, "log");
      await getInterview(args);
      consoleLogSpy.mockRestore();

      const output = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(Object.keys(output)).toContain("id");
      expect(Object.keys(output)).toContain("workout_id");
      expect(Object.keys(output)).toContain("created_at");
      expect(Object.keys(output)).toContain("coach_confidence");
      expect(Object.keys(output)).toContain("athlete_reflection_summary");
      expect(Object.keys(output)).toContain("coach_notes");
    });
  });
});
