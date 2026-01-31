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

export interface StatsArgs {
  command: "stats";
  weeks?: number;
  longestWeeks?: number;
  json: boolean;
  verbose?: boolean;
  noSync?: boolean;
}

export interface TrainingLoadArgs {
  command: "training-load";
  weeks?: number;
  json: boolean;
  verbose?: boolean;
  noSync?: boolean;
}

export interface FoundationArgs {
  command: "foundation";
  topWeeks?: number;
  json: boolean;
}

export interface StrengthArgs {
  command: "strength";
  months?: number;
  longMonths?: number;
  easyHrMax?: number;
  longMinutes?: number;
  years?: number;
  json: boolean;
}

export interface SchedulePreferencesArgs {
  command: "schedule-preferences";
  rideMinutes?: number;
  runMinutes?: number;
  json: boolean;
}

export interface HrZonesArgs {
  command: "hr-zones";
  weeks?: number;
  distributionWeeks?: number;
  json: boolean;
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

export interface ActivityLapsArgs {
  command: "activity";
  id: number;
  laps: true;
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
  create?: string;
  category?: string;
  templateFile?: string;
  overwrite?: boolean;
  dryRun?: boolean;
  example?: boolean;
  userTemplatesDir?: string;
  validate?: string;
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

export interface InterviewArgs {
  command: "interview";
  mode: "latest" | "list" | "manual" | "specific";
  workoutId?: number;
  laps?: boolean;
  days?: number;
  json?: boolean;
}

export interface InterviewSaveArgs {
  command: "interview-save";
  workoutId: number;
  reflection: string;
  notes: string;
  confidence: "Low" | "Medium" | "High";
}

export interface PreliminaryNoteSaveArgs {
  command: "preliminary-note-save";
  workoutId: number;
  note: string;
}

export interface ActivityRecordArgs {
  command: "activity-record";
  type: string;
  duration: number;
  distance?: number;
  structure?: string;
  notes?: string;
}

export interface TriggersArgs {
  command: "triggers";
  subcommand: "list" | "set" | "disable";
  type?: string;
  threshold?: number;
  unit?: string;
  enabled?: boolean;
}

export interface InterviewsListArgs {
  command: "interviews";
  subcommand: "list";
  workout?: number;
  limit?: number;
}

export interface InterviewsGetArgs {
  command: "interviews";
  subcommand: "get";
  interviewId: number;
}

export type CliArgs =
  | SyncArgs
  | RenderArgs
  | StatsArgs
  | TrainingLoadArgs
  | FoundationArgs
  | StrengthArgs
  | SchedulePreferencesArgs
  | HrZonesArgs
  | QueryArgs
  | AuthArgs
  | ActivityLapsArgs
  | HelpArgs
  | ModifyArgs
  | ValidateArgs
  | SchemaArgs
  | ExpandArgs
  | TemplatesArgs
  | InterviewArgs
  | InterviewSaveArgs
  | PreliminaryNoteSaveArgs
  | ActivityRecordArgs
  | TriggersArgs
  | InterviewsListArgs
  | InterviewsGetArgs;
