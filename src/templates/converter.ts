/**
 * Template Structure Conversion
 *
 * Converts template structures (string-based properties) to workout structures
 * (object-based properties) for export to Zwift, Garmin, and other platforms.
 *
 * This layer handles:
 * - Interpolating template variables (${paces.easy}, ${duration}, etc.)
 * - Parsing duration strings ("10min", "${warmup_mins}min") into DurationTarget objects
 * - Parsing intensity strings ("Zone 2", "RPE 7-8") into IntensityTarget objects
 * - Converting TemplateStep to WorkoutStep
 * - Converting TemplateIntervalSet to IntervalSet
 */

import type {
  TemplateStep,
  TemplateIntervalSet,
  TemplateStructure,
  InterpolationContext,
} from "./template.types.js";
import type {
  WorkoutStep,
  IntervalSet,
  StructuredWorkout,
  DurationTarget,
  IntensityTarget,
  DurationUnit,
  IntensityUnit,
} from "../schema/training-plan.js";
import { interpolate, evaluateExpression } from "./interpolate.js";

/**
 * Parse a human-readable duration string and resolve interpolated expressions into a DurationTarget.
 *
 * @param durationStr - Duration string to parse; may contain interpolated variables or arithmetic expressions (e.g., `"${warmup_mins}min"`, `"10 + ${extra}"`, `"5km"`, `"30sec"`). If undefined, no parsing is performed.
 * @param context - Interpolation context used to resolve variables and evaluate expressions
 * @returns A DurationTarget describing the parsed numeric value and unit (e.g., minutes, seconds, kilometers), or `undefined` when `durationStr` is `undefined`.
 * @throws Error if the string cannot be parsed as a duration or if the unit token is unrecognized
 */
export function parseDuration(
  durationStr: string | undefined,
  context: InterpolationContext
): DurationTarget | undefined {
  if (!durationStr) {
    return undefined;
  }

  // First interpolate any variables
  let parsed = interpolate(durationStr, context);

  // Try to evaluate as expression (e.g., "10 + ${warmup_mins}")
  try {
    const evaluated = evaluateExpression(parsed, context);
    if (typeof evaluated === "number") {
      // If just a number, default to minutes
      return { unit: "minutes", value: evaluated };
    }
    parsed = String(evaluated);
  } catch {
    // Not an expression, continue with string parsing
  }

  // Parse unit and value
  // Match: number followed by unit (min/sec/hr/m/km/mile/yd/lap/etc)
  const durationPattern =
    /^(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|minute|minutes|min|m|meters|km|kilometers|mile|miles|yd|yards|hr|hour|hours|lap|laps)$/i;
  const match = parsed.match(durationPattern);

  if (!match) {
    // If we can't parse, try extracting just the number (default to minutes)
    const numberMatch = parsed.match(/^(\d+(?:\.\d+)?)$/);
    if (numberMatch) {
      return { unit: "minutes", value: parseFloat(numberMatch[1]) };
    }
    throw new Error(`Could not parse duration: "${durationStr}" (interpolated: "${parsed}")`);
  }

  const value = parseFloat(match[1]);
  const unitStr = match[2].toLowerCase();

  // Map unit string to DurationUnit
  const unitMap: Record<string, DurationUnit> = {
    s: "seconds",
    sec: "seconds",
    second: "seconds",
    seconds: "seconds",
    min: "minutes",
    minute: "minutes",
    minutes: "minutes",
    hr: "hours",
    hour: "hours",
    hours: "hours",
    m: "meters",
    meters: "meters",
    km: "kilometers",
    kilometers: "kilometers",
    mile: "miles",
    miles: "miles",
    yd: "yards",
    yards: "yards",
    lap: "laps",
    laps: "laps",
  };

  const unit = unitMap[unitStr];
  if (!unit) {
    throw new Error(`Unknown duration unit: "${unitStr}" in "${durationStr}"`);
  }

  return { unit, value };
}

/**
 * Parse an intensity expression or label into a normalized intensity target.
 *
 * Supports zone labels (e.g., "Zone 2", "Z2", "Zone 2-3"), percentage formats (single or ranges, with optional FTP/LTHR target), RPE (single or ranges, including "7/10"), explicit pace references (e.g., "5:30/km"), and interpolated variables from the provided context.
 *
 * @param intensityStr - Intensity string to parse; may contain template variables that will be resolved using the context
 * @param context - Interpolation context used to resolve variables in `intensityStr`
 * @returns A normalized intensity target with a `unit` and numeric `value`; range inputs populate `valueLow`/`valueHigh`, and `description` contains a human-readable representation when available
 */
export function parseIntensity(
  intensityStr: string | undefined,
  context: InterpolationContext
): IntensityTarget {
  if (!intensityStr) {
    // Default to moderate intensity
    return { unit: "percent_ftp", value: 65, description: "Moderate" };
  }

  // First interpolate any variables
  let parsed = interpolate(intensityStr, context);

  // Check if it's a pace reference (e.g., "5:30/km", "9:00/mi")
  const pacePattern = /^(\d+:\d+(?:\.\d+)?)\/(km|mi|mile|m|meter|100m|400m)$/i;
  const paceMatch = parsed.match(pacePattern);
  if (paceMatch) {
    // For now, store as description. Future enhancement could convert pace to zones
    return {
      unit: "pace_zone",
      value: 2, // Default to Zone 2 for explicit pace
      description: parsed,
    };
  }

  // Check for Zone format (e.g., "Zone 2", "Z2", "Zone 2-3")
  const zonePattern = /^(?:Zone\s*|Z)(\d+)(?:\s*[-–to]+\s*(\d+))?$/i;
  const zoneMatch = parsed.match(zonePattern);
  if (zoneMatch) {
    const lowZone = parseInt(zoneMatch[1], 10);
    const highZone = zoneMatch[2] ? parseInt(zoneMatch[2], 10) : lowZone;

    return {
      unit: "pace_zone",
      value: (lowZone + highZone) / 2,
      valueLow: lowZone !== highZone ? lowZone : undefined,
      valueHigh: lowZone !== highZone ? highZone : undefined,
      description: zoneMatch[2] ? `Zone ${lowZone}-${highZone}` : `Zone ${lowZone}`,
    };
  }

  // Check for percentage formats (e.g., "75% FTP", "75%", "70-80% FTP")
  const percentPattern = /^(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*%?\s*(FTP|LTHR|LT)?$/i;
  const percentRangeMatch = parsed.match(percentPattern);
  if (percentRangeMatch) {
    const valueLow = parseFloat(percentRangeMatch[1]);
    const valueHigh = parseFloat(percentRangeMatch[2]);
    const target = percentRangeMatch[3]?.toUpperCase() || "FTP";
    const unit: IntensityUnit =
      target === "LTHR" || target === "LT" ? "percent_lthr" : "percent_ftp";

    return {
      unit,
      value: (valueLow + valueHigh) / 2,
      valueLow,
      valueHigh,
      description: `${valueLow}-${valueHigh}% ${target}`,
    };
  }

  // Check for single percentage (e.g., "75% FTP", "75%")
  const singlePercentPattern = /^(\d+(?:\.\d+)?)\s*%?\s*(FTP|LTHR|LT)?$/i;
  const singlePercentMatch = parsed.match(singlePercentPattern);
  if (singlePercentMatch) {
    const value = parseFloat(singlePercentMatch[1]);
    const target = singlePercentMatch[2]?.toUpperCase() || "FTP";
    const unit: IntensityUnit =
      target === "LTHR" || target === "LT" ? "percent_lthr" : "percent_ftp";

    return {
      unit,
      value,
      description: `${value}% ${target}`,
    };
  }

  // Check for RPE format (e.g., "RPE 7", "RPE 7-8", "7/10")
  const rpePattern = /^(?:RPE\s*)?(\d+)(?:\s*[-–/to]+\s*(\d+))?(?:\s*\/\s*10)?$/i;
  const rpeMatch = parsed.match(rpePattern);
  if (rpeMatch) {
    const lowRpe = parseInt(rpeMatch[1], 10);
    const highRpe = rpeMatch[2] ? parseInt(rpeMatch[2], 10) : lowRpe;

    return {
      unit: "rpe",
      value: (lowRpe + highRpe) / 2,
      valueLow: lowRpe !== highRpe ? lowRpe : undefined,
      valueHigh: lowRpe !== highRpe ? highRpe : undefined,
      description: rpeMatch[2] ? `RPE ${lowRpe}-${highRpe}` : `RPE ${lowRpe}`,
    };
  }

  // If we can't parse, treat as description and use default intensity
  return {
    unit: "percent_ftp",
    value: 65,
    description: parsed,
  };
}

/**
 * Convert a template-defined step into a WorkoutStep with parsed duration and intensity.
 *
 * Duration and intensity strings on the template step are parsed and interpolated; name and description are interpolated when present. If neither duration nor distance is provided, defaults to 10 minutes; if neither intensity nor pace is provided, defaults to 65% FTP.
 *
 * @param templateStep - Template step containing string-based duration/intensity/pace/name/description
 * @param context - Interpolation context used to resolve template variables and expressions
 * @returns The corresponding WorkoutStep with object-based `duration` and `intensity`, and interpolated `name` and `notes` when available
 * @throws Error if a provided duration or distance string cannot be parsed
 */
export function convertTemplateStep(
  templateStep: TemplateStep,
  context: InterpolationContext
): WorkoutStep {
  // Parse duration
  let duration: DurationTarget;
  if (templateStep.duration) {
    const parsedDuration = parseDuration(templateStep.duration, context);
    if (!parsedDuration) {
      throw new Error(`Failed to parse duration: "${templateStep.duration}"`);
    }
    duration = parsedDuration;
  } else if (templateStep.distance) {
    // If distance is specified but not duration, parse it as distance duration
    const parsedDuration = parseDuration(templateStep.distance, context);
    if (!parsedDuration) {
      throw new Error(`Failed to parse distance: "${templateStep.distance}"`);
    }
    duration = parsedDuration;
  } else {
    // Default to 10 minutes if no duration specified
    duration = { unit: "minutes", value: 10 };
  }

  // Parse intensity
  let intensity: IntensityTarget;
  if (templateStep.intensity) {
    intensity = parseIntensity(templateStep.intensity, context);
  } else if (templateStep.pace) {
    // Pace specified, create intensity description
    const interpolatedPace = interpolate(templateStep.pace, context);
    intensity = {
      unit: "pace_zone",
      value: 2, // Default to Zone 2
      description: interpolatedPace,
    };
  } else {
    // Default intensity
    intensity = { unit: "percent_ftp", value: 65, description: "Moderate" };
  }

  return {
    type: templateStep.type,
    name: templateStep.name ? interpolate(templateStep.name, context) : undefined,
    duration,
    intensity,
    notes: templateStep.description ? interpolate(templateStep.description, context) : undefined,
  };
}

/**
 * Convert a template interval set into an IntervalSet ready for export.
 *
 * @param intervalSet - The template interval set to convert; its `repeats` field may contain interpolated values.
 * @param context - Interpolation context used to resolve template variables referenced in the interval set.
 * @returns An IntervalSet with `type: "interval_set"`, a parsed non-negative `repeats` count, and `steps` containing the converted work and recovery WorkoutSteps.
 * @throws Error if the interpolated `repeats` value cannot be parsed as a non-negative integer.
 */
export function convertTemplateIntervalSet(
  intervalSet: TemplateIntervalSet,
  context: InterpolationContext
): IntervalSet {
  // Parse repeats (may be a variable like "${reps}")
  const repeatsStr = interpolate(intervalSet.repeats, context);
  const repeats = typeof repeatsStr === "string" ? parseInt(repeatsStr, 10) : Number(repeatsStr);

  if (isNaN(repeats) || repeats < 0) {
    throw new Error(`Invalid repeats value: "${intervalSet.repeats}" (parsed: "${repeatsStr}")`);
  }

  // Convert work and recovery steps
  const work = convertTemplateStep(intervalSet.work, context);
  const recovery = convertTemplateStep(intervalSet.recovery, context);

  return {
    type: "interval_set",
    repeats,
    steps: [work, recovery],
  };
}

/**
 * Convert a template-based workout structure into an object-based structured workout.
 *
 * @param templateStructure - Template data containing warmup, main, and cooldown entries to convert
 * @param context - Interpolation context used to resolve template variables and expressions
 * @returns The structured workout with warmup, main, and cooldown sections represented as object-based steps and interval sets
 */
export function convertTemplateStructure(
  templateStructure: TemplateStructure,
  context: InterpolationContext
): StructuredWorkout {
  // Convert warmup steps
  const warmup = templateStructure.warmup?.map((step) => convertTemplateStep(step, context));

  // Convert main set (can be steps or interval sets)
  const main = templateStructure.main.map((item) => {
    if ("repeats" in item) {
      // TemplateIntervalSet
      return convertTemplateIntervalSet(item, context);
    } else {
      // TemplateStep
      return convertTemplateStep(item, context);
    }
  });

  // Convert cooldown steps
  const cooldown = templateStructure.cooldown?.map((step) => convertTemplateStep(step, context));

  return {
    warmup,
    main,
    cooldown,
  };
}