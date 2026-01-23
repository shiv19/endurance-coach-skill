/**
 * Client-side Plan Update & Regeneration
 *
 * This module applies local changes (from localStorage) to the plan JSON
 * and generates downloadable updated files (JSON + HTML).
 *
 * This is the browser equivalent of the CLI `modify` + `render` commands.
 */

import type { TrainingPlan, TrainingDay, Workout } from "../../schema/training-plan.js";

export interface PlanChanges {
  moved: Record<string, string>;
  edited: Record<string, Partial<Workout>>;
  deleted: string[];
  added: Record<string, { date: string; workout: Workout }>;
}

export interface UpdateResult {
  success: boolean;
  planFilename?: string;
  changesSummary?: {
    deleted: number;
    edited: number;
    moved: number;
    added: number;
    completed: number;
  };
  error?: string;
}

/**
 * Apply all local changes to the plan (browser version of modify.ts)
 */
function applyLocalChangesToPlan(
  plan: TrainingPlan,
  changes: PlanChanges,
  completed: Record<string, boolean>
): TrainingPlan {
  // Deep clone to avoid mutating original
  const modifiedPlan = JSON.parse(JSON.stringify(plan)) as TrainingPlan;

  // Track all workouts by ID for easy lookup
  const workoutMap = new Map<string, { weekIdx: number; dayIdx: number; workoutIdx: number }>();

  modifiedPlan.weeks?.forEach((week, weekIdx) => {
    week.days?.forEach((day, dayIdx) => {
      day.workouts?.forEach((workout, workoutIdx) => {
        workoutMap.set(workout.id, { weekIdx, dayIdx, workoutIdx });
      });
    });
  });

  // 1. Apply deleted workouts
  changes.deleted.forEach((workoutId) => {
    const location = workoutMap.get(workoutId);
    if (location) {
      const { weekIdx, dayIdx, workoutIdx } = location;
      modifiedPlan.weeks![weekIdx].days![dayIdx].workouts!.splice(workoutIdx, 1);
    }
  });

  // Rebuild workout map after deletions
  workoutMap.clear();
  modifiedPlan.weeks?.forEach((week, weekIdx) => {
    week.days?.forEach((day, dayIdx) => {
      day.workouts?.forEach((workout, workoutIdx) => {
        workoutMap.set(workout.id, { weekIdx, dayIdx, workoutIdx });
      });
    });
  });

  // 2. Apply edits to existing workouts
  Object.entries(changes.edited).forEach(([workoutId, edits]) => {
    const location = workoutMap.get(workoutId);
    if (location) {
      const { weekIdx, dayIdx, workoutIdx } = location;
      const workout = modifiedPlan.weeks![weekIdx].days![dayIdx].workouts![workoutIdx];
      Object.assign(workout, edits);
    }
  });

  // 3. Apply moved workouts
  Object.entries(changes.moved).forEach(([workoutId, newDate]) => {
    const location = workoutMap.get(workoutId);
    if (!location) return;

    const { weekIdx, dayIdx, workoutIdx } = location;

    // Remove workout from original location
    const [workout] = modifiedPlan.weeks![weekIdx].days![dayIdx].workouts!.splice(workoutIdx, 1);

    // Find the target day
    let targetDay: TrainingDay | null = null;

    for (const week of modifiedPlan.weeks || []) {
      for (const day of week.days || []) {
        if (day.date === newDate) {
          targetDay = day;
          break;
        }
      }
      if (targetDay) break;
    }

    if (targetDay) {
      if (!targetDay.workouts) {
        targetDay.workouts = [];
      }
      targetDay.workouts.push(workout);
    }
  });

  // 4. Add new workouts
  Object.entries(changes.added).forEach(([workoutId, { date, workout }]) => {
    let targetDay: TrainingDay | null = null;

    for (const week of modifiedPlan.weeks || []) {
      for (const day of week.days || []) {
        if (day.date === date) {
          targetDay = day;
          break;
        }
      }
      if (targetDay) break;
    }

    if (targetDay) {
      if (!targetDay.workouts) {
        targetDay.workouts = [];
      }
      targetDay.workouts.push(workout);
    }
  });

  // 5. Apply completed status
  modifiedPlan.weeks?.forEach((week) => {
    week.days?.forEach((day) => {
      day.workouts?.forEach((workout) => {
        workout.completed = completed[workout.id] || false;
      });
    });
  });

  // Update metadata
  modifiedPlan.meta.updatedAt = new Date().toISOString();

  return modifiedPlan;
}

/**
 * Download a file to the user's computer
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate a safe filename from the plan
 */
function generateFilename(plan: TrainingPlan, extension: string): string {
  const safeName = plan.meta.event
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .substring(0, 50);
  const date = new Date().toISOString().split("T")[0];
  return `${safeName}-updated-${date}.${extension}`;
}

/**
 * Count total changes
 */
function countChanges(changes: PlanChanges, completed: Record<string, boolean>): number {
  return (
    changes.deleted.length +
    Object.keys(changes.edited).length +
    Object.keys(changes.moved).length +
    Object.keys(changes.added).length +
    Object.keys(completed).filter((id) => completed[id]).length
  );
}

/**
 * Main function: Update plan and generate downloadable JSON
 *
 * This applies changes from localStorage and downloads the updated plan JSON.
 * To get the HTML, use: claude-coach render updated.json -o updated.html
 */
export function updatePlanAndRegenerate(
  plan: TrainingPlan,
  changes: PlanChanges,
  completed: Record<string, boolean>
): UpdateResult {
  try {
    // Check if there are any changes to apply
    const totalChanges = countChanges(changes, completed);
    if (totalChanges === 0) {
      return {
        success: false,
        error: "No changes to apply",
      };
    }

    // 1. Apply all changes to the plan
    const updatedPlan = applyLocalChangesToPlan(plan, changes, completed);

    // 2. Generate and download new plan JSON
    const planJson = JSON.stringify(updatedPlan, null, 2);
    const planFilename = generateFilename(updatedPlan, "json");
    downloadFile(planJson, planFilename, "application/json");

    // 3. Calculate summary
    const completedCount = Object.keys(completed).filter((id) => completed[id]).length;

    return {
      success: true,
      planFilename,
      changesSummary: {
        deleted: changes.deleted.length,
        edited: Object.keys(changes.edited).length,
        moved: Object.keys(changes.moved).length,
        added: Object.keys(changes.added).length,
        completed: completedCount,
      },
    };
  } catch (error) {
    console.error("Error updating plan:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get changes from localStorage
 */
export function getChangesFromLocalStorage(planId: string): {
  changes: PlanChanges;
  completed: Record<string, boolean>;
} {
  const changesKey = `plan-${planId}-changes`;
  const completedKey = `plan-${planId}-completed`;

  const changesJson = localStorage.getItem(changesKey);
  const completedJson = localStorage.getItem(completedKey);

  const changes: PlanChanges = changesJson
    ? JSON.parse(changesJson)
    : { moved: {}, edited: {}, deleted: [], added: {} };

  const completed: Record<string, boolean> = completedJson ? JSON.parse(completedJson) : {};

  return { changes, completed };
}

/**
 * Check if there are any pending changes
 */
export function hasPendingChanges(planId: string): boolean {
  const { changes, completed } = getChangesFromLocalStorage(planId);
  return countChanges(changes, completed) > 0;
}
