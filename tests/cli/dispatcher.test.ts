import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  delete process.env.HTTPS_PROXY;
});

function mockCommandModules() {
  const runSchema = vi.fn();
  const runQuery = vi.fn();
  const runRender = vi.fn();
  const runValidate = vi.fn();
  const runExpand = vi.fn();
  const runTemplates = vi.fn();
  const runActivityLaps = vi.fn();
  const runAuth = vi.fn();
  const runSync = vi.fn();
  const runModify = vi.fn();
  const runStats = vi.fn();
  const runTrainingLoad = vi.fn();
  const runFoundation = vi.fn();
  const runStrength = vi.fn();
  const runSchedulePreferences = vi.fn();
  const runHrZones = vi.fn();

  vi.doMock("../../src/cli/commands/schema.js", () => ({ runSchema }));
  vi.doMock("../../src/cli/commands/query.js", () => ({ runQuery }));
  vi.doMock("../../src/cli/commands/render.js", () => ({ runRender }));
  vi.doMock("../../src/cli/commands/validate.js", () => ({ runValidate }));
  vi.doMock("../../src/cli/commands/expand.js", () => ({ runExpand }));
  vi.doMock("../../src/cli/commands/templates.js", () => ({ runTemplates }));
  vi.doMock("../../src/cli/commands/strava.js", () => ({ runActivityLaps, runAuth, runSync }));
  vi.doMock("../../src/cli/commands/modify.js", () => ({ runModify }));
  vi.doMock("../../src/cli/commands/stats.js", () => ({ runStats }));
  vi.doMock("../../src/cli/commands/training-load.js", () => ({ runTrainingLoad }));
  vi.doMock("../../src/cli/commands/foundation.js", () => ({ runFoundation }));
  vi.doMock("../../src/cli/commands/strength.js", () => ({ runStrength }));
  vi.doMock("../../src/cli/commands/schedule-preferences.js", () => ({ runSchedulePreferences }));
  vi.doMock("../../src/cli/commands/hr-zones.js", () => ({ runHrZones }));

  return {
    runSchema,
    runQuery,
    runRender,
    runValidate,
    runExpand,
    runTemplates,
    runActivityLaps,
    runAuth,
    runSync,
    runModify,
    runStats,
    runTrainingLoad,
    runFoundation,
    runStrength,
    runSchedulePreferences,
    runHrZones,
  };
}

describe("cli dispatcher", () => {
  it("routes render command to runRender", async () => {
    const mocks = mockCommandModules();
    const args = { command: "render", inputFile: "plan.json" } as const;

    vi.doMock("../../src/cli/args.js", () => ({
      parseArgs: () => args,
    }));

    vi.doMock("../../src/cli/help.js", () => ({
      printHelp: vi.fn(),
    }));

    await import("../../src/cli/index.js");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.runRender).toHaveBeenCalledWith(args);
  });

  it("logs errors and exits when a handler throws", async () => {
    const errorSpy = vi.fn();
    vi.doMock("../../src/lib/logging.js", () => ({
      log: {
        error: errorSpy,
        info: vi.fn(),
        warn: vi.fn(),
        success: vi.fn(),
        debug: vi.fn(),
        box: vi.fn(),
        start: vi.fn(),
        ready: vi.fn(),
        progress: vi.fn(),
        progressEnd: vi.fn(),
      },
    }));

    const mocks = mockCommandModules();
    const args = { command: "sync" } as const;

    vi.doMock("../../src/cli/args.js", () => ({
      parseArgs: () => args,
    }));

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    mocks.runSync.mockRejectedValue(new Error("boom"));

    vi.doMock("../../src/cli/help.js", () => ({
      printHelp: vi.fn(),
    }));

    await import("../../src/cli/index.js");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("boom"));
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });

  it("sets proxy dispatcher when HTTPS_PROXY is set", async () => {
    const mocks = mockCommandModules();
    process.env.HTTPS_PROXY = "http://proxy.test";

    vi.doMock("undici", () => ({
      ProxyAgent: vi.fn(),
      setGlobalDispatcher: vi.fn(),
    }));

    vi.doMock("../../src/cli/args.js", () => ({
      parseArgs: () => ({ command: "schema" }) as const,
    }));

    vi.doMock("../../src/cli/help.js", () => ({
      printHelp: vi.fn(),
    }));

    const undici = await import("undici");
    await import("../../src/cli/index.js");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(undici.setGlobalDispatcher).toHaveBeenCalled();
    expect(mocks.runSchema).toHaveBeenCalled();
  });
});
