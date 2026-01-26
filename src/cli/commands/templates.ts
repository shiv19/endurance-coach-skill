import { log } from "../../lib/logging.js";
import { colors } from "../utils/colors.js";
import {
  loadTemplates,
  getUserTemplatesDir,
  validateTemplateOrThrow,
  type WorkoutTemplate,
} from "../../templates/index.js";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { findSimilarTemplates } from "../../expander/validation.js";
import type { TemplatesArgs } from "../args.js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// ============================================================================
// Helper Types and Constants
// ============================================================================

const SPORT_VALUES = ["run", "bike", "swim", "strength", "brick", "race", "rest"] as const;
const CATEGORY_VALUES = [
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
] as const;

type Sport = (typeof SPORT_VALUES)[number];
type Category = (typeof CATEGORY_VALUES)[number];

// ============================================================================
// Create Command Handler
/**
 * Create a new workout template file from a generated scaffold or an existing YAML file.
 *
 * Validates the provided template ID, sport, and optional category; generates or loads a template,
 * validates the template schema, and writes the resulting YAML file into the user's templates
 * directory (unless running in dry-run mode).
 *
 * @param args - Command arguments. Important properties:
 *   - create: template ID to create
 *   - type: sport for the template (e.g., "run", "bike", "swim", "strength", "rest")
 *   - category: optional template category (defaults to "endurance")
 *   - templateFile: optional path to an existing YAML template to import
 *   - overwrite: whether to replace an existing template file
 *   - dryRun: if true, prints the generated YAML instead of writing the file
 *   - userTemplatesDir: optional custom templates directory
 *   - example: if true, generate an example-filled scaffold
 *
 * @throws Error if the template ID is missing or malformed, the sport or category is invalid,
 * if a template file already exists and overwrite is not set, if validation of the template fails,
 * or if file I/O operations fail when creating or writing the template.
 */

function handleCreate(args: TemplatesArgs): void {
  // Validate required arguments
  if (!args.create) {
    throw new Error(
      "Template ID is required for create command\nUsage: endurance-coach templates create --id <id> --type <sport>"
    );
  }

  const templateId = args.create;
  const sport = args.type as Sport;

  // Validate template ID format
  const idRegex = /^[a-zA-Z0-9_.]+$/;
  if (!idRegex.test(templateId)) {
    throw new Error(
      "Invalid template ID: Template IDs can only contain letters, numbers, dots (.), and underscores (_)"
    );
  }

  // Validate sport type
  if (!sport || !SPORT_VALUES.includes(sport)) {
    const validSports = SPORT_VALUES.join(", ");
    throw new Error(
      `Invalid sport type: ${String(sport || "undefined")}\nValid sport types: ${validSports}`
    );
  }

  // Validate category if provided
  if (args.category && !CATEGORY_VALUES.includes(args.category as Category)) {
    const validCategories = CATEGORY_VALUES.join(", ");
    throw new Error(`Invalid category: ${args.category}\nValid categories: ${validCategories}`);
  }

  // Determine templates directory
  const templatesDir = args.userTemplatesDir || getUserTemplatesDir();

  // Load existing user templates to check for duplicates
  const existingTemplates = loadTemplates({ includeUserTemplates: false });

  // Determine output path (rest templates go in run/ directory)
  const sportDir = sport === "rest" ? "run" : sport;
  const outputPath = join(templatesDir, sportDir, `${templateId}.yaml`);

  // Check if template already exists
  const templateExists = existsSync(outputPath);
  if (templateExists && !args.overwrite) {
    throw new Error(
      `Template already exists: ${outputPath}\nUse --overwrite to replace existing template`
    );
  }

  // Generate or load template
  let template: WorkoutTemplate;

  if (args.templateFile) {
    // Load scaffold from existing template file
    template = loadTemplateFromFile(args.templateFile, templateId, sport);
  } else {
    // Generate new template scaffold
    const category = (args.category || "endurance") as Category;
    template = generateTemplateScaffold(templateId, sport, category, args.example || false);
  }

  // Validate generated template
  try {
    validateTemplateOrThrow(template);
  } catch (error) {
    // Re-throw the error directly to preserve error message
    throw error;
  }

  // Create output directory if needed
  const outputDir = join(templatesDir, sportDir);
  if (!args.dryRun && !existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Write template file (unless dry-run)
  if (args.dryRun) {
    log.info(`Dry-run mode: would create template at ${colors.bold(outputPath)}`);
    console.log("\n" + colors.dim("─".repeat(60)));
    console.log(stringifyYaml(template));
    console.log(colors.dim("─".repeat(60)));
  } else {
    writeFileSync(outputPath, stringifyYaml(template), "utf-8");
    log.success(`Template created: ${colors.bold(outputPath)}`);
    log.info(`Template ID: ${colors.green(template.id)}`);
    log.info(`Sport: ${colors.green(template.sport)}`);
    log.info(`Category: ${colors.green(template.category)}`);
  }
}

/**
 * Load a workout template from a YAML file and apply command-line overrides.
 *
 * @param filePath - Path to the YAML template file to load
 * @param templateId - Template ID to set on the loaded template (overrides the file's id)
 * @param sport - Sport to set on the loaded template (overrides the file's sport)
 * @returns The validated WorkoutTemplate with `id` and `sport` set to the provided values
 * @throws Error if the file does not exist
 * @throws Error if the file contains invalid YAML or fails schema validation
 */
function loadTemplateFromFile(filePath: string, templateId: string, sport: Sport): WorkoutTemplate {
  if (!existsSync(filePath)) {
    throw new Error(`Template file not found: ${filePath}`);
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed = parseYaml(content) as unknown;
    const template = validateTemplateOrThrow(parsed) as WorkoutTemplate;

    // Override id and sport from command line arguments
    template.id = templateId;
    template.sport = sport;

    return template;
  } catch (error) {
    if (error instanceof Error && (error as any).name === "YAMLParseError") {
      throw new Error(`Invalid YAML in template file: ${filePath}\n${error.message}`);
    }
    throw error;
  }
}

/**
 * Create a WorkoutTemplate scaffold for the given template id, sport, and category.
 *
 * @param templateId - Template identifier (also used to generate a title-cased `name`)
 * @param sport - Sport for the template (e.g., "run", "bike")
 * @param category - Template category/type (e.g., "endurance", "intervals")
 * @param example - When true, return a populated example template; when false, return a minimal scaffold
 * @returns A WorkoutTemplate object: a populated example if `example` is true, otherwise a minimal scaffold containing `id`, `name`, `sport`, `type`, `category`, and `humanReadable`
 */
function generateTemplateScaffold(
  templateId: string,
  sport: Sport,
  category: Category,
  example: boolean
): WorkoutTemplate {
  const baseTemplate: WorkoutTemplate = {
    id: templateId,
    name: toTitleCase(templateId.replace(/[._]/g, " ")),
    sport,
    type: category,
    category,
    humanReadable: generateHumanReadable(sport, category),
  };

  if (example) {
    return generateExampleTemplate(baseTemplate);
  }

  return baseTemplate;
}

/**
 * Produce an example workout template by populating a base template with
 * category-specific parameters, structure, and metadata.
 *
 * @param baseTemplate - The base WorkoutTemplate to extend; its `sport` and `category` determine the example content.
 * @returns A WorkoutTemplate extended from `baseTemplate` with example/default `params`, `structure`, `humanReadable`, and other metadata appropriate for the template's category.
 */
function generateExampleTemplate(baseTemplate: WorkoutTemplate): WorkoutTemplate {
  const { sport, category } = baseTemplate;

  switch (category) {
    case "intervals":
      return {
        ...baseTemplate,
        name: "Interval Workout",
        params: {
          reps: {
            type: "int",
            required: true,
            default: 6,
            min: 4,
            max: 12,
            description: "Number of intervals",
          },
          recovery: {
            type: "duration",
            default: "90s",
            description: "Recovery duration",
          },
        },
        structure: {
          warmup: [
            {
              type: "warmup",
              name: "Easy warmup",
              duration: "10min",
              pace: "${paces.easy}",
            },
          ],
          main: [
            {
              type: "intervals",
              repeats: "${reps}",
              work: {
                type: "work",
                name: "Interval",
                duration: "3min",
                pace: "${paces.tempo}",
                intensity: "Zone 4",
              },
              recovery: {
                type: "recovery",
                name: "Recovery",
                duration: "${recovery}",
                pace: "${paces.easy}",
              },
            },
          ],
          cooldown: [
            {
              type: "cooldown",
              name: "Easy cooldown",
              duration: "10min",
              pace: "${paces.easy}",
            },
          ],
        },
        humanReadable: `
INTERVAL WORKOUT

WARM-UP: 10 min easy @ \${paces.easy}

MAIN SET: \${reps} x 3 min @ \${paces.tempo} with \${recovery} recovery

COOL-DOWN: 10 min easy @ \${paces.easy}
`,
        estimatedDuration: "\${10 + (reps * 3.5) + 10}",
        targetZone: "Z4",
        rpe: "7-8",
      };

    case "tempo":
    case "threshold":
      return {
        ...baseTemplate,
        name: `${toTitleCase(category)} Workout`,
        params: {
          duration: {
            type: "int",
            required: true,
            default: 30,
            min: 15,
            max: 60,
            description: "Duration in minutes",
          },
        },
        structure: {
          warmup: [
            {
              type: "warmup",
              name: "Easy warmup",
              duration: "10min",
              pace: "${paces.easy}",
            },
          ],
          main: [
            {
              type: "work",
              name: `${toTitleCase(category)}`,
              duration: "${duration}min",
              pace: "${paces.tempo}",
              intensity: "Zone 3-4",
            },
          ],
          cooldown: [
            {
              type: "cooldown",
              name: "Easy cooldown",
              duration: "10min",
              pace: "${paces.easy}",
            },
          ],
        },
        humanReadable: `
${toTitleCase(category).toUpperCase()} WORKOUT - \${duration} min

WARM-UP: 10 min easy @ \${paces.easy}

MAIN SET: \${duration} min @ \${paces.tempo}

COOL-DOWN: 10 min easy @ \${paces.easy}
`,
        estimatedDuration: "\${10 + duration + 10}",
        targetZone: "Z3-Z4",
        rpe: "6-7",
      };

    case "endurance":
    case "aerobic":
      return {
        ...baseTemplate,
        name: "Easy Endurance Workout",
        params: {
          duration: {
            type: "int",
            required: true,
            default: 45,
            min: 20,
            max: 120,
            description: "Duration in minutes",
          },
        },
        structure: {
          main: [
            {
              type: "work",
              name: "Endurance",
              duration: "${duration}min",
              pace: "${paces.easy}",
              intensity: "Zone 2",
            },
          ],
        },
        humanReadable: `
EASY ENDURANCE - \${duration} min

Run at a comfortable, conversational pace.
Pace: \${paces.easy}
`,
        estimatedDuration: "\${duration}",
        targetZone: "Z2",
        rpe: "4-5",
      };

    case "strength":
      return {
        ...baseTemplate,
        name: "Strength Workout",
        params: {
          duration: {
            type: "int",
            required: true,
            default: 20,
            min: 15,
            max: 45,
            description: "Duration in minutes",
          },
        },
        structure: {
          main: [
            {
              type: "work",
              name: "Strength circuit",
              duration: "${duration}min",
              description:
                "2-3 rounds through all exercises\n  - Squats x 12-15\n  - Lunges x 10 each leg\n  - Plank x 45-60s\n  - Push-ups x 10-15\n  - Glute bridges x 15",
            },
          ],
        },
        humanReadable: `
STRENGTH WORKOUT - \${duration} min

Complete 2-3 rounds through all exercises.
Focus on form over speed.
`,
        estimatedDuration: "\${duration}",
        targetZone: "-",
        rpe: "5",
      };

    case "rest":
      return {
        ...baseTemplate,
        name: "Rest Day",
        humanReadable: `
REST DAY

Take the day off. Focus on recovery, sleep, and nutrition.
`,
        estimatedDuration: 0,
        targetZone: "-",
        rpe: "1",
        notes: "Complete rest from structured training",
      };

    default:
      return baseTemplate;
  }
}

/**
 * Build a human-readable header and placeholder description for a template based on sport and category.
 *
 * @param sport - Sport identifier (e.g., "run", "bike", "swim")
 * @param category - Template category (e.g., "endurance", "intervals", "rest")
 * @returns A formatted description string. For `category === "rest"` this contains a REST DAY notice; otherwise it contains an uppercase header combining category and sport with a placeholder description.
 */
function generateHumanReadable(sport: Sport, category: Category): string {
  const sportLabel = toTitleCase(sport);
  const categoryLabel = toTitleCase(category);

  if (category === "rest") {
    return `
REST DAY

Take the day off. Focus on recovery, sleep, and nutrition.
`;
  }

  return `
${categoryLabel.toUpperCase()} ${sportLabel.toUpperCase()} WORKOUT

Description of your workout goes here.
Edit this file to customize workout details.
`;
}

/**
 * Convert a string to title case by capitalizing the first letter of each word.
 *
 * @param str - The input string to convert
 * @returns The input string with each word's first letter capitalized and the rest lowercased
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================================================
// Validate Command Handler
/**
 * Validate a template identified by `args.validate`, print a detailed validation
 * summary to stdout, and surface any schema or YAML errors.
 *
 * Loads both builtin and user templates (using `args.userTemplatesDir` if present),
 * attempts to locate the requested template, and if found runs schema validation
 * then prints source, file path (for user templates), sport, category, type,
 * optional target zone/RPE, parameters (with required/default info and descriptions),
 * and a confirmation that validation checks passed.
 *
 * @param args - Command arguments; must include `validate` (the template ID). If provided,
 *               `userTemplatesDir` is used to include user templates when loading.
 * @throws If `args.validate` is not provided, if the template cannot be found,
 *         or if the template file contains YAML parsing or schema validation errors.
 */

function handleValidate(args: TemplatesArgs): void {
  if (!args.validate) {
    throw new Error("Template ID is required for validate command");
  }

  const userTemplatesDir = args.userTemplatesDir || getUserTemplatesDir();
  const templates = loadTemplates({
    includeUserTemplates: true,
    userTemplatesDir,
  });

  const templateId = args.validate;
  const template = templates.get(templateId);

  if (!template) {
    // Template not found in registry, which could mean:
    // 1. Template doesn't exist at all
    // 2. Template failed to load due to validation errors

    // Try to manually load the template file to provide better error messages
    const manualTemplate = tryLoadTemplateFromFile(templateId, userTemplatesDir);

    if (manualTemplate && manualTemplate.error) {
      // Template file exists but has validation errors
      throw new Error(`${colors.bold(templateId)}: ${manualTemplate.error}`);
    }

    // Template doesn't exist
    const suggestions = findSimilarTemplates(templateId, templates, 5);
    let errorMsg = `Template not found: ${templateId}`;
    if (suggestions.length > 0) {
      errorMsg += `\n\nDid you mean one of these?\n${suggestions.map((s) => `  - ${s}`).join("\n")}`;
    }
    errorMsg += `\n\nList all templates with: endurance-coach templates list`;

    log.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Get source information
  const source = (templates.getSource && templates.getSource(templateId)) || "builtin";
  const sourcePath = templates.getSourcePath && templates.getSourcePath(templateId);
  const sourceLabel = source === "user" ? colors.green("[USER]") : colors.gray("[BUILTIN]");

  // Validate template schema
  validateTemplateOrThrow(template);

  // Display validation results
  console.log(
    `\n${colors.green("✓")} ${sourceLabel} ${colors.bold(template.name)} ${colors.dim(`(${template.id})`)}`
  );

  console.log(`${colors.bold("Source:")}      ${source}`);
  if (source === "user" && sourcePath) {
    console.log(`${colors.bold("File:")}        ${sourcePath}`);
  }

  console.log(`${colors.bold("Sport:")}       ${template.sport}`);
  console.log(`${colors.bold("Category:")}    ${template.category}`);
  console.log(`${colors.bold("Type:")}        ${template.type}`);

  if (template.targetZone) {
    console.log(`${colors.bold("Target Zone:")} ${template.targetZone}`);
  }

  if (template.rpe) {
    console.log(`${colors.bold("RPE:")}         ${template.rpe}`);
  }

  if (template.params && Object.keys(template.params).length > 0) {
    console.log(`\n${colors.bold("Parameters:")}`);
    for (const [name, param] of Object.entries(template.params)) {
      const required = param.required ? colors.red("(required)") : colors.dim("(optional)");
      const defaultVal =
        param.default !== undefined ? ` ${colors.dim(`[default: ${param.default}]`)}` : "";
      console.log(`  ${colors.bold(name)}: ${param.type} ${required}${defaultVal}`);
      if (param.description) {
        console.log(`    ${colors.dim(param.description)}`);
      }
    }
  }

  console.log(`\n${colors.green("✓ Template is valid")}`);
  console.log(`\n${colors.dim("Validation checks passed:")}`);
  console.log(`  ${colors.dim("•")} Schema validation`);
  console.log(`  ${colors.dim("•")} Required fields present`);
  console.log(`  ${colors.dim("•")} Valid sport and category types`);
  console.log(`  ${colors.dim("•")} Parameter definitions valid`);
}

/**
 * Searches the user's templates directory for a YAML file matching `templateId` across sport subdirectories and validates it.
 *
 * @param templateId - The template identifier (filename without extension) to look up.
 * @param userTemplatesDir - Root path of the user's templates directory containing sport subfolders (e.g., run, bike).
 * @returns An object `{ error: string }` containing a formatted validation or parse error if a matching file exists but fails validation or YAML parsing; `null` if no matching user template file is found or if a matching file is found and validates successfully.
 */
function tryLoadTemplateFromFile(
  templateId: string,
  userTemplatesDir: string
): { error?: string } | null {
  // Try to find template file in user templates directory
  // Check all sport subdirectories
  const sports = ["run", "bike", "swim", "strength", "brick", "rest"];

  for (const sport of sports) {
    const sportDir = sport === "rest" ? "run" : sport;
    const filePath = join(userTemplatesDir, sportDir, `${templateId}.yaml`);

    if (existsSync(filePath)) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const parsed = parseYaml(content) as unknown;
        validateTemplateOrThrow(parsed);
        // If validation passes, no error
        return null;
      } catch (error) {
        if (error instanceof Error) {
          // Format validation errors
          if (error.name === "ZodError") {
            const zodError = error as unknown as { issues: { path: string[]; message: string }[] };
            const errors = zodError.issues.map((issue) => {
              const path = issue.path.length > 0 ? issue.path.join(".") : "root";
              return `${colors.bold(path)}: ${issue.message}`;
            });
            return { error: `Validation errors:\n  ${errors.join("\n  ")}` };
          }
          // YAML parsing errors
          if ((error as any).name === "YAMLParseError") {
            return { error: `Invalid YAML: ${error.message}` };
          }
          return { error: error.message };
        }
        return { error: String(error) };
      }
    }
  }

  // Template file not found in user directory
  return null;
}

// ============================================================================
// Templates Command
/**
 * Dispatches the "templates" CLI command: handles validate, create, show, and list subcommands.
 *
 * Processes the provided CLI arguments to run the appropriate templates subcommand:
 * - validate: validate a template by ID
 * - create: create or scaffold a new template
 * - show: display detailed metadata and usage for a specific template
 * - list: list available templates with optional filtering and verbose output
 *
 * @param args - Parsed templates command arguments (subcommand selector, filters, flags, and options)
 */

export function runTemplates(args: TemplatesArgs): void {
  try {
    // Handle validate subcommand
    if (args.validate) {
      handleValidate(args);
      return;
    }

    // Handle create subcommand
    if (args.create) {
      handleCreate(args);
      return;
    }

    // Load templates with user templates included
    const templates = loadTemplates({ includeUserTemplates: true });

    if (args.show) {
      // Show details of a specific template
      const templateId = args.show;
      const template = templates.get(templateId);

      if (!template) {
        log.error(`Template not found: ${colors.bold(templateId)}`);

        // Use fuzzy matching to find similar templates
        const suggestions = findSimilarTemplates(templateId, templates, 5);
        if (suggestions.length > 0) {
          console.log(`\n${colors.dim("Did you mean one of these?")}`);
          suggestions.forEach((s) => console.log(`  - ${colors.green(s)}`));
        }

        console.log(`\nList all templates with: ${colors.green("endurance-coach templates list")}`);
        process.exit(1);
      }

      // Get source information
      const source = (templates.getSource && templates.getSource(templateId)) || "builtin";
      const sourcePath = templates.getSourcePath && templates.getSourcePath(templateId);
      const sourceLabel = source === "user" ? colors.green("[USER]") : colors.gray("[BUILTIN]");

      // Display template header
      console.log(
        `\n${sourceLabel} ${colors.bold(template.name)} ${colors.dim(`(${template.id})`)}`
      );
      console.log(`${"─".repeat(template.name.length + template.id.length + 12)}`);

      // Display basic info
      console.log(`\n${colors.bold("Sport:")}      ${template.sport}`);
      console.log(`${colors.bold("Category:")}   ${template.category}`);
      console.log(`${colors.bold("Type:")}       ${template.type}`);

      // Display source path for user templates
      if (source === "user" && sourcePath) {
        console.log(`${colors.bold("File:")}       ${sourcePath}`);
      }

      // Display target zone
      if (template.targetZone) {
        console.log(`${colors.bold("Target Zone:")} ${template.targetZone}`);
      }

      // Display RPE
      if (template.rpe) {
        console.log(`${colors.bold("RPE:")}        ${template.rpe}`);
      }

      // Display estimated duration formula
      if (template.estimatedDuration) {
        const durationDisplay =
          typeof template.estimatedDuration === "string"
            ? `${template.estimatedDuration} (formula)`
            : `${template.estimatedDuration} minutes`;
        console.log(`${colors.bold("Est. Duration:")} ${durationDisplay}`);
      }

      // Display parameters
      if (template.params && Object.keys(template.params).length > 0) {
        console.log(`\n${colors.bold("Parameters:")}`);
        for (const [name, param] of Object.entries(template.params)) {
          const required = param.required ? colors.red("(required)") : colors.dim("(optional)");
          const defaultVal =
            param.default !== undefined ? ` ${colors.dim(`[default: ${param.default}]`)}` : "";
          console.log(`  ${colors.bold(name)}: ${param.type} ${required}${defaultVal}`);
          if (param.description) {
            console.log(`    ${colors.dim(param.description)}`);
          }
        }
      }

      // Display usage examples
      console.log(`\n${colors.bold("Usage examples:")}`);
      const paramNames = template.params ? Object.keys(template.params) : [];
      if (paramNames.length === 0) {
        console.log(`  ${colors.green(template.id)}`);
      } else {
        const defaults = paramNames
          .filter((p) => template.params![p].default !== undefined)
          .map((p) => template.params![p].default);
        if (defaults.length > 0) {
          console.log(`  ${colors.green(template.id)}(${colors.dim(defaults.join(", "))})`);
        }
        console.log(`  ${colors.green(template.id)}(${colors.dim(paramNames.join(", "))})`);
      }

      // Display human-readable description
      console.log(`\n${colors.bold("Description:")}`);
      console.log(template.humanReadable);

      // Display notes if present
      if (template.notes) {
        console.log(`\n${colors.bold("Notes:")}`);
        console.log(colors.dim(template.notes));
      }
    } else {
      // List all templates
      const sportFilter = args.sport as "run" | "bike" | "swim" | undefined;
      const typeFilter = args.type;
      const sourceFilter = args.source;
      const verbose = args.verbose;

      let list = templates.list(sportFilter);

      // Filter by source if specified
      if (sourceFilter && sourceFilter !== "all") {
        list = list.filter((t) => {
          const source = templates.getSource && templates.getSource(t.id);
          return source === sourceFilter;
        });
      }

      // Filter by type if specified
      if (typeFilter) {
        list = list.filter((t) => t.type.toLowerCase().includes(typeFilter.toLowerCase()));
      }

      if (list.length === 0) {
        console.log(
          `\n${colors.dim("No templates found")}${verbose ? " with specified filters" : ""}.`
        );

        const filters = [];
        if (sportFilter) filters.push(`sport=${colors.green(sportFilter)}`);
        if (sourceFilter && sourceFilter !== "all")
          filters.push(`source=${colors.green(sourceFilter)}`);
        if (typeFilter) filters.push(`type=${colors.green(typeFilter)}`);

        if (filters.length > 0) {
          console.log(`${colors.dim("Filters:")} ${filters.join(", ")}`);
        }

        console.log(`\nList all templates with: ${colors.green("endurance-coach templates list")}`);
        return;
      }

      console.log(
        `\n${colors.bold("Available Templates")}${sportFilter ? ` ${colors.dim(`(${sportFilter})`)}` : ""}${sourceFilter ? ` ${colors.dim(`[source: ${sourceFilter}]`)}` : ""}`
      );

      const usageExamples = list.map((t) => {
        const baseId = t.id;
        const paramNames = t.params ? Object.keys(t.params) : [];
        if (paramNames.length === 0) {
          return baseId;
        }
        return `${baseId}(${paramNames.join(", ")})`;
      });

      // Calculate column widths
      const idWidth = Math.max(12, ...list.map((t) => t.id.length));
      const nameWidth = Math.max(20, ...list.map((t) => t.name.length));
      const sportWidth = Math.max(8, ...list.map((t) => t.sport.length));
      const categoryWidth = Math.max(10, ...list.map((t) => t.category.length));
      const sourceWidth = 10;
      const usageWidth = Math.max(18, ...usageExamples.map((example) => example.length));

      console.log(
        `${colors.bold("ID".padEnd(idWidth))}  ${colors.bold("Name".padEnd(nameWidth))}  ${colors.bold("Sport".padEnd(sportWidth))}  ${colors.bold("Category".padEnd(categoryWidth))}  ${colors.bold("Source".padEnd(sourceWidth))}  ${colors.bold("Usage".padEnd(usageWidth))}`
      );
      const separatorRow =
        "─".repeat(idWidth) +
        "──" +
        "─".repeat(nameWidth) +
        "──" +
        "─".repeat(sportWidth) +
        "──" +
        "─".repeat(categoryWidth) +
        "──" +
        "─".repeat(sourceWidth) +
        "──" +
        "─".repeat(usageWidth);
      console.log(separatorRow);

      // Build data rows
      for (const [index, t] of list.entries()) {
        const source = (templates.getSource && templates.getSource(t.id)) || "builtin";
        const sourceDisplay =
          source === "user" ? colors.green("[USER]  ") : colors.gray("[BUILTIN]");

        const usageExample = usageExamples[index];
        const cells = [
          t.id.padEnd(idWidth),
          t.name.padEnd(nameWidth),
          t.sport.padEnd(sportWidth),
          t.category.padEnd(categoryWidth),
          sourceDisplay.padEnd(sourceWidth),
          colors.dim(usageExample.padEnd(usageWidth)),
        ];

        if (verbose) {
          const typeWidth = 12;
          const zoneWidth = 8;
          const typeDisplay = (t.type || "-").substring(0, typeWidth).padEnd(typeWidth);
          const zoneDisplay = (t.targetZone || t.rpe || "-")
            .substring(0, zoneWidth)
            .padEnd(zoneWidth);
          cells.push(colors.dim(typeDisplay), colors.dim(zoneDisplay));

          // Add verbose headers if not already shown
          if (list.indexOf(t) === 0) {
            console.log(
              `${colors.bold("ID".padEnd(idWidth))}  ${colors.bold("Name".padEnd(nameWidth))}  ${colors.bold("Sport".padEnd(sportWidth))}  ${colors.bold("Category".padEnd(categoryWidth))}  ${colors.bold("Source".padEnd(sourceWidth))}  ${colors.bold("Usage".padEnd(usageWidth))}  ${colors.bold("Type".padEnd(12))}  ${colors.bold("Zone".padEnd(8))}`
            );
            const verboseSeparator =
              separatorRow + "──" + "─".repeat(typeWidth) + "──" + "─".repeat(zoneWidth);
            console.log(verboseSeparator);
          }
        }

        console.log(cells.join("  "));
      }

      console.log(
        `\n${colors.dim("Total:")} ${list.length} ${list.length === 1 ? "template" : "templates"}`
      );

      console.log(`\n${colors.dim("Commands:")}`);
      console.log(
        `  ${colors.green("endurance-coach templates show <id>")}  Show template details`
      );
      console.log(
        `  ${colors.green("endurance-coach templates validate <id>")}  Validate a template by ID`
      );
      console.log(`  ${colors.green("endurance-coach templates list")}        List all templates`);
      console.log(
        `  ${colors.green("endurance-coach templates list --sport=<sport>")}  Filter by sport`
      );
      console.log(
        `  ${colors.green("endurance-coach templates list --type=<category>")}  Filter by workout category`
      );
      console.log(
        `  ${colors.green("endurance-coach templates list --source=<user|builtin|all>")}  Filter by source`
      );
      console.log(`\n${colors.dim("Custom templates directory:")} ${getUserTemplatesDir()}`);
    }
  } catch (error) {
    // Re-throw for main() to catch and log
    throw error;
  }
}