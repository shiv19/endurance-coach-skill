import { describe, it, expect } from "vitest";
import type { StravaActivity, StravaAthlete } from "../../src/strava/types.js";

describe("Strava Types", () => {
  describe("StravaActivity", () => {
    it("should have required fields", () => {
      const activity: StravaActivity = {
        id: 12345678,
        name: "Morning Run",
        sport_type: "Run",
        start_date: "2024-01-15T07:30:00Z",
        elapsed_time: 3600,
        moving_time: 3500,
        distance: 10000,
        total_elevation_gain: 150,
        average_speed: 2.86,
        max_speed: 4.5,
      };

      expect(activity.id).toBe(12345678);
      expect(activity.name).toBe("Morning Run");
      expect(activity.sport_type).toBe("Run");
      expect(activity.distance).toBe(10000);
    });

    it("should allow optional fields", () => {
      const activity: StravaActivity = {
        id: 12345678,
        name: "Ride with Power",
        sport_type: "Ride",
        start_date: "2024-01-15T07:30:00Z",
        elapsed_time: 7200,
        moving_time: 7000,
        distance: 50000,
        total_elevation_gain: 500,
        average_speed: 7.14,
        max_speed: 15.0,
        average_watts: 200,
        max_watts: 450,
        average_heartrate: 145,
        max_heartrate: 175,
        suffer_score: 120,
      };

      expect(activity.average_watts).toBe(200);
      expect(activity.average_heartrate).toBe(145);
      expect(activity.suffer_score).toBe(120);
    });
  });

  describe("StravaAthlete", () => {
    it("should have required fields", () => {
      const athlete: StravaAthlete = {
        id: 99999,
        firstname: "John",
        lastname: "Doe",
      };

      expect(athlete.id).toBe(99999);
      expect(athlete.firstname).toBe("John");
      expect(athlete.lastname).toBe("Doe");
    });

    it("should allow optional fields", () => {
      const athlete: StravaAthlete = {
        id: 99999,
        firstname: "Jane",
        lastname: "Smith",
        weight: 65.5,
        ftp: 250,
      };

      expect(athlete.weight).toBe(65.5);
      expect(athlete.ftp).toBe(250);
    });
  });
});

describe("Strava API Helpers", () => {
  describe("URL construction", () => {
    it("should build correct activities URL", () => {
      const API_BASE = "https://www.strava.com/api/v3";
      const after = 1704067200; // 2024-01-01
      const page = 1;
      const perPage = 100;

      const url = new URL(`${API_BASE}/athlete/activities`);
      url.searchParams.set("after", after.toString());
      url.searchParams.set("page", page.toString());
      url.searchParams.set("per_page", perPage.toString());

      expect(url.toString()).toBe(
        "https://www.strava.com/api/v3/athlete/activities?after=1704067200&page=1&per_page=100"
      );
    });
  });

  describe("Date calculations", () => {
    it("should calculate correct unix timestamp for date", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      const timestamp = Math.floor(date.getTime() / 1000);

      expect(timestamp).toBe(1704067200);
    });

    it("should calculate date N days ago", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      const daysAgo = 365;

      const afterDate = new Date(now);
      afterDate.setDate(afterDate.getDate() - daysAgo);

      // Should be approximately June 15, 2023 (or June 16 due to leap year)
      expect(afterDate.getFullYear()).toBe(2023);
      expect(afterDate.getMonth()).toBe(5); // June (0-indexed)
    });
  });
});

describe("SQL Escaping", () => {
  function escapeString(str: string | null | undefined): string {
    if (str == null) return "NULL";
    return `'${str.replace(/'/g, "''")}'`;
  }

  it("should escape single quotes", () => {
    expect(escapeString("O'Reilly")).toBe("'O''Reilly'");
    expect(escapeString("It's a test")).toBe("'It''s a test'");
  });

  it("should handle null and undefined", () => {
    expect(escapeString(null)).toBe("NULL");
    expect(escapeString(undefined)).toBe("NULL");
  });

  it("should wrap normal strings in quotes", () => {
    expect(escapeString("hello")).toBe("'hello'");
    expect(escapeString("Morning Run")).toBe("'Morning Run'");
  });

  it("should handle empty strings", () => {
    expect(escapeString("")).toBe("''");
  });

  it("should handle multiple quotes", () => {
    expect(escapeString("It's John's bike")).toBe("'It''s John''s bike'");
  });
});
