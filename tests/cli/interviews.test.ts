import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initDatabase, resetDatabaseCache, getDb } from "../../src/db/client.js";
import {
  queryInterviews,
  queryInterviewById,
  listInterviews,
  getInterview,
} from "../../src/cli/commands/interviews.js";
import { log } from "../../src/lib/logging.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";

describe("interviews", () => {
  const testDir = join(tmpdir(), "endurance-coach-interviews-test-" + Date.now());
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    process.env.ENDURANCE_COACH_CONFIG_DIR = testDir;
    resetDatabaseCache();
    await initDatabase();
    const db = getDb();

    db.exec("DELETE FROM workout_interviews");
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

  describe("queryInterviews", () => {
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

    it("should return all interviews with no filters", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const interviews = await queryInterviews(args);

      expect(interviews).toHaveLength(3);
      expect(interviews[0]).toHaveProperty("id");
      expect(interviews[0]).toHaveProperty("workout_id");
      expect(interviews[0]).toHaveProperty("created_at");
      expect(interviews[0]).toHaveProperty("coach_confidence");
      expect(interviews[0]).toHaveProperty("athlete_reflection_summary");
    });

    it("should return interviews filtered by workout ID", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
        workout: 1,
      };

      const interviews = await queryInterviews(args);

      expect(interviews).toHaveLength(2);
      expect(interviews.every((i) => i.workout_id === 1)).toBe(true);
    });

    it("should return interviews with custom limit", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
        limit: 1,
      };

      const interviews = await queryInterviews(args);

      expect(interviews).toHaveLength(1);
    });

    it("should respect default limit of 10", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const interviews = await queryInterviews(args);

      expect(interviews).toHaveLength(3);
    });

    it("should return empty array when database is empty", async () => {
      const db = getDb();
      db.exec("DELETE FROM workout_interviews");

      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const interviews = await queryInterviews(args);

      expect(interviews).toHaveLength(0);
    });

    it("should return interviews ordered by created_at DESC", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const interviews = await queryInterviews(args);

      expect(interviews.length).toBeGreaterThan(1);
      const dates = interviews.map((i) => new Date(i.created_at).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });
  });

  describe("queryInterviewById", () => {
    beforeEach(async () => {
      const db = getDb();

      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Felt great today", "Good pace control", "High");
    });

    it("should return interview by ID with all fields", async () => {
      const db = getDb();
      const interview = db
        .prepare("SELECT id FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { id: number };

      const result = await queryInterviewById(interview.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(interview.id);
      expect(result!.workout_id).toBe(1);
      expect(result!.athlete_reflection_summary).toBe("Felt great today");
      expect(result!.coach_notes).toBe("Good pace control");
      expect(result!.coach_confidence).toBe("High");
      expect(result!.created_at).toBeDefined();
    });

    it("should return null for non-existent interview", async () => {
      const result = await queryInterviewById(999);

      expect(result).toBeNull();
    });

    it("should return interview with all required fields", async () => {
      const db = getDb();
      const interview = db
        .prepare("SELECT id FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { id: number };

      const result = await queryInterviewById(interview.id);

      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("workout_id");
      expect(result).toHaveProperty("created_at");
      expect(result).toHaveProperty("coach_confidence");
      expect(result).toHaveProperty("athlete_reflection_summary");
      expect(result).toHaveProperty("coach_notes");
    });
  });

  describe("listInterviews", () => {
    beforeEach(async () => {
      const db = getDb();

      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Felt great today", "Good pace control", "High");
    });

    it("should log message when no interviews found", async () => {
      const db = getDb();
      db.exec("DELETE FROM workout_interviews");

      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const logInfoSpy = vi.spyOn(log, "info");
      await listInterviews(args);

      expect(logInfoSpy).toHaveBeenCalledWith("No interviews found.");
      logInfoSpy.mockRestore();
    });

    it("should log formatted table when interviews exist", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "list" as const,
      };

      const logInfoSpy = vi.spyOn(log, "info");
      await listInterviews(args);

      expect(logInfoSpy).toHaveBeenCalled();
      logInfoSpy.mockRestore();
    });
  });

  describe("getInterview", () => {
    beforeEach(async () => {
      const db = getDb();

      db.prepare(
        "INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence) VALUES (?, ?, ?, ?)"
      ).run(1, "Felt great today", "Good pace control", "High");
    });

    it("should log error and exit for non-existent interview", async () => {
      const args = {
        command: "interviews" as const,
        subcommand: "get" as const,
        interviewId: 999,
      };

      const logErrorSpy = vi.spyOn(log, "error");
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
        expect(logErrorSpy).toHaveBeenCalledWith("Interview with ID 999 not found");
      } finally {
        process.exit = originalExit;
        logErrorSpy.mockRestore();
      }
    });

    it("should log interview JSON when found", async () => {
      const db = getDb();
      const interview = db
        .prepare("SELECT id FROM workout_interviews WHERE workout_id = ?")
        .get(1) as { id: number };

      const args = {
        command: "interviews" as const,
        subcommand: "get" as const,
        interviewId: interview.id,
      };

      const logInfoSpy = vi.spyOn(log, "info");
      await getInterview(args);

      expect(logInfoSpy).toHaveBeenCalled();
      const jsonCall = logInfoSpy.mock.calls.find((call) =>
        (call[0] as string).trim().startsWith("{")
      );
      expect(jsonCall).toBeDefined();
      const parsed = JSON.parse(jsonCall![0] as string);
      expect(parsed.id).toBe(interview.id);
      logInfoSpy.mockRestore();
    });
  });
});
