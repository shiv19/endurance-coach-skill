import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, resetDatabaseCache, getDb } from "../../src/db/client.js";
import {
  saveInterview,
  savePreliminaryNote,
} from "../../src/cli/commands/interview-persistence.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

describe("interview-persistence", () => {
  const testDir = join(tmpdir(), "endurance-coach-interview-persistence-test-" + Date.now());
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

    db.exec(`
      CREATE TABLE IF NOT EXISTS preliminary_coach_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workout_id INTEGER NOT NULL,
        note_draft TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (workout_id) REFERENCES activities(id) ON DELETE CASCADE
      )
    `);

    db.exec("DELETE FROM activities");
    db.prepare(
      "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(1, "Test Run", "Run", "2025-01-01T10:00:00Z", 3600, 3600);
    db.prepare(
      "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(2, "Test Ride", "Ride", "2025-01-02T10:00:00Z", 3600, 3600);
  });

  afterEach(() => {
    process.env = originalEnv;
    resetDatabaseCache();
    rmSync(testDir, { recursive: true, force: true });
  });

  describe("saveInterview", () => {
    it("should save interview with valid inputs", async () => {
      const args = {
        command: "interview-save" as const,
        workoutId: 1,
        reflection: "Felt great today",
        notes: "Good pace control",
        confidence: "High" as const,
      };

      await saveInterview(args);

      const db = getDb();
      const interviews = db.prepare("SELECT * FROM workout_interviews").all() as {
        id: number;
        workout_id: number;
        athlete_reflection_summary: string;
        coach_notes: string;
        coach_confidence: string;
        created_at: string;
      }[];

      expect(interviews).toHaveLength(1);
      expect(interviews[0].workout_id).toBe(1);
      expect(interviews[0].athlete_reflection_summary).toBe("Felt great today");
      expect(interviews[0].coach_notes).toBe("Good pace control");
      expect(interviews[0].coach_confidence).toBe("High");
    });

    it("should exit with error for invalid confidence level", async () => {
      const args = {
        command: "interview-save" as const,
        workoutId: 1,
        reflection: "Felt great today",
        notes: "Good pace control",
        confidence: "Invalid" as "Low" | "Medium" | "High",
      };

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => {
        exitCalled = true;
        throw new Error("Exit called");
      };

      try {
        await expect(async () => {
          await saveInterview(args);
        }).rejects.toThrow("Exit called");
        expect(exitCalled).toBe(true);
      } finally {
        process.exit = originalExit;
      }
    });

    it("should exit with error for empty reflection", async () => {
      const args = {
        command: "interview-save" as const,
        workoutId: 1,
        reflection: "",
        notes: "Good pace control",
        confidence: "High" as const,
      };

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => {
        exitCalled = true;
        throw new Error("Exit called");
      };

      try {
        await expect(async () => {
          await saveInterview(args);
        }).rejects.toThrow("Exit called");
        expect(exitCalled).toBe(true);
      } finally {
        process.exit = originalExit;
      }
    });

    it("should exit with error for empty notes", async () => {
      const args = {
        command: "interview-save" as const,
        workoutId: 1,
        reflection: "Felt great today",
        notes: "",
        confidence: "High" as const,
      };

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => {
        exitCalled = true;
        throw new Error("Exit called");
      };

      try {
        await expect(async () => {
          await saveInterview(args);
        }).rejects.toThrow("Exit called");
        expect(exitCalled).toBe(true);
      } finally {
        process.exit = originalExit;
      }
    });

    it("should exit with error for non-existent workout", async () => {
      const args = {
        command: "interview-save" as const,
        workoutId: 999,
        reflection: "Felt great today",
        notes: "Good pace control",
        confidence: "High" as const,
      };

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => {
        exitCalled = true;
        throw new Error("Exit called");
      };

      try {
        await expect(async () => {
          await saveInterview(args);
        }).rejects.toThrow("Exit called");
        expect(exitCalled).toBe(true);
      } finally {
        process.exit = originalExit;
      }
    });

    it("should save interview with Medium confidence", async () => {
      const args = {
        command: "interview-save" as const,
        workoutId: 1,
        reflection: "Felt okay",
        notes: "Decent effort",
        confidence: "Medium" as const,
      };

      await saveInterview(args);

      const db = getDb();
      const interviews = db.prepare("SELECT * FROM workout_interviews").all() as {
        coach_confidence: string;
      }[];

      expect(interviews[0].coach_confidence).toBe("Medium");
    });

    it("should save interview with Low confidence", async () => {
      const args = {
        command: "interview-save" as const,
        workoutId: 1,
        reflection: "Felt tired",
        notes: "Struggled with pace",
        confidence: "Low" as const,
      };

      await saveInterview(args);

      const db = getDb();
      const interviews = db.prepare("SELECT * FROM workout_interviews").all() as {
        coach_confidence: string;
      }[];

      expect(interviews[0].coach_confidence).toBe("Low");
    });
  });

  describe("savePreliminaryNote", () => {
    it("should save preliminary note with valid inputs", async () => {
      const args = {
        command: "preliminary-note-save" as const,
        workoutId: 1,
        note: "Check HR drift data",
      };

      await savePreliminaryNote(args);

      const db = getDb();
      const notes = db.prepare("SELECT * FROM preliminary_coach_notes").all() as {
        id: number;
        workout_id: number;
        note_draft: string;
        created_at: string;
      }[];

      expect(notes).toHaveLength(1);
      expect(notes[0].workout_id).toBe(1);
      expect(notes[0].note_draft).toBe("Check HR drift data");
    });

    it("should exit with error for empty note", async () => {
      const args = {
        command: "preliminary-note-save" as const,
        workoutId: 1,
        note: "",
      };

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => {
        exitCalled = true;
        throw new Error("Exit called");
      };

      try {
        await expect(async () => {
          await savePreliminaryNote(args);
        }).rejects.toThrow("Exit called");
        expect(exitCalled).toBe(true);
      } finally {
        process.exit = originalExit;
      }
    });

    it("should exit with error for non-existent workout", async () => {
      const args = {
        command: "preliminary-note-save" as const,
        workoutId: 999,
        note: "Check HR drift data",
      };

      const originalExit = process.exit;
      let exitCalled = false;
      process.exit = () => {
        exitCalled = true;
        throw new Error("Exit called");
      };

      try {
        await expect(async () => {
          await savePreliminaryNote(args);
        }).rejects.toThrow("Exit called");
        expect(exitCalled).toBe(true);
      } finally {
        process.exit = originalExit;
      }
    });

    it("should allow multiple notes for different workouts", async () => {
      // Activity id=2 is already inserted in beforeEach
      const db = getDb();

      const args1 = {
        command: "preliminary-note-save" as const,
        workoutId: 1,
        note: "Note for workout 1",
      };

      const args2 = {
        command: "preliminary-note-save" as const,
        workoutId: 2,
        note: "Note for workout 2",
      };

      await savePreliminaryNote(args1);
      await savePreliminaryNote(args2);

      const notes = db
        .prepare("SELECT * FROM preliminary_coach_notes ORDER BY workout_id")
        .all() as {
        workout_id: number;
        note_draft: string;
      }[];

      expect(notes).toHaveLength(2);
      expect(notes[0].workout_id).toBe(1);
      expect(notes[0].note_draft).toBe("Note for workout 1");
      expect(notes[1].workout_id).toBe(2);
      expect(notes[1].note_draft).toBe("Note for workout 2");
    });
  });
});
