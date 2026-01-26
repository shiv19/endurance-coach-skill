import { describe, it, expect, vi, afterEach } from "vitest";
import { runValidate } from "../../src/cli/commands/validate.js";
import { log } from "../../src/lib/logging.js";
import { readFileSync } from "fs";
import { parseYaml, loadTemplates } from "../../src/templates/index.js";
import { validateWorkoutRefs } from "../../src/expander/index.js";
import { validatePlan } from "../../src/schema/training-plan.schema.js";
import { validateCompactPlan } from "../../src/schema/compact-plan.schema.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("../../src/lib/logging.js", () => ({
  log: {
    start: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("../../src/templates/index.js", () => ({
  loadTemplates: vi.fn(),
  parseYaml: vi.fn(),
}));

vi.mock("../../src/expander/index.js", () => ({
  validateWorkoutRefs: vi.fn(),
}));

vi.mock("../../src/schema/training-plan.schema.js", () => ({
  validatePlan: vi.fn(),
  formatValidationErrors: vi.fn(),
}));

vi.mock("../../src/schema/compact-plan.schema.js", () => ({
  validateCompactPlan: vi.fn(),
  formatCompactValidationErrors: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("runValidate", () => {
  it("validates compact plan and logs warnings", () => {
    vi.mocked(readFileSync).mockReturnValue("version: '2.0'");
    vi.mocked(parseYaml).mockReturnValue({ version: "2.0" });
    vi.mocked(validateCompactPlan).mockReturnValue({
      success: true,
      data: { weeks: [] },
    } as any);
    vi.mocked(loadTemplates).mockReturnValue({} as never);
    vi.mocked(validateWorkoutRefs).mockReturnValue(["Missing template"]);

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    runValidate({ command: "validate", inputFile: "plan.yaml", compact: true });

    expect(log.warn).toHaveBeenCalledWith("Template reference warnings:");
    expect(errorSpy).toHaveBeenCalledWith("  - Missing template");
    expect(log.success).toHaveBeenCalledWith("Compact plan is valid!");

    errorSpy.mockRestore();
  });

  it("validates full plan JSON", () => {
    vi.mocked(readFileSync).mockReturnValue('{"version":"1.0"}');
    vi.mocked(validatePlan).mockReturnValue({ success: true, data: {} } as never);

    runValidate({ command: "validate", inputFile: "plan.json", compact: false });

    expect(log.success).toHaveBeenCalledWith("Plan is valid!");
  });

  it("exits on invalid JSON", () => {
    vi.mocked(readFileSync).mockReturnValue("not-json");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() =>
      runValidate({ command: "validate", inputFile: "plan.json", compact: false })
    ).toThrow("exit:1");
    expect(log.error).toHaveBeenCalledWith("Input file is not valid JSON");

    exitSpy.mockRestore();
  });
});
