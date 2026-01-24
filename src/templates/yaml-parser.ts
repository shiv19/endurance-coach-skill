/**
 * YAML Parser Wrapper
 *
 * Provides consistent YAML parsing for templates and compact plans.
 */

import { parse as yamlParse, stringify as yamlStringify } from "yaml";

/**
 * Parse a YAML string into a JavaScript object.
 */
export function parse<T = unknown>(content: string): T {
  return yamlParse(content) as T;
}

/**
 * Stringify a JavaScript object to YAML.
 */
export function stringify(data: unknown, options?: { indent?: number }): string {
  return yamlStringify(data, { indent: options?.indent ?? 2 });
}
