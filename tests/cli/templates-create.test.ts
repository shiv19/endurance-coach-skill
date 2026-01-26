import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import { runTemplates } from "../../src/cli/commands/templates.js";
import type { TemplatesArgs } from "../../src/cli/args.js";

// Create a temporary directory for testing
let testDir: string;

function setupTestDir(): string {
  const uniqueId = randomBytes(8).toString("hex");
  const dir = join(tmpdir(), `endurance-coach-create-test-${Date.now()}-${uniqueId}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupTestDir(dir: string): void {
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("templates create command", () => {
  beforeEach(() => {
    testDir = setupTestDir();
  });

  afterEach(() => {
    cleanupTestDir(testDir);
  });

  describe("minimal template creation", () => {
    it("should create a minimal valid template", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "my_custom_workout",
        type: "run",
        category: "endurance",
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      const filePath = join(testDir, "run", "my_custom_workout.yaml");
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("id: my_custom_workout");
      expect(content).toContain("sport: run");
      expect(content).toContain("type: endurance");
      expect(content).toContain("category: endurance");
      expect(content).toContain("humanReadable:");
    });

    it("should create template for each sport type", () => {
      const sports: Array<"run" | "bike" | "swim" | "strength" | "brick"> = [
        "run",
        "bike",
        "swim",
        "strength",
        "brick",
      ];

      for (const sport of sports) {
        const args: TemplatesArgs = {
          command: "templates",
          create: `test.${sport}`,
          type: sport,
          userTemplatesDir: testDir,
        };

        runTemplates(args);

        const filePath = join(testDir, sport, `test.${sport}.yaml`);
        expect(existsSync(filePath)).toBe(true);

        const content = readFileSync(filePath, "utf-8");
        expect(content).toContain(`sport: ${sport}`);
      }
    });
  });

  describe("example template creation", () => {
    it("should create an example template with structure", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "tempo_example",
        type: "run",
        category: "tempo",
        example: true,
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      const filePath = join(testDir, "run", "tempo_example.yaml");
      const content = readFileSync(filePath, "utf-8");

      // Should have params section
      expect(content).toContain("params:");
      expect(content).toContain("duration:");

      // Should have structure section
      expect(content).toContain("structure:");
      expect(content).toContain("warmup:");
      expect(content).toContain("main:");
      expect(content).toContain("cooldown:");

      // Should have interpolated values
      expect(content).toContain("${duration}");
      expect(content).toContain("${paces.easy}");
    });

    it("should create example for intervals type", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "intervals_example",
        type: "run",
        category: "intervals",
        example: true,
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      const filePath = join(testDir, "run", "intervals_example.yaml");
      const content = readFileSync(filePath, "utf-8");

      expect(content).toContain("repeats:");
      expect(content).toContain("work:");
      expect(content).toContain("recovery:");
    });

    it("should create example for strength type", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "strength_example",
        type: "strength",
        category: "strength",
        example: true,
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      const filePath = join(testDir, "strength", "strength_example.yaml");
      const content = readFileSync(filePath, "utf-8");

      expect(content).toContain("Squats x 12-15");
      expect(content).toContain("Lunges x 10 each leg");
      expect(content).toContain("Plank x 45-60s");
      expect(content).toContain("Push-ups x 10-15");
      expect(content).toContain("Glute bridges x 15");
    });
  });

  describe("create from template file", () => {
    it("should load scaffold from existing template file", () => {
      // Create a source template file
      const sourceTemplate = `
id: source_workout
name: Source Workout
sport: run
type: tempo
category: tempo

params:
  duration:
    type: int
    default: 30

structure:
  main:
    - type: work
      duration: "\${duration}min"

humanReadable: |
  TEMPO - \${duration} minutes
`;

      const sourcePath = join(testDir, "source.yaml");
      writeFileSync(sourcePath, sourceTemplate, "utf-8");

      const args: TemplatesArgs = {
        command: "templates",
        create: "derived_workout",
        type: "run",
        templateFile: sourcePath,
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      const filePath = join(testDir, "run", "derived_workout.yaml");
      expect(existsSync(filePath)).toBe(true);

      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("id: derived_workout");
      expect(content).toContain("name: Source Workout");
      expect(content).toContain("params:");
      expect(content).toContain("structure:");
    });

    it("should override sport when template file specifies different sport", () => {
      const sourceTemplate = `
id: source_workout
name: Source Workout
sport: bike
type: tempo
category: tempo
humanReadable: Tempo
`;

      const sourcePath = join(testDir, "source.yaml");
      writeFileSync(sourcePath, sourceTemplate, "utf-8");

      const args: TemplatesArgs = {
        command: "templates",
        create: "derived_workout2",
        type: "run", // Override sport
        templateFile: sourcePath,
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      const filePath = join(testDir, "run", "derived_workout2.yaml");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("sport: run");
    });
  });

  describe("validation and error handling", () => {
    it("should reject template ID with invalid characters", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "my_invalid_workout!", // Contains special chars
        type: "run",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/invalid.*template.*id/i);
    });

    it("should reject invalid sport type", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "test_workout",
        type: "invalid_sport" as any,
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/invalid.*sport/i);
    });

    it("should reject invalid category type", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "test_workout2",
        type: "run",
        category: "invalid_category" as any,
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/invalid.*category/i);
    });

    it("should reject template file that doesn't exist", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "derived_workout3",
        type: "run",
        templateFile: "/nonexistent/path/template.yaml",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/template.*file.*not.*found/i);
    });

    it("should reject template file that is invalid YAML", () => {
      const invalidYaml = `
id: test
sport: run
invalid: [unclosed
`;

      const sourcePath = join(testDir, "invalid.yaml");
      writeFileSync(sourcePath, invalidYaml, "utf-8");

      const args: TemplatesArgs = {
        command: "templates",
        create: "derived_workout",
        type: "run",
        templateFile: sourcePath,
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/invalid.*yaml/i);
    });

    it("should reject template file that fails schema validation", () => {
      const invalidTemplate = `
id: test
name: Test
sport: run
# Missing required fields: type, category, humanReadable
`;

      const sourcePath = join(testDir, "invalid.yaml");
      writeFileSync(sourcePath, invalidTemplate, "utf-8");

      const args: TemplatesArgs = {
        command: "templates",
        create: "derived_workout",
        type: "run",
        templateFile: sourcePath,
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/expected.*string/i);
    });
  });

  describe("overwrite behavior", () => {
    it("should fail when template exists without --overwrite flag", () => {
      // Create initial template
      const initialArgs: TemplatesArgs = {
        command: "templates",
        create: "existing_workout",
        type: "run",
        userTemplatesDir: testDir,
      };
      runTemplates(initialArgs);

      // Try to create again without overwrite
      const args: TemplatesArgs = {
        command: "templates",
        create: "existing_workout",
        type: "run",
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).toThrow(/template.*already.*exists/i);
    });

    it("should overwrite existing template with --overwrite flag", () => {
      // Create initial template
      const initialArgs: TemplatesArgs = {
        command: "templates",
        create: "existing_workout",
        type: "run",
        userTemplatesDir: testDir,
      };
      runTemplates(initialArgs);

      // Overwrite with different category
      const args: TemplatesArgs = {
        command: "templates",
        create: "existing_workout",
        type: "run",
        category: "tempo",
        overwrite: true,
        userTemplatesDir: testDir,
      };

      expect(() => runTemplates(args)).not.toThrow();

      const filePath = join(testDir, "run", "existing_workout.yaml");
      const content = readFileSync(filePath, "utf-8");
      expect(content).toContain("category: tempo");
    });
  });

  describe("dry-run mode", () => {
    it("should not create file in dry-run mode", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "dry_run_workout",
        type: "run",
        dryRun: true,
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      const filePath = join(testDir, "run", "dry_run_workout.yaml");
      expect(existsSync(filePath)).toBe(false);
    });
  });

  describe("file organization", () => {
    it("should create sport-specific subdirectories", () => {
      const args: TemplatesArgs = {
        command: "templates",
        create: "test_workout3",
        type: "bike",
        userTemplatesDir: testDir,
      };

      runTemplates(args);

      expect(existsSync(join(testDir, "bike"))).toBe(true);
      expect(existsSync(join(testDir, "bike", "test_workout3.yaml"))).toBe(true);
    });
  });
});
