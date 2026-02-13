import { describe, it, expect } from "vitest";
import type { Lap } from "../../src/strava/types.js";
import {
  evaluateHRDrift,
  evaluatePaceDeviation,
  evaluateLapVariability,
  evaluateEarlyFade,
  evaluateAllTriggers,
  type TriggerConfig,
} from "../../src/lib/triggers.js";

function createMockLap(overrides: Partial<Lap> = {}): Lap {
  return {
    id: 1,
    resource_state: 1,
    name: "Lap 1",
    activity: { id: 1, resource_state: 1 },
    athlete: { id: 1, resource_state: 1 },
    elapsed_time: 600,
    moving_time: 600,
    start_date: "2026-01-31T10:00:00Z",
    start_date_local: "2026-01-31T02:00:00Z",
    distance: 1000,
    start_index: 0,
    end_index: 100,
    total_elevation_gain: 0,
    average_speed: 1.67,
    max_speed: 2,
    average_cadence: 90,
    device_watts: false,
    average_watts: 0,
    lap_index: 0,
    split: 1,
    ...overrides,
  };
}

describe("evaluateHRDrift", () => {
  it("should not fire when laps have no heart rate data", () => {
    const laps = [createMockLap(), createMockLap(), createMockLap()];
    const result = evaluateHRDrift(laps, 10);

    expect(result.fired).toBe(false);
    expect(result.threshold).toBe(10);
    expect(result.unit).toBe("%");
    expect(result.value).toBeUndefined();
  });

  it("should not fire when less than 2 laps have heart rate data", () => {
    const laps = [createMockLap({ average_heartrate: 140 }), createMockLap(), createMockLap()];
    const result = evaluateHRDrift(laps, 10);

    expect(result.fired).toBe(false);
  });

  it("should calculate drift when HR increases from first to second half", () => {
    const laps = [
      createMockLap({ average_heartrate: 130 }),
      createMockLap({ average_heartrate: 135 }),
      createMockLap({ average_heartrate: 145 }),
      createMockLap({ average_heartrate: 150 }),
    ];
    const result = evaluateHRDrift(laps, 10);

    expect(result.fired).toBe(true);
    expect(result.value).toBeCloseTo(11.32, 1);
    expect(result.threshold).toBe(10);
    expect(result.unit).toBe("%");
    expect(result.percentageOver).toBeCloseTo(1.32, 1);
  });

  it("should not fire when HR drift is below threshold", () => {
    const laps = [
      createMockLap({ average_heartrate: 140 }),
      createMockLap({ average_heartrate: 142 }),
      createMockLap({ average_heartrate: 144 }),
      createMockLap({ average_heartrate: 146 }),
    ];
    const result = evaluateHRDrift(laps, 10);

    expect(result.fired).toBe(false);
    expect(result.value).toBeCloseTo(2.86, 1);
  });

  it("should handle identical HR values", () => {
    const laps = [
      createMockLap({ average_heartrate: 140 }),
      createMockLap({ average_heartrate: 140 }),
      createMockLap({ average_heartrate: 140 }),
      createMockLap({ average_heartrate: 140 }),
    ];
    const result = evaluateHRDrift(laps, 5);

    expect(result.fired).toBe(false);
    expect(result.value).toBeCloseTo(0, 1);
  });

  it("should handle HR decreasing (negative drift)", () => {
    const laps = [
      createMockLap({ average_heartrate: 150 }),
      createMockLap({ average_heartrate: 145 }),
      createMockLap({ average_heartrate: 140 }),
      createMockLap({ average_heartrate: 135 }),
    ];
    const result = evaluateHRDrift(laps, 5);

    expect(result.fired).toBe(false);
    expect(result.value).toBeCloseTo(-6.78, 1);
  });

  it("should not fire when only 1 lap is provided", () => {
    const laps = [createMockLap({ average_heartrate: 140 })];
    const result = evaluateHRDrift(laps, 10);

    expect(result.fired).toBe(false);
  });

  it("should handle empty array", () => {
    const laps: Lap[] = [];
    const result = evaluateHRDrift(laps, 10);

    expect(result.fired).toBe(false);
  });

  it("should handle zero heart rate values", () => {
    const laps = [
      createMockLap({ average_heartrate: 0 }),
      createMockLap({ average_heartrate: 140 }),
    ];
    const result = evaluateHRDrift(laps, 10);

    expect(result.fired).toBe(false);
  });
});

describe("evaluatePaceDeviation", () => {
  it("should not fire when less than 2 laps are provided", () => {
    const laps = [createMockLap({ distance: 1000, moving_time: 600 })];
    const result = evaluatePaceDeviation(laps, 15);

    expect(result.fired).toBe(false);
  });

  it("should calculate coefficient of variation for pace", () => {
    const laps = [
      createMockLap({ distance: 1000, moving_time: 300 }),
      createMockLap({ distance: 1000, moving_time: 350 }),
      createMockLap({ distance: 1000, moving_time: 250 }),
      createMockLap({ distance: 1000, moving_time: 400 }),
    ];
    const result = evaluatePaceDeviation(laps, 15);

    expect(result.fired).toBe(true);
    expect(result.value).toBeGreaterThan(0);
    expect(result.unit).toBe("%");
  });

  it("should not fire when CV is below threshold", () => {
    const laps = [
      createMockLap({ distance: 1000, moving_time: 300 }),
      createMockLap({ distance: 1000, moving_time: 310 }),
      createMockLap({ distance: 1000, moving_time: 295 }),
      createMockLap({ distance: 1000, moving_time: 305 }),
    ];
    const result = evaluatePaceDeviation(laps, 15);

    expect(result.fired).toBe(false);
  });

  it("should handle identical paces", () => {
    const laps = [
      createMockLap({ distance: 1000, moving_time: 300 }),
      createMockLap({ distance: 1000, moving_time: 300 }),
      createMockLap({ distance: 1000, moving_time: 300 }),
    ];
    const result = evaluatePaceDeviation(laps, 5);

    expect(result.fired).toBe(false);
    expect(result.value).toBeCloseTo(0, 1);
  });

  it("should filter out laps with zero pace", () => {
    const laps = [
      createMockLap({ distance: 0, moving_time: 600 }),
      createMockLap({ distance: 1000, moving_time: 300 }),
      createMockLap({ distance: 1000, moving_time: 400 }),
    ];
    const result = evaluatePaceDeviation(laps, 10);

    expect(result.fired).toBe(true);
  });

  it("should handle empty array", () => {
    const laps: Lap[] = [];
    const result = evaluatePaceDeviation(laps, 15);

    expect(result.fired).toBe(false);
  });

  it("should not fire when all laps have zero pace", () => {
    const laps = [
      createMockLap({ distance: 0, moving_time: 600 }),
      createMockLap({ distance: 0, moving_time: 600 }),
    ];
    const result = evaluatePaceDeviation(laps, 15);

    expect(result.fired).toBe(false);
  });
});

describe("evaluateLapVariability", () => {
  it("should not fire when less than 2 laps are provided", () => {
    const laps = [createMockLap()];
    const result = evaluateLapVariability(laps, 20);

    expect(result.fired).toBe(false);
  });

  it("should use power data when available", () => {
    const laps = [
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 250 }),
      createMockLap({ average_watts: 180 }),
      createMockLap({ average_watts: 220 }),
    ];
    const result = evaluateLapVariability(laps, 10);

    expect(result.fired).toBe(true);
    expect(result.value).toBeGreaterThan(0);
    expect(result.unit).toBe("%");
  });

  it("should fall back to pace when power is not available", () => {
    const laps = [
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 300 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 350 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 250 }),
    ];
    const result = evaluateLapVariability(laps, 10);

    expect(result.fired).toBe(true);
    expect(result.value).toBeGreaterThan(0);
  });

  it("should handle mixed power and pace data", () => {
    const laps = [
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 300 }),
      createMockLap({ average_watts: 180 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 350 }),
    ];
    const result = evaluateLapVariability(laps, 20);

    expect(result.fired).toBe(true);
  });

  it("should not fire when variability is below threshold", () => {
    const laps = [
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 205 }),
      createMockLap({ average_watts: 195 }),
      createMockLap({ average_watts: 198 }),
    ];
    const result = evaluateLapVariability(laps, 10);

    expect(result.fired).toBe(false);
  });

  it("should handle identical values", () => {
    const laps = [
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 200 }),
    ];
    const result = evaluateLapVariability(laps, 5);

    expect(result.fired).toBe(false);
    expect(result.value).toBeCloseTo(0, 1);
  });

  it("should handle empty array", () => {
    const laps: Lap[] = [];
    const result = evaluateLapVariability(laps, 20);

    expect(result.fired).toBe(false);
  });

  it("should not fire when all values are zero", () => {
    const laps = [
      createMockLap({ average_watts: 0, distance: 0, moving_time: 600 }),
      createMockLap({ average_watts: 0, distance: 0, moving_time: 600 }),
    ];
    const result = evaluateLapVariability(laps, 20);

    expect(result.fired).toBe(false);
  });
});

describe("evaluateEarlyFade", () => {
  it("should not fire when less than 4 laps are provided", () => {
    const laps = [
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 190 }),
      createMockLap({ average_watts: 185 }),
    ];
    const result = evaluateEarlyFade(laps, 10);

    expect(result.fired).toBe(false);
  });

  it("should detect fade when power decreases from first 25% to last 25%", () => {
    const laps = [
      createMockLap({ average_watts: 250 }),
      createMockLap({ average_watts: 240 }),
      createMockLap({ average_watts: 230 }),
      createMockLap({ average_watts: 220 }),
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 190 }),
      createMockLap({ average_watts: 180 }),
      createMockLap({ average_watts: 170 }),
    ];
    const result = evaluateEarlyFade(laps, 5);

    expect(result.fired).toBe(true);
    expect(result.value).toBeGreaterThan(0);
  });

  it("should not fire when power is consistent", () => {
    const laps = [
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 205 }),
      createMockLap({ average_watts: 198 }),
      createMockLap({ average_watts: 202 }),
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 199 }),
      createMockLap({ average_watts: 201 }),
      createMockLap({ average_watts: 200 }),
    ];
    const result = evaluateEarlyFade(laps, 10);

    expect(result.fired).toBe(false);
  });

  it("should use pace when power is not available", () => {
    const laps = [
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 240 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 250 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 260 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 270 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 280 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 290 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 300 }),
      createMockLap({ average_watts: 0, distance: 1000, moving_time: 310 }),
    ];
    const result = evaluateEarlyFade(laps, 10);

    expect(result.fired).toBe(true);
  });

  it("should handle exact 4 laps", () => {
    const laps = [
      createMockLap({ average_watts: 250 }),
      createMockLap({ average_watts: 240 }),
      createMockLap({ average_watts: 190 }),
      createMockLap({ average_watts: 180 }),
    ];
    const result = evaluateEarlyFade(laps, 5);

    expect(result.fired).toBe(true);
  });

  it("should handle improvement (negative fade)", () => {
    const laps = [
      createMockLap({ average_watts: 150 }),
      createMockLap({ average_watts: 160 }),
      createMockLap({ average_watts: 170 }),
      createMockLap({ average_watts: 180 }),
      createMockLap({ average_watts: 190 }),
      createMockLap({ average_watts: 200 }),
      createMockLap({ average_watts: 210 }),
      createMockLap({ average_watts: 220 }),
    ];
    const result = evaluateEarlyFade(laps, 40);

    expect(result.fired).toBe(false);
  });

  it("should handle empty array", () => {
    const laps: Lap[] = [];
    const result = evaluateEarlyFade(laps, 10);

    expect(result.fired).toBe(false);
  });

  it("should not fire when all values are zero", () => {
    const laps = [
      createMockLap({ average_watts: 0, distance: 0, moving_time: 600 }),
      createMockLap({ average_watts: 0, distance: 0, moving_time: 600 }),
      createMockLap({ average_watts: 0, distance: 0, moving_time: 600 }),
      createMockLap({ average_watts: 0, distance: 0, moving_time: 600 }),
    ];
    const result = evaluateEarlyFade(laps, 10);

    expect(result.fired).toBe(false);
  });
});

describe("evaluateAllTriggers", () => {
  it("should return empty array when no triggers fire", () => {
    const laps = [
      createMockLap({ average_heartrate: 140 }),
      createMockLap({ average_heartrate: 142 }),
    ];
    const triggers: TriggerConfig[] = [
      { type: "hr_drift", threshold: 20, unit: "%", enabled: true },
      { type: "pace_deviation", threshold: 30, unit: "%", enabled: true },
    ];

    const result = evaluateAllTriggers(laps, triggers);

    expect(result).toHaveLength(0);
  });

  it("should return only fired triggers", () => {
    const laps = [
      createMockLap({
        average_heartrate: 130,
        average_watts: 200,
        distance: 1000,
        moving_time: 300,
      }),
      createMockLap({
        average_heartrate: 135,
        average_watts: 180,
        distance: 1000,
        moving_time: 350,
      }),
      createMockLap({
        average_heartrate: 145,
        average_watts: 220,
        distance: 1000,
        moving_time: 250,
      }),
      createMockLap({
        average_heartrate: 150,
        average_watts: 190,
        distance: 1000,
        moving_time: 320,
      }),
    ];
    const triggers: TriggerConfig[] = [
      { type: "hr_drift", threshold: 10, unit: "%", enabled: true },
      { type: "pace_deviation", threshold: 15, unit: "%", enabled: true },
      { type: "lap_variability", threshold: 10, unit: "%", enabled: true },
      { type: "early_fade", threshold: 5, unit: "%", enabled: true },
    ];

    const result = evaluateAllTriggers(laps, triggers);

    expect(result.length).toBeGreaterThan(0);
    result.forEach((fired) => {
      expect(fired).toHaveProperty("trigger_type");
      expect(fired).toHaveProperty("actual_value");
      expect(fired).toHaveProperty("threshold");
      expect(fired).toHaveProperty("unit");
      expect(fired).toHaveProperty("percentage_over");
    });
  });

  it("should skip disabled triggers", () => {
    const laps = [
      createMockLap({ average_heartrate: 130 }),
      createMockLap({ average_heartrate: 150 }),
    ];
    const triggers: TriggerConfig[] = [
      { type: "hr_drift", threshold: 10, unit: "%", enabled: false },
      { type: "pace_deviation", threshold: 15, unit: "%", enabled: true },
    ];

    const result = evaluateAllTriggers(laps, triggers);

    expect(result.every((fired) => fired.trigger_type !== "hr_drift")).toBe(true);
  });

  it("should return all fired triggers", () => {
    const laps = [
      createMockLap({
        average_heartrate: 130,
        average_watts: 200,
        distance: 1000,
        moving_time: 300,
      }),
      createMockLap({
        average_heartrate: 150,
        average_watts: 250,
        distance: 1000,
        moving_time: 400,
      }),
      createMockLap({
        average_heartrate: 135,
        average_watts: 180,
        distance: 1000,
        moving_time: 250,
      }),
      createMockLap({
        average_heartrate: 145,
        average_watts: 220,
        distance: 1000,
        moving_time: 350,
      }),
      createMockLap({
        average_heartrate: 140,
        average_watts: 190,
        distance: 1000,
        moving_time: 280,
      }),
      createMockLap({
        average_heartrate: 155,
        average_watts: 210,
        distance: 1000,
        moving_time: 380,
      }),
      createMockLap({
        average_heartrate: 138,
        average_watts: 175,
        distance: 1000,
        moving_time: 260,
      }),
      createMockLap({
        average_heartrate: 148,
        average_watts: 200,
        distance: 1000,
        moving_time: 320,
      }),
    ];
    const triggers: TriggerConfig[] = [
      { type: "hr_drift", threshold: 5, unit: "%", enabled: true },
      { type: "pace_deviation", threshold: 10, unit: "%", enabled: true },
      { type: "lap_variability", threshold: 10, unit: "%", enabled: true },
      { type: "early_fade", threshold: 5, unit: "%", enabled: true },
    ];

    const result = evaluateAllTriggers(laps, triggers);

    expect(result.length).toBeGreaterThan(0);
  });

  it("should handle empty triggers array", () => {
    const laps = [createMockLap(), createMockLap()];
    const triggers: TriggerConfig[] = [];

    const result = evaluateAllTriggers(laps, triggers);

    expect(result).toHaveLength(0);
  });

  it("should handle empty laps array", () => {
    const laps: Lap[] = [];
    const triggers: TriggerConfig[] = [
      { type: "hr_drift", threshold: 10, unit: "%", enabled: true },
    ];

    const result = evaluateAllTriggers(laps, triggers);

    expect(result).toHaveLength(0);
  });

  it("should handle mixed enabled/disabled triggers", () => {
    const laps = [
      createMockLap({ average_heartrate: 130 }),
      createMockLap({ average_heartrate: 150 }),
      createMockLap({ average_heartrate: 140 }),
      createMockLap({ average_heartrate: 145 }),
    ];
    const triggers: TriggerConfig[] = [
      { type: "hr_drift", threshold: 10, unit: "%", enabled: true },
      { type: "pace_deviation", threshold: 15, unit: "%", enabled: false },
      { type: "lap_variability", threshold: 10, unit: "%", enabled: true },
      { type: "early_fade", threshold: 5, unit: "%", enabled: false },
    ];

    const result = evaluateAllTriggers(laps, triggers);

    expect(result.every((fired) => fired.trigger_type !== "pace_deviation")).toBe(true);
    expect(result.every((fired) => fired.trigger_type !== "early_fade")).toBe(true);
  });
});

describe("deterministic behavior", () => {
  it("should produce same output for same input", () => {
    const laps = [
      createMockLap({ average_heartrate: 130 }),
      createMockLap({ average_heartrate: 135 }),
      createMockLap({ average_heartrate: 145 }),
      createMockLap({ average_heartrate: 150 }),
    ];

    const result1 = evaluateHRDrift(laps, 10);
    const result2 = evaluateHRDrift(laps, 10);

    expect(result1.fired).toBe(result2.fired);
    expect(result1.value).toBe(result2.value);
  });

  it("should produce same output for evaluateAllTriggers", () => {
    const laps = [
      createMockLap({
        average_heartrate: 130,
        average_watts: 200,
        distance: 1000,
        moving_time: 300,
      }),
      createMockLap({
        average_heartrate: 135,
        average_watts: 220,
        distance: 1000,
        moving_time: 320,
      }),
      createMockLap({
        average_heartrate: 145,
        average_watts: 180,
        distance: 1000,
        moving_time: 280,
      }),
      createMockLap({
        average_heartrate: 150,
        average_watts: 200,
        distance: 1000,
        moving_time: 300,
      }),
    ];
    const triggers: TriggerConfig[] = [
      { type: "hr_drift", threshold: 10, unit: "%", enabled: true },
      { type: "pace_deviation", threshold: 15, unit: "%", enabled: true },
    ];

    const result1 = evaluateAllTriggers(laps, triggers);
    const result2 = evaluateAllTriggers(laps, triggers);

    expect(result1).toEqual(result2);
  });
});
