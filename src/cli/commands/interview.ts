import { initDatabase, queryJson, getDb } from "../../db/client.js";
import type { InterviewArgs } from "../args.js";
import { ensureFreshData, type FreshnessResult } from "../../lib/freshness.js";
import { evaluateAllTriggers, TriggerType, type TriggerConfig } from "../../lib/triggers.js";
import { getActivityLaps } from "../../strava/api.js";
import { getValidTokens } from "../../strava/oauth.js";
import type { Lap } from "../../strava/types.js";

const DEFAULT_LIST_DAYS = 7;

interface ActivitySummary {
  id: number;
  date: string;
  sport_type: string;
  name: string;
  duration_minutes: number;
  distance_km: number;
}

interface ActivityMetadata {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  moving_time: number;
  distance: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  suffer_score?: number;
  total_elevation_gain?: number;
  description?: string;
}

interface InterviewSummary {
  created_at: string;
  athlete_reflection_summary?: string;
}

interface TriggerInfo {
  trigger_type: string;
  actual_value: number;
  threshold: number;
  unit: string;
  percentage_over: number;
}

interface InterviewPromptData {
  mode: "strava" | "manual" | "list";
  sync_status: "synced" | "cached" | "manual";
  workout_metadata?: ActivityMetadata;
  laps?: Lap[];
  fired_triggers?: TriggerInfo[];
  athlete_interview_count: number;
  preliminary_note_eligible: boolean;
  previous_interviews?: InterviewSummary[];
  activities?: ActivitySummary[];
  warning?: string;
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toISOString().split("T")[0];
}

async function loadTriggerConfigs(): Promise<TriggerConfig[]> {
  const rows = queryJson<{
    trigger_type: string;
    threshold_value: number;
    threshold_unit: string;
    enabled: number;
  }>("SELECT trigger_type, threshold_value, threshold_unit, enabled FROM interview_triggers");

  return rows.map((row) => ({
    type: row.trigger_type as TriggerType,
    threshold: row.threshold_value,
    unit: row.threshold_unit,
    enabled: row.enabled === 1,
  }));
}

async function loadActivityMetadata(workoutId: number): Promise<ActivityMetadata | null> {
  const stmt = getDb().prepare(
    `SELECT id, name, sport_type, start_date, moving_time, distance,
            average_heartrate, max_heartrate, average_watts, suffer_score,
            total_elevation_gain, description
     FROM activities WHERE id = ?`
  );
  const rows = stmt.all(workoutId) as ActivityMetadata[];

  return rows.length > 0 ? rows[0] : null;
}

async function loadPreviousInterviews(workoutId: number, limit = 3): Promise<InterviewSummary[]> {
  const stmt = getDb().prepare(
    `SELECT created_at, athlete_reflection_summary
     FROM workout_interviews
     WHERE workout_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  );
  const rows = stmt.all(workoutId, limit) as {
    created_at: string;
    athlete_reflection_summary: string | null;
  }[];

  return rows.map((row) => ({
    created_at: row.created_at,
    athlete_reflection_summary: row.athlete_reflection_summary || undefined,
  }));
}

async function getMostRecentActivityId(): Promise<number | null> {
  const rows = queryJson<{ id: number }>(
    "SELECT id FROM activities ORDER BY start_date DESC LIMIT 1"
  );
  return rows.length > 0 ? rows[0].id : null;
}

async function getRecentActivities(days: number): Promise<ActivitySummary[]> {
  const stmt = getDb().prepare(
    `SELECT id, date(start_date) as date, sport_type, name,
            ROUND(moving_time / 60.0) as duration_minutes,
            ROUND(distance / 1000.0, 2) as distance_km
     FROM activities
     WHERE start_date >= date('now', ?)
     ORDER BY start_date DESC`
  );

  return stmt.all(`-${days} days`) as ActivitySummary[];
}

async function getTotalInterviewCount(): Promise<number> {
  const rows = queryJson<{ count: number }>("SELECT COUNT(*) as count FROM workout_interviews");
  return rows[0]?.count ?? 0;
}

async function buildInterviewData(
  metadata: ActivityMetadata,
  workoutId: number,
  fetchLaps: boolean,
  syncResult: FreshnessResult
): Promise<InterviewPromptData> {
  let laps: Lap[] | undefined;
  let firedTriggers: TriggerInfo[] | undefined;

  if (fetchLaps) {
    try {
      const tokens = await getValidTokens();
      laps = await getActivityLaps(tokens, workoutId);

      const triggers = await loadTriggerConfigs();
      firedTriggers = evaluateAllTriggers(laps, triggers).map((t) => ({
        trigger_type: t.trigger_type,
        actual_value: t.actual_value,
        threshold: t.threshold,
        unit: t.unit,
        percentage_over: t.percentage_over,
      }));
    } catch (error) {
      const warning = error instanceof Error ? error.message : String(error);
      return {
        mode: "strava",
        sync_status: syncResult.synced ? "synced" : "cached",
        workout_metadata: metadata,
        athlete_interview_count: await getTotalInterviewCount(),
        preliminary_note_eligible: false,
        previous_interviews: await loadPreviousInterviews(workoutId),
        warning: `Failed to fetch laps: ${warning}`,
      };
    }
  }

  const totalInterviews = await getTotalInterviewCount();
  const previousInterviews = await loadPreviousInterviews(workoutId);

  return {
    mode: "strava",
    sync_status: syncResult.synced ? "synced" : "cached",
    workout_metadata: metadata,
    laps,
    fired_triggers: firedTriggers,
    athlete_interview_count: totalInterviews,
    preliminary_note_eligible: totalInterviews >= 5,
    previous_interviews: previousInterviews,
  };
}

async function runLatestMode(
  args: InterviewArgs & { mode: "latest" }
): Promise<InterviewPromptData> {
  const syncResult = await ensureFreshData();

  if (syncResult.reason === "not_configured") {
    return {
      mode: "manual",
      sync_status: "manual",
      athlete_interview_count: await getTotalInterviewCount(),
      preliminary_note_eligible: false,
      warning: "Strava not configured. Use manual entry mode.",
    };
  }

  const workoutId = await getMostRecentActivityId();
  if (!workoutId) {
    return {
      mode: "manual",
      sync_status: syncResult.cached ? "cached" : "synced",
      athlete_interview_count: await getTotalInterviewCount(),
      preliminary_note_eligible: false,
      warning: "No activities found in database.",
    };
  }

  const metadata = await loadActivityMetadata(workoutId);
  if (!metadata) {
    return {
      mode: "manual",
      sync_status: syncResult.cached ? "cached" : "synced",
      athlete_interview_count: await getTotalInterviewCount(),
      preliminary_note_eligible: false,
      warning: `Activity ${workoutId} not found in database.`,
    };
  }

  return buildInterviewData(metadata, workoutId, args.laps ?? false, syncResult);
}

async function runListMode(args: InterviewArgs & { mode: "list" }): Promise<InterviewPromptData> {
  const syncResult = await ensureFreshData();
  const days = args.days ?? DEFAULT_LIST_DAYS;
  const activities = await getRecentActivities(days);
  const totalInterviews = await getTotalInterviewCount();

  return {
    mode: "list",
    sync_status:
      syncResult.reason === "not_configured" ? "manual" : syncResult.synced ? "synced" : "cached",
    activities,
    athlete_interview_count: totalInterviews,
    preliminary_note_eligible: totalInterviews >= 5,
  };
}

async function runSpecificMode(
  args: InterviewArgs & { mode: "specific" }
): Promise<InterviewPromptData> {
  const syncResult = await ensureFreshData();

  if (syncResult.reason === "not_configured") {
    return {
      mode: "manual",
      sync_status: "manual",
      athlete_interview_count: await getTotalInterviewCount(),
      preliminary_note_eligible: false,
      warning: "Strava not configured. Use manual entry mode.",
    };
  }

  const metadata = await loadActivityMetadata(args.workoutId!);
  if (!metadata) {
    return {
      mode: "manual",
      sync_status: syncResult.cached ? "cached" : "synced",
      athlete_interview_count: await getTotalInterviewCount(),
      preliminary_note_eligible: false,
      warning: `Activity ${args.workoutId} not found in database.`,
    };
  }

  return buildInterviewData(metadata, args.workoutId!, args.laps ?? false, syncResult);
}

async function runManualMode(): Promise<InterviewPromptData> {
  const totalInterviews = await getTotalInterviewCount();

  return {
    mode: "manual",
    sync_status: "manual",
    athlete_interview_count: totalInterviews,
    preliminary_note_eligible: totalInterviews >= 5,
  };
}

function formatOutput(data: InterviewPromptData): string {
  if (data.mode === "list" && data.activities) {
    let output = "Recent Activities:\n\n";
    for (const activity of data.activities) {
      output += `  ${activity.id}: ${formatDate(activity.date)} - ${activity.sport_type} - ${activity.name}\n`;
      output += `      Duration: ${activity.duration_minutes} min, Distance: ${activity.distance_km} km\n\n`;
    }
    return output;
  }

  if (data.mode === "manual") {
    let output = "Manual Interview Mode\n\n";
    output += `Total interviews: ${data.athlete_interview_count}\n`;
    if (data.preliminary_note_eligible) {
      output += "Eligible for preliminary coach notes: Yes\n";
    } else {
      output += `Interviews needed for preliminary notes: ${5 - data.athlete_interview_count}\n`;
    }
    if (data.warning) {
      output += `\nWarning: ${data.warning}\n`;
    }
    return output;
  }

  if (data.workout_metadata) {
    let output = "Workout Interview\n\n";
    output += `Sync Status: ${data.sync_status}\n\n`;
    output += `Workout ID: ${data.workout_metadata.id}\n`;
    output += `Date: ${formatDate(data.workout_metadata.start_date)}\n`;
    output += `Type: ${data.workout_metadata.sport_type}\n`;
    output += `Name: ${data.workout_metadata.name}\n`;
    output += `Duration: ${Math.round(data.workout_metadata.moving_time / 60)} minutes\n`;
    output += `Distance: ${Math.round((data.workout_metadata.distance / 1000) * 100) / 100} km\n`;
    if (data.workout_metadata.average_heartrate) {
      output += `Avg HR: ${Math.round(data.workout_metadata.average_heartrate)} bpm\n`;
    }
    if (data.workout_metadata.suffer_score) {
      output += `Strava Effort Score: ${data.workout_metadata.suffer_score}\n`;
    }

    if (data.fired_triggers && data.fired_triggers.length > 0) {
      output += "\nFired Triggers:\n";
      for (const trigger of data.fired_triggers) {
        output += `  ${trigger.trigger_type}: ${trigger.actual_value.toFixed(2)}${trigger.unit} (threshold: ${trigger.threshold}${trigger.unit}, ${trigger.percentage_over.toFixed(1)}% over)\n`;
      }
    }

    if (data.laps && data.laps.length > 0) {
      output += "\nLap Data:\n";
      for (const lap of data.laps) {
        const distanceKm = (lap.distance / 1000).toFixed(2);
        const durationMin = Math.floor(lap.moving_time / 60);
        const durationSec = lap.moving_time % 60;
        const paceMinPerKm = lap.distance > 0 ? lap.moving_time / 60 / (lap.distance / 1000) : 0;
        const paceMin = Math.floor(paceMinPerKm);
        const paceSec = Math.round((paceMinPerKm - paceMin) * 60);

        output += `  Lap ${lap.lap_index}: ${distanceKm} km, ${durationMin}:${durationSec.toString().padStart(2, "0")}`;
        if (paceMinPerKm > 0) {
          output += `, ${paceMin}:${paceSec.toString().padStart(2, "0")}/km`;
        }
        if (lap.average_heartrate) {
          output += `, HR: ${Math.round(lap.average_heartrate)} bpm`;
        }
        if (lap.average_watts) {
          output += `, Power: ${Math.round(lap.average_watts)} W`;
        }
        if (lap.average_cadence) {
          output += `, Cadence: ${Math.round(lap.average_cadence)} spm`;
        }
        output += "\n";
      }
    }

    output += `\nTotal interviews: ${data.athlete_interview_count}\n`;
    if (data.preliminary_note_eligible) {
      output += "Eligible for preliminary coach notes: Yes\n";
    } else {
      output += `Interviews needed for preliminary notes: ${5 - data.athlete_interview_count}\n`;
    }

    if (data.previous_interviews && data.previous_interviews.length > 0) {
      output += "\nPrevious Interviews:\n";
      for (const interview of data.previous_interviews) {
        output += `  ${formatDate(interview.created_at)}: ${interview.athlete_reflection_summary || "(no summary)"}\n`;
      }
    }

    if (data.warning) {
      output += `\nWarning: ${data.warning}\n`;
    }

    return output;
  }

  return "No interview data available\n";
}

export async function runInterview(args: InterviewArgs): Promise<void> {
  await initDatabase();

  let data: InterviewPromptData | undefined;

  switch (args.mode) {
    case "latest":
      data = await runLatestMode(args as InterviewArgs & { mode: "latest" });
      break;
    case "list":
      data = await runListMode(args as InterviewArgs & { mode: "list" });
      break;
    case "specific":
      if (args.workoutId === undefined) {
        throw new Error("workoutId is required for specific mode");
      }
      data = await runSpecificMode(args as InterviewArgs & { mode: "specific" });
      break;
    case "manual":
      data = await runManualMode();
      break;
  }

  if (!data) {
    throw new Error("Failed to generate interview prompt data");
  }

  if (args.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(formatOutput(data));
  }
}
