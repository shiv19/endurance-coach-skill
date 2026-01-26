/**
 * Workout Template Types
 *
 * Templates define reusable workout structures with parametrized values.
 * They're referenced in compact plans and expanded with athlete-specific data.
 */

import type { Sport } from "../schema/compact-plan.js";

// ============================================================================
// MARK: Template Parameters
// ============================================================================

/**
 * Parameter types for template variables.
 */
export type ParamType = "int" | "number" | "duration" | "distance" | "string";

/**
 * A template parameter definition.
 */
export interface TemplateParam {
  type: ParamType;
  required?: boolean;
  default?: number | string;
  min?: number;
  max?: number;
  description?: string;
}

/**
 * Map of parameter names to their definitions.
 */
export interface TemplateParams {
  [paramName: string]: TemplateParam;
}

// ============================================================================
// MARK: Workout Structure
// ============================================================================

/**
 * Step types within a structured workout.
 */
export type StepType = "warmup" | "work" | "recovery" | "rest" | "cooldown";

/**
 * A single step in a workout structure.
 * Values can include ${variable} interpolation.
 */
export interface TemplateStep {
  type: StepType;
  name?: string;
  duration?: string; // "10min", "${warmup_mins}min", "5:00"
  distance?: string; // "400m", "${distance}m", "1km"
  pace?: string; // "${paces.easy}", "${paces.r400}"
  intensity?: string; // "Zone 2", "RPE 7-8"
  description?: string;
}

/**
 * An interval set with work/recovery pattern.
 */
export interface TemplateIntervalSet {
  type: "intervals";
  repeats: string; // "${reps}" or literal number as string
  work: TemplateStep;
  recovery: TemplateStep;
}

/**
 * The main section can be simple steps or interval sets.
 */
export type MainSetElement = TemplateStep | TemplateIntervalSet;

/**
 * Structured workout with warmup, main, and cooldown sections.
 */
export interface TemplateStructure {
  warmup?: TemplateStep[];
  main: MainSetElement[];
  cooldown?: TemplateStep[];
}

// ============================================================================
// MARK: Complete Template
// ============================================================================

/**
 * Workout category for organization.
 */
export type WorkoutCategory =
  | "rest"
  | "recovery"
  | "endurance"
  | "aerobic"
  | "tempo"
  | "threshold"
  | "intervals"
  | "speed"
  | "hills"
  | "race"
  | "strength"
  | "power"
  | "maintenance"
  | "technique";

/**
 * A complete workout template.
 */
export interface WorkoutTemplate {
  /** Unique template identifier, e.g., "intervals.400", "easy", "tempo" */
  id: string;

  /** Human-readable name, e.g., "400m Repeats", "Easy Run" */
  name: string;

  /** Sport type */
  sport: Sport;

  /** Workout type for classification */
  type: string;

  /** Category for grouping */
  category: WorkoutCategory;

  /** Template parameters with defaults and validation */
  params?: TemplateParams;

  /** Structured workout (optional, for device export) */
  structure?: TemplateStructure;

  /**
   * Human-readable workout description.
   * Supports ${variable} interpolation.
   * This becomes the workout's humanReadable field after expansion.
   */
  humanReadable: string;

  /**
   * Estimated duration calculation.
   * Can be a number (minutes) or expression string.
   * E.g., "${10 + (reps * 3.5) + 10}" or "30"
   */
  estimatedDuration?: string | number;

  /** Target training zone, e.g., "Z2", "Z4-Z5" */
  targetZone?: string;

  /** RPE range, e.g., "6-7", "8-9" */
  rpe?: string;

  /** Additional notes about the workout */
  notes?: string;
}

// ============================================================================
// MARK: Template Registry
// ============================================================================

/**
 * A registry of all available workout templates.
 */
export interface TemplateRegistry {
  /** All templates indexed by ID */
  templates: Map<string, WorkoutTemplate>;

  /** Get a template by ID */
  get(id: string): WorkoutTemplate | undefined;

  /** List all templates, optionally filtered by sport */
  list(sport?: Sport): WorkoutTemplate[];

  /** Check if a template exists */
  has(id: string): boolean;

  /** Get all template IDs */
  ids(): string[];

  /** Get the source of a template (user or builtin) */
  getSource?(id: string): "user" | "builtin" | undefined;

  /** Get the file path of a template */
  getSourcePath?(id: string): string | undefined;
}

// ============================================================================
// MARK: Interpolation Context
// ============================================================================

/**
 * Context provided during template interpolation.
 */
export interface InterpolationContext {
  /** Athlete's pace values */
  paces: Record<string, string | undefined>;

  /** Athlete's zone configuration */
  zones?: {
    hr?: {
      lthr: number;
      [zone: string]: number | undefined;
    };
    [key: string]: unknown;
  };

  /** Template parameters (reps, duration, etc.) */
  [param: string]: unknown;
}

// ============================================================================
// MARK: Expanded Workout
// ============================================================================

/**
 * A workout after template expansion.
 * All ${variables} have been replaced with actual values.
 */
export interface ExpandedWorkout {
  id: string;
  sport: Sport;
  type: string;
  name: string;
  description?: string;
  durationMinutes?: number;
  humanReadable: string;
  targetZone?: string;
  rpe?: string;
  completed: boolean;
}
