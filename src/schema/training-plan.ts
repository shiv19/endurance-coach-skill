/**
 * Training Plan JSON Schema
 *
 * Designed to be comprehensive enough for export to:
 * - Zwift (.zwo workouts)
 * - Garmin Connect (.fit workouts)
 * - TrainingPeaks
 * - Other training platforms
 */

// ============================================================================
// MARK: Core Types
// ============================================================================

export type Sport = "swim" | "bike" | "run" | "strength" | "brick" | "race" | "rest";

export type WorkoutType =
  | "rest"
  | "recovery"
  | "endurance"
  | "tempo"
  | "threshold"
  | "intervals"
  | "vo2max"
  | "sprint"
  | "race"
  | "brick"
  | "technique"
  | "openwater"
  | "hills"
  | "long";

export type IntensityUnit =
  | "percent_ftp"
  | "percent_lthr"
  | "hr_zone"
  | "pace_zone"
  | "rpe"
  | "css_offset";

export type DurationUnit =
  | "seconds"
  | "minutes"
  | "hours"
  | "meters"
  | "kilometers"
  | "miles"
  | "yards"
  | "laps";

export type StepType = "warmup" | "work" | "recovery" | "rest" | "cooldown" | "interval_set";

// Unit system preferences
export type SwimDistanceUnit = "meters" | "yards";
export type LandDistanceUnit = "kilometers" | "miles";
export type FirstDayOfWeek = "monday" | "sunday";

export interface UnitPreferences {
  swim: SwimDistanceUnit;
  bike: LandDistanceUnit;
  run: LandDistanceUnit;
  firstDayOfWeek: FirstDayOfWeek;
}

// Default preferences (metric)
export const defaultPreferences: UnitPreferences = {
  swim: "meters",
  bike: "kilometers",
  run: "kilometers",
  firstDayOfWeek: "monday",
};

// ============================================================================
// MARK: Workout Structure (for Zwift/Garmin export)
// ============================================================================

export interface IntensityTarget {
  unit: IntensityUnit;
  value: number; // e.g., 75 for 75% FTP, or 3 for Zone 3
  valueLow?: number; // For ranges: 70-75% FTP
  valueHigh?: number;
  description?: string; // "Zone 2", "Threshold", "Easy"
}

export interface DurationTarget {
  unit: DurationUnit;
  value: number;
}

export interface WorkoutStep {
  type: StepType;
  name?: string;
  duration: DurationTarget;
  intensity: IntensityTarget;
  cadence?: { low: number; high: number }; // RPM for bike, SPM for run
  notes?: string;
}

export interface IntervalSet {
  type: "interval_set";
  name?: string;
  repeats: number;
  steps: WorkoutStep[]; // Usually [work, recovery]
}

/**
 * Structured workout with object-based properties for device export.
 * This is the converted form of TemplateStructure where all string-based
 * properties have been parsed into proper objects.
 */
export interface StructuredWorkout {
  warmup?: WorkoutStep[];
  main: (WorkoutStep | IntervalSet)[];
  cooldown?: WorkoutStep[];
  totalDuration?: DurationTarget; // Calculated or specified
  estimatedTSS?: number;
  estimatedIF?: number; // Intensity Factor
}

// ============================================================================
// MARK: Daily Workout
// ============================================================================

export interface Workout {
  id: string;
  sport: Sport;
  type: WorkoutType;
  category?: string; // From template: endurance, speed, technique, etc.
  name: string;
  description: string; // Athlete-provided description
  coachingNotes?: string; // From template: coaching context and focus points

  // Duration
  durationMinutes?: number;
  distanceMeters?: number;

  // Intensity summary
  primaryZone?: string; // "Zone 2", "Threshold", etc.
  targetHR?: { low: number; high: number };
  targetPower?: { low: number; high: number }; // Watts or % FTP
  targetPace?: { low: string; high: string }; // "5:30/km" - "5:45/km"
  rpe?: number; // 1-10

  // Structured workout for device export (object-based properties)
  structure?: StructuredWorkout;

  // Human-readable workout text (for display)
  humanReadable?: string;

  // Tracking
  completed: boolean;
  completedAt?: string; // ISO date
  actualDuration?: number;
  actualDistance?: number;
  notes?: string;
}

// ============================================================================
// MARK: Training Week
// ============================================================================

export interface TrainingDay {
  date: string; // ISO date: "2025-01-06"
  dayOfWeek: string; // "Monday"
  workouts: Workout[]; // Can have multiple (e.g., AM swim + PM run)
}

export interface WeekSummary {
  totalHours: number;
  totalTSS?: number;
  bySport: {
    [key in Sport]?: {
      sessions: number;
      hours: number;
      km?: number;
    };
  };
}

export interface TrainingWeek {
  weekNumber: number;
  startDate: string; // ISO date
  endDate: string;
  phase: string;
  focus: string;
  targetHours: number;
  days: TrainingDay[];
  summary: WeekSummary;
  isRecoveryWeek: boolean;
}

// ============================================================================
// MARK: Training Zones
// ============================================================================

export interface HeartRateZones {
  lthr: number; // Lactate threshold HR
  zones: {
    zone: number;
    name: string;
    percentLow: number;
    percentHigh: number;
    hrLow: number;
    hrHigh: number;
  }[];
}

export interface PowerZones {
  ftp: number; // Functional Threshold Power
  zones: {
    zone: number;
    name: string;
    percentLow: number;
    percentHigh: number;
    wattsLow: number;
    wattsHigh: number;
  }[];
}

export interface SwimZones {
  css: string; // Critical Swim Speed: "1:45/100m"
  cssSeconds: number; // Per 100m
  zones: {
    zone: number;
    name: string;
    paceOffset: number; // Seconds per 100m relative to CSS
    pace: string; // "1:50/100m"
  }[];
}

export interface PaceZones {
  thresholdPace: string; // "4:30/km"
  thresholdPaceSeconds: number; // Per km
  zones: {
    zone: string; // "E", "M", "T", "I", "R"
    name: string;
    pace: string;
    paceSeconds: number;
  }[];
}

export interface AthleteZones {
  run?: {
    hr?: HeartRateZones;
    pace?: PaceZones;
  };
  bike?: {
    hr?: HeartRateZones;
    power?: PowerZones;
  };
  swim?: SwimZones;
  maxHR?: number;
  restingHR?: number;
  weight?: number; // kg
}

// ============================================================================
// MARK: Athlete Assessment
// ============================================================================

export interface AthleteAssessment {
  foundation: {
    raceHistory: string[];
    peakTrainingLoad: number; // hours/week
    foundationLevel: "beginner" | "intermediate" | "advanced" | "elite";
    yearsInSport: number;
  };
  currentForm: {
    weeklyVolume: {
      total: number;
      swim?: number;
      bike?: number;
      run?: number;
    };
    longestSessions: {
      swim?: number; // meters
      bike?: number; // km
      run?: number; // km
    };
    consistency: number; // sessions/week
    timeSincePeakFitness?: string;
    reasonForTimeOff?: string;
  };
  strengths: {
    sport: Sport;
    evidence: string;
  }[];
  limiters: {
    sport: Sport;
    evidence: string;
  }[];
  constraints: string[];
}

// ============================================================================
// MARK: Training Phases
// ============================================================================

export interface TrainingPhase {
  name: string;
  startWeek: number;
  endWeek: number;
  focus: string;
  weeklyHoursRange: { low: number; high: number };
  keyWorkouts: string[];
  physiologicalGoals: string[];
}

// ============================================================================
// MARK: Race Strategy
// ============================================================================

export interface RaceStrategy {
  event: {
    name: string;
    date: string;
    type: string;
    distances?: {
      swim?: number;
      bike?: number;
      run?: number;
    };
  };
  pacing: {
    swim?: { target: string; notes: string };
    bike?: { targetPower: string; targetHR: string; notes: string };
    run?: { targetPace: string; targetHR: string; notes: string };
  };
  nutrition: {
    preRace: string;
    during: {
      carbsPerHour: number;
      fluidPerHour: string;
      products: string[];
    };
    notes: string;
  };
  taper: {
    startDate: string;
    volumeReduction: number; // percent
    notes: string;
  };
  raceDay: {
    wakeUpTime?: string;
    preRaceMeal?: string;
    warmUp?: string;
    mentalCues?: string[];
  };
}

// ============================================================================
// MARK: Complete Training Plan
// ============================================================================

/**
 * Athlete notes from constraints configuration.
 */
export interface AthleteNotes {
  daysPerWeek?: number | string;
  preferredDays?: string[];
  maxLongRunHours?: number;
  maxLongBikeHours?: number;
  notes?: string[];
}

/**
 * Athlete training paces for reference display.
 */
export interface AthletePacesDisplay {
  // Running paces
  easy?: string;
  long?: string;
  tempo?: string;
  threshold?: string;
  marathon?: string;
  halfMarathon?: string;
  interval?: string;
  // Interval-specific
  r200?: string;
  r400?: string;
  r800?: string;
  r1k?: string;
  rMile?: string;
  // Cycling
  bikeFtp?: number;
  bikeEasy?: string;
  bikeTempo?: string;
  bikeThreshold?: string;
  // Swimming
  swimCss?: string;
  swimEasy?: string;
  swimTempo?: string;
}

export interface TrainingPlan {
  version: "1.0";
  meta: {
    id: string;
    athlete: string;
    event: string;
    eventDate: string;
    planStartDate: string;
    planEndDate: string;
    createdAt: string;
    updatedAt: string;
    totalWeeks: number;
    generatedBy: string; // "Endurance Coach"
  };
  preferences: UnitPreferences;
  assessment?: AthleteAssessment;
  zones: AthleteZones;
  phases: TrainingPhase[];
  weeks: TrainingWeek[];
  raceStrategy?: RaceStrategy;
  athleteNotes?: AthleteNotes;
  athletePaces?: AthletePacesDisplay;
}

// ============================================================================
// MARK: Example/Template
// ============================================================================

export const exampleWorkout: Workout = {
  id: "week1-tue-swim",
  sport: "swim",
  type: "technique",
  name: "Technique + Endurance",
  description: "Focus on catch and pull mechanics with aerobic base work",
  durationMinutes: 60,
  distanceMeters: 2500,
  primaryZone: "Zone 2",
  targetHR: { low: 120, high: 135 },
  structure: {
    warmup: [
      {
        type: "warmup",
        name: "Easy swim",
        duration: { unit: "meters", value: 300 },
        intensity: { unit: "css_offset", value: 15, description: "CSS + 15s/100m" },
      },
      {
        type: "warmup",
        name: "Drill set",
        duration: { unit: "meters", value: 200 },
        intensity: { unit: "rpe", value: 3, description: "Easy" },
        notes: "4x50m: catch-up, fingertip drag, fist drill, swim",
      },
    ],
    main: [
      {
        type: "interval_set",
        name: "Threshold set",
        repeats: 5,
        steps: [
          {
            type: "work",
            duration: { unit: "meters", value: 100 },
            intensity: { unit: "css_offset", value: 0, description: "CSS pace" },
          },
          {
            type: "rest",
            duration: { unit: "seconds", value: 15 },
            intensity: { unit: "rpe", value: 1 },
          },
        ],
      },
      {
        type: "work",
        name: "Aerobic pull",
        duration: { unit: "meters", value: 800 },
        intensity: { unit: "css_offset", value: 10, description: "CSS + 10s" },
        notes: "With pull buoy, focus on rotation",
      },
    ],
    cooldown: [
      {
        type: "cooldown",
        name: "Easy swim",
        duration: { unit: "meters", value: 200 },
        intensity: { unit: "rpe", value: 2 },
      },
    ],
    totalDuration: { unit: "minutes", value: 60 },
    estimatedTSS: 45,
  },
  humanReadable: `Warm-up: 300m easy, 4x50m drills
Main: 5x100m @ CSS, 15s rest
      800m pull @ CSS+10
Cool-down: 200m easy`,
  completed: false,
};
