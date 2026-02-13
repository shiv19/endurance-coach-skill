import { initDatabase, getDb } from "../../db/client.js";
import { formatTable } from "../utils/format-table.js";
import { log } from "../../lib/logging.js";
import type { InterviewsListArgs, InterviewsGetArgs } from "../args.js";

export interface InterviewSummary {
  id: number;
  workout_id: number;
  created_at: string;
  coach_confidence: string;
  athlete_reflection_summary: string;
}

export interface InterviewDetail extends InterviewSummary {
  coach_notes: string;
}

export async function queryInterviews(args: InterviewsListArgs): Promise<InterviewSummary[]> {
  await initDatabase();

  const db = getDb();
  const limit = args.limit ?? 10;
  let sql = `
    SELECT
      id,
      workout_id,
      created_at,
      coach_confidence,
      athlete_reflection_summary
    FROM workout_interviews
  `;

  const params: (number | string)[] = [];

  if (args.workout !== undefined) {
    sql += " WHERE workout_id = ?";
    params.push(args.workout);
  }

  sql += " ORDER BY created_at DESC LIMIT ?";
  params.push(limit);

  const stmt = db.prepare(sql);
  return stmt.all(...params) as InterviewSummary[];
}

export async function queryInterviewById(interviewId: number): Promise<InterviewDetail | null> {
  await initDatabase();

  const db = getDb();
  const sql = `
    SELECT
      id,
      workout_id,
      created_at,
      coach_confidence,
      athlete_reflection_summary,
      coach_notes
    FROM workout_interviews
    WHERE id = ?
  `;

  const stmt = db.prepare(sql);
  const interview = stmt.get(interviewId) as InterviewDetail | undefined;

  if (!interview) {
    return null;
  }

  return interview;
}

export async function listInterviews(args: InterviewsListArgs): Promise<void> {
  const interviews = await queryInterviews(args);

  if (interviews.length === 0) {
    log.info("No interviews found.");
    return;
  }

  const headers = ["ID", "Workout", "Created At", "Confidence", "Reflection"];
  const keys = ["id", "workout_id", "created_at", "coach_confidence", "athlete_reflection_summary"];

  log.info(formatTable(interviews as unknown as Record<string, unknown>[], headers, keys));
}

export async function getInterview(args: InterviewsGetArgs): Promise<void> {
  const interview = await queryInterviewById(args.interviewId);

  if (!interview) {
    log.error(`Interview with ID ${args.interviewId} not found`);
    process.exit(1);
  }

  log.info(JSON.stringify(interview, null, 2));
}

export async function runInterviews(args: InterviewsListArgs | InterviewsGetArgs): Promise<void> {
  if (args.subcommand === "list") {
    await listInterviews(args);
  } else {
    await getInterview(args);
  }
}
