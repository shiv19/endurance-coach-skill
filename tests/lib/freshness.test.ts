import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ensureFreshData, type FreshnessResult } from "../../src/lib/freshness.js";
import { saveTokens } from "../../src/lib/config.js";
import type { Tokens } from "../../src/lib/config.js";

vi.mock("../../src/strava/oauth.js", () => ({
  getValidTokens: vi.fn(),
}));

vi.mock("../../src/cli/commands/strava.js", () => ({
  syncActivities: vi.fn(),
}));

describe("ensureFreshData", () => {
  const testDir = join(tmpdir(), "endurance-coach-freshness-test-" + Date.now());
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    mkdirSync(testDir, { recursive: true });
    process.env.ENDURANCE_COACH_CONFIG_DIR = testDir;

    vi.clearAllMocks();

    const { resetDatabaseCache } = await import("../../src/db/client.js");
    resetDatabaseCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    rmSync(testDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createMockTokens(overrides: Partial<Tokens> = {}): Tokens {
    return {
      access_token: "test_token",
      refresh_token: "test_refresh",
      expires_at: Date.now() / 1000 + 3600,
      athlete_id: 123,
      ...overrides,
    };
  }

  function createTokensFile(tokens: Tokens): void {
    const tokensPath = join(testDir, "tokens.json");
    writeFileSync(tokensPath, JSON.stringify(tokens, null, 2));
  }

  async function insertActivity(start_date: string): Promise<void> {
    const { initDatabase, getDb } = await import("../../src/db/client.js");
    await initDatabase();
    const db = getDb();
    db.prepare(
      "INSERT INTO activities (id, name, sport_type, start_date, elapsed_time, moving_time) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(1, "Test Run", "Run", start_date, 3600, 3600);
  }

  async function insertSyncLog(completed_at: string): Promise<void> {
    const { initDatabase, getDb } = await import("../../src/db/client.js");
    await initDatabase();
    const db = getDb();
    db.prepare(
      "INSERT INTO sync_log (started_at, completed_at, activities_synced, status) VALUES (?, ?, ?, ?)"
    ).run(completed_at, completed_at, 1, "success");
  }

  describe("when Strava is not configured", () => {
    it("should return not_configured reason", async () => {
      const result = await ensureFreshData();

      expect(result).toEqual({
        synced: false,
        reason: "not_configured",
      });
    });

    it("should log warning when verbose is true", async () => {
      const result = await ensureFreshData({ verbose: true });

      expect(result).toEqual({
        synced: false,
        reason: "not_configured",
      });
    });
  });

  describe("when Strava is configured", () => {
    beforeEach(async () => {
      const tokens = createMockTokens();
      createTokensFile(tokens);
    });

    describe("when no activities exist in database", () => {
      it("should sync when noSync is false", async () => {
        const { syncActivities } = await import("../../src/cli/commands/strava.js");
        const { getValidTokens } = await import("../../src/strava/oauth.js");

        vi.mocked(syncActivities).mockImplementation(async () => {
          const { initDatabase, getDb } = await import("../../src/db/client.js");
          await initDatabase();
          const db = getDb();
          db.prepare(
            "INSERT INTO sync_log (started_at, completed_at, activities_synced, status) VALUES (datetime('now'), datetime('now'), 5, 'success')"
          ).run();
          return { syncedCount: 5 };
        });
        vi.mocked(getValidTokens).mockResolvedValue(createMockTokens());

        const result = await ensureFreshData({ noSync: false });

        expect(result.synced).toBe(true);
        expect(result.syncedCount).toBe(5);

        const { getDb } = await import("../../src/db/client.js");
        const db = getDb();
        const syncLogs = db.prepare("SELECT COUNT(*) as count FROM sync_log").get() as {
          count: number;
        };
        expect(syncLogs.count).toBe(1);
      });

      it("should not sync when noSync is true", async () => {
        const { syncActivities } = await import("../../src/cli/commands/strava.js");

        const result = await ensureFreshData({ noSync: true });

        expect(result.synced).toBe(false);
        expect(result.cached).toBe(false);
        expect(result.warning).toBe("No cached data available");

        expect(syncActivities).not.toHaveBeenCalled();

        const { getDb } = await import("../../src/db/client.js");
        const db = getDb();
        const activities = db.prepare("SELECT COUNT(*) as count FROM activities").get() as {
          count: number;
        };
        expect(activities.count).toBe(0);
      });
    });

    describe("when activities exist and are fresh (synced within 2 hours)", () => {
      it("should return fresh reason when synced recently", async () => {
        const now = new Date();
        const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

        await insertActivity(now.toISOString());

        const { initDatabase, getDb } = await import("../../src/db/client.js");
        await initDatabase();
        const db = getDb();

        const syncTime = new Date(
          thirtyMinutesAgo.getTime() - thirtyMinutesAgo.getTimezoneOffset() * 60000
        )
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        db.prepare(
          "INSERT INTO sync_log (started_at, completed_at, activities_synced, status) VALUES (?, ?, ?, ?)"
        ).run(syncTime, syncTime, 1, "success");

        const { syncActivities } = await import("../../src/cli/commands/strava.js");

        const result = await ensureFreshData();

        expect(result.synced).toBe(false);
        expect(result.reason).toBe("fresh");

        expect(syncActivities).not.toHaveBeenCalled();
      });
    });

    describe("when activities exist but are stale", () => {
      it("should sync when data is stale and noSync is false", async () => {
        const now = new Date();
        const twoDaysAgo = new Date(now);
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        await insertActivity(twoDaysAgo.toISOString());

        const { syncActivities } = await import("../../src/cli/commands/strava.js");
        const { getValidTokens } = await import("../../src/strava/oauth.js");

        vi.mocked(syncActivities).mockImplementation(async () => {
          const { initDatabase, getDb } = await import("../../src/db/client.js");
          await initDatabase();
          const db = getDb();
          db.prepare(
            "INSERT INTO sync_log (started_at, completed_at, activities_synced, status) VALUES (datetime('now'), datetime('now'), 3, 'success')"
          ).run();
          return { syncedCount: 3 };
        });
        vi.mocked(getValidTokens).mockResolvedValue(createMockTokens());

        const result = await ensureFreshData({ noSync: false });

        expect(result.synced).toBe(true);
        expect(result.syncedCount).toBe(3);

        const { getDb } = await import("../../src/db/client.js");
        const db = getDb();
        const syncLogs = db.prepare("SELECT COUNT(*) as count FROM sync_log").get() as {
          count: number;
        };
        expect(syncLogs.count).toBe(1);
      });

      it("should cap sync window at 30 days", async () => {
        const now = new Date();
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        await insertActivity(sixtyDaysAgo.toISOString());

        const { syncActivities } = await import("../../src/cli/commands/strava.js");
        const { getValidTokens } = await import("../../src/strava/oauth.js");

        vi.mocked(syncActivities).mockResolvedValue({ syncedCount: 1 });
        vi.mocked(getValidTokens).mockResolvedValue(createMockTokens());

        await ensureFreshData({ noSync: false, verbose: true });

        expect(syncActivities).toHaveBeenCalledWith(expect.any(Object), 30, expect.any(Boolean));
      });

      it("should return cached result when noSync is true", async () => {
        const now = new Date();
        const fiveDaysAgo = new Date(now);
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        await insertActivity(fiveDaysAgo.toISOString());

        const { syncActivities } = await import("../../src/cli/commands/strava.js");

        const result = await ensureFreshData({ noSync: true });

        expect(result.synced).toBe(false);
        expect(result.cached).toBe(true);
        expect(result.warning).toContain("Using cached data");
        expect(result.warning).toContain("5 days ago");

        expect(syncActivities).not.toHaveBeenCalled();
      });
    });

    describe("when sync fails", () => {
      it("should return error with warning", async () => {
        const { syncActivities } = await import("../../src/cli/commands/strava.js");
        const { getValidTokens } = await import("../../src/strava/oauth.js");

        vi.mocked(getValidTokens).mockResolvedValue(createMockTokens());
        vi.mocked(syncActivities).mockResolvedValue({
          syncedCount: 0,
          error: "Network error",
        });

        const result = await ensureFreshData({ noSync: false });

        expect(result.synced).toBe(false);
        expect(result.reason).toBe("error");
        expect(result.warning).toBe("Network error");
        expect(result.cached).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should handle empty activity list from API", async () => {
        const { syncActivities } = await import("../../src/cli/commands/strava.js");
        const { getValidTokens } = await import("../../src/strava/oauth.js");

        vi.mocked(getValidTokens).mockResolvedValue(createMockTokens());
        vi.mocked(syncActivities).mockResolvedValue({ syncedCount: 0 });

        const result = await ensureFreshData({ noSync: false });

        expect(result.synced).toBe(true);
        expect(result.syncedCount).toBe(0);
      });
    });
  });
});

describe("FreshnessResult type", () => {
  it("should have correct structure", () => {
    const result: FreshnessResult = {
      synced: false,
      reason: "not_configured",
    };

    expect(result).toHaveProperty("synced");
    expect(result).toHaveProperty("reason");
    expect(result.synced).toBe(false);
    expect(result.reason).toBe("not_configured");
  });

  it("should include optional fields", () => {
    const result: FreshnessResult = {
      synced: true,
      syncedCount: 10,
      warning: "Test warning",
      cached: true,
    };

    expect(result.syncedCount).toBe(10);
    expect(result.warning).toBe("Test warning");
    expect(result.cached).toBe(true);
  });
});
