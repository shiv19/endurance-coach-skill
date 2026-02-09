import { describe, it, expect, vi, afterEach } from "vitest";
import { parseArgs } from "../../src/cli/args.js";
import { log } from "../../src/lib/logging.js";

vi.mock("../../src/lib/logging.js", () => ({
  log: {
    error: vi.fn(),
    start: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
  },
}));

const originalArgv = process.argv.slice();

function setArgv(args: string[]): void {
  process.argv = ["node", "cli", ...args];
}

afterEach(() => {
  process.argv = originalArgv.slice();
  vi.clearAllMocks();
});

describe("parseArgs", () => {
  it("parses render with positional output", () => {
    setArgv(["render", "plan.yaml", "out.html"]);
    const result = parseArgs();

    expect(result.command).toBe("render");
    if (result.command === "render") {
      expect(result.inputFile).toBe("plan.yaml");
      expect(result.outputFile).toBe("out.html");
    }
  });

  it("parses expand flags and output", () => {
    setArgv(["expand", "plan.yaml", "--format=yaml", "-o", "out.yaml", "-v"]);
    const result = parseArgs();

    expect(result.command).toBe("expand");
    if (result.command === "expand") {
      expect(result.inputFile).toBe("plan.yaml");
      expect(result.format).toBe("yaml");
      expect(result.outputFile).toBe("out.yaml");
      expect(result.verbose).toBe(true);
    }
  });

  it("parses stats weeks and longest-weeks", () => {
    setArgv(["stats", "--weeks", "8", "--longest-weeks=12", "--json"]);
    const result = parseArgs();

    expect(result.command).toBe("stats");
    if (result.command === "stats") {
      expect(result.weeks).toBe(8);
      expect(result.longestWeeks).toBe(12);
      expect(result.json).toBe(true);
    }
  });

  it("parses templates show and filters", () => {
    setArgv([
      "templates",
      "show",
      "run.easy",
      "--sport=run",
      "--source",
      "builtin",
      "--type",
      "endurance",
    ]);
    const result = parseArgs();

    expect(result.command).toBe("templates");
    if (result.command === "templates") {
      expect(result.show).toBe("run.easy");
      expect(result.sport).toBe("run");
      expect(result.source).toBe("builtin");
      expect(result.type).toBe("endurance");
    }
  });

  it("parses validate compact from extension", () => {
    setArgv(["validate", "plan.yaml"]);
    const result = parseArgs();

    expect(result.command).toBe("validate");
    if (result.command === "validate") {
      expect(result.inputFile).toBe("plan.yaml");
      expect(result.compact).toBe(true);
    }
  });

  it("parses modify with required flags", () => {
    setArgv(["modify", "--backup", "backup.json", "--plan=plan.json", "--output", "out.json"]);
    const result = parseArgs();

    expect(result.command).toBe("modify");
    if (result.command === "modify") {
      expect(result.backup).toBe("backup.json");
      expect(result.plan).toBe("plan.json");
      expect(result.output).toBe("out.json");
    }
  });

  it("errors on activity without laps flag", () => {
    setArgv(["activity", "123"]);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => parseArgs()).toThrow("exit:1");
    expect(log.error).toHaveBeenCalledWith(
      "activity command requires a subcommand flag like --laps"
    );

    exitSpy.mockRestore();
  });

  it("errors on invalid templates source", () => {
    setArgv(["templates", "--source", "invalid"]);
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => parseArgs()).toThrow("exit:1");
    expect(log.error).toHaveBeenCalledWith(
      "Invalid source value: invalid. Must be 'user', 'builtin', or 'all'"
    );

    exitSpy.mockRestore();
  });

  describe("activity-record --help", () => {
    it("displays help when --help flag is provided", () => {
      setArgv(["activity-record", "--help"]);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);

      expect(() => parseArgs()).toThrow("exit:0");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("activity-record - Manually record an activity")
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("--type=TYPE"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("--duration=MINUTES"));

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("displays help when -h flag is provided", () => {
      setArgv(["activity-record", "-h"]);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
        throw new Error(`exit:${code}`);
      }) as never);

      expect(() => parseArgs()).toThrow("exit:0");
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("activity-record - Manually record an activity")
      );

      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });

    it("does not display help when --help is not present", () => {
      setArgv(["activity-record", "--type=Run", "--duration=30"]);
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const result = parseArgs();

      expect(result.command).toBe("activity-record");
      if (result.command === "activity-record") {
        expect(result.type).toBe("Run");
        expect(result.duration).toBe(30);
      }
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining("activity-record - Manually record an activity")
      );

      consoleSpy.mockRestore();
    });
  });
});
