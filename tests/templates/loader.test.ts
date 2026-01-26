/**
 * Test suite for custom template support (Phase 1.2)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadTemplates, getUserTemplatesDir } from "../../src/templates/index.js";

let testDir: string;

function createTestDir(): string {
  testDir = join(tmpdir(), `endurance-coach-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });
  return testDir;
}

function cleanupTestDir(): void {
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
}

function createTemplateFile(dir: string, sport: string, filename: string, content: string): void {
  const sportDir = join(dir, sport);
  mkdirSync(sportDir, { recursive: true });
  writeFileSync(join(sportDir, filename), content);
}

const CUSTOM_TEMPLATE = `id: custom.run
name: Custom Run
sport: run
type: endurance
category: endurance
humanReadable: Custom run`;

const INVALID_YAML = `id: invalid
invalid: [yaml`;

describe("Template Loader - User Template Support", () => {
  beforeEach(() => {
    createTestDir();
  });

  afterEach(() => {
    cleanupTestDir();
  });

  it("loads built-in templates by default", () => {
    const registry = loadTemplates();
    expect(registry.has("run.easy")).toBe(true);
  });

  it("loads user templates when includeUserTemplates is true", () => {
    createTemplateFile(testDir, "run", "custom.yaml", CUSTOM_TEMPLATE);
    const registry = loadTemplates({ includeUserTemplates: true, userTemplatesDir: testDir });
    expect(registry.has("custom.run")).toBe(true);
  });

  it("handles missing user templates directory gracefully", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const nonExistent = join(tmpdir(), "non-existent");
    const registry = loadTemplates({ includeUserTemplates: true, userTemplatesDir: nonExistent });
    expect(registry.has("run.easy")).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    logSpy.mockRestore();
  });

  it("getUserTemplatesDir returns correct path", () => {
    const dir = getUserTemplatesDir();
    expect(dir).toContain(".endurance-coach");
    expect(dir).toContain("workout-templates");
  });
});
