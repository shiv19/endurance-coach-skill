import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { runValidate } from "../../src/cli/commands/validate.js";

function withSilencedConsole(fn: () => void): void {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

  try {
    fn();
  } finally {
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }
}

describe("runValidate", () => {
  let tempDir: string;

  const createTempFile = (content: string, filename: string): string => {
    if (!tempDir) {
      tempDir = join(tmpdir(), `validate-test-${Date.now()}`);
      mkdirSync(tempDir, { recursive: true });
    }
    const filepath = join(tempDir, filename);
    writeFileSync(filepath, content, "utf-8");
    return filepath;
  };

  const createValidCompactPlan = (): string => {
    return `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "5:30/km"

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Build base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.rest`;
  };

  const _createValidFullPlan = (): string => {
    return JSON.stringify({
      version: "1.0",
      meta: {
        name: "Test Plan",
        athlete: "Test Athlete",
        event: "Test Event",
        eventDate: "2026-06-01",
      },
      weeks: [
        {
          week: 1,
          days: [
            {
              date: "2026-01-05",
              workouts: [
                {
                  id: "w001",
                  sport: "run",
                  type: "easy",
                  duration: 30,
                },
              ],
            },
          ],
        },
      ],
    });
  };

  beforeEach(() => {
    tempDir = "";
  });

  afterEach(() => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("validates a valid compact plan", () => {
    const planContent = createValidCompactPlan();
    const inputFile = createTempFile(planContent, "valid-plan.yaml");

    withSilencedConsole(() => {
      runValidate({ command: "validate", inputFile, compact: true });
    });
  });

  it("validates a valid full plan JSON", () => {
    const planContent = `{
      "version": "1.0",
      "meta": {
        "id": "test-plan-1",
        "athlete": "Test Athlete",
        "event": "Test Event",
        "eventDate": "2026-06-01",
        "planStartDate": "2026-03-01",
        "planEndDate": "2026-06-01",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-01T00:00:00.000Z",
        "totalWeeks": 1,
        "generatedBy": "Test"
      },
      "preferences": {
        "swim": "meters",
        "bike": "kilometers",
        "run": "kilometers",
        "firstDayOfWeek": "monday"
      },
      "assessment": {
        "foundation": {
          "raceHistory": ["Test"],
          "peakTrainingLoad": 100,
          "foundationLevel": "intermediate",
          "yearsInSport": 5
        },
        "currentForm": {
          "weeklyVolume": {"total": 10},
          "longestSessions": {"run": 60},
          "consistency": 80
        },
        "strengths": [{"sport": "run", "evidence": "Test"}],
        "limiters": [{"sport": "run", "evidence": "Test"}],
        "constraints": []
      },
      "zones": {
        "run": {
          "hr": {
            "lthr": 165,
            "zones": [{"zone": 1, "name": "Easy", "hrLow": 120, "hrHigh": 150}]
          }
        }
      },
      "phases": [
        {
          "name": "Base",
          "startWeek": 1,
          "endWeek": 1,
          "focus": "Base",
          "weeklyHoursRange": {"low": 5, "high": 10},
          "keyWorkouts": [],
          "physiologicalGoals": []
        }
      ],
      "weeks": [
        {
          "weekNumber": 1,
          "startDate": "2026-03-01",
          "endDate": "2026-03-07",
          "phase": "Base",
          "focus": "Base",
          "targetHours": 5,
          "days": [
            {
              "date": "2026-03-01",
              "dayOfWeek": "Sunday",
              "workouts": [
                {
                  "id": "w1",
                  "sport": "run",
                  "type": "easy",
                  "name": "Easy Run",
                  "completed": false
                }
              ]
            }
          ],
          "summary": {"totalHours": 5},
          "isRecoveryWeek": false
        }
      ],
      "raceStrategy": {}
    }`;
    const inputFile = createTempFile(planContent, "valid-plan.json");

    withSilencedConsole(() => {
      runValidate({ command: "validate", inputFile, compact: false });
    });
  });

  it("exits with error for invalid JSON", () => {
    const invalidContent = "{ not valid json }";
    const inputFile = createTempFile(invalidContent, "invalid.json");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile, compact: false });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });

  it("exits with error for invalid YAML", () => {
    const invalidContent = "key: unquoted colon: in middle";
    const inputFile = createTempFile(invalidContent, "invalid.yaml");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile, compact: true });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });

  it("exits with error for non-existent file", () => {
    const nonExistentFile = join(tmpdir(), "nonexistent-plan.yaml");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile: nonExistentFile, compact: true });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });

  it("exits with error for compact plan missing required fields", () => {
    const invalidPlan = `version: "2.0"
athlete:
  name: "Test"`;

    const inputFile = createTempFile(invalidPlan, "invalid-compact.yaml");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile, compact: true });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });

  it("exits with error for compact plan with invalid template reference", () => {
    const planWithInvalidRef = `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "5:30/km"

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Build base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.nonexistent_template`;

    const inputFile = createTempFile(planWithInvalidRef, "invalid-ref.yaml");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile, compact: true });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });

  it("validates compact plan with valid template references", () => {
    const planWithValidRefs = `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "5:30/km"

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Build base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.rest
      Tue: run.easy(30)
      Wed: bike.rest`;

    const inputFile = createTempFile(planWithValidRefs, "valid-refs.yaml");

    withSilencedConsole(() => {
      runValidate({ command: "validate", inputFile, compact: true });
    });
  });

  it("exits with error for full plan missing required fields", () => {
    const invalidFullPlan = JSON.stringify({ version: "1.0" });

    const inputFile = createTempFile(invalidFullPlan, "invalid-full.json");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile, compact: false });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });

  it("logs error message for invalid pace format", () => {
    const planWithInvalidPace = `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "invalid-pace"

phases:
  - name: "Base"
    weeks: "1-1"
    focus: "Build base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.rest`;

    const inputFile = createTempFile(planWithInvalidPace, "invalid-pace.yaml");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile, compact: true });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });

  it("detects non-sequential week numbers", () => {
    const planWithBadWeeks = `version: "2.0"

athlete:
  name: "Test Athlete"
  event: "Test Event"
  eventDate: "2026-06-01"
  paces:
    easy: "5:30/km"

phases:
  - name: "Base"
    weeks: "1-2"
    focus: "Build base"

weeks:
  - week: 1
    phase: Base
    workouts:
      Mon: run.rest
  - week: 3
    phase: Base
    workouts:
      Mon: run.rest`;

    const inputFile = createTempFile(planWithBadWeeks, "bad-weeks.yaml");

    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`exit:${code}`);
    }) as never);

    expect(() => {
      withSilencedConsole(() => {
        runValidate({ command: "validate", inputFile, compact: true });
      });
    }).toThrow("exit:1");

    exitSpy.mockRestore();
  });
});
