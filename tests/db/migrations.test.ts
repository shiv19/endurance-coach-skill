import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";

describe("Database Migrations", () => {
  const testDir = join(tmpdir(), "endurance-coach-migration-test-" + Date.now());
  const dbPath = join(testDir, "coach.db"); // Database is always named coach.db

  // Mock config to use test database
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    process.env.ENDURANCE_COACH_CONFIG_DIR = testDir;

    // Reset database cache to ensure each test gets a fresh connection
    const { resetDatabaseCache } = await import("../../src/db/client.js");
    resetDatabaseCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("Fresh database initialization", () => {
    it("should create schema_migrations table on first run", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      // Check schema_migrations table exists
      const result = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations';"`,
        { encoding: "utf-8" }
      );

      expect(result.trim()).toBe("schema_migrations");
    });

    it("should apply migration 001 to fresh database", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      // Check expected tables exist
      const tables = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`,
        { encoding: "utf-8" }
      );

      const expectedTables = [
        "schema_migrations",
        "activities",
        "streams",
        "athlete",
        "goals",
        "sync_log",
      ];

      for (const table of expectedTables) {
        expect(tables).toContain(table);
      }

      // Check expected indexes exist
      const indexes = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name;"`,
        { encoding: "utf-8" }
      );

      expect(indexes).toContain("idx_activities_date");
      expect(indexes).toContain("idx_activities_sport");
      expect(indexes).toContain("idx_activities_sport_date");

      // Check expected views exist
      const views = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name;"`,
        { encoding: "utf-8" }
      );

      expect(views).toContain("weekly_volume");
      expect(views).toContain("recent_activities");
    });

    it("should apply migration 002 to fresh database", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      // Check expected interview tables exist
      const tables = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`,
        { encoding: "utf-8" }
      );

      const expectedTables = [
        "workout_interviews",
        "preliminary_coach_notes",
        "interview_triggers",
      ];

      for (const table of expectedTables) {
        expect(tables).toContain(table);
      }

      // Check expected indexes exist for interview tables
      const indexes = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name;"`,
        { encoding: "utf-8" }
      );

      expect(indexes).toContain("idx_workout_interviews_workout_id");
      expect(indexes).toContain("idx_workout_interviews_created_at");
      expect(indexes).toContain("idx_workout_interviews_workout_created");
      expect(indexes).toContain("idx_preliminary_notes_workout_id");
    });

    it("should record both migrations in schema_migrations table", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      const { getMigrationStatus } = await import("../../src/db/migrations.js");

      const status = getMigrationStatus();
      expect(status.applied).toBe(2);
      expect(status.latestApplied).toBe("002_interview_tables");
    });
  });

  describe("Migration idempotency", () => {
    it("should be safe to run initDatabase multiple times", async () => {
      const { initDatabase } = await import("../../src/db/client.js");

      // First run
      await initDatabase();

      // Get migration status
      const { getMigrationStatus } = await import("../../src/db/migrations.js");
      let status = getMigrationStatus();
      expect(status.applied).toBe(2);

      // Second run - should be idempotent
      await initDatabase();

      status = getMigrationStatus();
      expect(status.applied).toBe(2); // Still 2, not 4

      // Check only two migrations were recorded
      const records = execSync(
        `sqlite3 "${dbPath}" "SELECT COUNT(*) as count FROM schema_migrations;"`,
        { encoding: "utf-8" }
      );

      expect(parseInt(records.trim())).toBe(2);
    });
  });

  describe("Migration status and queries", () => {
    it("should report correct migration status", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      const { getMigrationStatus } = await import("../../src/db/migrations.js");

      const status = getMigrationStatus();
      expect(status.applied).toBe(2);
      expect(status.pending).toBe(0);
      expect(status.latestApplied).toBe("002_interview_tables");
    });

    it("should correctly check if migration is applied", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      const { isMigrationApplied } = await import("../../src/db/migrations.js");

      expect(isMigrationApplied("001_initial_schema")).toBe(true);
      expect(isMigrationApplied("002_interview_tables")).toBe(true);
    });
  });

  describe("Interview table constraints", () => {
    it("should enforce CHECK constraint on coach_confidence", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      const db = getDb();

      // First create an activity to reference
      db.prepare(
        "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time) VALUES (?, ?, ?, ?, ?)"
      ).run(1, "Test Run", "Run", "2025-01-01T10:00:00Z", 3600);

      // Valid coach_confidence values should work
      const validValues = ["Low", "Medium", "High"];
      for (const value of validValues) {
        expect(() => {
          db.prepare(
            "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
          ).run(1, "Felt good", "Keep it up", value);
        }).not.toThrow();
      }

      // Invalid value should fail
      expect(() => {
        db.prepare(
          "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
        ).run(1, "Felt good", "Keep it up", "Invalid");
      }).toThrow();
    });

    it("should enforce CHECK constraint on interview_triggers.trigger_type", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      const db = getDb();

      // Valid trigger types should work
      const validTypes = ["hr_drift", "pace_deviation", "lap_variability", "early_fade"];
      for (const type of validTypes) {
        expect(() => {
          db.prepare(
            "INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit) VALUES (?, ?, ?)"
          ).run(type, 10.0, "percent");
        }).not.toThrow();
      }

      // Invalid trigger type should fail
      expect(() => {
        db.prepare(
          "INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit) VALUES (?, ?, ?)"
        ).run("invalid_type", 10.0, "percent");
      }).toThrow();
    });

    it("should enforce UNIQUE constraint on interview_triggers.trigger_type", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      const db = getDb();

      // Insert a trigger
      db.prepare(
        "INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit) VALUES (?, ?, ?)"
      ).run("hr_drift", 10.0, "percent");

      // Duplicate should fail
      expect(() => {
        db.prepare(
          "INSERT INTO interview_triggers (trigger_type, threshold_value, threshold_unit) VALUES (?, ?, ?)"
        ).run("hr_drift", 15.0, "percent");
      }).toThrow();
    });
  });

  describe("Foreign key constraints", () => {
    it("should enforce FK constraint on workout_interviews.workout_id", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      const db = getDb();

      // Insert without a valid activity should fail
      expect(() => {
        db.prepare(
          "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
        ).run(999, "Felt good", "Keep it up", "Medium");
      }).toThrow();

      // Create an activity
      db.prepare(
        "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time) VALUES (?, ?, ?, ?, ?)"
      ).run(1, "Test Run", "Run", "2025-01-01T10:00:00Z", 3600);

      // Now insert should work
      expect(() => {
        db.prepare(
          "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
        ).run(1, "Felt good", "Keep it up", "Medium");
      }).not.toThrow();
    });

    it("should enforce FK constraint on preliminary_coach_notes.workout_id", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      const db = getDb();

      // Insert without a valid activity should fail
      expect(() => {
        db.prepare(
          "INSERT INTO preliminary_coach_notes (workout_id, note_draft) VALUES (?, ?)"
        ).run(999, "Draft note");
      }).toThrow();

      // Create an activity
      db.prepare(
        "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time) VALUES (?, ?, ?, ?, ?)"
      ).run(1, "Test Run", "Run", "2025-01-01T10:00:00Z", 3600);

      // Now insert should work
      expect(() => {
        db.prepare(
          "INSERT INTO preliminary_coach_notes (workout_id, note_draft) VALUES (?, ?)"
        ).run(1, "Draft note");
      }).not.toThrow();
    });

    it("should cascade delete when activity is deleted", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      const db = getDb();

      // Create an activity
      db.prepare(
        "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time) VALUES (?, ?, ?, ?, ?)"
      ).run(1, "Test Run", "Run", "2025-01-01T10:00:00Z", 3600);

      // Create interview
      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Felt good", "Keep it up", "Medium");

      // Create preliminary note
      db.prepare("INSERT INTO preliminary_coach_notes (workout_id, note_draft) VALUES (?, ?)").run(
        1,
        "Draft note"
      );

      // Verify they exist
      let interviews = db.prepare("SELECT COUNT(*) as count FROM workout_interviews").get() as {
        count: number;
      };
      let notes = db.prepare("SELECT COUNT(*) as count FROM preliminary_coach_notes").get() as {
        count: number;
      };
      expect(interviews.count).toBe(1);
      expect(notes.count).toBe(1);

      // Delete activity
      db.prepare("DELETE FROM activities WHERE id = ?").run(1);

      // Verify cascade delete worked
      interviews = db.prepare("SELECT COUNT(*) as count FROM workout_interviews").get() as {
        count: number;
      };
      notes = db.prepare("SELECT COUNT(*) as count FROM preliminary_coach_notes").get() as {
        count: number;
      };
      expect(interviews.count).toBe(0);
      expect(notes.count).toBe(0);
    });

    it("should support multiple interviews per workout", async () => {
      const { initDatabase, getDb } = await import("../../src/db/client.js");
      await initDatabase();

      const db = getDb();

      // Create an activity
      db.prepare(
        "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time) VALUES (?, ?, ?, ?, ?)"
      ).run(1, "Test Run", "Run", "2025-01-01T10:00:00Z", 3600);

      // Create multiple interviews for the same workout
      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "First reflection", "First notes", "Medium");

      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Second reflection", "Second notes", "High");

      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Third reflection", "Third notes", "Low");

      // Verify all three exist
      const interviews = db
        .prepare("SELECT COUNT(*) as count FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { count: number };
      expect(interviews.count).toBe(3);
    });
  });

  describe("Backward compatibility", () => {
    it("should work with existing pre-versioning database", async () => {
      // Create a database with old schema.sql structure
      const oldSchema = `
        CREATE TABLE activities (
          id INTEGER PRIMARY KEY,
          name TEXT,
          sport_type TEXT,
          start_date TEXT
        );

        CREATE TABLE streams (
          activity_id INTEGER PRIMARY KEY,
          time_data TEXT,
          FOREIGN KEY (activity_id) REFERENCES activities(id)
        );

        CREATE TABLE athlete (
          id INTEGER PRIMARY KEY,
          firstname TEXT
        );

        CREATE TABLE goals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_name TEXT
        );

        CREATE TABLE sync_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          started_at TEXT
        );
      `;

      execSync(`sqlite3 "${dbPath}" "${oldSchema.replace(/\n/g, " ")}"`);

      // Now initDatabase should add schema_migrations and continue working
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      // Old tables should still exist
      const tables = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"`,
        { encoding: "utf-8" }
      );

      expect(tables).toContain("activities");
      expect(tables).toContain("streams");
      expect(tables).toContain("athlete");
      expect(tables).toContain("goals");
      expect(tables).toContain("sync_log");
      expect(tables).toContain("schema_migrations");
    });
  });
});
