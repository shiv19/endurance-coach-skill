/**
 * Template Validation with Fuzzy Matching
 *
 * Provides fail-fast validation for unknown template references
 * with helpful suggestions for similar template names.
 */

import type { TemplateRegistry } from "../templates/index.js";

// ============================================================================
// Error Classes
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
// Fuzzy Matching Functions
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings.
 * Lower distance = more similar.
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
 * Calculate normalized similarity score (0-1, where 1 is identical).
 */
export function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / maxLen;
}

/**
 * Find templates similar to given template ID.
 * Returns up to `maxSuggestions` templates sorted by similarity.
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
 * Validate that a template exists and throw an error if not.
 * Includes fuzzy matching suggestions for helpful error messages.
 */
export function validateTemplateExists(templateId: string, templates: TemplateRegistry): void {
  if (templates.has(templateId)) {
    return; // Template exists, all good
  }

  const suggestions = findSimilarTemplates(templateId, templates);
  throw new UnknownTemplateError(templateId, suggestions);
}

// ============================================================================
// Enhanced Plan Validation
// ============================================================================

/**
 * Enhanced version of validateWorkoutRefs that returns detailed error objects.
 */
export interface TemplateValidationError {
  templateId: string;
  week: number;
  day: string;
  ref: string;
  suggestions: string[];
}

export function validatePlanTemplates(
  compactPlan: {
    weeks: Array<{ week: number; workouts: Record<string, string | string[]> }>;
  },
  templates: TemplateRegistry
): TemplateValidationError[] {
  const errors: TemplateValidationError[] = [];

  for (const week of compactPlan.weeks) {
    for (const [day, refs] of Object.entries(week.workouts)) {
      const refArray = Array.isArray(refs) ? refs : [refs];
      for (const ref of refArray) {
        // Extract template ID from reference (e.g., "easy(30)" -> "easy")
        const templateId = ref.split(/[:(]/)[0];

        if (!templates.has(templateId)) {
          const suggestions = findSimilarTemplates(templateId, templates);
          errors.push({
            templateId,
            week: week.week,
            day,
            ref,
            suggestions,
          });
        }
      }
    }
  }

  return errors;
}

/**
 * Format validation errors into a human-readable message.
 */
export function formatValidationErrors(errors: TemplateValidationError[]): string {
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
