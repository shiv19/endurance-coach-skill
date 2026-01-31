import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ensureFreshData, type FreshnessResult } from "../../src/lib/freshness.js";
import { tokensExist } from "../../src/lib/config.js";
import { initDatabase, queryJson } from "../../src/db/client.js";
import { getValidTokens } from "../../src/strava/oauth.js";
import { syncActivities } from "../../src/cli/commands/strava.js";

vi.mock("../../src/lib/config.js", () => ({
  tokensExist: vi.fn(),
}));

vi.mock("../../src/db/client.js", () => ({
  initDatabase: vi.fn(),
  execute: vi.fn(),
  queryJson: vi.fn(),
}));

vi.mock("../../src/strava/oauth.js", () => ({
  getValidTokens: vi.fn(),
}));

vi.mock("../../src/cli/commands/strava.js", () => ({
  syncActivities: vi.fn(),
}));

describe("ensureFreshData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when Strava is not configured", () => {
    it("should return not_configured reason", async () => {
      vi.mocked(tokensExist).mockReturnValue(false);

      const result = await ensureFreshData();

      expect(result).toEqual({
        synced: false,
        reason: "not_configured",
      });
      expect(tokensExist).toHaveBeenCalled();
    });

    it("should log warning when verbose is true", async () => {
      vi.mocked(tokensExist).mockReturnValue(false);

      const result = await ensureFreshData({ verbose: true });

      expect(result).toEqual({
        synced: false,
        reason: "not_configured",
      });
      expect(tokensExist).toHaveBeenCalled();
    });
  });

  describe("when Strava is configured", () => {
    beforeEach(() => {
      vi.mocked(tokensExist).mockReturnValue(true);
      vi.mocked(initDatabase).mockResolvedValue(undefined);
    });

    describe("when no activities exist in database", () => {
      it("should sync when noSync is false", async () => {
        vi.mocked(queryJson).mockReturnValue([]);

        const mockTokens = {
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        };

        vi.mocked(getValidTokens).mockResolvedValue(mockTokens);
        vi.mocked(syncActivities).mockResolvedValue({ syncedCount: 1 });

        const result = await ensureFreshData({ noSync: false });

        expect(result.synced).toBe(true);
        expect(result.syncedCount).toBe(1);
        expect(getValidTokens).toHaveBeenCalled();
        expect(syncActivities).toHaveBeenCalledWith(mockTokens, 730, false);
      });

      it("should not sync when noSync is true", async () => {
        vi.mocked(queryJson).mockReturnValue([]);

        const result = await ensureFreshData({ noSync: true });

        expect(result.synced).toBe(false);
        expect(result.cached).toBe(false);
        expect(result.warning).toBe("No cached data available");
        expect(getValidTokens).not.toHaveBeenCalled();
        expect(syncActivities).not.toHaveBeenCalled();
      });
    });

    describe("when activities exist and are fresh", () => {
      it("should return fresh reason when latest activity is from today", async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);

        vi.mocked(queryJson).mockReturnValue([{ start_date: today.toISOString() }]);

        const result = await ensureFreshData();

        expect(result.synced).toBe(false);
        expect(result.reason).toBe("fresh");
        expect(getValidTokens).not.toHaveBeenCalled();
        expect(syncActivities).not.toHaveBeenCalled();
      });

      it("should log info message when verbose is true", async () => {
        const today = new Date();
        today.setHours(12, 0, 0, 0);

        vi.mocked(queryJson).mockReturnValue([{ start_date: today.toISOString() }]);

        const result = await ensureFreshData({ verbose: true });

        expect(result.synced).toBe(false);
        expect(result.reason).toBe("fresh");
        expect(getValidTokens).not.toHaveBeenCalled();
        expect(syncActivities).not.toHaveBeenCalled();
      });
    });

    describe("when activities exist but are stale", () => {
      it("should sync when data is stale and noSync is false", async () => {
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        vi.mocked(queryJson).mockReturnValue([{ start_date: twoDaysAgo.toISOString() }]);

        const mockTokens = {
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        };

        vi.mocked(getValidTokens).mockResolvedValue(mockTokens);
        vi.mocked(syncActivities).mockResolvedValue({ syncedCount: 1 });

        const result = await ensureFreshData({ noSync: false });

        expect(result.synced).toBe(true);
        expect(result.syncedCount).toBe(1);
        expect(getValidTokens).toHaveBeenCalled();
        expect(syncActivities).toHaveBeenCalledWith(mockTokens, 2, false);
      });

      it("should cap sync window at 30 days", async () => {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        vi.mocked(queryJson).mockReturnValue([{ start_date: sixtyDaysAgo.toISOString() }]);

        const mockTokens = {
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        };

        vi.mocked(getValidTokens).mockResolvedValue(mockTokens);
        vi.mocked(syncActivities).mockResolvedValue({ syncedCount: 1 });

        await ensureFreshData({ noSync: false, verbose: true });

        expect(getValidTokens).toHaveBeenCalled();
        expect(syncActivities).toHaveBeenCalledWith(mockTokens, 30, true);
      });

      it("should return cached result when noSync is true", async () => {
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        vi.mocked(queryJson).mockReturnValue([{ start_date: fiveDaysAgo.toISOString() }]);

        const result = await ensureFreshData({ noSync: true });

        expect(result.synced).toBe(false);
        expect(result.cached).toBe(true);
        expect(result.warning).toContain("Using cached data");
        expect(result.warning).toContain("5 days ago");
        expect(getValidTokens).not.toHaveBeenCalled();
        expect(syncActivities).not.toHaveBeenCalled();
      });
    });

    describe("when sync fails", () => {
      it("should return error with warning", async () => {
        vi.mocked(queryJson).mockReturnValue([]);

        vi.mocked(getValidTokens).mockResolvedValue({
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        });

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
      it("should handle database errors gracefully", async () => {
        vi.mocked(queryJson).mockImplementation(() => {
          throw new Error("Database connection failed");
        });

        const result = await ensureFreshData();

        expect(result.synced).toBe(false);
        expect(result.reason).toBe("error");
        expect(getValidTokens).toHaveBeenCalled();
      });

      it("should handle empty activity list from API", async () => {
        vi.mocked(queryJson).mockReturnValue([]);

        const mockTokens = {
          access_token: "test_token",
          refresh_token: "test_refresh",
          expires_at: Date.now() / 1000 + 3600,
          athlete_id: 123,
        };

        vi.mocked(getValidTokens).mockResolvedValue(mockTokens);
        vi.mocked(syncActivities).mockResolvedValue({ syncedCount: 0 });

        const result = await ensureFreshData({ noSync: false });

        expect(result.synced).toBe(true);
        expect(result.syncedCount).toBe(0);
        expect(syncActivities).toHaveBeenCalledWith(mockTokens, 730, false);
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
