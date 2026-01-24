/**
 * Template Loader
 *
 * Loads workout templates from YAML files in the templates directory.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "./yaml-parser.js";
import { validateTemplateOrThrow, type WorkoutTemplate } from "./template.schema.js";
import type { TemplateRegistry } from "./template.types.js";
import type { Sport } from "../schema/compact-plan.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Default templates directory location.
 * In development: ./templates relative to project root
 * In production: bundled with the package
 */
function getTemplatesDir(): string {
  // Try multiple locations
  const locations = [
    join(__dirname, "..", "..", "templates"), // From dist/templates
    join(__dirname, "..", "templates"), // From src/templates
    join(process.cwd(), "templates"), // From current working directory
  ];

  for (const loc of locations) {
    if (existsSync(loc)) {
      return loc;
    }
  }

  throw new Error(`Templates directory not found. Searched: ${locations.join(", ")}`);
}

/**
 * Recursively find all YAML files in a directory.
 */
function findYamlFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (stat.isFile() && (entry.endsWith(".yaml") || entry.endsWith(".yml"))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Load a single template from a YAML file.
 */
function loadTemplateFile(filePath: string): WorkoutTemplate {
  const content = readFileSync(filePath, "utf-8");
  const data = parseYaml(content);

  // Validate against schema
  return validateTemplateOrThrow(data);
}

/**
 * Load all templates from the templates directory.
 */
export function loadTemplates(templatesDir?: string): TemplateRegistry {
  const dir = templatesDir ?? getTemplatesDir();
  const yamlFiles = findYamlFiles(dir);
  const templates = new Map<string, WorkoutTemplate>();

  for (const file of yamlFiles) {
    try {
      const template = loadTemplateFile(file);
      if (templates.has(template.id)) {
        console.warn(`Duplicate template ID: ${template.id} in ${file}`);
      }
      templates.set(template.id, template);
    } catch (error) {
      const fileName = basename(file);
      if (error instanceof Error) {
        console.error(`Failed to load template ${fileName}: ${error.message}`);
      } else {
        console.error(`Failed to load template ${fileName}: Unknown error`);
      }
    }
  }

  return createRegistry(templates);
}

/**
 * Load templates from an array of template objects (for testing or embedded templates).
 */
export function loadTemplatesFromArray(templateArray: WorkoutTemplate[]): TemplateRegistry {
  const templates = new Map<string, WorkoutTemplate>();

  for (const template of templateArray) {
    const validated = validateTemplateOrThrow(template);
    templates.set(validated.id, validated);
  }

  return createRegistry(templates);
}

/**
 * Create a template registry from a Map of templates.
 */
function createRegistry(templates: Map<string, WorkoutTemplate>): TemplateRegistry {
  return {
    templates,

    get(id: string): WorkoutTemplate | undefined {
      return templates.get(id);
    },

    list(sport?: Sport): WorkoutTemplate[] {
      const all = Array.from(templates.values());
      if (!sport) {
        return all;
      }
      return all.filter((t) => t.sport === sport);
    },

    has(id: string): boolean {
      return templates.has(id);
    },

    ids(): string[] {
      return Array.from(templates.keys());
    },
  };
}

/**
 * Get the path to the templates directory.
 */
export function getTemplatesPath(): string {
  return getTemplatesDir();
}
