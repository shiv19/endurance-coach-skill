import { initDatabase } from "./client.js";
import { runMigrations, getMigrationStatus } from "./migrations.js";
import { ensureConfigDir } from "../lib/config.js";
import { log } from "../lib/logging.js";

export async function migrate(): Promise<void> {
  ensureConfigDir();
  await initDatabase();

  // Show current status before running migrations
  const statusBefore = getMigrationStatus();
  log.info(`Current schema: ${statusBefore.applied} migrations applied`);

  // Run pending migrations
  const appliedCount = runMigrations();

  if (appliedCount > 0) {
    log.success(`Database schema updated to latest version`);
  }
}
