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

    it("should record migration in schema_migrations table", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      const { getMigrationStatus } = await import("../../src/db/migrations.js");

      const status = getMigrationStatus();
      expect(status.applied).toBe(1);
      expect(status.latestApplied).toBe("001_initial_schema");
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
      expect(status.applied).toBe(1);

      // Second run - should be idempotent
      await initDatabase();

      status = getMigrationStatus();
      expect(status.applied).toBe(1); // Still 1, not 2

      // Check only one migration was recorded
      const records = execSync(
        `sqlite3 "${dbPath}" "SELECT COUNT(*) as count FROM schema_migrations;"`,
        { encoding: "utf-8" }
      );

      expect(parseInt(records.trim())).toBe(1);
    });
  });

  describe("Migration status and queries", () => {
    it("should report correct migration status", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      const { getMigrationStatus } = await import("../../src/db/migrations.js");

      const status = getMigrationStatus();
      expect(status.applied).toBe(1);
      expect(status.pending).toBe(0);
      expect(status.latestApplied).toBe("001_initial_schema");
    });

    it("should correctly check if migration is applied", async () => {
      const { initDatabase } = await import("../../src/db/client.js");
      await initDatabase();

      const { isMigrationApplied } = await import("../../src/db/migrations.js");

      expect(isMigrationApplied("001_initial_schema")).toBe(true);
      expect(isMigrationApplied("002_add_interviews")).toBe(false);
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
