import { describe, it, expect, vi, afterEach } from "vitest";
import { runStats } from "../../src/cli/commands/stats.js";
import { runTrainingLoad } from "../../src/cli/commands/training-load.js";
import { runFoundation } from "../../src/cli/commands/foundation.js";
import { runStrength } from "../../src/cli/commands/strength.js";
import { runSchedulePreferences } from "../../src/cli/commands/schedule-preferences.js";
import { runHrZones } from "../../src/cli/commands/hr-zones.js";
import { runQuery } from "../../src/cli/commands/query.js";
import { initDatabase, queryJson, query } from "../../src/db/client.js";
import { formatTable } from "../../src/cli/utils/format-table.js";

vi.mock("../../src/db/client.js", () => ({
  initDatabase: vi.fn(),
  queryJson: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../src/cli/utils/format-table.js", () => ({
  formatTable: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("analytics-style CLI commands", () => {
  it("runs stats in JSON mode", async () => {
    vi.mocked(queryJson).mockReturnValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runStats({ command: "stats", json: true });

    expect(initDatabase).toHaveBeenCalled();
    expect(queryJson).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(output);
    expect(parsed).toEqual({
      weeklyVolume: [],
      longestSessions: [],
      averageSessionDuration: [],
    });

    logSpy.mockRestore();
  });

  it("prints stats tables with no results", async () => {
    vi.mocked(queryJson).mockReturnValue([]);
    vi.mocked(formatTable).mockReturnValue("");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runStats({ command: "stats", json: false });

    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("(no results)"))).toBe(true);

    logSpy.mockRestore();
  });

  it("uses default weeks for training load when invalid", async () => {
    vi.mocked(queryJson).mockReturnValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runTrainingLoad({ command: "training-load", json: true, weeks: 0 });

    const sql = vi.mocked(queryJson).mock.calls[0]?.[0] as string;
    expect(sql).toContain("-84 days");

    logSpy.mockRestore();
  });

  it("uses default top weeks in foundation when invalid", async () => {
    vi.mocked(queryJson).mockReturnValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runFoundation({ command: "foundation", json: true, topWeeks: -2 });

    const sqlCalls = vi.mocked(queryJson).mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes("LIMIT 5"))).toBe(true);

    logSpy.mockRestore();
  });

  it("uses default thresholds in strength when invalid", async () => {
    vi.mocked(queryJson).mockReturnValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runStrength({
      command: "strength",
      json: true,
      months: 0,
      longMonths: 0,
      easyHrMax: 0,
      longMinutes: 0,
      years: 0,
    });

    const sqlCalls = vi.mocked(queryJson).mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes("-6 months"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("moving_time > 3600"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("average_heartrate < 145"))).toBe(true);

    logSpy.mockRestore();
  });

  it("uses default ride/run thresholds for schedule preferences", async () => {
    vi.mocked(queryJson).mockReturnValue([]);
    vi.mocked(formatTable).mockReturnValue("");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runSchedulePreferences({
      command: "schedule-preferences",
      json: false,
      rideMinutes: -1,
      runMinutes: 0,
    });

    const sqlCalls = vi.mocked(queryJson).mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes("moving_time > 5400"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("moving_time > 3600"))).toBe(true);
    expect(logSpy.mock.calls.some((call) => String(call[0]).includes("(no results)"))).toBe(true);

    logSpy.mockRestore();
  });

  it("uses default week ranges for hr-zones when invalid", async () => {
    vi.mocked(queryJson).mockReturnValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runHrZones({ command: "hr-zones", json: true, weeks: 0, distributionWeeks: 0 });

    const sqlCalls = vi.mocked(queryJson).mock.calls.map((call) => String(call[0]));
    expect(sqlCalls.some((sql) => sql.includes("-56 days"))).toBe(true);
    expect(sqlCalls.some((sql) => sql.includes("-84 days"))).toBe(true);

    logSpy.mockRestore();
  });

  it("runs query in json and text modes", async () => {
    vi.mocked(queryJson).mockReturnValue([{ id: 1 }]);
    vi.mocked(query).mockReturnValue("result");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runQuery({ command: "query", sql: "select 1", json: true });
    await runQuery({ command: "query", sql: "select 1", json: false });

    expect(queryJson).toHaveBeenCalledWith("select 1");
    expect(query).toHaveBeenCalledWith("select 1");

    logSpy.mockRestore();
  });
});
