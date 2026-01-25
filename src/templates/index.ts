/**
 * Templates Module
 *
 * Re-exports all template-related types and functions.
 */

// Types
export type {
  WorkoutTemplate,
  TemplateParam,
  TemplateParams,
  TemplateStep,
  TemplateIntervalSet,
  TemplateStructure,
  TemplateRegistry,
  InterpolationContext,
  ExpandedWorkout,
  ParamType,
  StepType,
  WorkoutCategory,
  MainSetElement,
} from "./template.types.js";

// Schema validation
export {
  WorkoutTemplateSchema,
  TemplateParamSchema,
  TemplateParamsSchema,
  TemplateStepSchema,
  TemplateStructureSchema,
  validateTemplate,
  validateTemplateOrThrow,
} from "./template.schema.js";

// Loader
export {
  loadTemplates,
  loadTemplatesFromArray,
  getTemplatesPath,
  getUserTemplatesDir,
  type LoadTemplatesOptions,
} from "./loader.js";

// YAML utilities
export { parse as parseYaml, stringify as stringifyYaml } from "./yaml-parser.js";

// Interpolation
export {
  interpolate,
  interpolateObject,
  evaluateExpression,
  createContext,
  hasInterpolation,
  extractVariables,
} from "./interpolate.js";

// Conversion (template to workout structure)
export {
  parseDuration,
  parseIntensity,
  convertTemplateStep,
  convertTemplateIntervalSet,
  convertTemplateStructure,
} from "./converter.js";
