import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runExpand } from "../../src/cli/commands/expand.js";
import { log } from "../../src/lib/logging.js";

describe("runExpand", () => {
  let tempDir: string;
  const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit:${code}`);
  }) as never);

  const createTempFile = (content: string, filename = "plan.yaml"): string => {
    if (!tempDir) {
      tempDir = join(tmpdir(), `endurance-coach-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    }
    const filepath = join(tempDir, filename);
    writeFileSync(filepath, content, "utf-8");
    return filepath;
  };

  const createValidPlan = (overrides = {}): string => {
    const basePlan = `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-05-15"
  paces:
    easy: "5:30/km"

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Build base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.rest`;

    return basePlan;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = "";
    }
  });

  it("prints JSON to stdout when no output file", () => {
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);

    runExpand({ command: "expand", inputFile, format: "json" });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("weeks");
    expect(Array.isArray(parsed.weeks)).toBe(true);
  });

  it("writes JSON output when format is json and output file specified", () => {
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);
    const outputFile = createTempFile("", "output.json");

    runExpand({
      command: "expand",
      inputFile,
      outputFile,
      format: "json",
    });

    expect(existsSync(outputFile)).toBe(true);
    const output = readFileSync(outputFile, "utf-8");
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("weeks");
    expect(Array.isArray(parsed.weeks)).toBe(true);
  });

  it("writes YAML output when format is yaml", () => {
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);
    const outputFile = createTempFile("", "output.yaml");

    runExpand({
      command: "expand",
      inputFile,
      outputFile,
      format: "yaml",
    });

    expect(existsSync(outputFile)).toBe(true);
    const output = readFileSync(outputFile, "utf-8");
    expect(output).toContain("version:");
    expect(output).toContain("weeks:");
  });

  it("exits when input file does not exist", () => {
    if (!tempDir) {
      tempDir = join(tmpdir(), `endurance-coach-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    }
    const nonExistentFile = join(tempDir, "nonexistent.yaml");

    expect(() =>
      runExpand({ command: "expand", inputFile: nonExistentFile, format: "json" })
    ).toThrow("exit:1");
  });

  it("exits on invalid YAML", () => {
    const invalidYaml = createTempFile("{key: unquoted colon: in middle}");
    const inputFile = invalidYaml;

    expect(() => runExpand({ command: "expand", inputFile, format: "json" })).toThrow("exit:1");
  });

  it("exits on validation failure", () => {
    const invalidPlan = createTempFile("version: '2.0'");
    const inputFile = invalidPlan;

    expect(() => runExpand({ command: "expand", inputFile, format: "json" })).toThrow("exit:1");
    expect(consoleErrorSpy).toHaveBeenCalled();
    const errorCall = consoleErrorSpy.mock.calls[0][0] as string;
    expect(errorCall).toContain("Validation failed");
  });

  it("exits on invalid template reference", () => {
    const planWithInvalidRef = `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-05-15"
  paces:
    easy: "5:30/km"

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Build base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.nonexistent`;
    const inputFile = createTempFile(planWithInvalidRef);

    expect(() => runExpand({ command: "expand", inputFile, format: "json" })).toThrow("exit:1");
  });

  it("expands plan with rest workout successfully", () => {
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);
    const outputFile = createTempFile("", "output.json");

    runExpand({
      command: "expand",
      inputFile,
      outputFile,
      format: "json",
    });

    expect(existsSync(outputFile)).toBe(true);
    const output = readFileSync(outputFile, "utf-8");
    const parsed = JSON.parse(output);
    expect(parsed.weeks).toHaveLength(1);
    expect(parsed.weeks[0].weekNumber).toBe(1);
  });

  it("writes output with correct structure", () => {
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);
    const outputFile = createTempFile("", "output.yaml");

    runExpand({
      command: "expand",
      inputFile,
      outputFile,
      format: "yaml",
    });

    const output = readFileSync(outputFile, "utf-8");
    expect(output).toMatch(/version:\s*["']1\.0["']/);
    expect(output).toMatch(/weeks:/);
  });

  it("handles verbose flag by showing progress info", () => {
    const infoSpy = vi.spyOn(log, "info").mockImplementation(() => undefined);
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);

    runExpand({
      command: "expand",
      inputFile,
      format: "json",
      verbose: true,
    });

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining("Loaded"));
    infoSpy.mockRestore();
  });

  it("writes to file when outputFile is specified", () => {
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);
    const outputFile = createTempFile("", "output.json");

    runExpand({
      command: "expand",
      inputFile,
      outputFile,
      format: "json",
    });

    expect(existsSync(outputFile)).toBe(true);
    const content = readFileSync(outputFile, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("defaults to json format when format not specified", () => {
    const planYaml = createValidPlan();
    const inputFile = createTempFile(planYaml);

    runExpand({ command: "expand", inputFile });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = consoleLogSpy.mock.calls[0][0] as string;
    expect(() => JSON.parse(output)).not.toThrow();
  });
});
