import { describe, it, expect, vi, afterEach } from "vitest";
import { runRender } from "../../src/cli/commands/render.js";
import { log } from "../../src/lib/logging.js";
import { readFileSync, writeFileSync } from "fs";
import { loadTemplates, parseYaml } from "../../src/templates/index.js";
import { expandPlan } from "../../src/expander/index.js";
import { validatePlan, formatValidationErrors } from "../../src/schema/training-plan.schema.js";
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
}));

vi.mock("../../src/expander/index.js", () => ({
  expandPlan: vi.fn(),
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

describe("runRender", () => {
  it("renders compact YAML into template", () => {
    const templateHtml =
      '<html><head></head><body><script type="application/json" id="plan-data">old</script></body></html>';
    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes("plan-viewer.html")) {
        return templateHtml;
      }
      return "version: '2.0'";
    });

    vi.mocked(parseYaml).mockReturnValue({ version: "2.0" });
    vi.mocked(validateCompactPlan).mockReturnValue({
      success: true,
      data: { weeks: [] },
    } as any);
    vi.mocked(loadTemplates).mockReturnValue({} as never);
    vi.mocked(expandPlan).mockReturnValue({ weeks: [] } as never);

    runRender({ command: "render", inputFile: "plan.yaml", outputFile: "out.html" });

    const output = vi.mocked(writeFileSync).mock.calls[0]?.[1] as string;
    expect(output).toContain('<script type="application/json" id="plan-data">');
    expect(output).toContain('"weeks": []');
    expect(log.success).toHaveBeenCalledWith("Plan expanded successfully");
  });

  it("renders JSON plan without expansion", () => {
    const templateHtml =
      '<html><body><script type="application/json" id="plan-data">old</script></body></html>';
    const planJson = JSON.stringify({ version: "1.0", weeks: [] }, null, 2);

    vi.mocked(readFileSync).mockImplementation((path) => {
      if (String(path).includes("plan-viewer.html")) {
        return templateHtml;
      }
      return planJson;
    });

    vi.mocked(validatePlan).mockReturnValue({ success: true, data: { weeks: [] } } as never);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    runRender({ command: "render", inputFile: "plan.json" });

    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain('"version": "1.0"');
    expect(log.success).toHaveBeenCalledWith("Plan schema validated successfully");

    logSpy.mockRestore();
  });

  it("exits on invalid JSON", () => {
    vi.mocked(readFileSync).mockReturnValue("not-json");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => runRender({ command: "render", inputFile: "plan.json" })).toThrow("exit:1");
    expect(log.error).toHaveBeenCalledWith("Input file is not valid JSON");
    expect(formatValidationErrors).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });
});
