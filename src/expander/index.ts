/**
 * Expander Module
 *
 * Re-exports all expander-related types and functions.
 */

// Types
export type {
  ExpandedPlan,
  ExpandedWeek,
  ExpandedDay,
  ExpandedWorkout,
  ExpandedPhase,
  ExpandedWeekSummary,
  ExpandedHRZones,
  ExpandedHRZone,
  ExpandedPaceZones,
  ExpandedPaceZone,
  ExpandedAthleteZones,
  ExpandedPlanMeta,
  ExpandedUnitPreferences,
  ExpansionOptions,
} from "./types.js";

// Core expander
export { expandPlan, expandWorkout, validateWorkoutRefs, parseLocalDate } from "./expander.js";

// Template validation
export {
  UnknownTemplateError,
  validateTemplateExists,
  findSimilarTemplates,
  levenshteinDistance,
  similarityScore,
  validatePlanTemplates,
  formatValidationErrors,
} from "./validation.js";

// Zone calculations
export {
  calculateHRZones,
  calculatePaceZones,
  calculateAthleteZones,
  parsePace,
  formatPace,
  getHRZoneForValue,
  getPaceZoneForValue,
} from "./zones.js";
