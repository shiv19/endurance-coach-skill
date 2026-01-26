import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { log } from "../../lib/logging.js";
import { validatePlan, formatValidationErrors } from "../../schema/training-plan.schema.js";
import {
  validateCompactPlan,
  formatCompactValidationErrors,
} from "../../schema/compact-plan.schema.js";
import { loadTemplates, parseYaml } from "../../templates/index.js";
import { expandPlan } from "../../expander/index.js";
import type { RenderArgs } from "../args.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================================
// MARK: Render Command
// ============================================================================
/**
 * Locate the `plan-viewer.html` template by checking multiple candidate locations and return the first readable path.
 *
 * @returns The filesystem path to the first readable `plan-viewer.html` template.
 * @throws Error if no template file is found in any of the checked locations.
 */

export function getTemplatePath(): string {
  // Look for template in multiple locations
  const locations = [
    join(__dirname, "..", "..", "..", "templates", "plan-viewer.html"),
    join(__dirname, "..", "..", "..", "..", "templates", "plan-viewer.html"),
    join(process.cwd(), "templates", "plan-viewer.html"),
  ];

  for (const loc of locations) {
    try {
      readFileSync(loc);
      return loc;
    } catch {
      // Continue to next location
    }
  }

  throw new Error("Could not find plan-viewer.html template");
}

/**
 * Render a training plan file into the plan-viewer HTML template.
 *
 * Reads the specified input plan (compact YAML or full JSON), validates and expands it as needed,
 * injects the resulting plan JSON into the plan-viewer template, and writes the rendered HTML
 * to the given output file or stdout when no output file is provided.
 *
 * @param args - Rendering arguments containing the input file path and optional output file path.
 */
export function runRender(args: RenderArgs): void {
  log.start("Rendering training plan...");

  const isCompact = args.inputFile.endsWith(".yaml") || args.inputFile.endsWith(".yml");

  // Read the plan file
  let planContent: string;
  try {
    planContent = readFileSync(args.inputFile, "utf-8");
  } catch {
    log.error(`Could not read input file: ${args.inputFile}`);
    process.exit(1);
  }

  let planJson: string;

  if (isCompact) {
    // Handle compact YAML plan
    log.info("Detected compact YAML plan, expanding...");

    // Parse YAML
    let compactData: unknown;
    try {
      compactData = parseYaml(planContent);
    } catch {
      log.error("Input file is not valid YAML");
      process.exit(1);
    }

    // Validate compact plan
    const compactValidation = validateCompactPlan(compactData);
    if (!compactValidation.success) {
      log.error("Compact plan validation failed:");
      console.error(formatCompactValidationErrors(compactValidation.errors));
      process.exit(1);
    }

    // Load templates and expand (include user templates)
    const templates = loadTemplates({ includeUserTemplates: true });
    const expanded = expandPlan(compactValidation.data, templates);

    log.success("Plan expanded successfully");
    planJson = JSON.stringify(expanded, null, 2);
  } else {
    // Handle full JSON plan
    let planData: unknown;
    try {
      planData = JSON.parse(planContent);
    } catch {
      log.error("Input file is not valid JSON");
      process.exit(1);
    }

    // Validate against schema
    const validation = validatePlan(planData);
    if (!validation.success) {
      log.error("Training plan validation failed:");
      console.error(formatValidationErrors(validation.errors));
      process.exit(1);
    }
    log.success("Plan schema validated successfully");
    planJson = planContent;
  }

  // Read the template
  const templatePath = getTemplatePath();
  let template = readFileSync(templatePath, "utf-8");

  // Replace the plan data in the template
  const planDataRegex = /<script type="application\/json" id="plan-data">[\s\S]*?<\/script>/;
  if (!planDataRegex.test(template)) {
    log.error("Template is missing the plan-data script placeholder.");
    process.exit(1);
  }
  const escapedPlanJson = planJson.replace(/<\/script>/g, "<\\/script>");
  const newPlanData = `<script type="application/json" id="plan-data">\n${escapedPlanJson}\n</script>`;
  template = template.replace(planDataRegex, newPlanData);

  // Output
  if (args.outputFile) {
    writeFileSync(args.outputFile, template);
    log.success(`Training plan rendered to: ${args.outputFile}`);
  } else {
    // Output to stdout
    console.log(template);
  }
}
