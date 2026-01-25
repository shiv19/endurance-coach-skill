import { log } from "../lib/logging.js";

// ============================================================================
// Argument Type Interfaces
// ============================================================================

export interface SyncArgs {
  command: "sync";
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  days?: number;
}

export interface RenderArgs {
  command: "render";
  inputFile: string;
  outputFile?: string;
}

export interface QueryArgs {
  command: "query";
  sql: string;
  json: boolean;
}

export interface AuthArgs {
  command: "auth";
  clientId?: string;
  clientSecret?: string;
  code?: string;
}

export interface HelpArgs {
  command: "help";
}

export interface ValidateArgs {
  command: "validate";
  inputFile: string;
  compact?: boolean;
}

export interface ExpandArgs {
  command: "expand";
  inputFile: string;
  outputFile?: string;
  format?: "json" | "yaml";
  verbose?: boolean;
}

export interface TemplatesArgs {
  command: "templates";
  sport?: string;
  show?: string;
  type?: string;
  source?: "user" | "builtin" | "all";
  verbose?: boolean;
}

export interface SchemaArgs {
  command: "schema";
}

export interface ModifyArgs {
  command: "modify";
  backup: string;
  plan: string;
  output?: string;
}

export type CliArgs =
  | SyncArgs
  | RenderArgs
  | QueryArgs
  | AuthArgs
  | HelpArgs
  | ModifyArgs
  | ValidateArgs
  | SchemaArgs
  | ExpandArgs
  | TemplatesArgs;

// ============================================================================
// Argument Parsing
// ============================================================================

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
        syncArgs.days = parseInt(arg.split("=")[1]);
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
      } else if (!args[i].startsWith("-") && !templatesArgs.show) {
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
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { command: "help" };
  }

  log.error(`Unknown command: ${args[0]}`);
  process.exit(1);
}
