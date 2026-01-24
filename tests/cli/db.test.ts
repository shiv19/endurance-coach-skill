import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import { existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("Database", () => {
  const testDir = join(tmpdir(), "endurance-coach-db-test-" + Date.now());
  const dbPath = join(testDir, "test.db");

  beforeEach(() => {
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("SQLite operations", () => {
    it("should create a database and table", () => {
      const createSql = `CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);`;
      execSync(`sqlite3 "${dbPath}" "${createSql}"`);

      expect(existsSync(dbPath)).toBe(true);
    });

    it("should insert and query data", () => {
      // Create table
      execSync(`sqlite3 "${dbPath}" "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);"`);

      // Insert data
      execSync(`sqlite3 "${dbPath}" "INSERT INTO test (id, name) VALUES (1, 'Alice');"`);
      execSync(`sqlite3 "${dbPath}" "INSERT INTO test (id, name) VALUES (2, 'Bob');"`);

      // Query data
      const result = execSync(`sqlite3 -json "${dbPath}" "SELECT * FROM test ORDER BY id;"`, {
        encoding: "utf-8",
      });

      const rows = JSON.parse(result);
      expect(rows).toHaveLength(2);
      expect(rows[0].name).toBe("Alice");
      expect(rows[1].name).toBe("Bob");
    });

    it("should handle special characters in strings", () => {
      execSync(`sqlite3 "${dbPath}" "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);"`);

      // Insert with escaped single quote
      const name = "O''Reilly";
      execSync(`sqlite3 "${dbPath}" "INSERT INTO test (id, name) VALUES (1, '${name}');"`);

      const result = execSync(`sqlite3 -json "${dbPath}" "SELECT name FROM test WHERE id = 1;"`, {
        encoding: "utf-8",
      });

      const rows = JSON.parse(result);
      expect(rows[0].name).toBe("O'Reilly");
    });

    it("should handle NULL values", () => {
      execSync(
        `sqlite3 "${dbPath}" "CREATE TABLE test (id INTEGER PRIMARY KEY, value REAL, name TEXT);"`
      );
      execSync(`sqlite3 "${dbPath}" "INSERT INTO test (id, value, name) VALUES (1, NULL, NULL);"`);

      const result = execSync(`sqlite3 -json "${dbPath}" "SELECT * FROM test WHERE id = 1;"`, {
        encoding: "utf-8",
      });

      const rows = JSON.parse(result);
      expect(rows[0].value).toBeNull();
      expect(rows[0].name).toBeNull();
    });
  });

  describe("Schema", () => {
    it("should create activities table with correct columns", () => {
      const createSql = `
        CREATE TABLE activities (
          id INTEGER PRIMARY KEY,
          name TEXT,
          sport_type TEXT,
          start_date TEXT,
          distance REAL,
          moving_time INTEGER
        );
      `;
      execSync(`sqlite3 "${dbPath}" "${createSql.replace(/\n/g, " ")}"`);

      // Check table exists
      const result = execSync(
        `sqlite3 "${dbPath}" "SELECT name FROM sqlite_master WHERE type='table' AND name='activities';"`,
        { encoding: "utf-8" }
      );

      expect(result.trim()).toBe("activities");
    });
  });
});
