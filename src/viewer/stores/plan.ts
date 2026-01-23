import type { TrainingPlan } from "../../schema/training-plan.js";

// Load plan from embedded JSON
function loadPlanData(): TrainingPlan {
  const el = document.getElementById("plan-data");
  if (!el) throw new Error("Plan data not found");
  return JSON.parse(el.textContent || "{}");
}

// Reactive state using Svelte 5's $state rune is only available in .svelte files
// So we export the raw data and let components create reactive state
export const planData = loadPlanData();

// Completed workouts stored in localStorage
const storageKey = `plan-${planData.meta.id}-completed`;

/**
 * Load completed status from both:
 * 1. The embedded JSON plan data (workouts with completed: true)
 * 2. localStorage (user's local changes)
 *
 * localStorage takes precedence for any conflicts.
 */
export function loadCompleted(): Record<string, boolean> {
  // First, extract completed status from the plan JSON
  const fromPlan: Record<string, boolean> = {};
  planData.weeks?.forEach((week) => {
    week.days?.forEach((day) => {
      day.workouts?.forEach((workout) => {
        if (workout.completed) {
          fromPlan[workout.id] = true;
        }
      });
    });
  });

  // Then load from localStorage (user's local changes)
  const saved = localStorage.getItem(storageKey);
  const fromStorage: Record<string, boolean> = saved ? JSON.parse(saved) : {};

  // Merge: localStorage overrides plan data
  return { ...fromPlan, ...fromStorage };
}

export function saveCompleted(completed: Record<string, boolean>): void {
  localStorage.setItem(storageKey, JSON.stringify(completed));
}
