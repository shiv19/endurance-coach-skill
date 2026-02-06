import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { runTemplates } from "../../src/cli/commands/templates.js";
import type { TemplatesArgs } from "../../src/cli/args.js";
import { loadTemplates } from "../../src/templates/index.js";

let testDir: string;

function setupTestDir(): string {
  const uniqueId = randomBytes(8).toString("hex");
  const dir = join(tmpdir(), `endurance-coach-validate-test-${Date.now()}-${uniqueId}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTestDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

function createTemplateFile(dir: string, sport: string, filename: string, content: string): void {
  const sportDir = join(dir, sport);
  mkdirSync(sportDir, { recursive: true });
  writeFileSync(join(sportDir, filename), content, "utf-8");
}

describe("templates validate command", () => {
  beforeEach(() => {
    testDir = setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
    vi.restoreAllMocks();
  });

  describe("valid templates", () => {
    it("should not throw error for valid built-in template", () => {
      const args: TemplatesArgs = {
        command: "templates",
        validate: "run.easy",
      };

      expect(() => runTemplates(args)).not.toThrow();
    });

    it("should not throw error for valid user template", () => {
      const userTemplate = `id: custom_easy
name: Custom Easy Run
sport: run
type: easy
category: recovery
humanReadable: Easy run at comfortable pace`;

      createTemplateFile(testDir, "run", "custom_easy.yaml", userTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "custom_easy",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).not.toThrow();
    });

    it("should load valid user template from correct file path", () => {
      const userTemplate = `id: path_test
name: Path Test
sport: run
type: easy
category: recovery
humanReadable: Test`;

      createTemplateFile(testDir, "run", "path_test.yaml", userTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "path_test",
        userTemplatesDir: testDir,
      };

      const templates = loadTemplates({
        includeUserTemplates: true,
        userTemplatesDir: testDir,
      });

      const template = templates.get("path_test");
      expect(template).toBeDefined();
      expect(template?.id).toBe("path_test");
      expect(template?.name).toBe("Path Test");
      expect(template?.sport).toBe("run");

      expect(() => runTemplates(args)).not.toThrow();
    });
  });

  describe("invalid template IDs", () => {
    it("should throw error for non-existent template ID", () => {
      const args: TemplatesArgs = {
        command: "templates",
        validate: "nonexistent_template",
      };

      expect(() => runTemplates(args)).toThrow(/Template not found/);
    });

    it("should include template ID in error message for non-existent template", () => {
      const args: TemplatesArgs = {
        command: "templates",
        validate: "nonexistent_template",
      };

      try {
        runTemplates(args);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).message).toContain("nonexistent_template");
      }
    });

    it("should provide suggestions for similar template IDs", () => {
      const args: TemplatesArgs = {
        command: "templates",
        validate: "eazy",
      };

      try {
        runTemplates(args);
        expect.fail("Should have thrown");
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain("eazy");
        expect(error.message).toContain("Did you mean");
      }
    });

    it("should list all templates hint in error for non-existent template", () => {
      const args: TemplatesArgs = {
        command: "templates",
        validate: "unknown_template",
      };

      try {
        runTemplates(args);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).message).toContain("templates list");
      }
    });
  });

  describe("schema validation errors", () => {
    it("should throw error for template with missing required fields", () => {
      const invalidTemplate = `id: invalid_test
name: Invalid Test
sport: run
# Missing required: type, category, humanReadable`;

      createTemplateFile(testDir, "run", "invalid_test.yaml", invalidTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "invalid_test",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/Validation errors:/);
    });

    it("should throw error for template with invalid sport type", () => {
      const invalidTemplate = `id: invalid_sport
name: Invalid Sport
sport: invalid_sport
type: easy
category: recovery
humanReadable: Test workout`;

      createTemplateFile(testDir, "run", "invalid_sport.yaml", invalidTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "invalid_sport",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/sport/i);
    });

    it("should throw error for template with invalid category type", () => {
      const invalidTemplate = `id: invalid_category
name: Invalid Category
sport: run
type: easy
category: invalid_category
humanReadable: Test workout`;

      createTemplateFile(testDir, "run", "invalid_category.yaml", invalidTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "invalid_category",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/category/i);
    });

    it("should throw error for template with invalid params type definition", () => {
      const invalidTemplate = `id: invalid_params
name: Invalid Params
sport: run
type: intervals
category: speed
params:
  reps:
    type: invalid_type
    default: 5
humanReadable: Intervals with \${reps} repeats`;

      createTemplateFile(testDir, "run", "invalid_params.yaml", invalidTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "invalid_params",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/params/);
    });

    it("should include template ID in validation error message", () => {
      const invalidTemplate = `id: id_in_error
name: ID In Error
sport: run
# Missing required fields`;

      createTemplateFile(testDir, "run", "id_in_error.yaml", invalidTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "id_in_error",
        userTemplatesDir: testDir,
      };

      try {
        runTemplates(args);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).message).toContain("id_in_error");
      }
    });
  });

  describe("YAML syntax errors", () => {
    it("should throw error for malformed YAML", () => {
      const invalidYaml = `id: malformed
name: Malformed YAML
sport: run
type: easy
category: recovery
invalid: [unclosed
humanReadable: Test`;

      createTemplateFile(testDir, "run", "malformed.yaml", invalidYaml);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "malformed",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/Invalid YAML/);
    });

    it("should throw error for YAML with indentation errors", () => {
      const invalidYaml = `id: indentation
name: Indentation Error
sport: run
type: intervals
category: speed
params:
  reps:
type: int
humanReadable: Test`;

      createTemplateFile(testDir, "run", "indentation.yaml", invalidYaml);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "indentation",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow();
    });

    it("should include YAML parsing details in error message", () => {
      const invalidYaml = `id: yaml_error
name: YAML Error
sport: run
type: easy
category: recovery
invalid: [unclosed bracket
humanReadable: Test`;

      createTemplateFile(testDir, "run", "yaml_error.yaml", invalidYaml);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "yaml_error",
        userTemplatesDir: testDir,
      };

      try {
        runTemplates(args);
        expect.fail("Should have thrown");
      } catch (e) {
        expect((e as Error).message).toMatch(/Invalid YAML/i);
      }
    });
  });

  describe("template source priority", () => {
    it("should load user template when it overrides built-in with same ID", () => {
      const userTemplate = `id: easy
name: My Custom Easy Run
sport: run
type: easy
category: recovery
humanReadable: My custom easy run`;

      createTemplateFile(testDir, "run", "easy.yaml", userTemplate);

      const templates = loadTemplates({
        includeUserTemplates: true,
        userTemplatesDir: testDir,
      });

      const template = templates.get("easy");
      expect(template).toBeDefined();
      expect(template?.name).toBe("My Custom Easy Run");

      const source = templates.getSource?.("easy");
      expect(source).toBe("user");

      const args: TemplatesArgs = {
        command: "templates",
        validate: "easy",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).not.toThrow();
    });

    it("should identify built-in template source", () => {
      const templates = loadTemplates();
      const template = templates.get("run.easy");

      expect(template).toBeDefined();

      const source = templates.getSource?.("run.easy");
      expect(source).toBe("builtin");
    });

    it("should identify user template source", () => {
      const userTemplate = `id: user_source_test
name: User Source Test
sport: run
type: easy
category: recovery
humanReadable: Test`;

      createTemplateFile(testDir, "run", "user_source_test.yaml", userTemplate);

      const templates = loadTemplates({
        includeUserTemplates: true,
        userTemplatesDir: testDir,
      });

      const template = templates.get("user_source_test");
      expect(template).toBeDefined();

      const source = templates.getSource?.("user_source_test");
      expect(source).toBe("user");
    });
  });

  describe("template file path resolution", () => {
    it("should return correct file path for user template", () => {
      const userTemplate = `id: path_test
name: Path Test
sport: run
type: easy
category: recovery
humanReadable: Test`;

      createTemplateFile(testDir, "run", "path_test.yaml", userTemplate);

      const templates = loadTemplates({
        includeUserTemplates: true,
        userTemplatesDir: testDir,
      });

      const sourcePath = templates.getSourcePath?.("path_test");
      expect(sourcePath).toBeDefined();
      expect(sourcePath).toContain(testDir);
      expect(sourcePath).toContain("path_test.yaml");
    });

    it("should return file path for built-in template", () => {
      const templates = loadTemplates();
      const sourcePath = templates.getSourcePath?.("run.easy");

      expect(sourcePath).toBeDefined();
      expect(sourcePath).toContain("templates/");
      expect(sourcePath).toContain("run");
      expect(sourcePath).toContain("easy.yaml");
    });
  });

  describe("validation error reporting", () => {
    it("should throw error with non-empty message for invalid template", () => {
      const invalidTemplate = `id: clear_error
name: Clear Error
sport: run
# Missing required fields`;

      createTemplateFile(testDir, "run", "clear_error.yaml", invalidTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "clear_error",
        userTemplatesDir: testDir,
      };

      try {
        runTemplates(args);
        expect.fail("Should have thrown");
      } catch (e) {
        const error = e as Error;
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it("should include template ID in validation error", () => {
      const invalidTemplate = `id: file_path_error
name: File Path Error
sport: run
# Missing required fields`;

      createTemplateFile(testDir, "run", "file_path_error.yaml", invalidTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "file_path_error",
        userTemplatesDir: testDir,
      };

      try {
        runTemplates(args);
        expect.fail("Should have thrown");
      } catch (e) {
        const error = e as Error;
        expect(error.message).toContain("file_path_error");
      }
    });
  });

  describe("edge cases", () => {
    it("should validate templates with no params", () => {
      const noParamsTemplate = `id: no_params
name: No Params
sport: run
type: easy
category: recovery
humanReadable: Simple easy run`;

      createTemplateFile(testDir, "run", "no_params.yaml", noParamsTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "no_params",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).not.toThrow();
    });

    it("should validate templates with complex params", () => {
      const complexTemplate = `id: complex_params
name: Complex Params
sport: run
type: intervals
category: speed
params:
  reps:
    type: int
    required: true
    default: 5
    min: 1
    max: 20
    description: Number of repetitions
  work_duration:
    type: duration
    required: true
    default: "4min"
    description: Duration of each work interval
  recovery_duration:
    type: duration
    required: true
    default: "2min"
    description: Duration of recovery
humanReadable: \${reps} x \${work_duration} work, \${recovery_duration} recovery`;

      createTemplateFile(testDir, "run", "complex_params.yaml", complexTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "complex_params",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).not.toThrow();
    });

    it("should validate templates with structure section", () => {
      const structuredTemplate = `id: structured
name: Structured
sport: run
type: intervals
category: speed
params:
  reps:
    type: int
    default: 5
structure:
  warmup:
    - type: warmup
      duration: "10min"
      pace: "\${paces.easy}"
  main:
    - type: intervals
      repeats: "\${reps}"
      work:
        type: work
        duration: "4min"
        pace: "\${paces.interval}"
      recovery:
        type: recovery
        duration: "2min"
        pace: "\${paces.easy}"
  cooldown:
    - type: cooldown
      duration: "5min"
      pace: "\${paces.easy}"
humanReadable: \${reps} x 4min intervals`;

      createTemplateFile(testDir, "run", "structured.yaml", structuredTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "structured",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).not.toThrow();
    });

    it("should validate templates with optional metadata fields", () => {
      const metadataTemplate = `id: metadata_test
name: Metadata Test
sport: run
type: tempo
category: tempo
humanReadable: Tempo workout
targetZone: "Z3"
rpe: "6-7"
estimatedDuration: "\${30 + 10 + 10}"
notes: Optional notes here`;

      createTemplateFile(testDir, "run", "metadata_test.yaml", metadataTemplate);

      const args: TemplatesArgs = {
        command: "templates",
        validate: "metadata_test",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).not.toThrow();
    });
  });

  describe("integration with existing templates", () => {
    it("should validate at least one template from each sport", () => {
      const templates = loadTemplates();
      const sports = ["swim", "bike", "run", "strength", "brick"];

      for (const sport of sports) {
        const sportTemplates = templates.list(sport as any);
        if (sportTemplates.length > 0) {
          const args: TemplatesArgs = {
            command: "templates",
            validate: sportTemplates[0].id,
          };

          expect(() => runTemplates(args)).not.toThrow();
        }
      }
    });

    it("should load all built-in templates without errors", () => {
      const templates = loadTemplates();
      const allIds = templates.ids();

      expect(allIds.length).toBeGreaterThan(0);

      for (const id of allIds) {
        const template = templates.get(id);
        expect(template).toBeDefined();
        expect(template?.id).toBe(id);
      }
    });
  });

  describe("console logging side effects", () => {
    it("should log validation success message when template is valid", () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const args: TemplatesArgs = {
        command: "templates",
        validate: "run.easy",
      };

      runTemplates(args);

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it("should not log to error console when template is valid", () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const args: TemplatesArgs = {
        command: "templates",
        validate: "run.easy",
      };

      runTemplates(args);

      expect(errorSpy).not.toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
