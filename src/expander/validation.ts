/**
 * Template Validation with Fuzzy Matching
 *
 * Provides fail-fast validation for unknown template references
 * with helpful suggestions for similar template names.
 */

import type { TemplateRegistry } from "../templates/index.js";
import { WORKOUT_REF_PATTERN } from "../schema/compact-plan.js";

// ============================================================================
// MARK: Error Classes
// ============================================================================

/**
 * Error thrown when a referenced template does not exist.
 */
export class UnknownTemplateError extends Error {
  constructor(
    public templateId: string,
    public suggestions: string[]
  ) {
    super(UnknownTemplateError.formatMessage(templateId, suggestions));
    this.name = "UnknownTemplateError";
  }

  private static formatMessage(templateId: string, suggestions: string[]): string {
    let message = `Template not found: "${templateId}"\n\n`;

    if (suggestions.length > 0) {
      message += `Did you mean one of these?\n`;
      suggestions.forEach((s, i) => {
        message += `  - ${s}\n`;
      });
    } else {
      message += `No similar templates found.\n`;
    }

    message += `\nAvailable templates can be listed with the \`templates\` CLI command.\n`;
    message += `Check spelling or create a custom template if needed.`;

    return message;
  }
}

// ============================================================================
// MARK: Fuzzy Matching Functions
// ============================================================================

/**
 * Compute the Levenshtein distance between two strings.
 *
 * @returns The integer edit distance between `a` and `b` (0 when the strings are identical).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  // Create a matrix of size (m+1) x (n+1)
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  // Initialize matrix
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Compute a normalized similarity score between two strings (1.0 = identical, 0.0 = completely different).
 *
 * Comparison is case-insensitive.
 *
 * @param a - The first string to compare
 * @param b - The second string to compare
 * @returns A number between 0 and 1 representing similarity; `1` if the strings are identical. Returns `1` when both inputs are empty.
 */
export function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Suggests template IDs from the registry that are most similar to the provided template ID.
 *
 * @param templateId - The template identifier to match against the registry
 * @param templates - The template registry to search
 * @param maxSuggestions - Maximum number of suggestions to return (default: 5)
 * @returns An array of template IDs ordered from most to least similar (up to `maxSuggestions`)
 */
export function findSimilarTemplates(
  templateId: string,
  templates: TemplateRegistry,
  maxSuggestions: number = 5
): string[] {
  const allIds = templates.ids();
  const threshold = 0.3; // Minimum similarity score (0-1)

  // Calculate similarity for all template IDs
  const similarities = allIds
    .map((id) => ({
      id,
      score: similarityScore(templateId, id),
    }))
    .filter((s) => s.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);

  return similarities.map((s) => s.id);
}

/**
 * Ensures a template with the given ID exists in the provided registry.
 *
 * @throws UnknownTemplateError - if the template is not found; the error includes fuzzy-match suggestions for possible template IDs.
 */
export function validateTemplateExists(templateId: string, templates: TemplateRegistry): void {
  if (templates.has(templateId)) {
    return; // Template exists, all good
  }

  const suggestions = findSimilarTemplates(templateId, templates);
  throw new UnknownTemplateError(templateId, suggestions);
}

// ============================================================================
// MARK: Enhanced Plan Validation
// ============================================================================

/**
 * Enhanced version of validateWorkoutRefs that returns detailed error objects.
 */
export interface PlanTemplateValidationError {
  templateId: string;
  week: number;
  day: string;
  ref: string;
  suggestions: string[];
}

/**
 * Collects unknown template references from a compact plan and returns detailed validation errors.
 *
 * Iterates the plan's weeks and workouts, identifies template references that are not present in the provided
 * TemplateRegistry, and returns an array of PlanTemplateValidationError objects containing the week, day, original
 * reference, the extracted template ID, and suggested similar template IDs.
 *
 * @param compactPlan - Plan object with a `weeks` array; each week contains a `week` number and `workouts` mapping days to a template ref or array of refs.
 * @param templates - TemplateRegistry used to check whether a referenced template ID exists and to derive suggestions for unknown IDs.
 * @returns An array of PlanTemplateValidationError objects describing each unknown template reference found in the plan.
 */
export function validatePlanTemplates(
  compactPlan: {
    weeks: Array<{ week: number; workouts: Record<string, string | string[]> }>;
  },
  templates: TemplateRegistry
): PlanTemplateValidationError[] {
  const errors: PlanTemplateValidationError[] = [];

  for (const week of compactPlan.weeks) {
    for (const [day, refs] of Object.entries(week.workouts)) {
      const refArray = Array.isArray(refs) ? refs : [refs];
      for (const ref of refArray) {
        if (typeof ref !== "string") {
          const refString = String(ref);
          errors.push({
            templateId: refString,
            week: week.week,
            day,
            ref: refString,
            suggestions: [],
          });
          continue;
        }
        // Extract template ID from reference (e.g., "run.easy(30)" -> "run.easy")
        // Uses WORKOUT_REF_PATTERN to match the same validation rules as parseWorkoutRef
        const trimmedRef = ref.trim();
        const match = trimmedRef.match(WORKOUT_REF_PATTERN);
        const templateId = match ? match[1] : trimmedRef;

        if (!templates.has(templateId)) {
          const suggestions = findSimilarTemplates(templateId, templates);
          errors.push({
            templateId,
            week: week.week,
            day,
            ref: trimmedRef,
            suggestions,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Render a list of template validation errors into a concise, human-readable report.
 *
 * The returned string lists each unknown reference with its week, day, and original ref,
 * and includes suggested template IDs when available. If `errors` is empty, returns an empty string.
 *
 * @param errors - Array of template validation errors to format
 * @returns A multi-line message describing each unknown reference and any suggestions, or an empty string if there are no errors
 */
export function formatValidationErrors(errors: PlanTemplateValidationError[]): string {
  if (errors.length === 0) return "";

  let message = `Found ${errors.length} unknown template reference${
    errors.length > 1 ? "s" : ""
  }:\n\n`;

  for (const error of errors) {
    message += `  Week ${error.week}, ${error.day}: "${error.ref}"\n`;
    if (error.suggestions.length > 0) {
      message += `    Did you mean: ${error.suggestions.join(", ")}?\n`;
    }
    message += "\n";
  }

  message += "Fix these template references and try again.";

  return message;
}
