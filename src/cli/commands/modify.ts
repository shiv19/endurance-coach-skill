import { readFileSync, writeFileSync } from "fs";
import type { TrainingPlan, TrainingDay, Workout } from "../../schema/training-plan.js";
import type { ModifyArgs } from "../args.js";

// ============================================================================
// MARK: Modify Command Types
// ============================================================================

interface PlanChanges {
  moved: Record<string, string>;
  edited: Record<string, Partial<Workout>>;
  deleted: string[];
  added: Record<string, { date: string; workout: Workout }>;
}

interface BackupData {
  [key: string]: string;
}

export interface ModifyOptions {
  backup: string;
  plan: string;
  output?: string;
}

// ============================================================================
// MARK: Helper Functions
// ============================================================================

/**
 * Extract plan ID, plan changes, and completed-workout flags from backup localStorage data.
 *
 * Parses the backup entries to locate a `plan-{id}-changes` entry and an optional
 * `plan-{id}-completed` entry. JSON parse failures are logged to the console and
 * cause the corresponding return fields to be `null`.
 *
 * @param backupData - Mapping of localStorage keys to JSON string values from a backup.
 * @returns An object containing:
 *  - `planId` — the extracted plan identifier, or `null` if not found;
 *  - `changes` — the parsed `PlanChanges` object, or `null` if missing or parsing failed;
 *  - `completed` — a map of workout IDs to `true` for completed workouts, or `null` if missing or parsing failed.
 */
function extractDataFromBackup(backupData: BackupData): {
  planId: string | null;
  changes: PlanChanges | null;
  completed: Record<string, boolean> | null;
} {
  // Find the changes key (format: "plan-{id}-changes")
  const changesKey = Object.keys(backupData).find((key) => key.endsWith("-changes"));

  if (!changesKey) {
    return { planId: null, changes: null, completed: null };
  }

  // Extract plan ID from key
  const planId = changesKey.replace(/^plan-/, "").replace(/-changes$/, "");

  // Parse the changes JSON
  let changes: PlanChanges | null = null;
  try {
    const changesJson = backupData[changesKey];
    changes = JSON.parse(changesJson) as PlanChanges;
  } catch (error) {
    console.error("Failed to parse changes:", error);
  }

  // Find and parse completed workouts
  const completedKey = `plan-${planId}-completed`;
  let completed: Record<string, boolean> | null = null;

  if (backupData[completedKey]) {
    try {
      completed = JSON.parse(backupData[completedKey]) as Record<string, boolean>;
    } catch (error) {
      console.error("Failed to parse completed data:", error);
    }
  }

  return { planId, changes, completed };
}

/**
 * Set each workout's `completed` flag according to the provided map.
 *
 * @param plan - The training plan whose workouts will be updated
 * @param completed - A map from workout ID to a boolean; if an ID exists in this map the corresponding workout's `completed` property will be set to that boolean
 */
function applyCompletedStatus(plan: TrainingPlan, completed: Record<string, boolean>): void {
  const completedCount = Object.keys(completed).filter((id) => completed[id]).length;
  console.log(`Applying completed status to ${completedCount} workouts...`);

  let appliedCount = 0;

  plan.weeks?.forEach((week) => {
    week.days?.forEach((day) => {
      day.workouts?.forEach((workout) => {
        if (completed[workout.id] !== undefined) {
          workout.completed = completed[workout.id];
          if (completed[workout.id]) {
            appliedCount++;
            console.log(`  - Marked ${workout.id} as completed`);
          }
        }
      });
    });
  });

  if (appliedCount > 0) {
    console.log(`Applied completed status to ${appliedCount} workouts`);
  }
}

/**
 * Apply deletions, edits, moves, and additions from a PlanChanges object to a training plan and return the resulting plan.
 *
 * @param plan - The source TrainingPlan; the function does not mutate this object and returns a modified deep clone.
 * @param changes - The set of changes to apply (deleted IDs, edited fields, moved workout dates, and added workouts).
 * @returns The modified TrainingPlan with all changes applied and `meta.updatedAt` set to the current ISO timestamp.
 */
function applyChangesToPlan(plan: TrainingPlan, changes: PlanChanges): TrainingPlan {
  const modifiedPlan = JSON.parse(JSON.stringify(plan)) as TrainingPlan;

  const findWorkoutLocation = (
    workoutId: string
  ): { weekIdx: number; dayIdx: number; workoutIdx: number; workout: Workout } | null => {
    for (const [weekIdx, week] of (modifiedPlan.weeks || []).entries()) {
      for (const [dayIdx, day] of (week.days || []).entries()) {
        for (const [workoutIdx, workout] of (day.workouts || []).entries()) {
          if (workout.id === workoutId) {
            return { weekIdx, dayIdx, workoutIdx, workout };
          }
        }
      }
    }
    return null;
  };

  const findDayByDate = (date: string): TrainingDay | null => {
    for (const week of modifiedPlan.weeks || []) {
      for (const day of week.days || []) {
        if (day.date === date) {
          return day;
        }
      }
    }
    return null;
  };

  // 1. Apply deleted workouts
  console.log(`Applying ${changes.deleted.length} deletions...`);
  changes.deleted.forEach((workoutId) => {
    const location = findWorkoutLocation(workoutId);
    if (location) {
      const { weekIdx, dayIdx, workoutIdx } = location;
      modifiedPlan.weeks![weekIdx].days![dayIdx].workouts!.splice(workoutIdx, 1);
      console.log(`  - Deleted workout: ${workoutId}`);
    }
  });

  // 2. Apply edits to existing workouts
  const editCount = Object.keys(changes.edited).length;
  console.log(`Applying ${editCount} edits...`);
  Object.entries(changes.edited).forEach(([workoutId, edits]) => {
    const location = findWorkoutLocation(workoutId);
    if (location) {
      const { workout } = location;
      Object.assign(workout, edits);
      console.log(`  - Edited workout: ${workoutId}`);
    }
  });

  // 3. Apply moved workouts
  const moveCount = Object.keys(changes.moved).length;
  console.log(`Applying ${moveCount} moves...`);
  Object.entries(changes.moved).forEach(([workoutId, newDate]) => {
    // Find the target day
    const targetDay = findDayByDate(newDate);

    if (targetDay) {
      const location = findWorkoutLocation(workoutId);
      if (!location) return;

      const { weekIdx, dayIdx, workoutIdx, workout } = location;

      modifiedPlan.weeks![weekIdx].days![dayIdx].workouts!.splice(workoutIdx, 1);

      // Add workout to new location
      if (!targetDay.workouts) {
        targetDay.workouts = [];
      }
      targetDay.workouts.push(workout);
      console.log(`  - Moved workout ${workoutId} to ${newDate}`);
    } else {
      console.warn(`  ! Could not find target date ${newDate} for workout ${workoutId}`);
    }
  });

  // 4. Add new workouts
  const addCount = Object.keys(changes.added).length;
  console.log(`Adding ${addCount} new workouts...`);
  Object.entries(changes.added).forEach(([workoutId, { date, workout }]) => {
    // Find the target day
    const targetDay = findDayByDate(date);

    if (targetDay) {
      if (!targetDay.workouts) {
        targetDay.workouts = [];
      }
      targetDay.workouts.push(workout);
      console.log(`  - Added workout ${workoutId} on ${date}`);
    } else {
      console.warn(`  ! Could not find date ${date} for new workout ${workoutId}`);
    }
  });

  // Update the plan's updatedAt timestamp
  modifiedPlan.meta.updatedAt = new Date().toISOString();

  return modifiedPlan;
}

// ============================================================================
// MARK: Modify Command
// ============================================================================
/**
 * Modify a training plan using changes and completed flags extracted from a backup file and persist the updated plan.
 *
 * Reads the specified backup to obtain plan changes and optional completed-workout flags, applies deletions/edits/moves/additions and completed status to the provided plan file, and writes the resulting plan to the output path (or overwrites the original plan).
 *
 * @param options - Options controlling the modify operation:
 *   - backup: Path to the backup file containing change and completed data
 *   - plan: Path to the existing training plan file to modify
 *   - output: Optional path to write the modified plan (defaults to `plan` if omitted)
 */

export function modifyCommand(options: ModifyOptions): void {
  console.log("📝 Modifying training plan...\n");

  try {
    // 1. Read backup file
    console.log(`Reading backup: ${options.backup}`);
    const backupContent = readFileSync(options.backup, "utf-8");
    const backupData: BackupData = JSON.parse(backupContent);

    // 2. Extract changes and completed status from backup
    const { planId, changes, completed } = extractDataFromBackup(backupData);

    if (!changes) {
      console.error("❌ No changes found in backup file");
      process.exit(1);
    }

    console.log(`Found data for plan: ${planId}`);
    if (completed) {
      const completedCount = Object.keys(completed).filter((id) => completed[id]).length;
      console.log(`Found ${completedCount} completed workouts in backup`);
    }
    console.log();

    // 3. Read plan file
    console.log(`Reading plan: ${options.plan}`);
    const planContent = readFileSync(options.plan, "utf-8");
    const plan: TrainingPlan = JSON.parse(planContent);

    // Verify plan IDs match
    if (plan.meta.id !== planId) {
      console.warn(
        `⚠️  Warning: Plan ID mismatch!\n   Backup: ${planId}\n   Plan:   ${plan.meta.id}`
      );
      console.log("   Continuing anyway...\n");
    }

    // 4. Apply changes
    console.log("Applying changes:\n");
    const modifiedPlan = applyChangesToPlan(plan, changes);

    // 5. Apply completed status if available
    if (completed) {
      console.log();
      applyCompletedStatus(modifiedPlan, completed);
    }

    // 6. Write output
    const outputPath = options.output || options.plan;
    console.log(`\nWriting modified plan to: ${outputPath}`);
    writeFileSync(outputPath, JSON.stringify(modifiedPlan, null, 2));

    console.log("\n✅ Plan modified successfully!");
    console.log(`\nSummary:`);
    console.log(`  - Deleted: ${changes.deleted.length} workouts`);
    console.log(`  - Edited: ${Object.keys(changes.edited).length} workouts`);
    console.log(`  - Moved: ${Object.keys(changes.moved).length} workouts`);
    console.log(`  - Added: ${Object.keys(changes.added).length} workouts`);
    if (completed) {
      const completedCount = Object.keys(completed).filter((id) => completed[id]).length;
      console.log(`  - Completed: ${completedCount} workouts marked as done`);
    }
  } catch (error) {
    console.error("❌ Error modifying plan:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Run the modify operation using parsed CLI arguments.
 *
 * @param args - Parsed CLI arguments containing `backup` and `plan` file paths and an optional `output` path
 */
export function runModify(args: ModifyArgs): void {
  modifyCommand({
    backup: args.backup,
    plan: args.plan,
    output: args.output,
  });
}
