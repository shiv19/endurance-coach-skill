/**
 * CLI Entry Point
 *
 * This file re-exports from the modular CLI structure.
 * The actual implementation is in src/cli/index.ts
 */
export * from "./cli/index.js";

// Re-export the ModifyOptions interface for backwards compatibility
export type { ModifyOptions } from "./cli/commands/modify.js";

// Import to trigger CLI execution
import "./cli/index.js";
