/**
 * Expander Types
 *
 * Types for the plan expansion process - converting compact plans to expanded format.
 */

import type { Sport } from "../schema/compact-plan.js";

// ============================================================================
// Expanded Workout
// ============================================================================

/**
 * A fully expanded workout with all variables interpolated.
 */
export interface ExpandedWorkout {
  id: string;
  sport: Sport;
  type: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  primaryZone?: string;
  rpe?: string;
  humanReadable: string;
  completed: boolean;
}

// ============================================================================
// Expanded Day
// ============================================================================

/**
 * A day in the expanded plan.
 */
export interface ExpandedDay {
  date: string; // ISO date: "2025-01-06"
  dayOfWeek: string; // "Monday"
  workouts: ExpandedWorkout[];
}

// ============================================================================
// Expanded Week
// ============================================================================

/**
 * Summary statistics for a training week.
 */
export interface ExpandedWeekSummary {
  totalHours: number;
  bySport: {
    [sport: string]: {
      sessions: number;
      hours: number;
    };
  };
}

/**
 * A week in the expanded plan.
 */
export interface ExpandedWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase: string;
  focus: string;
  targetHours: number;
  days: ExpandedDay[];
  summary: ExpandedWeekSummary;
  isRecoveryWeek: boolean;
}

// ============================================================================
// Expanded Zones
// ============================================================================

/**
 * A calculated heart rate zone.
 */
export interface ExpandedHRZone {
  zone: number;
  name: string;
  percentLow: number;
  percentHigh: number;
  hrLow: number;
  hrHigh: number;
}

/**
 * Full heart rate zone configuration.
 */
export interface ExpandedHRZones {
  lthr: number;
  maxHR?: number;
  restingHR?: number;
  zones: ExpandedHRZone[];
}

/**
 * A calculated pace zone.
 */
export interface ExpandedPaceZone {
  zone: string;
  name: string;
  pace: string;
  paceSeconds: number;
}

/**
 * Full pace zone configuration.
 */
export interface ExpandedPaceZones {
  thresholdPace: string;
  thresholdPaceSeconds: number;
  zones: ExpandedPaceZone[];
}

/**
 * All athlete zones after calculation.
 */
export interface ExpandedAthleteZones {
  run?: {
    hr?: ExpandedHRZones;
    pace?: ExpandedPaceZones;
  };
  bike?: {
    hr?: ExpandedHRZones;
  };
  maxHR?: number;
  restingHR?: number;
}

// ============================================================================
// Expanded Phase
// ============================================================================

/**
 * A training phase in the expanded plan.
 */
export interface ExpandedPhase {
  name: string;
  startWeek: number;
  endWeek: number;
  focus: string;
  weeklyHoursRange: { low: number; high: number };
  keyWorkouts: string[];
  physiologicalGoals: string[];
}

// ============================================================================
// Expanded Plan Metadata
// ============================================================================

/**
 * Metadata for the expanded plan.
 */
export interface ExpandedPlanMeta {
  id: string;
  athlete: string;
  event: string;
  eventDate: string;
  planStartDate: string;
  planEndDate: string;
  createdAt: string;
  updatedAt: string;
  totalWeeks: number;
  generatedBy: string;
}

// ============================================================================
// Complete Expanded Plan
// ============================================================================

/**
 * Unit preferences for the expanded plan.
 */
export interface ExpandedUnitPreferences {
  swim: "meters" | "yards";
  bike: "kilometers" | "miles";
  run: "kilometers" | "miles";
  firstDayOfWeek: "monday" | "sunday";
}

/**
 * The complete expanded training plan.
 * This format is consumed by the HTML renderer.
 */
export interface ExpandedPlan {
  version: "1.0";
  meta: ExpandedPlanMeta;
  preferences: ExpandedUnitPreferences;
  zones: ExpandedAthleteZones;
  phases: ExpandedPhase[];
  weeks: ExpandedWeek[];
  raceStrategy?: Record<string, unknown>;
}

// ============================================================================
// Expansion Options
// ============================================================================

/**
 * Options for the expansion process.
 */
export interface ExpansionOptions {
  /** The start date for the plan (defaults to calculating from event date) */
  startDate?: Date;

  /** Whether to validate template references */
  validateTemplates?: boolean;

  /** Whether to include structured workout data (for device export) */
  includeStructure?: boolean;
}
