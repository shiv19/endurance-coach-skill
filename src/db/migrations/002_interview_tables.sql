-- Migration 002: Interview tables
-- Creates tables for interview persistence and trigger configuration

-- ============================================================================
-- Workout interviews
-- ============================================================================

CREATE TABLE IF NOT EXISTS workout_interviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL,
  athlete_reflection_summary TEXT,
  coach_notes TEXT,
  coach_confidence TEXT NOT NULL CHECK (coach_confidence IN ('Low', 'Medium', 'High')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workout_id) REFERENCES activities(id) ON DELETE CASCADE
);

-- Indexes for performance and pattern detection queries
CREATE INDEX IF NOT EXISTS idx_workout_interviews_workout_id ON workout_interviews(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_interviews_created_at ON workout_interviews(created_at);
CREATE INDEX IF NOT EXISTS idx_workout_interviews_workout_created ON workout_interviews(workout_id, created_at);

-- ============================================================================
-- Preliminary coach notes
-- ============================================================================

CREATE TABLE IF NOT EXISTS preliminary_coach_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL,
  note_draft TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (workout_id) REFERENCES activities(id) ON DELETE CASCADE
);

-- Index for looking up preliminary notes by workout
CREATE INDEX IF NOT EXISTS idx_preliminary_notes_workout_id ON preliminary_coach_notes(workout_id);

-- ============================================================================
-- Interview triggers
-- ============================================================================

CREATE TABLE IF NOT EXISTS interview_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger_type TEXT NOT NULL UNIQUE,
  threshold_value REAL NOT NULL,
  threshold_unit TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (trigger_type IN ('hr_drift', 'pace_deviation', 'lap_variability', 'early_fade'))
);
