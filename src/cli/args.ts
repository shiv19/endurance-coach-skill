import { log } from "../lib/logging.js";
import type {
  CliArgs,
  SyncArgs,
  RenderArgs,
  StatsArgs,
  TrainingLoadArgs,
  FoundationArgs,
  StrengthArgs,
  SchedulePreferencesArgs,
  HrZonesArgs,
  QueryArgs,
  AuthArgs,
  ActivityLapsArgs,
  HelpArgs,
  ValidateArgs,
  ExpandArgs,
  TemplatesArgs,
  ModifyArgs,
  InterviewArgs,
  InterviewSaveArgs,
  PreliminaryNoteSaveArgs,
  ActivityRecordArgs,
  TriggersArgs,
  InterviewsListArgs,
  InterviewsGetArgs,
} from "./args.types.js";

export type {
  CliArgs,
  SyncArgs,
  RenderArgs,
  StatsArgs,
  TrainingLoadArgs,
  FoundationArgs,
  StrengthArgs,
  SchedulePreferencesArgs,
  HrZonesArgs,
  QueryArgs,
  AuthArgs,
  ActivityLapsArgs,
  HelpArgs,
  ValidateArgs,
  ExpandArgs,
  TemplatesArgs,
  ModifyArgs,
  InterviewArgs,
  InterviewSaveArgs,
  PreliminaryNoteSaveArgs,
  ActivityRecordArgs,
  TriggersArgs,
  InterviewsListArgs,
  InterviewsGetArgs,
} from "./args.types.js";

// ============================================================================
// MARK: Argument Parsing
// ============================================================================
/**
 * Parse command-line arguments from process.argv and produce the corresponding CLI command object.
 *
 * The returned object identifies the selected command and any parsed options or flags.
 *
 * Note: for missing required inputs or invalid option values this function logs an error and exits the process with status 1.
 *
 * @returns A `CliArgs` object describing the requested command and its parsed options
 */

export function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const readEqualsValue = (value: string): string => value.slice(value.indexOf("=") + 1);

  if (args.length === 0 || args[0] === "sync") {
    // Sync command (default)
    const syncArgs: SyncArgs = { command: "sync" };

    for (const arg of args) {
      if (arg.startsWith("--client-id=")) {
        syncArgs.clientId = readEqualsValue(arg);
      } else if (arg.startsWith("--client-secret=")) {
        syncArgs.clientSecret = readEqualsValue(arg);
      } else if (arg.startsWith("--access-token=")) {
        syncArgs.accessToken = readEqualsValue(arg);
      } else if (arg.startsWith("--refresh-token=")) {
        syncArgs.refreshToken = readEqualsValue(arg);
      } else if (arg.startsWith("--days=")) {
        const parsed = parseInt(readEqualsValue(arg), 10);
        if (Number.isNaN(parsed)) {
          log.error("Invalid --days value: must be a number");
          process.exit(1);
        }
        syncArgs.days = parsed;
      }
    }

    return syncArgs;
  }

  if (args[0] === "render") {
    if (!args[1]) {
      log.error("render command requires an input file");
      process.exit(1);
    }

    const renderArgs: RenderArgs = {
      command: "render",
      inputFile: args[1],
    };

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--output" || args[i] === "-o") {
        renderArgs.outputFile = args[i + 1];
        i++;
      } else if (args[i].startsWith("--output=")) {
        renderArgs.outputFile = readEqualsValue(args[i]);
      } else if (!args[i].startsWith("-") && !renderArgs.outputFile) {
        // Accept positional output argument (helps when npm consumes -o)
        renderArgs.outputFile = args[i];
      }
    }

    return renderArgs;
  }

  if (args[0] === "stats") {
    const statsArgs: StatsArgs = {
      command: "stats",
      json: args.includes("--json"),
      verbose: args.includes("--verbose") || args.includes("-v"),
      noSync: args.includes("--no-sync"),
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--weeks") {
        statsArgs.weeks = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i].startsWith("--weeks=")) {
        statsArgs.weeks = parseInt(readEqualsValue(args[i]), 10);
      } else if (args[i] === "--longest-weeks") {
        statsArgs.longestWeeks = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i].startsWith("--longest-weeks=")) {
        statsArgs.longestWeeks = parseInt(readEqualsValue(args[i]), 10);
      }
    }

    return statsArgs;
  }

  if (args[0] === "training-load") {
    const trainingLoadArgs: TrainingLoadArgs = {
      command: "training-load",
      json: args.includes("--json"),
      verbose: args.includes("--verbose") || args.includes("-v"),
      noSync: args.includes("--no-sync"),
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--weeks") {
        trainingLoadArgs.weeks = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--weeks=")) {
        trainingLoadArgs.weeks = parseInt(readEqualsValue(args[i]));
      }
    }

    return trainingLoadArgs;
  }

  if (args[0] === "foundation") {
    const foundationArgs: FoundationArgs = {
      command: "foundation",
      json: args.includes("--json"),
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--top-weeks") {
        foundationArgs.topWeeks = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--top-weeks=")) {
        foundationArgs.topWeeks = parseInt(readEqualsValue(args[i]));
      }
    }

    return foundationArgs;
  }

  if (args[0] === "strength") {
    const strengthArgs: StrengthArgs = {
      command: "strength",
      json: args.includes("--json"),
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--months") {
        strengthArgs.months = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--months=")) {
        strengthArgs.months = parseInt(readEqualsValue(args[i]));
      } else if (args[i] === "--long-months") {
        strengthArgs.longMonths = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--long-months=")) {
        strengthArgs.longMonths = parseInt(readEqualsValue(args[i]));
      } else if (args[i] === "--easy-hr-max") {
        strengthArgs.easyHrMax = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--easy-hr-max=")) {
        strengthArgs.easyHrMax = parseInt(readEqualsValue(args[i]));
      } else if (args[i] === "--long-minutes") {
        strengthArgs.longMinutes = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--long-minutes=")) {
        strengthArgs.longMinutes = parseInt(readEqualsValue(args[i]));
      } else if (args[i] === "--years") {
        strengthArgs.years = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--years=")) {
        strengthArgs.years = parseInt(readEqualsValue(args[i]));
      }
    }

    return strengthArgs;
  }

  if (args[0] === "schedule-preferences") {
    const scheduleArgs: SchedulePreferencesArgs = {
      command: "schedule-preferences",
      json: args.includes("--json"),
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--ride-minutes") {
        scheduleArgs.rideMinutes = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--ride-minutes=")) {
        scheduleArgs.rideMinutes = parseInt(readEqualsValue(args[i]));
      } else if (args[i] === "--run-minutes") {
        scheduleArgs.runMinutes = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--run-minutes=")) {
        scheduleArgs.runMinutes = parseInt(readEqualsValue(args[i]));
      }
    }

    return scheduleArgs;
  }

  if (args[0] === "hr-zones") {
    const hrArgs: HrZonesArgs = {
      command: "hr-zones",
      json: args.includes("--json"),
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--weeks") {
        hrArgs.weeks = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--weeks=")) {
        hrArgs.weeks = parseInt(readEqualsValue(args[i]));
      } else if (args[i] === "--distribution-weeks") {
        hrArgs.distributionWeeks = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--distribution-weeks=")) {
        hrArgs.distributionWeeks = parseInt(readEqualsValue(args[i]));
      }
    }

    return hrArgs;
  }

  if (args[0] === "query") {
    if (!args[1]) {
      log.error("query command requires a SQL statement");
      process.exit(1);
    }

    const queryArgs: QueryArgs = {
      command: "query",
      sql: args[1],
      json: args.includes("--json"),
    };

    return queryArgs;
  }

  if (args[0] === "auth") {
    const authArgs: AuthArgs = { command: "auth" };

    for (const arg of args) {
      if (arg.startsWith("--client-id=")) {
        authArgs.clientId = arg.slice("--client-id=".length);
      } else if (arg.startsWith("--client-secret=")) {
        authArgs.clientSecret = arg.slice("--client-secret=".length);
      } else if (arg.startsWith("--code=")) {
        authArgs.code = arg.slice("--code=".length);
      }
    }

    return authArgs;
  }

  if (args[0] === "activity") {
    if (!args[1]) {
      log.error("activity command requires an activity ID");
      process.exit(1);
    }

    const id = parseInt(args[1], 10);
    if (Number.isNaN(id)) {
      log.error(`Invalid activity ID: ${args[1]}`);
      process.exit(1);
    }

    let laps = false;
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--laps") {
        laps = true;
      }
    }

    if (!laps) {
      log.error("activity command requires a subcommand flag like --laps");
      process.exit(1);
    }

    const activityArgs: ActivityLapsArgs = {
      command: "activity",
      id,
      laps: true,
    };
    return activityArgs;
  }

  if (args[0] === "validate") {
    if (!args[1]) {
      log.error("validate command requires an input file");
      process.exit(1);
    }

    const validateArgs: ValidateArgs = {
      command: "validate",
      inputFile: args[1],
      compact: args.includes("--compact") || args[1].endsWith(".yaml") || args[1].endsWith(".yml"),
    };

    return validateArgs;
  }

  if (args[0] === "expand") {
    if (!args[1]) {
      log.error("expand command requires an input file");
      process.exit(1);
    }

    const expandArgs: ExpandArgs = {
      command: "expand",
      inputFile: args[1],
    };

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--output" || args[i] === "-o") {
        expandArgs.outputFile = args[i + 1];
        i++;
      } else if (args[i].startsWith("--output=")) {
        expandArgs.outputFile = readEqualsValue(args[i]);
      } else if (args[i] === "--format") {
        expandArgs.format = args[i + 1] as "json" | "yaml";
        i++;
      } else if (args[i].startsWith("--format=")) {
        expandArgs.format = readEqualsValue(args[i]) as "json" | "yaml";
      } else if (args[i] === "--verbose" || args[i] === "-v") {
        expandArgs.verbose = true;
      }
    }

    return expandArgs;
  }

  if (args[0] === "templates") {
    const templatesArgs: TemplatesArgs = {
      command: "templates",
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "list") {
        // Default subcommand, no action needed
      } else if (args[i] === "show") {
        if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          templatesArgs.show = args[i + 1];
          i++;
        }
      } else if (args[i] === "create") {
        if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          templatesArgs.create = args[i + 1];
          i++;
        }
      } else if (args[i] === "validate") {
        if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
          templatesArgs.validate = args[i + 1];
          i++;
        }
      } else if (args[i] === "--sport") {
        templatesArgs.sport = args[i + 1];
        i++;
      } else if (args[i] === "--type") {
        templatesArgs.type = args[i + 1];
        i++;
      } else if (args[i] === "--source") {
        const sourceVal = args[i + 1];
        if (sourceVal === "user" || sourceVal === "builtin" || sourceVal === "all") {
          templatesArgs.source = sourceVal;
        } else {
          log.error(`Invalid source value: ${sourceVal}. Must be 'user', 'builtin', or 'all'`);
          process.exit(1);
        }
        i++;
      } else if (args[i] === "--verbose" || args[i] === "-v") {
        templatesArgs.verbose = true;
      } else if (args[i] === "--category") {
        templatesArgs.category = args[i + 1];
        i++;
      } else if (args[i] === "--template-file") {
        templatesArgs.templateFile = args[i + 1];
        i++;
      } else if (args[i] === "--overwrite") {
        templatesArgs.overwrite = true;
      } else if (args[i] === "--dry-run") {
        templatesArgs.dryRun = true;
      } else if (args[i] === "--example") {
        templatesArgs.example = true;
      } else if (args[i].startsWith("--sport=")) {
        templatesArgs.sport = readEqualsValue(args[i]);
      } else if (args[i].startsWith("--type=")) {
        templatesArgs.type = readEqualsValue(args[i]);
      } else if (args[i].startsWith("--source=")) {
        const sourceVal = readEqualsValue(args[i]);
        if (sourceVal === "user" || sourceVal === "builtin" || sourceVal === "all") {
          templatesArgs.source = sourceVal;
        } else {
          log.error(`Invalid source value: ${sourceVal}. Must be 'user', 'builtin', or 'all'`);
          process.exit(1);
        }
      } else if (args[i].startsWith("--category=")) {
        templatesArgs.category = readEqualsValue(args[i]);
      } else if (args[i].startsWith("--template-file=")) {
        templatesArgs.templateFile = readEqualsValue(args[i]);
      } else if (
        !args[i].startsWith("-") &&
        !templatesArgs.show &&
        !templatesArgs.create &&
        !templatesArgs.validate
      ) {
        // Treat as template ID for 'show' subcommand
        templatesArgs.show = args[i];
      }
    }

    return templatesArgs;
  }

  if (args[0] === "schema") {
    return { command: "schema" };
  }

  if (args[0] === "modify") {
    if (!args[1] || !args[2]) {
      log.error("modify command requires --backup and --plan arguments");
      process.exit(1);
    }

    const modifyArgs: ModifyArgs = {
      command: "modify",
      backup: "",
      plan: "",
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--backup" || args[i] === "-b") {
        modifyArgs.backup = args[i + 1];
        i++;
      } else if (args[i].startsWith("--backup=")) {
        modifyArgs.backup = readEqualsValue(args[i]);
      } else if (args[i] === "--plan" || args[i] === "-p") {
        modifyArgs.plan = args[i + 1];
        i++;
      } else if (args[i].startsWith("--plan=")) {
        modifyArgs.plan = readEqualsValue(args[i]);
      } else if (args[i] === "--output" || args[i] === "-o") {
        modifyArgs.output = args[i + 1];
        i++;
      } else if (args[i].startsWith("--output=")) {
        modifyArgs.output = readEqualsValue(args[i]);
      }
    }

    if (!modifyArgs.backup || !modifyArgs.plan) {
      log.error("Both --backup and --plan are required");
      process.exit(1);
    }

    return modifyArgs;
  }

  if (args[0] === "interview") {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
interview - Interactive athlete interview system

Usage: npx endurance-coach interview [mode|id] [options]

Modes:
  [none]                    Manual interview mode (default)
  --latest                  Interview for most recent activity
  --list                    List recent activities for interview selection
  <id>                      Specific workout ID to interview

Options:
  --laps                    Include lap-by-lap data in specific/latest modes
  --days=N                  Days to show in list mode (default: 7)
  --json                    Output as JSON instead of formatted text

Examples:
  # Manual interview mode
  npx endurance-coach interview

  # Interview most recent activity with lap data
  npx endurance-coach interview --latest --laps

  # List activities from last 7 days
  npx endurance-coach interview --list --days=14

  # Interview specific activity with lap data
  npx endurance-coach interview 17213185177 --laps --json
`);
      process.exit(0);
    }

    let mode: "latest" | "list" | "manual" | "specific" = "manual";
    let workoutId: number | undefined;
    let laps = false;
    let days: number | undefined;
    let json = false;

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--latest") {
        mode = "latest";
      } else if (args[i] === "--list") {
        mode = "list";
      } else if (args[i] === "--manual") {
        mode = "manual";
      } else if (args[i] === "--laps") {
        laps = true;
      } else if (args[i].startsWith("--days=")) {
        days = parseInt(readEqualsValue(args[i]), 10);
      } else if (args[i] === "--days") {
        days = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i] === "--json") {
        json = true;
      } else if (!args[i].startsWith("-") && !isNaN(parseInt(args[i], 10))) {
        mode = "specific";
        workoutId = parseInt(args[i], 10);
      }
    }

    const interviewArgs: InterviewArgs = {
      command: "interview",
      mode,
      laps,
      json,
    };

    if (workoutId !== undefined) {
      interviewArgs.workoutId = workoutId;
    }
    if (days !== undefined) {
      interviewArgs.days = days;
    }

    return interviewArgs;
  }

  if (args[0] === "interview-save") {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
interview-save - Save post-workout interview results

Usage: npx endurance-coach interview-save <workout-id> [options]

Required:
  <workout-id>              Strava activity ID
  --reflection="TEXT"       Athlete reflection summary (what athlete reported)
  --notes="TEXT"            Coach notes (coach's interpretation)

Optional:
  --confidence=LEVEL        Coach confidence: Low, Medium, or High (default: Medium)

Example:
  npx endurance-coach interview-save 17213185177 \\
    --reflection="Felt good overall, tempo portion was comfortably hard" \\
    --notes="Solid execution, good terrain adaptation" \\
    --confidence=High
`);
      process.exit(0);
    }

    const interviewSaveArgs: InterviewSaveArgs = {
      command: "interview-save",
      workoutId: 0,
      reflection: "",
      notes: "",
      confidence: "Medium",
    };

    for (const arg of args) {
      if (arg.startsWith("--reflection=")) {
        interviewSaveArgs.reflection = arg.slice(arg.indexOf("=") + 1);
      } else if (arg.startsWith("--notes=")) {
        interviewSaveArgs.notes = arg.slice(arg.indexOf("=") + 1);
      } else if (arg.startsWith("--confidence=")) {
        const confidence = readEqualsValue(arg);
        if (confidence === "Low" || confidence === "Medium" || confidence === "High") {
          interviewSaveArgs.confidence = confidence;
        } else {
          log.error(`Invalid confidence level: ${confidence}. Must be Low, Medium, or High`);
          process.exit(1);
        }
      }
    }

    if (!args[1] || isNaN(parseInt(args[1], 10))) {
      log.error("interview-save command requires a workout ID");
      process.exit(1);
    }
    interviewSaveArgs.workoutId = parseInt(args[1], 10);

    if (!interviewSaveArgs.reflection) {
      log.error("interview-save command requires --reflection");
      process.exit(1);
    }

    if (!interviewSaveArgs.notes) {
      log.error("interview-save command requires --notes");
      process.exit(1);
    }

    return interviewSaveArgs;
  }

  if (args[0] === "preliminary-note-save") {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
preliminary-note-save - Save preliminary coach note (internal use)

Usage: npx endurance-coach preliminary-note-save <workout-id> [options]

Required:
  <workout-id>              Strava activity ID
  --note="TEXT"             Preliminary coach note (shapes future interview questions)

Notes:
  Preliminary notes are generated after 5+ interviews to help frame future
  interview questions. They are internal and not shown to the athlete.

Example:
  npx endurance-coach preliminary-note-save 17213185177 \\
    --note="Athlete tends to underreport effort on easy runs when HR drift is elevated"
`);
      process.exit(0);
    }

    const preliminaryNoteSaveArgs: PreliminaryNoteSaveArgs = {
      command: "preliminary-note-save",
      workoutId: 0,
      note: "",
    };

    for (const arg of args) {
      if (arg.startsWith("--note=")) {
        preliminaryNoteSaveArgs.note = arg.slice(arg.indexOf("=") + 1);
      }
    }

    if (!args[1] || isNaN(parseInt(args[1], 10))) {
      log.error("preliminary-note-save command requires a workout ID");
      process.exit(1);
    }
    preliminaryNoteSaveArgs.workoutId = parseInt(args[1], 10);

    if (!preliminaryNoteSaveArgs.note) {
      log.error("preliminary-note-save command requires --note");
      process.exit(1);
    }

    return preliminaryNoteSaveArgs;
  }

  if (args[0] === "activity-record") {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
activity-record - Manually record an activity (bypassing Strava)

Usage: npx endurance-coach activity-record [options]

Required:
  --type=TYPE               Sport type: Run, Bike, Swim, Strength, or Brick
  --duration=MINUTES        Duration in minutes

Optional:
  --distance=KM             Distance in kilometers (for activities with distance)
  --structure="TEXT"        Workout structure description (e.g., "3x8min tempo")
  --notes="TEXT"            Free-form notes about the activity

Example:
  npx endurance-coach activity-record \\
    --type=Run \\
    --duration=45 \\
    --distance=8.5 \\
    --structure="4x10min tempo w/2min easy" \\
    --notes="Felt strong, maintained good form"
`);
      process.exit(0);
    }

    const activityRecordArgs: ActivityRecordArgs = {
      command: "activity-record",
      type: "",
      duration: 0,
    };

    for (let i = 1; i < args.length; i++) {
      if (args[i] === "--type") {
        activityRecordArgs.type = args[i + 1];
        i++;
      } else if (args[i].startsWith("--type=")) {
        activityRecordArgs.type = readEqualsValue(args[i]);
      } else if (args[i] === "--duration") {
        activityRecordArgs.duration = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i].startsWith("--duration=")) {
        activityRecordArgs.duration = parseInt(readEqualsValue(args[i]), 10);
      } else if (args[i] === "--distance") {
        activityRecordArgs.distance = parseFloat(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--distance=")) {
        activityRecordArgs.distance = parseFloat(readEqualsValue(args[i]));
      } else if (args[i] === "--structure") {
        activityRecordArgs.structure = args[i + 1];
        i++;
      } else if (args[i].startsWith("--structure=")) {
        activityRecordArgs.structure = readEqualsValue(args[i]);
      } else if (args[i] === "--notes") {
        activityRecordArgs.notes = args[i + 1];
        i++;
      } else if (args[i].startsWith("--notes=")) {
        activityRecordArgs.notes = readEqualsValue(args[i]);
      }
    }

    if (!activityRecordArgs.type) {
      log.error("activity-record command requires --type");
      process.exit(1);
    }

    if (!activityRecordArgs.duration || activityRecordArgs.duration <= 0) {
      log.error("activity-record command requires --duration (positive number)");
      process.exit(1);
    }

    return activityRecordArgs;
  }

  if (args[0] === "triggers") {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
triggers - Manage interview trigger thresholds

Triggers automatically flag workouts that may need coaching attention based on
performance patterns. They are evaluated during interview sessions when lap data
is fetched.

Usage: npx endurance-coach triggers <subcommand> [options]

Subcommands:
  list                      List all configured triggers
  set                       Configure or update a trigger threshold
  disable                   Disable a specific trigger

Trigger Types:
  hr_drift                  Heart rate drift across the workout
  pace_deviation            Pace variability between segments
  lap_variability           Inconsistency in lap performance
  early_fade                Performance drop-off early in workout

Set Options:
  --type=TYPE               Trigger type (see above)
  --threshold=NUM           Threshold value (positive number)
  --unit=UNIT               Unit: percent, bpm, or seconds
  --enabled                 Enable the trigger (default: enabled)

Disable Options:
  --type=TYPE               Trigger type to disable

Examples:
  # List all triggers
  npx endurance-coach triggers list

  # Set HR drift threshold to 10%
  npx endurance-coach triggers set --type=hr_drift --threshold=10 --unit=percent

  # Set pace deviation to 15 bpm
  npx endurance-coach triggers set --type=pace_deviation --threshold=15 --unit=bpm

  # Disable lap variability trigger
  npx endurance-coach triggers disable --type=lap_variability
`);
      process.exit(0);
    }

    if (!args[1] || (args[1] !== "list" && args[1] !== "set" && args[1] !== "disable")) {
      log.error("triggers command requires a subcommand: list, set, or disable");
      process.exit(1);
    }

    const subcommand = args[1] as "list" | "set" | "disable";
    const triggersArgs: TriggersArgs = {
      command: "triggers",
      subcommand,
    };

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--type") {
        triggersArgs.type = args[i + 1];
        i++;
      } else if (args[i].startsWith("--type=")) {
        triggersArgs.type = readEqualsValue(args[i]);
      } else if (args[i] === "--threshold") {
        triggersArgs.threshold = parseFloat(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--threshold=")) {
        triggersArgs.threshold = parseFloat(readEqualsValue(args[i]));
      } else if (args[i] === "--unit") {
        triggersArgs.unit = args[i + 1];
        i++;
      } else if (args[i].startsWith("--unit=")) {
        triggersArgs.unit = readEqualsValue(args[i]);
      } else if (args[i] === "--enabled") {
        triggersArgs.enabled = true;
      }
    }

    if (subcommand === "set" || subcommand === "disable") {
      if (!triggersArgs.type) {
        log.error(`${subcommand} subcommand requires --type`);
        process.exit(1);
      }
    }

    if (subcommand === "set") {
      if (triggersArgs.threshold === undefined) {
        log.error("set subcommand requires --threshold");
        process.exit(1);
      }
      if (!triggersArgs.unit) {
        log.error("set subcommand requires --unit");
        process.exit(1);
      }
    }

    return triggersArgs;
  }

  if (args[0] === "interviews") {
    if (args.includes("--help") || args.includes("-h")) {
      console.log(`
interviews - Query saved workout interviews

Usage: npx endurance-coach interviews <subcommand> [options]

Subcommands:
  list                      List saved interviews
  get <id>                  Get full details of a specific interview

List Options:
  --workout=ID              Filter by workout ID
  --limit=N                 Maximum number of interviews to show (default: 10)

Get Arguments:
  <id>                      Interview ID to retrieve

Examples:
  # List all interviews
  npx endurance-coach interviews list

  # List interviews for specific workout
  npx endurance-coach interviews list --workout=17213185177

  # List last 5 interviews
  npx endurance-coach interviews list --limit=5

  # Get full interview details
  npx endurance-coach interviews get 42
`);
      process.exit(0);
    }

    if (!args[1] || (args[1] !== "list" && args[1] !== "get")) {
      log.error("interviews command requires a subcommand: list or get");
      process.exit(1);
    }

    const subcommand = args[1] as "list" | "get";

    if (subcommand === "list") {
      const interviewsListArgs: InterviewsListArgs = {
        command: "interviews",
        subcommand: "list",
      };

      for (let i = 2; i < args.length; i++) {
        if (args[i] === "--workout") {
          interviewsListArgs.workout = parseInt(args[i + 1], 10);
          i++;
        } else if (args[i].startsWith("--workout=")) {
          interviewsListArgs.workout = parseInt(readEqualsValue(args[i]), 10);
        } else if (args[i] === "--limit") {
          interviewsListArgs.limit = parseInt(args[i + 1], 10);
          i++;
        } else if (args[i].startsWith("--limit=")) {
          interviewsListArgs.limit = parseInt(readEqualsValue(args[i]), 10);
        }
      }

      return interviewsListArgs;
    } else {
      if (!args[2] || isNaN(parseInt(args[2], 10))) {
        log.error("interviews get subcommand requires an interview ID");
        process.exit(1);
      }

      const interviewsGetArgs: InterviewsGetArgs = {
        command: "interviews",
        subcommand: "get",
        interviewId: parseInt(args[2], 10),
      };

      return interviewsGetArgs;
    }
  }

  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { command: "help" };
  }

  log.error(`Unknown command: ${args[0]}`);
  process.exit(1);
}
