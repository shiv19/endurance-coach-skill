/**
 * Tests for training plan expander, focusing on date calculation logic
 */

import { describe, it, expect } from "vitest";
import { expandPlan } from "../../src/expander/expander.js";
import { loadTemplates } from "../../src/templates/index.js";

// ============================================================================
// MARK: Helper Functions (defined outside describe blocks for shared access)
// ============================================================================

const createWeek = (weekNum: number, phase: string, baseWorkouts: Record<string, string> = {}) => {
  const defaultWorkouts = {
    Mon: "run.rest",
    Tue: "run.easy(30)",
    Wed: "run.rest",
    Thu: "run.easy(30)",
    Fri: "run.rest",
    Sat: "run.easy(45)",
    Sun: "run.long(60)",
    ...baseWorkouts,
  };
  return { week: weekNum, phase, workouts: defaultWorkouts };
};

const generate8WeekPlan = (phase: string = "Base") => {
  return Array.from({ length: 8 }, (_, i) => createWeek(i + 1, phase));
};

const generate12WeekPlan = (phase: string = "Base") => {
  return Array.from({ length: 12 }, (_, i) => createWeek(i + 1, phase));
};

const generate4WeekPlan = (phase: string = "Base") => {
  return Array.from({ length: 4 }, (_, i) => createWeek(i + 1, phase));
};

// ============================================================================
// MARK: Tests
// ============================================================================

describe("Training Start Date Calculation", () => {
  const templates = loadTemplates();

  it("aligns final week with event date for 8-week plan (monday start)", () => {
    const weeks = generate8WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });
    weeks[7] = createWeek(8, "Base", { Sun: "run.race.5k" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20", // Sunday
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-8", focus: "Base" }],
      weeks,
    } as any;

    const expanded = expandPlan(compact, templates);

    expect(expanded.meta.planStartDate).toBe("2025-02-24");
    expect(expanded.meta.planEndDate).toBe("2025-04-20");
    expect(expanded.meta.eventDate).toBe(expanded.meta.planEndDate);
  });

  it("handles Sunday first day of week", () => {
    const weeks = generate8WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Sun: "run.easy(30)" });
    weeks[7] = createWeek(8, "Base", { Sat: "run.race.5k" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20", // Sunday
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "sunday",
      },
      phases: [{ name: "Base", weeks: "1-8", focus: "Base" }],
      weeks,
    } as any;

    const expanded = expandPlan(compact, templates);

    expect(expanded.meta.planStartDate).toBe("2025-03-02");
    expect(expanded.meta.planEndDate).toBe("2025-04-26");
  });

  it("calculates correct dates for 12-week plan", () => {
    const weeks = generate12WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });
    weeks[11] = createWeek(12, "Base", { Sun: "run.long(90)" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Marathon",
        eventDate: "2025-05-18", // Sunday
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-12", focus: "Base" }],
      weeks,
    } as any;

    const expanded = expandPlan(compact, templates);

    expect(expanded.meta.planStartDate).toBe("2025-02-24");
    expect(expanded.meta.planEndDate).toBe("2025-05-18");
    expect(expanded.meta.eventDate).toBe(expanded.meta.planEndDate);
  });

  it("uses explicit startDate if provided in athlete config", () => {
    const weeks = generate4WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20",
        startDate: "2025-03-01", // Explicit start date
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-4", focus: "Base" }],
      weeks,
    } as any;

    const expanded = expandPlan(compact, templates);

    expect(expanded.meta.planStartDate).toBe("2025-03-01");
  });

  it("respects options.startDate over athlete.startDate and calculated date", () => {
    const weeks = generate4WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20",
        startDate: "2025-03-01", // This should be ignored
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-4", focus: "Base" }],
      weeks,
    } as any;

    const options = { startDate: new Date("2025-02-15") };
    const expanded = expandPlan(compact, templates, options);

    expect(expanded.meta.planStartDate).toBe("2025-02-15");
  });

  it("handles 4-week plan with Monday event", () => {
    const weeks = generate4WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });
    weeks[3] = createWeek(4, "Peak", { Mon: "run.race.5k" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-03-03", // Monday
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-4", focus: "Base" }],
      weeks,
    } as any;

    const expanded = expandPlan(compact, templates);

    expect(expanded.meta.planStartDate).toBe("2025-02-10");
    expect(expanded.meta.planEndDate).toBe("2025-03-09");
    expect(expanded.meta.eventDate).not.toBe(expanded.meta.planEndDate); // Event is on first day of last week
  });

  it("validates last week contains the event date day", () => {
    const weeks = generate8WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });
    weeks[7] = createWeek(8, "Peak", { Sun: "run.race.5k" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20", // Sunday
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-8", focus: "Base" }],
      weeks,
    } as any;

    const expanded = expandPlan(compact, templates);
    const lastWeek = expanded.weeks[expanded.weeks.length - 1];

    expect(lastWeek.endDate).toBe("2025-04-20");
  });

  it("handles leap year correctly", () => {
    const weeks = generate8WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });
    weeks[7] = createWeek(8, "Peak", { Sun: "run.race.5k" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2024-04-20", // Sunday in leap year
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-8", focus: "Base" }],
      weeks,
    } as any;

    const expanded = expandPlan(compact, templates);

    expect(expanded.meta.planStartDate).toBe("2024-02-26");
    expect(expanded.meta.planEndDate).toBe("2024-04-21");
  });
});

describe("Template Validation - Fail-Fast", () => {
  const templates = loadTemplates();

  it("throws error when template does not exist", () => {
    const weeks = generate8WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "nonexistent(30)" });

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20",
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-8", focus: "Base" }],
      weeks,
    } as any;

    expect(() => expandPlan(compact, templates)).toThrow();
  });

  it("includes helpful suggestions in error message", () => {
    const weeks = generate8WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.eazy(30)" }); // Typo for "easy"

    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20",
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-8", focus: "Base" }],
      weeks,
    } as any;

    try {
      expandPlan(compact, templates);
      expect.fail("Should have thrown");
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toContain("run.eazy");
      expect(message.toLowerCase()).toContain("run.easy");
    }
  });

  it("validates all templates before expansion", () => {
    const weeks = generate8WeekPlan("Base");
    weeks[0] = createWeek(1, "Base", { Mon: "run.easy(30)" });
    weeks[7] = createWeek(8, "Base", { Sun: "run.badtemplate(30)" });
    const compact = {
      version: "2.0",
      athlete: {
        name: "Test Athlete",
        event: "Test Race",
        eventDate: "2025-04-20",
        paces: { easy: "10:00/mi" },
        unit: "mi",
        firstDayOfWeek: "monday",
      },
      phases: [{ name: "Base", weeks: "1-8", focus: "Base" }],
      weeks,
    } as any;

    expect(() => expandPlan(compact, templates)).toThrow();
    // Error should happen before any expansion occurs
  });
});
