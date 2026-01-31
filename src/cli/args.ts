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

  if (args.length === 0 || args[0] === "sync") {
    // Sync command (default)
    const syncArgs: SyncArgs = { command: "sync" };

    for (const arg of args) {
      if (arg.startsWith("--client-id=")) {
        syncArgs.clientId = arg.split("=")[1];
      } else if (arg.startsWith("--client-secret=")) {
        syncArgs.clientSecret = arg.split("=")[1];
      } else if (arg.startsWith("--access-token=")) {
        syncArgs.accessToken = arg.split("=")[1];
      } else if (arg.startsWith("--refresh-token=")) {
        syncArgs.refreshToken = arg.split("=")[1];
      } else if (arg.startsWith("--days=")) {
        const parsed = parseInt(arg.split("=")[1], 10);
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
        renderArgs.outputFile = args[i].split("=")[1];
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
        statsArgs.weeks = parseInt(args[i].split("=")[1], 10);
      } else if (args[i] === "--longest-weeks") {
        statsArgs.longestWeeks = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i].startsWith("--longest-weeks=")) {
        statsArgs.longestWeeks = parseInt(args[i].split("=")[1], 10);
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
        trainingLoadArgs.weeks = parseInt(args[i].split("=")[1]);
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
        foundationArgs.topWeeks = parseInt(args[i].split("=")[1]);
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
        strengthArgs.months = parseInt(args[i].split("=")[1]);
      } else if (args[i] === "--long-months") {
        strengthArgs.longMonths = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--long-months=")) {
        strengthArgs.longMonths = parseInt(args[i].split("=")[1]);
      } else if (args[i] === "--easy-hr-max") {
        strengthArgs.easyHrMax = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--easy-hr-max=")) {
        strengthArgs.easyHrMax = parseInt(args[i].split("=")[1]);
      } else if (args[i] === "--long-minutes") {
        strengthArgs.longMinutes = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--long-minutes=")) {
        strengthArgs.longMinutes = parseInt(args[i].split("=")[1]);
      } else if (args[i] === "--years") {
        strengthArgs.years = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--years=")) {
        strengthArgs.years = parseInt(args[i].split("=")[1]);
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
        scheduleArgs.rideMinutes = parseInt(args[i].split("=")[1]);
      } else if (args[i] === "--run-minutes") {
        scheduleArgs.runMinutes = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--run-minutes=")) {
        scheduleArgs.runMinutes = parseInt(args[i].split("=")[1]);
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
        hrArgs.weeks = parseInt(args[i].split("=")[1]);
      } else if (args[i] === "--distribution-weeks") {
        hrArgs.distributionWeeks = parseInt(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--distribution-weeks=")) {
        hrArgs.distributionWeeks = parseInt(args[i].split("=")[1]);
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
        expandArgs.outputFile = args[i].split("=")[1];
      } else if (args[i] === "--format") {
        expandArgs.format = args[i + 1] as "json" | "yaml";
        i++;
      } else if (args[i].startsWith("--format=")) {
        expandArgs.format = args[i].split("=")[1] as "json" | "yaml";
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
        templatesArgs.sport = args[i].split("=")[1];
      } else if (args[i].startsWith("--type=")) {
        templatesArgs.type = args[i].split("=")[1];
      } else if (args[i].startsWith("--source=")) {
        const sourceVal = args[i].split("=")[1];
        if (sourceVal === "user" || sourceVal === "builtin" || sourceVal === "all") {
          templatesArgs.source = sourceVal;
        } else {
          log.error(`Invalid source value: ${sourceVal}. Must be 'user', 'builtin', or 'all'`);
          process.exit(1);
        }
      } else if (args[i].startsWith("--category=")) {
        templatesArgs.category = args[i].split("=")[1];
      } else if (args[i].startsWith("--template-file=")) {
        templatesArgs.templateFile = args[i].split("=")[1];
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
        modifyArgs.backup = args[i].split("=")[1];
      } else if (args[i] === "--plan" || args[i] === "-p") {
        modifyArgs.plan = args[i + 1];
        i++;
      } else if (args[i].startsWith("--plan=")) {
        modifyArgs.plan = args[i].split("=")[1];
      } else if (args[i] === "--output" || args[i] === "-o") {
        modifyArgs.output = args[i + 1];
        i++;
      } else if (args[i].startsWith("--output=")) {
        modifyArgs.output = args[i].split("=")[1];
      }
    }

    if (!modifyArgs.backup || !modifyArgs.plan) {
      log.error("Both --backup and --plan are required");
      process.exit(1);
    }

    return modifyArgs;
  }

  if (args[0] === "interview") {
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
        days = parseInt(args[i].split("=")[1], 10);
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
    const interviewSaveArgs: InterviewSaveArgs = {
      command: "interview-save",
      workoutId: 0,
      reflection: "",
      notes: "",
      confidence: "Medium",
    };

    for (const arg of args) {
      if (arg.startsWith("--reflection=")) {
        interviewSaveArgs.reflection = arg.split("=")[1];
      } else if (arg.startsWith("--notes=")) {
        interviewSaveArgs.notes = arg.split("=")[1];
      } else if (arg.startsWith("--confidence=")) {
        const confidence = arg.split("=")[1];
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
    const preliminaryNoteSaveArgs: PreliminaryNoteSaveArgs = {
      command: "preliminary-note-save",
      workoutId: 0,
      note: "",
    };

    for (const arg of args) {
      if (arg.startsWith("--note=")) {
        preliminaryNoteSaveArgs.note = arg.split("=")[1];
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
        activityRecordArgs.type = args[i].split("=")[1];
      } else if (args[i] === "--duration") {
        activityRecordArgs.duration = parseInt(args[i + 1], 10);
        i++;
      } else if (args[i].startsWith("--duration=")) {
        activityRecordArgs.duration = parseInt(args[i].split("=")[1], 10);
      } else if (args[i] === "--distance") {
        activityRecordArgs.distance = parseFloat(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--distance=")) {
        activityRecordArgs.distance = parseFloat(args[i].split("=")[1]);
      } else if (args[i] === "--structure") {
        activityRecordArgs.structure = args[i + 1];
        i++;
      } else if (args[i].startsWith("--structure=")) {
        activityRecordArgs.structure = args[i].split("=")[1];
      } else if (args[i] === "--notes") {
        activityRecordArgs.notes = args[i + 1];
        i++;
      } else if (args[i].startsWith("--notes=")) {
        activityRecordArgs.notes = args[i].split("=")[1];
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
        triggersArgs.type = args[i].split("=")[1];
      } else if (args[i] === "--threshold") {
        triggersArgs.threshold = parseFloat(args[i + 1]);
        i++;
      } else if (args[i].startsWith("--threshold=")) {
        triggersArgs.threshold = parseFloat(args[i].split("=")[1]);
      } else if (args[i] === "--unit") {
        triggersArgs.unit = args[i + 1];
        i++;
      } else if (args[i].startsWith("--unit=")) {
        triggersArgs.unit = args[i].split("=")[1];
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
          interviewsListArgs.workout = parseInt(args[i].split("=")[1], 10);
        } else if (args[i] === "--limit") {
          interviewsListArgs.limit = parseInt(args[i + 1], 10);
          i++;
        } else if (args[i].startsWith("--limit=")) {
          interviewsListArgs.limit = parseInt(args[i].split("=")[1], 10);
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
