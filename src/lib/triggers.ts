import type { Lap } from "../strava/types.js";

export type TriggerType = "hr_drift" | "pace_deviation" | "lap_variability" | "early_fade";

export interface TriggerConfig {
  type: TriggerType;
  threshold: number;
  unit: string;
  enabled: boolean;
}

export interface TriggerEvaluationResult {
  fired: boolean;
  value?: number;
  threshold: number;
  unit: string;
  percentageOver?: number;
}

export interface FiredTrigger {
  trigger_type: TriggerType;
  actual_value: number;
  threshold: number;
  unit: string;
  percentage_over: number;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const squareDiffs = values.map((val) => Math.pow(val - avg, 2));
  const sumSquareDiffs = squareDiffs.reduce((sum, val) => sum + val, 0);
  return Math.sqrt(sumSquareDiffs / (values.length - 1));
}

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  if (avg === 0) return 0;
  const stdDev = standardDeviation(values);
  return (stdDev / avg) * 100;
}

function getPace(lap: Lap): number {
  if (lap.distance > 0 && lap.moving_time > 0) {
    return lap.moving_time / lap.distance;
  }
  return 0;
}

function getHeartRate(lap: Lap): number | null {
  if (lap.average_heartrate !== undefined && lap.average_heartrate > 0) {
    return lap.average_heartrate;
  }
  return null;
}

function getPower(lap: Lap): number | null {
  if (lap.average_watts !== undefined && lap.average_watts > 0) {
    return lap.average_watts;
  }
  return null;
}

function splitLaps<T>(laps: T[], fraction: number): T[] {
  if (laps.length === 0) return [];
  const splitIndex = Math.floor(laps.length * fraction);
  return laps.slice(0, splitIndex);
}

export function evaluateHRDrift(laps: Lap[], threshold: number): TriggerEvaluationResult {
  if (laps.length < 2) {
    return { fired: false, threshold, unit: "%" };
  }

  const lapsWithHR = laps.filter(
    (lap) => lap.average_heartrate !== undefined && lap.average_heartrate > 0
  );

  if (lapsWithHR.length < 2) {
    return { fired: false, threshold, unit: "%" };
  }

  const firstHalf = lapsWithHR.slice(0, Math.floor(lapsWithHR.length / 2));
  const secondHalf = lapsWithHR.slice(Math.ceil(lapsWithHR.length / 2));

  const firstHalfHR = firstHalf.map(getHeartRate).filter((hr): hr is number => hr !== null);
  const secondHalfHR = secondHalf.map(getHeartRate).filter((hr): hr is number => hr !== null);

  if (firstHalfHR.length === 0 || secondHalfHR.length === 0) {
    return { fired: false, threshold, unit: "%" };
  }

  const firstHalfAvg = mean(firstHalfHR);
  const secondHalfAvg = mean(secondHalfHR);

  if (firstHalfAvg === 0) {
    return { fired: false, threshold, unit: "%" };
  }

  const drift = ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  const fired = drift > threshold;

  return {
    fired,
    value: drift,
    threshold,
    unit: "%",
    percentageOver: fired ? drift - threshold : undefined,
  };
}

export function evaluatePaceDeviation(laps: Lap[], threshold: number): TriggerEvaluationResult {
  if (laps.length < 2) {
    return { fired: false, threshold, unit: "%" };
  }

  const paces = laps.map(getPace).filter((pace): pace is number => pace > 0);

  if (paces.length < 2) {
    return { fired: false, threshold, unit: "%" };
  }

  const cv = coefficientOfVariation(paces);
  const fired = cv > threshold;

  return {
    fired,
    value: cv,
    threshold,
    unit: "%",
    percentageOver: fired ? cv - threshold : undefined,
  };
}

export function evaluateLapVariability(laps: Lap[], threshold: number): TriggerEvaluationResult {
  if (laps.length < 2) {
    return { fired: false, threshold, unit: "%" };
  }

  const powerValues = laps
    .map(getPower)
    .filter((power): power is number => power !== null && power > 0);

  const paceValues = laps.map(getPace).filter((pace): pace is number => pace > 0);

  const values = powerValues.length === laps.length ? powerValues : paceValues;

  if (values.length < 2) {
    return { fired: false, threshold, unit: "%" };
  }

  const cv = coefficientOfVariation(values);
  const fired = cv > threshold;

  return {
    fired,
    value: cv,
    threshold,
    unit: "%",
    percentageOver: fired ? cv - threshold : undefined,
  };
}

export function evaluateEarlyFade(laps: Lap[], threshold: number): TriggerEvaluationResult {
  if (laps.length < 4) {
    return { fired: false, threshold, unit: "%" };
  }

  const firstQuarter = splitLaps(laps, 0.25);
  const lastQuarter = laps.slice(-Math.ceil(laps.length / 4));

  if (firstQuarter.length === 0 || lastQuarter.length === 0) {
    return { fired: false, threshold, unit: "%" };
  }

  const firstPowerValues: number[] = [];
  const firstPaceValues: number[] = [];
  const lastPowerValues: number[] = [];
  const lastPaceValues: number[] = [];

  for (const lap of firstQuarter) {
    const pace = getPace(lap);
    const power = getPower(lap);

    if (power !== null && power > 0) {
      firstPowerValues.push(power);
    } else if (pace > 0) {
      firstPaceValues.push(pace);
    }
  }

  for (const lap of lastQuarter) {
    const pace = getPace(lap);
    const power = getPower(lap);

    if (power !== null && power > 0) {
      lastPowerValues.push(power);
    } else if (pace > 0) {
      lastPaceValues.push(pace);
    }
  }

  if (firstPowerValues.length > 0 && lastPowerValues.length > 0) {
    const firstAvg = mean(firstPowerValues);
    const lastAvg = mean(lastPowerValues);

    if (firstAvg === 0) {
      return { fired: false, threshold, unit: "%" };
    }

    const fade = ((firstAvg - lastAvg) / firstAvg) * 100;
    const fired = fade > threshold;

    return {
      fired,
      value: fade,
      threshold,
      unit: "%",
      percentageOver: fired ? fade - threshold : undefined,
    };
  }

  if (firstPaceValues.length > 0 && lastPaceValues.length > 0) {
    const firstAvg = mean(firstPaceValues);
    const lastAvg = mean(lastPaceValues);

    if (firstAvg === 0) {
      return { fired: false, threshold, unit: "%" };
    }

    const fade = ((lastAvg - firstAvg) / firstAvg) * 100;
    const fired = fade > threshold;

    return {
      fired,
      value: fade,
      threshold,
      unit: "%",
      percentageOver: fired ? fade - threshold : undefined,
    };
  }

  return { fired: false, threshold, unit: "%" };
}

export function evaluateAllTriggers(laps: Lap[], triggers: TriggerConfig[]): FiredTrigger[] {
  const fired: FiredTrigger[] = [];

  for (const trigger of triggers) {
    if (!trigger.enabled) {
      continue;
    }

    let result: TriggerEvaluationResult;

    switch (trigger.type) {
      case "hr_drift":
        result = evaluateHRDrift(laps, trigger.threshold);
        break;
      case "pace_deviation":
        result = evaluatePaceDeviation(laps, trigger.threshold);
        break;
      case "lap_variability":
        result = evaluateLapVariability(laps, trigger.threshold);
        break;
      case "early_fade":
        result = evaluateEarlyFade(laps, trigger.threshold);
        break;
      default:
        continue;
    }

    if (result.fired && result.value !== undefined) {
      fired.push({
        trigger_type: trigger.type,
        actual_value: result?.value,
        threshold: result?.threshold,
        unit: result?.unit,
        percentage_over: result?.percentageOver ?? 0,
      });
    }
  }

  return fired;
}
