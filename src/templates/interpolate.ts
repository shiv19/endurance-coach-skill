/**
 * Variable Interpolation Engine
 *
 * Replaces ${variable} patterns in template strings with actual values.
 * Supports:
 * - Simple variables: ${paces.easy} → "5:30/km"
 * - Math expressions: ${10 + (reps * 3)} → "22"
 * - Nested access: ${zones.hr.lthr} → "170"
 */

import type { InterpolationContext } from "./template.types.js";

/**
 * Pattern to match ${...} interpolation markers.
 */
const INTERPOLATION_PATTERN = /\$\{([^}]+)\}/g;

/**
 * Pattern to detect if a string contains a math expression.
 */
const MATH_EXPRESSION_PATTERN = /[+\-*/%()]/;

/**
 * Get a nested value from an object using dot notation.
 *
 * @example
 * getNestedValue({ paces: { easy: "5:30" } }, "paces.easy") // "5:30"
 * getNestedValue({ a: { b: { c: 1 } } }, "a.b.c") // 1
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Evaluate a simple math expression with variable substitution.
 *
 * This uses a safe evaluation approach that only allows basic math operations.
 * Variables in the expression are first replaced with their values from context.
 *
 * @example
 * evaluateExpression("10 + (reps * 3)", { reps: 4 }) // 22
 */
export function evaluateExpression(expr: string, context: InterpolationContext): string | number {
  // First, replace any variable references in the expression
  let substituted = expr;

  // Find all word tokens that could be variables
  const variablePattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g;
  let match;

  while ((match = variablePattern.exec(expr)) !== null) {
    const varName = match[1];

    // Skip JavaScript keywords and numbers
    if (["true", "false", "null", "undefined", "NaN", "Infinity"].includes(varName)) {
      continue;
    }

    // Try to get the value from context
    const value = getNestedValue(context as Record<string, unknown>, varName);

    if (value !== undefined) {
      // Convert to appropriate format for the expression
      let replacement: string;
      if (typeof value === "number") {
        replacement = String(value);
      } else if (typeof value === "string") {
        // If it's a string that looks like a number, use it directly
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          replacement = String(numValue);
        } else {
          // For non-numeric strings, quote them
          replacement = `"${value}"`;
        }
      } else {
        replacement = String(value);
      }

      // Replace this specific occurrence
      substituted = substituted.replace(new RegExp(`\\b${varName}\\b`, "g"), replacement);
    }
  }

  // Check if the result looks like a math expression
  if (MATH_EXPRESSION_PATTERN.test(substituted)) {
    try {
      // Safe evaluation using Function constructor
      // Only allow numbers, operators, and parentheses
      const sanitized = substituted.replace(/[^0-9+\-*/().%\s]/g, "");
      if (sanitized.trim() !== substituted.trim()) {
        // Expression contained invalid characters after substitution
        return substituted;
      }

      // Evaluate the expression
      const fn = new Function(`return (${sanitized})`);
      const result = fn();

      if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
        // Round to reasonable precision
        return Math.round(result * 100) / 100;
      }
    } catch {
      // If evaluation fails, return the substituted string
    }
  }

  // Return the substituted string (might be a simple value)
  return substituted;
}

/**
 * Interpolate all ${variable} patterns in a string.
 *
 * @example
 * interpolate("Run ${duration} min @ ${paces.easy}", {
 *   duration: 30,
 *   paces: { easy: "5:30/km" }
 * })
 * // "Run 30 min @ 5:30/km"
 */
export function interpolate(template: string, context: InterpolationContext): string {
  return template.replace(INTERPOLATION_PATTERN, (_, expr: string) => {
    const trimmed = expr.trim();

    // Check if it's a simple variable reference (no math)
    if (!MATH_EXPRESSION_PATTERN.test(trimmed)) {
      const value = getNestedValue(context as Record<string, unknown>, trimmed);
      if (value !== undefined && value !== null) {
        return String(value);
      }
      // Return placeholder if variable not found
      return `\${${trimmed}}`;
    }

    // It's an expression - evaluate it
    const result = evaluateExpression(trimmed, context);
    return String(result);
  });
}

/**
 * Interpolate all string values in an object recursively.
 */
export function interpolateObject<T>(obj: T, context: InterpolationContext): T {
  if (typeof obj === "string") {
    return interpolate(obj, context) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => interpolateObject(item, context)) as T;
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = interpolateObject(value, context);
    }
    return result as T;
  }

  return obj;
}

/**
 * Create an interpolation context from a compact plan's athlete data.
 */
export function createContext(
  paces: Record<string, string | undefined>,
  zones?: InterpolationContext["zones"],
  params?: Record<string, unknown>
): InterpolationContext {
  return {
    paces,
    zones,
    ...params,
  };
}

/**
 * Check if a string contains any interpolation markers.
 */
export function hasInterpolation(str: string): boolean {
  return INTERPOLATION_PATTERN.test(str);
}

/**
 * Extract all variable names from a template string.
 *
 * @example
 * extractVariables("Run ${duration} min @ ${paces.easy}")
 * // ["duration", "paces.easy"]
 */
export function extractVariables(template: string): string[] {
  const variables: string[] = [];
  let match;

  // Reset the regex
  const pattern = new RegExp(INTERPOLATION_PATTERN.source, "g");

  while ((match = pattern.exec(template)) !== null) {
    const expr = match[1].trim();

    // For simple variables, add directly
    if (!MATH_EXPRESSION_PATTERN.test(expr)) {
      variables.push(expr);
    } else {
      // For expressions, extract variable names
      const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_.]*)\b/g;
      let varMatch;
      while ((varMatch = varPattern.exec(expr)) !== null) {
        const varName = varMatch[1];
        if (!["true", "false", "null", "undefined", "NaN", "Infinity"].includes(varName)) {
          variables.push(varName);
        }
      }
    }
  }

  return [...new Set(variables)];
}
