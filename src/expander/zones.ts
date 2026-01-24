/**
 * Zone Calculator
 *
 * Calculates training zone ranges from threshold values.
 * Uses standard physiological percentages for zone calculations.
 */

import type { HRZoneConfig, AthletePaces } from "../schema/compact-plan.js";
import type {
  ExpandedHRZones,
  ExpandedHRZone,
  ExpandedPaceZones,
  ExpandedPaceZone,
  ExpandedAthleteZones,
} from "./types.js";

// ============================================================================
// Heart Rate Zone Calculation
// ============================================================================

/**
 * Standard 5-zone heart rate model based on LTHR percentages.
 */
const HR_ZONE_DEFINITIONS = [
  { zone: 1, name: "Recovery", percentLow: 0, percentHigh: 81 },
  { zone: 2, name: "Aerobic", percentLow: 81, percentHigh: 89 },
  { zone: 3, name: "Tempo", percentLow: 89, percentHigh: 94 },
  { zone: 4, name: "Threshold", percentLow: 94, percentHigh: 100 },
  { zone: 5, name: "VO2max", percentLow: 100, percentHigh: 106 },
];

/**
 * Calculate heart rate zones from LTHR.
 *
 * Uses the standard 5-zone model with percentages of LTHR.
 */
export function calculateHRZones(config: HRZoneConfig): ExpandedHRZones {
  const { lthr, maxHR, restingHR } = config;

  const zones: ExpandedHRZone[] = HR_ZONE_DEFINITIONS.map((def) => ({
    zone: def.zone,
    name: def.name,
    percentLow: def.percentLow,
    percentHigh: def.percentHigh,
    hrLow: Math.round(lthr * (def.percentLow / 100)),
    hrHigh: Math.round(lthr * (def.percentHigh / 100)),
  }));

  return {
    lthr,
    maxHR,
    restingHR,
    zones,
  };
}

// ============================================================================
// Pace Zone Calculation
// ============================================================================

/**
 * Parse a pace string into seconds per unit.
 *
 * @example
 * parsePace("5:30/km") // { seconds: 330, unit: "km" }
 * parsePace("8:00/mi") // { seconds: 480, unit: "mi" }
 * parsePace("5:30") // { seconds: 330, unit: undefined }
 */
export function parsePace(pace: string): { seconds: number; unit?: string } {
  const match = pace.match(/^(\d+):(\d{2})(?:\/(\w+))?$/);
  if (!match) {
    throw new Error(`Invalid pace format: ${pace}`);
  }

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  const unit = match[3];

  return {
    seconds: minutes * 60 + seconds,
    unit,
  };
}

/**
 * Format seconds back to a pace string.
 *
 * @example
 * formatPace(330, "km") // "5:30/km"
 * formatPace(480) // "8:00"
 */
export function formatPace(seconds: number, unit?: string): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  const base = `${mins}:${secs.toString().padStart(2, "0")}`;
  return unit ? `${base}/${unit}` : base;
}

/**
 * Standard pace zone definitions based on Jack Daniels' VDOT system.
 * Offsets are in seconds per km from threshold pace.
 */
const PACE_ZONE_DEFINITIONS = [
  { zone: "E", name: "Easy", offsetSeconds: 60 }, // +60s from threshold
  { zone: "M", name: "Marathon", offsetSeconds: 30 }, // +30s from threshold
  { zone: "T", name: "Threshold", offsetSeconds: 0 }, // At threshold
  { zone: "I", name: "Interval", offsetSeconds: -15 }, // -15s from threshold
  { zone: "R", name: "Repetition", offsetSeconds: -30 }, // -30s from threshold
];

/**
 * Calculate pace zones from threshold pace.
 */
export function calculatePaceZones(thresholdPace: string): ExpandedPaceZones {
  const { seconds: thresholdSeconds, unit } = parsePace(thresholdPace);

  const zones: ExpandedPaceZone[] = PACE_ZONE_DEFINITIONS.map((def) => {
    const paceSeconds = thresholdSeconds + def.offsetSeconds;
    return {
      zone: def.zone,
      name: def.name,
      pace: formatPace(paceSeconds, unit),
      paceSeconds,
    };
  });

  return {
    thresholdPace,
    thresholdPaceSeconds: thresholdSeconds,
    zones,
  };
}

// ============================================================================
// Combined Zone Calculation
// ============================================================================

/**
 * Calculate all athlete zones from compact plan inputs.
 */
export function calculateAthleteZones(
  hrConfig?: HRZoneConfig,
  paces?: AthletePaces
): ExpandedAthleteZones {
  const zones: ExpandedAthleteZones = {};

  // Calculate HR zones if LTHR provided
  if (hrConfig) {
    zones.run = zones.run || {};
    zones.run.hr = calculateHRZones(hrConfig);

    // Also apply to bike if no separate bike HR zones
    zones.bike = zones.bike || {};
    zones.bike.hr = calculateHRZones(hrConfig);

    zones.maxHR = hrConfig.maxHR;
    zones.restingHR = hrConfig.restingHR;
  }

  // Calculate pace zones if threshold pace provided
  if (paces?.threshold) {
    zones.run = zones.run || {};
    zones.run.pace = calculatePaceZones(paces.threshold);
  }

  return zones;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the HR zone for a given heart rate.
 */
export function getHRZoneForValue(hr: number, zones: ExpandedHRZones): ExpandedHRZone | undefined {
  return zones.zones.find((z) => hr >= z.hrLow && hr <= z.hrHigh);
}

/**
 * Get the pace zone for a given pace.
 */
export function getPaceZoneForValue(
  paceSeconds: number,
  zones: ExpandedPaceZones
): ExpandedPaceZone | undefined {
  // Find the closest zone
  let closest: ExpandedPaceZone | undefined;
  let minDiff = Infinity;

  for (const zone of zones.zones) {
    const diff = Math.abs(paceSeconds - zone.paceSeconds);
    if (diff < minDiff) {
      minDiff = diff;
      closest = zone;
    }
  }

  return closest;
}
