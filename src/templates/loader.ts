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
import { log } from "../lib/logging.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// MARK: Configuration Paths
// ============================================================================

/**
 * Default user templates directory in home directory.
 */
const USER_TEMPLATES_DIR = join(homedir(), ".endurance-coach", "workout-templates");

/**
 * Get the default user templates directory path.
 *
 * @returns The absolute path to the user templates directory (typically `~/.endurance-coach/workout-templates`)
 */
export function getUserTemplatesDir(): string {
  return USER_TEMPLATES_DIR;
}

/**
 * Locate the package's templates directory.
 *
 * Searches candidate locations in priority order (distribution build, source tree, then current working directory)
 * and returns the first existing directory.
 *
 * @returns The filesystem path to the templates directory.
 * @throws Error if no templates directory is found; the error message lists the locations that were searched.
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
// MARK: Types
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
// MARK: Internal Types
// ============================================================================

/**
 * Internal type for templates with source metadata.
 * Extends WorkoutTemplate with runtime metadata fields.
 */
type TemplateWithMetadata = WorkoutTemplate & {
  _source: "builtin" | "user";
  _sourcePath: string;
};

// ============================================================================
// MARK: File Discovery
// ============================================================================

/**
 * Recursively find all YAML files under a directory.
 *
 * @param dir - Path of the directory to search
 * @returns An array of file paths for files ending with `.yaml` or `.yml`; returns an empty array if the directory does not exist or no matching files are found
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
// MARK: Template Loading
// ============================================================================

/**
 * Loads a workout template from a YAML file and annotates it with source metadata.
 *
 * @param filePath - Path to the YAML template file
 * @param source - Origin of the template, either `"builtin"` or `"user"`
 * @returns The validated workout template with `_source` set to `source` and `_sourcePath` set to `filePath`
 * @throws Error if the file cannot be read, the YAML is invalid, or the template fails schema validation
 */
function loadTemplateFile(filePath: string, source: "builtin" | "user"): TemplateWithMetadata {
  const content = readFileSync(filePath, "utf-8");
  const data = parseYaml(content);

  // Validate against schema
  const template = validateTemplateOrThrow(data);

  // Return template with source metadata
  return {
    ...template,
    _source: source,
    _sourcePath: filePath,
  };
}

/**
 * Loads all YAML templates from the given directory and inserts them into the provided templates map.
 *
 * Adds or overwrites entries in `templates` for each valid template found. Logs warnings when duplicate
 * template IDs are encountered and logs errors for files that fail to load.
 *
 * @param dir - Filesystem path to the directory to search for YAML template files
 * @param source - Origin label for loaded templates; `"builtin"` or `"user"`
 * @param templates - Mutable map to receive loaded templates; keys are template IDs and values include `_source` and `_sourcePath`
 */
function loadTemplatesFromDir(
  dir: string,
  source: "builtin" | "user",
  templates: Map<string, TemplateWithMetadata>
): void {
  const yamlFiles = findYamlFiles(dir);

  for (const file of yamlFiles) {
    try {
      const template = loadTemplateFile(file, source);

      if (templates.has(template.id)) {
        const existing = templates.get(template.id)!;
        if (source === "user" && existing._source === "builtin") {
          log.warn(
            `User template overrides built-in template with ID "${template.id}". ` +
              `User: ${file} | Built-in: ${existing._sourcePath}`
          );
        } else if (source === "builtin") {
          log.warn(
            `Duplicate template ID: ${template.id} in ${file}. ` +
              `Previous template loaded from: ${existing._sourcePath}`
          );
        }
      }

      templates.set(template.id, template);
    } catch (error) {
      const fileName = basename(file);
      if (error instanceof Error) {
        log.error(`Failed to load template ${fileName} from ${source} directory: ${error.message}`);
      } else {
        log.error(`Failed to load template ${fileName} from ${source} directory: Unknown error`);
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
/**
 * Load workout templates from built-in and optionally user template directories and return a registry.
 *
 * The `arg` may be either a string (treated as the built-in templates directory for backward compatibility)
 * or an options object. When user templates are included, templates from the user directory override built-in templates
 * with the same id.
 *
 * @param arg - A path to the built-in templates directory, or a LoadTemplatesOptions object:
 *   - If a string, it is treated as the built-in templates directory.
 *   - If a LoadTemplatesOptions object, `builtinTemplatesDir` and `userTemplatesDir` may override defaults,
 *     and `includeUserTemplates` controls whether user templates are loaded and can override built-ins.
 * @returns A TemplateRegistry containing all loaded templates; registry methods can be used to query templates and their sources.
 */
export function loadTemplates(arg?: string | LoadTemplatesOptions): TemplateRegistry {
  const templates = new Map<string, TemplateWithMetadata>();

  // Determine if we have a string (templatesDir) or options object
  const isStringArg = typeof arg === "string";

  if (isStringArg) {
    // Backward compatibility: string arg is treated as templatesDir
    const dir = arg ?? getTemplatesDir();
    if (!existsSync(dir)) {
      throw new Error(`Templates directory not found: ${dir}`);
    }
    loadTemplatesFromDir(dir, "builtin", templates);
  } else {
    // New API with options object
    const options: LoadTemplatesOptions = arg ?? {};

    // Load built-in templates first
    const builtinDir = options.builtinTemplatesDir ?? getTemplatesDir();
    if (!existsSync(builtinDir)) {
      throw new Error(`Built-in templates directory not found: ${builtinDir}`);
    }
    loadTemplatesFromDir(builtinDir, "builtin", templates);

    // Optionally load user templates (they will override built-ins)
    if (options.includeUserTemplates) {
      const userDir = options.userTemplatesDir ?? USER_TEMPLATES_DIR;

      if (!existsSync(userDir)) {
        log.info(
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
 * Type guard to check if a template has metadata.
 */
function hasMetadata(template: WorkoutTemplate): template is TemplateWithMetadata {
  return "_source" in template && "_sourcePath" in template;
}

/**
 * Create a TemplateRegistry backed by the provided templates map.
 *
 * @param templates - Map keyed by template id with `WorkoutTemplate` values; template objects may include runtime metadata `_source` (`"user"` | `"builtin"`) and `_sourcePath`.
 * @returns The registry exposing template lookup (`get`), listing (`list`), membership (`has`), id enumeration (`ids`), and source inquiry (`getSource`, `getSourcePath`).
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
      return hasMetadata(template) ? template._source : "builtin";
    },

    getSourcePath(id: string): string | undefined {
      const template = templates.get(id);
      if (!template) return undefined;
      return hasMetadata(template) ? template._sourcePath : undefined;
    },
  };
}

/**
 * Get the path to the templates directory.
 */
export function getTemplatesPath(): string {
  return getTemplatesDir();
}
