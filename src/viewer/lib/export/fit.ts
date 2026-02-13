/**
 * FIT (Garmin) Workout Export
 *
 * Generates Garmin FIT workout files that can be uploaded to Garmin Connect.
 * Uses the official @garmin/fitsdk package for binary FIT encoding.
 *
 * How to import to Garmin:
 * - Upload to Garmin Connect (connect.garmin.com) -> Training -> Workouts -> Import
 * - The workout will sync to compatible Garmin devices
 */

import type {
  Workout,
  Sport,
  StructuredWorkout,
  WorkoutStep,
  IntervalSet,
} from "../../../schema/training-plan.js";
import type { Settings } from "../../stores/settings.js";
import { Encoder, Profile } from "@garmin/fitsdk";

/**
 * Check if the FIT SDK is available at runtime
 * Always returns true since the SDK is now bundled
 */
export async function isFitSdkAvailable(): Promise<boolean> {
  return true;
}

/**
 * Check if a sport is supported by FIT export
 */
export function isFitSupported(sport: Sport): boolean {
  // FIT supports most sports, excluding rest and race-specific
  return sport !== "rest" && sport !== "race";
}

/**
 * Map our sport types to FIT sport enum values
 */
function getFitSport(sport: Sport): string {
  switch (sport) {
    case "swim":
      return "swimming";
    case "bike":
      return "cycling";
    case "run":
      return "running";
    case "strength":
      return "training";
    case "brick":
      return "multisport";
    default:
      return "generic";
  }
}

/**
 * Convert an internal sport identifier to the corresponding FIT `sub_sport` enum value.
 *
 * @param sport - Internal sport identifier (e.g., "swim", "bike", "run", "strength", "brick")
 * @returns The FIT `sub_sport` enum string (for example `lapSwimming`, `road`, `strengthTraining`, or `generic`)
 */
function getFitSubSport(sport: Sport): string {
  switch (sport) {
    case "swim":
      return "lapSwimming";
    case "bike":
      return "road";
    case "run":
      return "road";
    case "strength":
      return "strengthTraining";
    case "brick":
      return "generic";
    default:
      return "generic";
  }
}

/**
 * Get workout step intensity/duration type based on step type
 */
function getStepIntensity(stepType: string): string {
  switch (stepType) {
    case "warmup":
      return "warmup";
    case "cooldown":
      return "cooldown";
    case "rest":
      return "rest";
    case "recovery":
      return "recovery";
    case "work":
      return "active";
    default:
      return "active";
  }
}

/**
 * Convert duration to FIT workout step duration
 */
function getDurationValue(value: number, unit: string): number {
  switch (unit) {
    case "seconds":
      return value * 1000; // FIT uses milliseconds
    case "minutes":
      return value * 60 * 1000;
    case "hours":
      return value * 3600 * 1000;
    case "meters":
      return value * 100; // FIT uses centimeters
    case "kilometers":
      return value * 100000;
    case "miles":
      return value * 160934; // cm per mile
    default:
      return value * 1000;
  }
}

/**
 * Map a duration unit string to the corresponding FIT duration category.
 *
 * @param unit - Unit name (e.g., "seconds", "minutes", "hours", "meters", "kilometers", "miles")
 * @returns `"time"` for time-based units or unknown units, `"distance"` for distance-based units
 */
function getDurationType(unit: string): string {
  switch (unit) {
    case "seconds":
    case "minutes":
    case "hours":
      return "time";
    case "meters":
    case "kilometers":
    case "miles":
      return "distance";
    default:
      return "time";
  }
}

/**
 * Convert a pace string in MM:SS[/km|/mi] form to meters per second.
 *
 * @param pace - Pace formatted as minutes and seconds (e.g., "4:30" or "5:00/mi"). If the unit is omitted, `/km` is assumed.
 * @returns The corresponding speed in meters per second, or `null` if the input cannot be parsed.
 */
function parsePaceToSpeedMps(pace: string): number | null {
  const match = pace.trim().match(/^(\d{1,2}):(\d{2})(?:\/(km|mi))?$/i);
  if (!match) {
    return null;
  }

  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
    return null;
  }

  const totalSeconds = minutes * 60 + seconds;
  if (totalSeconds === 0) {
    return null;
  }
  const unit = (match[3] ?? "km").toLowerCase();
  const meters = unit === "mi" ? 1609.34 : 1000;

  return meters / totalSeconds;
}

/**
 * Builds FIT workout steps from a structured workout.
 *
 * Creates an array of FIT WORKOUT_STEP-like message objects representing warmup,
 * main (including interval repeat blocks), and cooldown sections from `structure`.
 *
 * @param structure - Structured workout with optional `warmup` and `cooldown` arrays and a `main` sequence that may include interval sets
 * @returns An object containing `steps`, the generated array of FIT step message objects, and `totalSteps`, the number of generated steps
 */
function generateStepsFromStructure(structure: StructuredWorkout): {
  steps: Record<string, unknown>[];
  totalSteps: number;
} {
  const steps: Record<string, unknown>[] = [];
  let stepIndex = 0;

  // Helper to add a step
  const addStep = (step: WorkoutStep) => {
    const durationType = getDurationType(step.duration?.unit ?? "minutes");
    const durationValue = getDurationValue(
      step.duration?.value ?? 0,
      step.duration?.unit ?? "minutes"
    );

    const fitStep: Record<string, unknown> = {
      messageIndex: stepIndex,
      wktStepName: step.name || "",
      intensity: getStepIntensity(step.type),
      durationType: durationType,
      durationValue: durationValue,
      notes: step.notes || "",
    };

    // Add target based on intensity unit
    if (step.intensity) {
      const intensityValue = step.intensity.value ?? 50;
      switch (step.intensity.unit) {
        case "percent_ftp":
          fitStep.targetType = "power";
          fitStep.targetValue = 0;
          fitStep.customTargetValueLow = step.intensity.valueLow ?? intensityValue;
          fitStep.customTargetValueHigh = step.intensity.valueHigh ?? intensityValue;
          break;
        case "percent_lthr":
          fitStep.targetType = "heartRate";
          fitStep.targetValue = 0;
          fitStep.customTargetValueLow = step.intensity.valueLow ?? intensityValue;
          fitStep.customTargetValueHigh = step.intensity.valueHigh ?? intensityValue;
          break;
        case "hr_zone":
          fitStep.targetType = "heartRate";
          fitStep.targetValue = Math.round(intensityValue);
          break;
        case "pace_zone": {
          const pace = step.intensity.description ?? "";
          const speedMps = parsePaceToSpeedMps(pace);
          if (speedMps) {
            fitStep.targetType = "speed";
            fitStep.targetValue = 0;
            const scaled = Math.round(speedMps * 1000);
            fitStep.customTargetValueLow = scaled;
            fitStep.customTargetValueHigh = scaled;
          } else {
            fitStep.targetType = "open";
          }
          break;
        }
        case "rpe":
          // No direct RPE support in FIT, use open target
          fitStep.targetType = "open";
          break;
        default:
          fitStep.targetType = "open";
      }
    } else {
      fitStep.targetType = "open";
    }

    // Add cadence target if present
    if (step.cadence) {
      fitStep.customTargetCadenceLow = step.cadence.low ?? 80;
      fitStep.customTargetCadenceHigh = step.cadence.high ?? 100;
    }

    steps.push(fitStep);
    stepIndex++;
    return stepIndex - 1;
  };

  // Helper to add interval set
  const addIntervalSet = (intervalSet: IntervalSet) => {
    // For FIT, we need to add a repeat step that references the child steps
    const repeatFromIndex = stepIndex;

    // Add the child steps
    for (const childStep of intervalSet.steps) {
      addStep(childStep);
    }

    // Create the repeat step (must follow the block)
    const repeatStep: Record<string, unknown> = {
      messageIndex: stepIndex,
      wktStepName: intervalSet.name || "Intervals",
      durationType: "repeatUntilStepsCmplt",
      durationValue: repeatFromIndex + 1,
      targetType: "open",
      targetValue: intervalSet.repeats,
      intensity: "interval",
    };

    steps.push(repeatStep);
    stepIndex++;
  };

  // Process warmup
  if (structure.warmup) {
    for (const step of structure.warmup) {
      addStep(step);
    }
  }

  // Process main set
  for (const item of structure.main) {
    if ("repeats" in item) {
      addIntervalSet(item as IntervalSet);
    } else {
      addStep(item as WorkoutStep);
    }
  }

  // Process cooldown
  if (structure.cooldown) {
    for (const step of structure.cooldown) {
      addStep(step);
    }
  }

  return { steps, totalSteps: steps.length };
}

/**
 * Generate simple workout steps when no structure is provided
 */
function generateSimpleSteps(workout: Workout): {
  steps: Record<string, unknown>[];
  totalSteps: number;
} {
  const steps: Record<string, unknown>[] = [];
  const totalMinutes = workout.durationMinutes || 60;

  // Warmup (10% of total, 5-15 min)
  const warmupMinutes = Math.min(15, Math.max(5, Math.round(totalMinutes * 0.1)));
  steps.push({
    messageIndex: 0,
    wktStepName: "Warm Up",
    intensity: "warmup",
    durationType: "time",
    durationValue: warmupMinutes * 60 * 1000,
    targetType: "open",
  });

  // Main (80% of total)
  const cooldownMinutes = Math.min(10, Math.max(5, Math.round(totalMinutes * 0.1)));
  const mainMinutes = totalMinutes - warmupMinutes - cooldownMinutes;

  let mainIntensity = "active";
  if (workout.type === "recovery") mainIntensity = "recovery";
  else if (workout.type === "rest") mainIntensity = "rest";
  else if (workout.type === "intervals" || workout.type === "vo2max") mainIntensity = "interval";

  steps.push({
    messageIndex: 1,
    wktStepName: "Main Set",
    intensity: mainIntensity,
    durationType: "time",
    durationValue: mainMinutes * 60 * 1000,
    targetType: "open",
    notes: workout.description || "",
  });

  // Cooldown (10% of total, 5-10 min)
  steps.push({
    messageIndex: 2,
    wktStepName: "Cool Down",
    intensity: "cooldown",
    durationType: "time",
    durationValue: cooldownMinutes * 60 * 1000,
    targetType: "open",
  });

  return { steps, totalSteps: 3 };
}

/**
 * Create a Garmin FIT workout file from a Workout and exporter Settings.
 *
 * Validates that the workout's sport is supported, encodes the required FIT
 * messages (FILE_ID, WORKOUT, WORKOUT_STEP), and includes swim pool metadata
 * when applicable based on `settings`.
 *
 * @param workout - The workout to export
 * @param settings - Exporter settings (used for units and swim pool information)
 * @returns A Uint8Array containing the encoded FIT binary data
 * @throws Error if the workout's sport is not supported for FIT export
 */
export async function generateFit(workout: Workout, settings: Settings): Promise<Uint8Array> {
  if (!isFitSupported(workout.sport)) {
    throw new Error(`FIT export not supported for ${workout.sport} workouts`);
  }

  const encoder = new Encoder();

  // File ID message (required)
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: "workout",
    manufacturer: "development",
    product: 1,
    serialNumber: Math.floor(Math.random() * 1000000),
    timeCreated: new Date(),
  });

  // Generate steps
  const { steps, totalSteps } = workout.structure
    ? generateStepsFromStructure(workout.structure)
    : generateSimpleSteps(workout);

  // Workout message
  const workoutMessage: Record<string, unknown> = {
    wktName: workout.name,
    sport: getFitSport(workout.sport),
    subSport: getFitSubSport(workout.sport),
    numValidSteps: totalSteps,
  };

  if (workout.sport === "swim") {
    const isYards = settings.units.swim === "yards";
    const poolLengthMeters = isYards ? 22.86 : 25;
    workoutMessage.poolLength = Math.round(poolLengthMeters * 100);
    workoutMessage.poolLengthUnit = isYards ? "statute" : "metric";
  }

  encoder.onMesg(Profile.MesgNum.WORKOUT, workoutMessage);

  // Write workout steps
  for (const step of steps) {
    encoder.onMesg(Profile.MesgNum.WORKOUT_STEP, step);
  }

  // Finalize and return
  return encoder.close();
}
