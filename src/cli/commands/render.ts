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
// Render Command
// ============================================================================

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

    // Load templates and expand
    const templates = loadTemplates();
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
  const newPlanData = `<script type="application/json" id="plan-data">\n${planJson}\n</script>`;
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
