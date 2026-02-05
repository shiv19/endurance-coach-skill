import { initDatabase, getDb } from "../../db/client.js";
import { log } from "../../lib/logging.js";
import type { InterviewSaveArgs, PreliminaryNoteSaveArgs } from "../args.js";

// ============================================================================
// MARK: Types
// ============================================================================

interface CreatedInterview {
  id: number;
  created_at: string;
}

interface CreatedPreliminaryNote {
  id: number;
  created_at: string;
}

const VALID_CONFIDENCE_LEVELS = new Set(["Low", "Medium", "High"]);

// ============================================================================
// MARK: Validation Helpers
// ============================================================================

function validateConfidence(confidence: string): void {
  if (!VALID_CONFIDENCE_LEVELS.has(confidence)) {
    log.error(
      `Invalid confidence level: ${confidence}. Must be one of: ${Array.from(
        VALID_CONFIDENCE_LEVELS
      ).join(", ")}`
    );
    process.exit(1);
  }
}

function validateWorkoutExists(workoutId: number): void {
  const db = getDb();
  const workout = db.prepare("SELECT id FROM activities WHERE id = ?").get(workoutId);
  if (!workout) {
    log.error(`Workout with ID ${workoutId} not found`);
    process.exit(1);
  }
}

function validateNonEmpty(value: string, fieldName: string): void {
  if (!value || value.trim().length === 0) {
    log.error(`${fieldName} cannot be empty`);
    process.exit(1);
  }
}

// ============================================================================
// MARK: Interview Save Command
// ============================================================================

export async function saveInterview(args: InterviewSaveArgs): Promise<void> {
  await initDatabase();

  validateConfidence(args.confidence);
  validateNonEmpty(args.reflection, "reflection");
  validateNonEmpty(args.notes, "notes");
  validateWorkoutExists(args.workoutId);

  const db = getDb();

  const result = db
    .prepare(
      `
      INSERT INTO workout_interviews (workout_id, athlete_reflection_summary, coach_notes, coach_confidence)
      VALUES (?, ?, ?, ?)
      `
    )
    .run(args.workoutId, args.reflection, args.notes, args.confidence);

  const response: CreatedInterview = {
    id: result.lastInsertRowid as number,
    created_at: new Date().toISOString(),
  };

  console.log(JSON.stringify(response, null, 2));
}

// ============================================================================
// MARK: Preliminary Note Save Command
// ============================================================================

export async function savePreliminaryNote(args: PreliminaryNoteSaveArgs): Promise<void> {
  await initDatabase();

  validateNonEmpty(args.note, "note");
  validateWorkoutExists(args.workoutId);

  const db = getDb();

  const result = db
    .prepare(
      `
      INSERT OR REPLACE INTO preliminary_coach_notes (workout_id, note_draft)
      VALUES (?, ?)
      `
    )
    .run(args.workoutId, args.note);

  const response: CreatedPreliminaryNote = {
    id: result.lastInsertRowid as number,
    created_at: new Date().toISOString(),
  };

  console.log(JSON.stringify(response, null, 2));
}
