import { readFileSync, writeFileSync } from "fs";
import { log } from "../../lib/logging.js";
import {
  validateCompactPlan,
  formatCompactValidationErrors,
} from "../../schema/compact-plan.schema.js";
import { loadTemplates, parseYaml, stringifyYaml } from "../../templates/index.js";
import { expandPlan, validateWorkoutRefs } from "../../expander/index.js";
import type { ExpandArgs } from "../args.js";

// ============================================================================
// Expand Command
// ============================================================================

export function runExpand(args: ExpandArgs): void {
  log.start("Expanding compact plan...");

  // Read the compact plan
  let planContent: string;
  try {
    planContent = readFileSync(args.inputFile, "utf-8");
  } catch {
    log.error(`Could not read input file: ${args.inputFile}`);
    process.exit(1);
  }

  // Parse YAML
  let planData: unknown;
  try {
    planData = parseYaml(planContent);
  } catch {
    log.error("Input file is not valid YAML");
    process.exit(1);
  }

  // Validate compact plan
  const validation = validateCompactPlan(planData);
  if (!validation.success) {
    log.error("Compact plan validation failed:");
    console.error(formatCompactValidationErrors(validation.errors));
    process.exit(1);
  }

  // Load templates
  const templates = loadTemplates();
  if (args.verbose) {
    log.info(`Loaded ${templates.ids().length} templates`);
  }

  // Validate template references
  const templateErrors = validateWorkoutRefs(validation.data, templates);
  if (templateErrors.length > 0) {
    log.warn("Template reference warnings:");
    templateErrors.forEach((e) => console.error(`  - ${e}`));
  }

  // Expand the plan
  const expanded = expandPlan(validation.data, templates);

  if (args.verbose) {
    log.info(`Expanded ${expanded.weeks.length} weeks`);
  }

  // Format output
  let output: string;
  if (args.format === "yaml") {
    output = stringifyYaml(expanded);
  } else {
    output = JSON.stringify(expanded, null, 2);
  }

  // Write output
  if (args.outputFile) {
    writeFileSync(args.outputFile, output);
    log.success(`Expanded plan written to: ${args.outputFile}`);
  } else {
    console.log(output);
  }
}
