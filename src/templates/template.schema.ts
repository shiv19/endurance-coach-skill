/**
 * Workout Template Zod Schema
 *
 * Runtime validation for workout template definitions.
 */

import { z } from "zod";

// ============================================================================
// MARK: Core Types
// ============================================================================

export const SportSchema = z.enum(["swim", "bike", "run", "strength", "brick"]);

export const ParamTypeSchema = z.enum(["int", "number", "duration", "distance", "string"]);

export const StepTypeSchema = z.enum(["warmup", "work", "recovery", "rest", "cooldown"]);

export const WorkoutCategorySchema = z.enum([
  "rest",
  "recovery",
  "endurance",
  "aerobic",
  "tempo",
  "threshold",
  "intervals",
  "speed",
  "hills",
  "race",
  "strength",
  "power",
  "maintenance",
  "technique",
]);

// ============================================================================
// MARK: Template Parameters
// ============================================================================

export const TemplateParamSchema = z.object({
  type: ParamTypeSchema,
  required: z.boolean().optional(),
  default: z.union([z.number(), z.string()]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  description: z.string().optional(),
});

export const TemplateParamsSchema = z.record(z.string(), TemplateParamSchema);

// ============================================================================
// MARK: Workout Structure
// ============================================================================

export const TemplateStepSchema = z.object({
  type: StepTypeSchema,
  name: z.string().optional(),
  duration: z.string().optional(),
  distance: z.string().optional(),
  pace: z.string().optional(),
  intensity: z.string().optional(),
  description: z.string().optional(),
});

export const TemplateIntervalSetSchema = z.object({
  type: z.literal("intervals"),
  repeats: z.string(),
  work: TemplateStepSchema,
  recovery: TemplateStepSchema,
});

export const MainSetElementSchema = z.union([TemplateStepSchema, TemplateIntervalSetSchema]);

export const TemplateStructureSchema = z.object({
  warmup: z.array(TemplateStepSchema).optional(),
  main: z.array(MainSetElementSchema),
  cooldown: z.array(TemplateStepSchema).optional(),
});

// ============================================================================
// MARK: Complete Template
// ============================================================================

export const WorkoutTemplateSchema = z.object({
  id: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.]+$/,
      "Template ID must contain only letters, numbers, dots, and underscores"
    ),
  name: z.string().min(1),
  sport: SportSchema,
  type: z.string().min(1),
  category: WorkoutCategorySchema,
  params: TemplateParamsSchema.optional(),
  structure: TemplateStructureSchema.optional(),
  humanReadable: z.string().min(1),
  estimatedDuration: z.union([z.string(), z.number()]).optional(),
  targetZone: z.string().optional(),
  rpe: z.string().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// MARK: Validation Functions
// ============================================================================

export type TemplateValidationResult =
  | { success: true; data: z.infer<typeof WorkoutTemplateSchema> }
  | { success: false; errors: TemplateValidationError[] };

export interface TemplateValidationError {
  path: string;
  message: string;
  code: string;
}

/**
 * Validate a workout template against the schema.
 */
export function validateTemplate(data: unknown): TemplateValidationResult {
  const result = WorkoutTemplateSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: TemplateValidationError[] = result.error.issues.map((issue: z.core.$ZodIssue) => ({
    path: issue.path.join("."),
    message: issue.message,
    code: issue.code,
  }));

  return { success: false, errors };
}

/**
 * Validate a template and throw an error if invalid.
 */
export function validateTemplateOrThrow(data: unknown): z.infer<typeof WorkoutTemplateSchema> {
  return WorkoutTemplateSchema.parse(data);
}

// ============================================================================
// MARK: Type Exports
// ============================================================================

export type WorkoutTemplate = z.infer<typeof WorkoutTemplateSchema>;
export type TemplateParam = z.infer<typeof TemplateParamSchema>;
export type TemplateParams = z.infer<typeof TemplateParamsSchema>;
export type TemplateStep = z.infer<typeof TemplateStepSchema>;
export type TemplateIntervalSet = z.infer<typeof TemplateIntervalSetSchema>;
export type TemplateStructure = z.infer<typeof TemplateStructureSchema>;
export type Sport = z.infer<typeof SportSchema>;
export type WorkoutCategory = z.infer<typeof WorkoutCategorySchema>;
