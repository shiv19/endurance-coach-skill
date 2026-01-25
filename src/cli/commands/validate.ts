import { readFileSync } from "fs";
import { log } from "../../lib/logging.js";
import { validatePlan, formatValidationErrors } from "../../schema/training-plan.schema.js";
import {
  validateCompactPlan,
  formatCompactValidationErrors,
} from "../../schema/compact-plan.schema.js";
import { loadTemplates, parseYaml } from "../../templates/index.js";
import { validateWorkoutRefs } from "../../expander/index.js";
import type { ValidateArgs } from "../args.js";

// ============================================================================
// Validate Command
// ============================================================================

export function runValidate(args: ValidateArgs): void {
  const isCompact = args.compact;
  log.start(`Validating ${isCompact ? "compact" : "full"} training plan...`);

  // Read the plan file
  let planContent: string;
  try {
    planContent = readFileSync(args.inputFile, "utf-8");
  } catch {
    log.error(`Could not read input file: ${args.inputFile}`);
    process.exit(1);
  }

  // Parse content (YAML or JSON)
  let planData: unknown;
  try {
    if (args.inputFile.endsWith(".yaml") || args.inputFile.endsWith(".yml")) {
      planData = parseYaml(planContent);
    } else {
      planData = JSON.parse(planContent);
    }
  } catch (err) {
    log.error(`Input file is not valid ${isCompact ? "YAML" : "JSON"}`);
    process.exit(1);
  }

  if (isCompact) {
    // Validate against compact schema
    const validation = validateCompactPlan(planData);
    if (!validation.success) {
      log.error("Compact plan validation failed:");
      console.error(formatCompactValidationErrors(validation.errors));
      process.exit(1);
    }

    // Also validate template references (include user templates)
    const templates = loadTemplates({ includeUserTemplates: true });
    const templateErrors = validateWorkoutRefs(validation.data, templates);
    if (templateErrors.length > 0) {
      log.warn("Template reference warnings:");
      templateErrors.forEach((e) => console.error(`  - ${e}`));
    }

    log.success("Compact plan is valid!");
  } else {
    // Validate against full schema
    const validation = validatePlan(planData);
    if (!validation.success) {
      log.error("Validation failed:");
      console.error(formatValidationErrors(validation.errors));
      process.exit(1);
    }

    log.success("Plan is valid!");
  }
}
