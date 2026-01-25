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
// ============================================================================

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

function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================================================
// Templates Command
// ============================================================================

export function runTemplates(args: TemplatesArgs): void {
  try {
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

      // Calculate column widths
      const idWidth = Math.max(12, ...list.map((t) => t.id.length));
      const nameWidth = Math.max(20, ...list.map((t) => t.name.length));
      const sportWidth = Math.max(8, ...list.map((t) => t.sport.length));
      const categoryWidth = Math.max(10, ...list.map((t) => t.category.length));
      const sourceWidth = 10;

      console.log(
        `${colors.bold("ID".padEnd(idWidth))}  ${colors.bold("Name".padEnd(nameWidth))}  ${colors.bold("Sport".padEnd(sportWidth))}  ${colors.bold("Category".padEnd(categoryWidth))}  ${colors.bold("Source".padEnd(sourceWidth))}`
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
        "─".repeat(sourceWidth);
      console.log(separatorRow);

      // Build data rows
      for (const t of list) {
        const source = (templates.getSource && templates.getSource(t.id)) || "builtin";
        const sourceDisplay =
          source === "user" ? colors.green("[USER]  ") : colors.gray("[BUILTIN]");

        const cells = [
          t.id.padEnd(idWidth),
          t.name.padEnd(nameWidth),
          t.sport.padEnd(sportWidth),
          t.category.padEnd(categoryWidth),
          sourceDisplay.padEnd(sourceWidth),
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
              `${colors.bold("ID".padEnd(idWidth))}  ${colors.bold("Name".padEnd(nameWidth))}  ${colors.bold("Sport".padEnd(sportWidth))}  ${colors.bold("Category".padEnd(categoryWidth))}  ${colors.bold("Source".padEnd(sourceWidth))}  ${colors.bold("Type".padEnd(12))}  ${colors.bold("Zone".padEnd(8))}`
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
      console.log(`  ${colors.green("endurance-coach templates list")}        List all templates`);
      console.log(
        `  ${colors.green("endurance-coach templates list --type=<type>")}  Filter by workout type`
      );
      console.log(
        `  ${colors.green("endurance-coach templates list --source=<user|builtin|all>")}  Filter by source`
      );
      console.log(`\n${colors.dim("Custom templates directory:")} ${getUserTemplatesDir()}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      log.error(error.message);
      throw error; // Re-throw for test to catch
    } else {
      log.error(String(error));
      throw error; // Re-throw for test to catch
    }
  }
}
