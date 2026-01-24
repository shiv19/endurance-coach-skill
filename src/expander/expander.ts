/**
 * Core Expander
 *
 * Converts compact training plans to expanded format for HTML rendering.
 */

import type { CompactPlan, CompactWeek, ParsedWorkoutRef } from "../schema/compact-plan.js";
import { parseWorkoutRef, parseWeekRange } from "../schema/compact-plan.js";
import type {
  TemplateRegistry,
  WorkoutTemplate,
  InterpolationContext,
} from "../templates/index.js";
import { interpolate, createContext } from "../templates/index.js";
import { calculateAthleteZones } from "./zones.js";
import type {
  ExpandedPlan,
  ExpandedWeek,
  ExpandedDay,
  ExpandedWorkout,
  ExpandedPhase,
  ExpandedWeekSummary,
  ExpansionOptions,
} from "./types.js";

// ============================================================================
// Date Utilities
// ============================================================================

/**
 * Parse an ISO date string (YYYY-MM-DD) as a local date, avoiding timezone issues.
 * When you use `new Date("2025-02-16")`, it creates a UTC date which can shift
 * to the previous day in timezones behind UTC. This function creates a date in
 * local timezone.
 */
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get the day of week name from a Date.
 */
function getDayOfWeekName(date: Date): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[date.getDay()];
}

/**
 * Format a Date as ISO date string (YYYY-MM-DD).
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Add days to a date.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Calculate the start date of the plan from the event date and total weeks.
 */
function calculateStartDate(
  eventDate: string,
  totalWeeks: number,
  firstDayOfWeek: "monday" | "sunday"
): Date {
  const event = parseLocalDate(eventDate);
  // Go back totalWeeks * 7 days from event date
  const start = addDays(event, -(totalWeeks * 7));

  // Adjust to the first day of the week
  const targetDay = firstDayOfWeek === "monday" ? 1 : 0;
  const currentDay = start.getDay();
  const diff = currentDay - targetDay;
  const adjustedDiff = diff < 0 ? diff + 7 : diff;

  return addDays(start, -adjustedDiff);
}

/**
 * Map compact day abbreviation to day index (0-6, starting from Sunday).
 */
function dayAbbrevToIndex(abbrev: string): number {
  const mapping: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return mapping[abbrev] ?? -1;
}

/**
 * Get the offset from the first day of week to a specific day.
 */
function getDayOffset(dayAbbrev: string, firstDayOfWeek: "monday" | "sunday"): number {
  const dayIndex = dayAbbrevToIndex(dayAbbrev);
  const firstDayIndex = firstDayOfWeek === "monday" ? 1 : 0;

  let offset = dayIndex - firstDayIndex;
  if (offset < 0) offset += 7;

  return offset;
}

// ============================================================================
// Workout Expansion
// ============================================================================

/**
 * Parse a workout reference and extract the template ID and parameters.
 */
function parseWorkoutReference(ref: string): ParsedWorkoutRef {
  return parseWorkoutRef(ref);
}

/**
 * Expand a single workout from its template reference.
 */
export function expandWorkout(
  ref: string,
  workoutId: string,
  context: InterpolationContext,
  templates: TemplateRegistry
): ExpandedWorkout {
  const parsed = parseWorkoutReference(ref);
  const template = templates.get(parsed.templateId);

  if (!template) {
    // Create a placeholder workout for unknown templates
    return {
      id: workoutId,
      sport: "run",
      type: "unknown",
      name: `Unknown: ${parsed.templateId}`,
      humanReadable: `Template not found: ${parsed.templateId}`,
      completed: false,
    };
  }

  // Build the full context with template params
  const paramContext = buildParamContext(template, parsed.params);
  const fullContext: InterpolationContext = {
    ...context,
    ...paramContext,
  };

  // Interpolate the human-readable description
  const humanReadable = interpolate(template.humanReadable, fullContext);

  // Calculate duration
  let durationMinutes: number | undefined;
  if (template.estimatedDuration !== undefined) {
    if (typeof template.estimatedDuration === "number") {
      durationMinutes = template.estimatedDuration;
    } else {
      // Use interpolate to handle ${...} expressions in templates
      const result = interpolate(template.estimatedDuration, fullContext);
      const parsed = parseFloat(result);
      if (!isNaN(parsed)) {
        durationMinutes = parsed;
      }
    }
  }

  return {
    id: workoutId,
    sport: template.sport,
    type: template.type,
    name: template.name,
    durationMinutes,
    primaryZone: template.targetZone,
    rpe: template.rpe,
    humanReadable,
    completed: false,
  };
}

/**
 * Build parameter context from template defaults and provided params.
 */
function buildParamContext(
  template: WorkoutTemplate,
  providedParams: (string | number)[]
): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  if (!template.params) {
    return context;
  }

  const paramNames = Object.keys(template.params);

  // Apply defaults first
  for (const [name, def] of Object.entries(template.params)) {
    if (def.default !== undefined) {
      context[name] = def.default;
    }
  }

  // Override with provided params (positional)
  for (let i = 0; i < providedParams.length && i < paramNames.length; i++) {
    context[paramNames[i]] = providedParams[i];
  }

  return context;
}

// ============================================================================
// Week Expansion
// ============================================================================

/**
 * Expand a single week from the compact format.
 */
function expandWeek(
  compactWeek: CompactWeek,
  weekStartDate: Date,
  context: InterpolationContext,
  templates: TemplateRegistry,
  firstDayOfWeek: "monday" | "sunday"
): ExpandedWeek {
  const days: ExpandedDay[] = [];
  let totalMinutes = 0;
  const bySport: Record<string, { sessions: number; hours: number }> = {};

  // Create all 7 days of the week
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = addDays(weekStartDate, dayOffset);
    const dayOfWeek = getDayOfWeekName(date);

    days.push({
      date: formatDate(date),
      dayOfWeek,
      workouts: [],
    });
  }

  // Populate workouts from the schedule
  for (const [dayAbbrev, workoutRefs] of Object.entries(compactWeek.workouts)) {
    const dayOffset = getDayOffset(dayAbbrev, firstDayOfWeek);
    if (dayOffset < 0 || dayOffset >= 7) continue;

    const day = days[dayOffset];
    const refs = Array.isArray(workoutRefs) ? workoutRefs : [workoutRefs];

    for (let i = 0; i < refs.length; i++) {
      const ref = refs[i];
      const workoutId = `week${compactWeek.week}-${dayAbbrev.toLowerCase()}-${i + 1}`;
      const workout = expandWorkout(ref, workoutId, context, templates);

      day.workouts.push(workout);

      // Update summary stats
      if (workout.durationMinutes) {
        totalMinutes += workout.durationMinutes;

        const sport = workout.sport;
        if (!bySport[sport]) {
          bySport[sport] = { sessions: 0, hours: 0 };
        }
        bySport[sport].sessions += 1;
        bySport[sport].hours += workout.durationMinutes / 60;
      }
    }
  }

  // Round hours to 1 decimal place
  for (const sport of Object.keys(bySport)) {
    bySport[sport].hours = Math.round(bySport[sport].hours * 10) / 10;
  }

  const summary: ExpandedWeekSummary = {
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    bySport,
  };

  return {
    weekNumber: compactWeek.week,
    startDate: formatDate(weekStartDate),
    endDate: formatDate(addDays(weekStartDate, 6)),
    phase: compactWeek.phase,
    focus: compactWeek.focus || "",
    targetHours: compactWeek.targetHours || summary.totalHours,
    days,
    summary,
    isRecoveryWeek: compactWeek.isRecoveryWeek || false,
  };
}

// ============================================================================
// Phase Expansion
// ============================================================================

/**
 * Expand phases from compact format.
 */
function expandPhases(compact: CompactPlan): ExpandedPhase[] {
  return compact.phases.map((phase) => {
    const weeks = parseWeekRange(phase.weeks);
    const startWeek = Math.min(...weeks);
    const endWeek = Math.max(...weeks);

    return {
      name: phase.name,
      startWeek,
      endWeek,
      focus: phase.focus,
      weeklyHoursRange: { low: 0, high: 0 }, // Will be calculated from weeks
      keyWorkouts: phase.keyWorkouts || [],
      physiologicalGoals: [],
    };
  });
}

// ============================================================================
// Main Expander
// ============================================================================

/**
 * Expand a compact plan into the full format for HTML rendering.
 */
export function expandPlan(
  compact: CompactPlan,
  templates: TemplateRegistry,
  options: ExpansionOptions = {}
): ExpandedPlan {
  const firstDayOfWeek = compact.athlete.firstDayOfWeek || "monday";
  const totalWeeks = compact.weeks.length;

  // Calculate start date
  const startDate =
    options.startDate || calculateStartDate(compact.athlete.eventDate, totalWeeks, firstDayOfWeek);

  // Build interpolation context
  const zonesForContext = compact.athlete.zones?.hr
    ? {
        hr: {
          lthr: compact.athlete.zones.hr.lthr,
          maxHR: compact.athlete.zones.hr.maxHR,
          restingHR: compact.athlete.zones.hr.restingHR,
        } as { lthr: number; [key: string]: number | undefined },
      }
    : undefined;

  const context = createContext(
    compact.athlete.paces as Record<string, string | undefined>,
    zonesForContext
  );

  // Calculate zones
  const zones = calculateAthleteZones(compact.athlete.zones?.hr, compact.athlete.paces);

  // Expand phases
  const phases = expandPhases(compact);

  // Expand weeks
  const weeks: ExpandedWeek[] = [];
  for (let i = 0; i < compact.weeks.length; i++) {
    const compactWeek = compact.weeks[i];
    const weekStartDate = addDays(startDate, i * 7);
    const expandedWeek = expandWeek(compactWeek, weekStartDate, context, templates, firstDayOfWeek);
    weeks.push(expandedWeek);
  }

  // Calculate phase hour ranges from actual weeks
  for (const phase of phases) {
    const phaseWeeks = weeks.filter(
      (w) => w.weekNumber >= phase.startWeek && w.weekNumber <= phase.endWeek
    );
    if (phaseWeeks.length > 0) {
      const hours = phaseWeeks.map((w) => w.summary.totalHours);
      phase.weeklyHoursRange = {
        low: Math.min(...hours),
        high: Math.max(...hours),
      };
    }
  }

  // Build metadata
  const now = new Date().toISOString();
  const meta = {
    id: `plan-${Date.now()}`,
    athlete: compact.athlete.name,
    event: compact.athlete.event,
    eventDate: compact.athlete.eventDate,
    planStartDate: formatDate(startDate),
    planEndDate: formatDate(addDays(startDate, totalWeeks * 7 - 1)),
    createdAt: now,
    updatedAt: now,
    totalWeeks,
    generatedBy: "Endurance Coach",
  };

  // Build preferences
  const unit = compact.athlete.unit || "km";
  const preferences = {
    swim: "meters" as const,
    bike: unit === "mi" ? ("miles" as const) : ("kilometers" as const),
    run: unit === "mi" ? ("miles" as const) : ("kilometers" as const),
    firstDayOfWeek,
  };

  return {
    version: "1.0",
    meta,
    preferences,
    zones,
    phases,
    weeks,
    raceStrategy: compact.raceStrategy ? { ...compact.raceStrategy } : undefined,
    assessment: compact.assessment ? { ...compact.assessment } : undefined,
    athleteNotes: compact.athlete.constraints ? { ...compact.athlete.constraints } : undefined,
    athletePaces: compact.athlete.paces ? { ...compact.athlete.paces } : undefined,
  };
}

/**
 * Validate that all workout references in a compact plan have corresponding templates.
 */
export function validateWorkoutRefs(compact: CompactPlan, templates: TemplateRegistry): string[] {
  const errors: string[] = [];

  for (const week of compact.weeks) {
    for (const [day, refs] of Object.entries(week.workouts)) {
      const refArray = Array.isArray(refs) ? refs : [refs];
      for (const ref of refArray) {
        const parsed = parseWorkoutReference(ref);
        if (!templates.has(parsed.templateId)) {
          errors.push(`Week ${week.week}, ${day}: Unknown template "${parsed.templateId}"`);
        }
      }
    }
  }

  return errors;
}
