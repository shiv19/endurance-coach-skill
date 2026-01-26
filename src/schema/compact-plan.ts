/**
 * Compact Training Plan Schema
 *
 * A minimal schema for AI models to generate training plans.
 * The compact format is expanded to the full format for HTML rendering.
 *
 * Key design principles:
 * - Minimal output for models to generate
 * - Template references instead of full workout definitions
 * - Athlete paces/zones as inputs, system calculates ranges
 */

// ============================================================================
// MARK: Core Types
// ============================================================================

export type Sport = "swim" | "bike" | "run" | "strength" | "brick" | "race" | "rest";

export type FirstDayOfWeek = "monday" | "sunday";

export type DistanceUnit = "km" | "mi";

// ============================================================================
// MARK: Athlete Configuration
// ============================================================================

/**
 * Athlete's pace values for different workout intensities.
 * Models specify these once, templates interpolate them.
 */
export interface AthletePaces {
  // Running paces (string format: "MM:SS/mi" or "MM:SS/km")
  easy?: string;
  long?: string;
  tempo?: string;
  threshold?: string;
  marathon?: string;
  halfMarathon?: string;
  interval?: string;
  // Interval-specific paces
  r200?: string;
  r400?: string;
  r800?: string;
  r1k?: string;
  rMile?: string;
  // Cycling (watts or % FTP)
  bikeFtp?: number;
  bikeEasy?: string;
  bikeTempo?: string;
  bikeThreshold?: string;
  // Swimming (per 100m/100yd)
  swimCss?: string;
  swimEasy?: string;
  swimTempo?: string;
}

/**
 * Heart rate zone configuration.
 * Only LTHR required - zone ranges are calculated automatically.
 */
export interface HRZoneConfig {
  lthr: number;
  maxHR?: number;
  restingHR?: number;
}

/**
 * Athlete's training zones.
 * Minimal input, system calculates full zone ranges.
 */
export interface AthleteZones {
  hr?: HRZoneConfig;
  // Future: power zones, pace zones, swim zones
}

/**
 * Athlete preferences and constraints.
 */
export interface AthleteConstraints {
  daysPerWeek?: number | string; // e.g., 5 or "4-5"
  preferredDays?: string[]; // e.g., ["Mon", "Wed", "Fri", "Sat", "Sun"]
  maxLongRunHours?: number;
  maxLongBikeHours?: number;
  notes?: string[];
}

/**
 * Complete athlete configuration in compact format.
 */
export interface CompactAthlete {
  name: string;
  event: string;
  eventDate: string; // ISO date: "2025-03-02"
  startDate?: string; // Explicit plan start date (ISO format: "2025-02-17")
  paces: AthletePaces;
  zones?: AthleteZones;
  constraints?: AthleteConstraints;
  unit?: DistanceUnit; // Default: "km"
  firstDayOfWeek?: FirstDayOfWeek; // Default: "monday"
}

// ============================================================================
// MARK: Assessment (Optional)
// ============================================================================

/**
 * Strength or limiter entry in the assessment.
 */
export interface CompactAssessmentEntry {
  sport: Sport;
  evidence: string;
}

/**
 * Athlete assessment for context on their training background.
 */
export interface CompactAssessment {
  foundation?: {
    raceHistory?: string[];
    peakTrainingLoad?: number;
    foundationLevel?: "beginner" | "intermediate" | "advanced" | "elite";
    yearsInSport?: number;
  };
  currentForm?: {
    weeklyVolume?: {
      total?: number;
      swim?: number;
      bike?: number;
      run?: number;
    };
    longestSessions?: {
      swim?: number;
      bike?: number;
      run?: number;
    };
    consistency?: number;
  };
  strengths?: CompactAssessmentEntry[];
  limiters?: CompactAssessmentEntry[];
  constraints?: string[];
}

// ============================================================================
// MARK: Training Phases
// ============================================================================

/**
 * A training phase defines a block of focused training.
 * Weeks can be a range string or array of week numbers.
 */
export interface CompactPhase {
  name: string;
  weeks: string | number[]; // "1-3" or [1, 2, 3]
  focus: string;
  keyWorkouts?: string[];
}

// ============================================================================
// MARK: Weekly Schedule
// ============================================================================

/**
 * A workout reference is a template ID with optional parameters.
 *
 * Format: "template.id" or "template.id(param)" or "template.id(param1, param2)"
 *
 * Examples:
 *   - "easy(30)" → easy run, 30 minutes
 *   - "intervals.400(6)" → 6x400m intervals
 *   - "long(90)" → 90-minute long run
 *   - "rest" → rest day (no params)
 *   - "tempo(20)" → 20-minute tempo section
 */
export type WorkoutRef = string;

/**
 * Day of the week as used in the schedule.
 */
export type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

/**
 * A week's workout schedule maps days to workout references.
 * Days without workouts are implicitly rest days.
 */
export interface CompactWeekSchedule {
  [day: string]: WorkoutRef | WorkoutRef[]; // Single workout or multiple (e.g., brick day)
}

/**
 * A training week in the compact format.
 */
export interface CompactWeek {
  week: number;
  phase: string; // Must match a phase name
  focus?: string; // Optional week-specific focus
  isRecoveryWeek?: boolean;
  targetHours?: number;
  workouts: CompactWeekSchedule;
}

// ============================================================================
// MARK: Race Strategy (Optional)
// ============================================================================

/**
 * Simplified race strategy for the compact format.
 */
export interface CompactRaceStrategy {
  goalTime?: string;
  pacing?: {
    swim?: string;
    bike?: string;
    run?: string;
  };
  nutrition?: string;
  notes?: string[];
}

// ============================================================================
// MARK: Complete Compact Plan
// ============================================================================

/**
 * The complete compact training plan.
 *
 * This is what AI models generate. It's transformed to the full
 * expanded format for HTML rendering and device export.
 */
export interface CompactPlan {
  version: "2.0";
  athlete: CompactAthlete;
  assessment?: CompactAssessment;
  phases: CompactPhase[];
  weeks: CompactWeek[];
  raceStrategy?: CompactRaceStrategy;
}

// ============================================================================
// MARK: Utility Types
// ============================================================================

/**
 * Parsed workout reference.
 */
export interface ParsedWorkoutRef {
  templateId: string;
  params: (string | number)[];
}

/**
 * Parse a workout reference string into its components.
 *
 * Examples:
 *   "easy(30)" → { templateId: "easy", params: [30] }
 *   "intervals.400(6)" → { templateId: "intervals.400", params: [6] }
 *   "rest" → { templateId: "rest", params: [] }
 *   "tempo(20, 90)" → { templateId: "tempo", params: [20, 90] }
 */
export function parseWorkoutRef(ref: string): ParsedWorkoutRef {
  const match = ref.match(/^([a-zA-Z0-9_.]+)(?:\(([^)]*)\))?$/);
  if (!match) {
    throw new Error(`Invalid workout reference: "${ref}"`);
  }

  const templateId = match[1];
  const paramsStr = match[2];

  let params: (string | number)[] = [];
  if (paramsStr) {
    params = paramsStr.split(",").map((p) => {
      const trimmed = p.trim();
      const num = Number(trimmed);
      return isNaN(num) ? trimmed : num;
    });
  }

  return { templateId, params };
}

/**
 * Parse a week range string into an array of week numbers.
 *
 * Examples:
 *   "1-3" → [1, 2, 3]
 *   "4-6" → [4, 5, 6]
 *   [1, 2, 3] → [1, 2, 3] (passthrough)
 */
export function parseWeekRange(weeks: string | number[]): number[] {
  if (Array.isArray(weeks)) {
    return weeks;
  }

  const match = weeks.match(/^(\d+)-(\d+)$/);
  if (!match) {
    throw new Error(`Invalid week range: "${weeks}"`);
  }

  const start = parseInt(match[1], 10);
  const end = parseInt(match[2], 10);

  if (start > end) {
    throw new Error(`Invalid week range: start (${start}) > end (${end})`);
  }

  const result: number[] = [];
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  return result;
}
