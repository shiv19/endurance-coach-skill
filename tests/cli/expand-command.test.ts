import { describe, it, expect, vi, afterEach } from "vitest";
import { runExpand } from "../../src/cli/commands/expand.js";
import { log } from "../../src/lib/logging.js";
import { readFileSync, writeFileSync } from "fs";
import { loadTemplates, parseYaml, stringifyYaml } from "../../src/templates/index.js";
import { expandPlan, validateWorkoutRefs } from "../../src/expander/index.js";
import {
  validateCompactPlan,
  formatCompactValidationErrors,
} from "../../src/schema/compact-plan.schema.js";

vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
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
  stringifyYaml: vi.fn(),
}));

vi.mock("../../src/expander/index.js", () => ({
  expandPlan: vi.fn(),
  validateWorkoutRefs: vi.fn(),
}));

vi.mock("../../src/schema/compact-plan.schema.js", () => ({
  validateCompactPlan: vi.fn(),
  formatCompactValidationErrors: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("runExpand", () => {
  it("prints JSON to stdout when no output file", () => {
    vi.mocked(readFileSync).mockReturnValue("version: '2.0'");
    vi.mocked(parseYaml).mockReturnValue({ version: "2.0" });
    vi.mocked(validateCompactPlan).mockReturnValue({
      success: true,
      data: { weeks: [] },
    } as any);
    vi.mocked(loadTemplates).mockReturnValue({
      ids: () => ["run.easy"],
    } as never);
    vi.mocked(validateWorkoutRefs).mockReturnValue([]);
    vi.mocked(expandPlan).mockReturnValue({ weeks: [] } as never);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    runExpand({ command: "expand", inputFile: "plan.yaml" });

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ weeks: [] }, null, 2));
    expect(writeFileSync).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("writes YAML output when format is yaml", () => {
    vi.mocked(readFileSync).mockReturnValue("version: '2.0'");
    vi.mocked(parseYaml).mockReturnValue({ version: "2.0" });
    vi.mocked(validateCompactPlan).mockReturnValue({
      success: true,
      data: { weeks: [] },
    } as any);
    vi.mocked(loadTemplates).mockReturnValue({
      ids: () => ["run.easy"],
    } as never);
    vi.mocked(validateWorkoutRefs).mockReturnValue([]);
    vi.mocked(expandPlan).mockReturnValue({ weeks: [] } as never);
    vi.mocked(stringifyYaml).mockReturnValue("yaml-output");

    runExpand({
      command: "expand",
      inputFile: "plan.yaml",
      outputFile: "out.yaml",
      format: "yaml",
    });

    expect(writeFileSync).toHaveBeenCalledWith("out.yaml", "yaml-output");
    expect(log.success).toHaveBeenCalledWith("Expanded plan written to: out.yaml");
  });

  it("exits on validation failure", () => {
    vi.mocked(readFileSync).mockReturnValue("version: '2.0'");
    vi.mocked(parseYaml).mockReturnValue({ version: "2.0" });
    vi.mocked(validateCompactPlan).mockReturnValue({
      success: false,
      errors: [{ message: "Invalid" }],
    } as never);
    vi.mocked(formatCompactValidationErrors).mockReturnValue("Invalid");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => runExpand({ command: "expand", inputFile: "plan.yaml" })).toThrow("exit:1");
    expect(log.error).toHaveBeenCalledWith("Compact plan validation failed:");

    exitSpy.mockRestore();
  });
});
