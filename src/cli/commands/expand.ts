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
// MARK: Expand Command
// ============================================================================
/**
 * Executes the Expand command to transform a compact plan into an expanded plan.
 *
 * Reads the compact plan from disk, parses and validates it, loads templates (including user templates),
 * validates template references, expands the plan, and emits the expanded plan as YAML or JSON.
 *
 * @param args - Command arguments:
 *   - inputFile: Path to the compact plan file (YAML).
 *   - outputFile: Optional path to write the expanded plan; if omitted the result is printed to stdout.
 *   - format: Output format, either `"yaml"` or `"json"`.
 *   - verbose: When true, emits additional progress information.
 *
 * Exits the process with code 1 on file read, YAML parse, or validation failures.
 */

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

  // Load templates (include user templates)
  const templates = loadTemplates({ includeUserTemplates: true });
  if (args.verbose) {
    log.info(`Loaded ${templates.ids().length} templates`);
  }

  // Validate template references
  const templateErrors = validateWorkoutRefs(validation.data, templates);
  if (templateErrors.length > 0) {
    log.warn("Compact plan validation failed with template reference warnings:");
    templateErrors.forEach((e) => log.error(`  - ${e}`));
    process.exit(1);
  }

  // Expand the plan
  let expanded;
  try {
    expanded = expandPlan(validation.data, templates);
  } catch (error) {
    log.error(`Failed to expand plan: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exit(1);
  }

  if (args.verbose) {
    log.info(`Expanded ${expanded.weeks.length} weeks`);
  }

  // Format output + write
  try {
    const output =
      args.format === "yaml" ? stringifyYaml(expanded) : JSON.stringify(expanded, null, 2);

    if (args.outputFile) {
      writeFileSync(args.outputFile, output);
      log.success(`Expanded plan written to: ${args.outputFile}`);
    } else {
      console.log(output);
    }
  } catch (error) {
    log.error(
      `Failed to write expanded plan: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    process.exit(1);
  }
}
