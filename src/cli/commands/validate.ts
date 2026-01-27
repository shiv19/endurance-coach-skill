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
// MARK: Validate Command
// ============================================================================
/**
 * Validate a training plan file in either full or compact mode.
 *
 * Reads the file at `args.inputFile`, parses it as YAML when the filename ends with
 * `.yaml` or `.yml` and as JSON otherwise, and validates the parsed data against
 * the selected schema (compact or full). On compact validation, also checks workout
 * template references and emits warnings for reference issues. Logs validation
 * results and exits the process with code 1 on read, parse, or validation failures.
 *
 * @param args - Validation options including `inputFile` (path to the plan) and `compact` (use compact schema when true)
 */

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
    const fileType =
      args.inputFile.endsWith(".yaml") || args.inputFile.endsWith(".yml") ? "YAML" : "JSON";
    const details = err instanceof Error ? `: ${err.message}` : "";
    log.error(`Input file is not valid ${fileType}${details}`);
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
      log.warn("Compact plan validation failed with template reference warnings:");
      templateErrors.forEach((e) => log.error(`  - ${e}`));
      process.exit(1);
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
