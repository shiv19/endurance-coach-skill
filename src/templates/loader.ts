/**
 * Template Loader
 *
 * Loads workout templates from YAML files in templates directory.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "./yaml-parser.js";
import { validateTemplateOrThrow, type WorkoutTemplate } from "./template.schema.js";
import type { TemplateRegistry } from "./template.types.js";
import type { Sport } from "../schema/compact-plan.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Configuration Paths
// ============================================================================

/**
 * Default user templates directory in home directory.
 */
const USER_TEMPLATES_DIR = join(homedir(), ".endurance-coach", "workout-templates");

/**
 * Get user templates directory path.
 */
export function getUserTemplatesDir(): string {
  return USER_TEMPLATES_DIR;
}

/**
 * Default templates directory location.
 * In development: ./templates relative to project root
 * In production: bundled with package
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

// ============================================================================
// Types
// ============================================================================

/**
 * Options for loading templates.
 */
export interface LoadTemplatesOptions {
  /**
   * Whether to include user templates from user templates directory.
   * @default false
   */
  includeUserTemplates?: boolean;

  /**
   * Custom user templates directory path.
   * Defaults to ~/.endurance-coach/workout-templates
   */
  userTemplatesDir?: string;

  /**
   * Custom built-in templates directory path.
   * Defaults to built-in templates directory.
   */
  builtinTemplatesDir?: string;
}

// ============================================================================
// File Discovery
// ============================================================================

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

// ============================================================================
// Template Loading
// ============================================================================

/**
 * Load a single template from a YAML file.
 */
function loadTemplateFile(
  filePath: string,
  source: "builtin" | "user"
): WorkoutTemplate & { _source: "builtin" | "user"; _sourcePath: string } {
  const content = readFileSync(filePath, "utf-8");
  const data = parseYaml(content);

  // Validate against schema
  const template = validateTemplateOrThrow(data);

  // Attach source tracking
  (template as any)._source = source;
  (template as any)._sourcePath = filePath;

  return template as WorkoutTemplate & { _source: "builtin" | "user"; _sourcePath: string };
}

/**
 * Load templates from a directory and add them to the templates map.
 */
function loadTemplatesFromDir(
  dir: string,
  source: "builtin" | "user",
  templates: Map<string, WorkoutTemplate & { _source: "builtin" | "user"; _sourcePath: string }>
): void {
  const yamlFiles = findYamlFiles(dir);

  for (const file of yamlFiles) {
    try {
      const template = loadTemplateFile(file, source);

      if (templates.has(template.id)) {
        const existing = templates.get(template.id)!;
        if (source === "user" && existing._source === "builtin") {
          console.warn(
            `User template overrides built-in template with ID "${template.id}". ` +
              `User: ${file} | Built-in: ${existing._sourcePath}`
          );
        } else if (source === "builtin") {
          console.warn(
            `Duplicate template ID: ${template.id} in ${file}. ` +
              `Previous template loaded from: ${existing._sourcePath}`
          );
        }
      }

      templates.set(template.id, template);
    } catch (error) {
      const fileName = basename(file);
      if (error instanceof Error) {
        console.error(
          `Failed to load template ${fileName} from ${source} directory: ${error.message}`
        );
      } else {
        console.error(
          `Failed to load template ${fileName} from ${source} directory: Unknown error`
        );
      }
    }
  }
}

/**
 * Load all templates from the templates directory.
 *
 * @param templatesDir - Optional custom templates directory (backward compatibility)
 * @param options - Optional configuration for template loading
 *
 * @example
 * // Load only built-in templates
 * loadTemplates()
 *
 * @example
 * // Load from custom directory (backward compatible)
 * loadTemplates("/path/to/templates")
 *
 * @example
 * // Load built-in + user templates
 * loadTemplates({ includeUserTemplates: true })
 *
 * @example
 * // Load from custom directories
 * loadTemplates({
 *   includeUserTemplates: true,
 *   builtinTemplatesDir: "/path/to/builtin",
 *   userTemplatesDir: "/path/to/user"
 * })
 */
export function loadTemplates(templatesDir?: string): TemplateRegistry;
export function loadTemplates(options?: LoadTemplatesOptions): TemplateRegistry;
export function loadTemplates(arg?: string | LoadTemplatesOptions): TemplateRegistry {
  const templates = new Map<
    string,
    WorkoutTemplate & { _source: "builtin" | "user"; _sourcePath: string }
  >();

  // Determine if we have a string (templatesDir) or options object
  const isStringArg = typeof arg === "string";

  if (isStringArg) {
    // Backward compatibility: string arg is treated as templatesDir
    const dir = arg ?? getTemplatesDir();
    loadTemplatesFromDir(dir, "builtin", templates);
  } else {
    // New API with options object
    const options: LoadTemplatesOptions = arg ?? {};

    // Load built-in templates first
    const builtinDir = options.builtinTemplatesDir ?? getTemplatesDir();
    loadTemplatesFromDir(builtinDir, "builtin", templates);

    // Optionally load user templates (they will override built-ins)
    if (options.includeUserTemplates) {
      const userDir = options.userTemplatesDir ?? USER_TEMPLATES_DIR;

      if (!existsSync(userDir)) {
        console.log(
          `User templates directory does not exist: ${userDir}. Using built-in templates only.`
        );
      } else {
        loadTemplatesFromDir(userDir, "user", templates);
      }
    }
  }

  // Create registry from templates map (removing type cast for source tracking since TemplateRegistry expects WorkoutTemplate)
  const registryTemplates = new Map<string, WorkoutTemplate>();
  for (const [id, template] of templates) {
    registryTemplates.set(id, template);
  }

  return createRegistry(registryTemplates);
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

    getSource(id: string): "user" | "builtin" | undefined {
      const template = templates.get(id);
      if (!template) return undefined;
      return (template as any)._source ?? "builtin";
    },

    getSourcePath(id: string): string | undefined {
      const template = templates.get(id);
      if (!template) return undefined;
      return (template as any)._sourcePath;
    },
  };
}

/**
 * Get the path to the templates directory.
 */
export function getTemplatesPath(): string {
  return getTemplatesDir();
}
