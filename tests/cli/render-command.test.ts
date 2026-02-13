import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rmSync, mkdirSync, readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { runRender } from "../../src/cli/commands/render.js";

const tempDir = join(tmpdir(), `render-test-${Date.now()}`);

beforeEach(() => {
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("runRender", () => {
  it("renders compact YAML into HTML file", () => {
    const yamlContent = `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "5:00/km"
  unit: km

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Build base fitness"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.easy(30)
      Wed: run.easy(30)
      Fri: run.rest
`;
    const inputFile = join(tempDir, "plan.yaml");
    const outputFile = join(tempDir, "output.html");

    writeFileSync(inputFile, yamlContent);

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    runRender({ command: "render", inputFile, outputFile });

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    expect(existsSync(outputFile)).toBe(true);

    const htmlContent = readFileSync(outputFile, "utf-8");
    expect(htmlContent).toContain('<script type="application/json" id="plan-data">');
    expect(htmlContent).toContain('"version": "1.0"');
    expect(htmlContent).toContain('"weeks":');
    expect(htmlContent).toContain('"Test Athlete"');
  });

  it("outputs HTML to stdout when no outputFile specified", () => {
    const yamlContent = `version: "2.0"

athlete:
  name: "Stdout Test"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "5:00/km"
  unit: km

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.rest
`;
    const inputFile = join(tempDir, "stdout-plan.yaml");

    writeFileSync(inputFile, yamlContent);

    expect(existsSync(inputFile)).toBe(true);

    const logMessages: string[] = [];

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation((...args) => {
      logMessages.push(args.join(" "));
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    runRender({ command: "render", inputFile });

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    expect(logMessages.length).toBeGreaterThan(0);

    const stdoutOutput = logMessages[logMessages.length - 1];
    expect(stdoutOutput).toContain('<script type="application/json" id="plan-data">');
    expect(stdoutOutput).toContain('"version": "1.0"');
  });

  it("exits with error for invalid JSON file", () => {
    const inputFile = join(tempDir, "invalid.json");
    writeFileSync(inputFile, "{ not valid json }");

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => runRender({ command: "render", inputFile })).toThrow("exit:1");

    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("exits with error for invalid YAML compact plan", () => {
    const yamlContent = `version: "2.0"
athlete: invalid: structure`;

    const inputFile = join(tempDir, "invalid.yaml");
    writeFileSync(inputFile, yamlContent);

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => runRender({ command: "render", inputFile })).toThrow("exit:1");

    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("exits with error for non-existent input file", () => {
    const inputFile = join(tempDir, "nonexistent.yaml");

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => runRender({ command: "render", inputFile })).toThrow("exit:1");

    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("renders YAML to specific output file path", () => {
    const yamlContent = `version: "2.0"

athlete:
  name: "File Path Test"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "5:00/km"
  unit: km

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.rest
`;
    const inputFile = join(tempDir, "plan.yaml");
    const outputFile = join(tempDir, "custom-output.html");

    writeFileSync(inputFile, yamlContent);

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    runRender({ command: "render", inputFile, outputFile });

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();

    expect(existsSync(outputFile)).toBe(true);

    const htmlContent = readFileSync(outputFile, "utf-8");
    expect(htmlContent).toContain('<script type="application/json" id="plan-data">');
  });
});
