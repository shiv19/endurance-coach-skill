/**
 * Endurance Coach - Training Plan Generator
 *
 * Public API for validating and working with training plans.
 */

// Full Schema validation (v1.0 - expanded format)
export {
  // Validation functions
  validatePlan,
  validatePlanOrThrow,
  formatValidationErrors,
  getJsonSchema,
  // Main schema
  TrainingPlanSchema,
  // Component schemas (for partial validation)
  WorkoutSchema,
  TrainingWeekSchema,
  TrainingDaySchema,
  TrainingPhaseSchema,
  AthleteAssessmentSchema,
  AthleteZonesSchema,
  RaceStrategySchema,
  UnitPreferencesSchema,
  PlanMetaSchema,
  // Types
  type TrainingPlan,
  type Workout,
  type TrainingWeek,
  type TrainingDay,
  type TrainingPhase,
  type AthleteAssessment,
  type AthleteZones,
  type RaceStrategy,
  type UnitPreferences,
  type ValidationResult,
  type ValidationError,
} from "./schema/training-plan.schema.js";

// Compact Schema validation (v2.0 - template-based format)
export {
  validateCompactPlan,
  validateCompactPlanOrThrow,
  formatCompactValidationErrors,
  CompactPlanSchema,
  CompactAthleteSchema,
  CompactPhaseSchema,
  CompactWeekSchema,
  type CompactPlan,
  type CompactAthlete,
  type CompactPhase,
  type CompactWeek,
  type CompactWeekSchedule,
  type CompactRaceStrategy,
  type AthletePaces,
  type CompactValidationResult,
  type CompactValidationError,
} from "./schema/compact-plan.schema.js";

// Compact plan utilities
export { parseWorkoutRef, parseWeekRange } from "./schema/compact-plan.js";

// Templates
export {
  loadTemplates,
  loadTemplatesFromArray,
  getTemplatesPath,
  validateTemplate,
  validateTemplateOrThrow,
  interpolate,
  interpolateObject,
  createContext,
  parseYaml,
  stringifyYaml,
  type WorkoutTemplate,
  type TemplateParam,
  type TemplateParams,
  type TemplateRegistry,
  type InterpolationContext,
} from "./templates/index.js";

// Expander
export {
  expandPlan,
  expandWorkout,
  validateWorkoutRefs,
  calculateHRZones,
  calculatePaceZones,
  calculateAthleteZones,
  parsePace,
  formatPace,
  type ExpandedPlan,
  type ExpandedWeek,
  type ExpandedDay,
  type ExpandedWorkout,
  type ExpandedPhase,
  type ExpandedAthleteZones,
  type ExpansionOptions,
} from "./expander/index.js";

// Re-export TypeScript interface types for backwards compatibility
export type {
  Sport,
  WorkoutType,
  IntensityUnit,
  DurationUnit,
  StepType,
  SwimDistanceUnit,
  LandDistanceUnit,
  FirstDayOfWeek,
  IntensityTarget,
  DurationTarget,
  WorkoutStep,
  IntervalSet,
  StructuredWorkout,
  WeekSummary,
  HeartRateZones,
  PowerZones,
  SwimZones,
  PaceZones,
} from "./schema/training-plan.js";

// Triggers
export {
  evaluateHRDrift,
  evaluatePaceDeviation,
  evaluateLapVariability,
  evaluateEarlyFade,
  evaluateAllTriggers,
  type TriggerType,
  type TriggerConfig,
  type TriggerEvaluationResult,
  type FiredTrigger,
} from "./lib/triggers.js";
