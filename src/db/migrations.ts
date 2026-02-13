import { readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { getDb, transaction } from "./client.js";
import { log } from "../lib/logging.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

/**
 * Migration interface
 */
interface Migration {
  name: string;
  filename: string;
}

/**
 * Read and sort migration files from the migrations directory
 */
function getMigrationFiles(): Migration[] {
  try {
    const files = readdirSync(MIGRATIONS_DIR);
    return files
      .filter((f) => f.endsWith(".sql") && /^\d+/.test(f))
      .map((f) => ({
        name: f.replace(/\.sql$/, ""),
        filename: f,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code && ["ENOENT", "EACCES", "EPERM", "ENOTDIR"].includes(err.code)) {
      const reason = err.message || err.code;
      log.warn(`Migrations directory unavailable at ${MIGRATIONS_DIR}: ${reason}`);
    }
    return [];
  }
}

/**
 * Read migration SQL content
 */
function readMigrationContent(filename: string): string {
  const path = join(MIGRATIONS_DIR, filename);
  return readFileSync(path, "utf-8");
}

/**
 * Ensure schema_migrations table exists
 */
export function ensureSchemaMigrationsTable(): void {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

/**
 * Get list of applied migrations from database
 */
function getAppliedMigrations(): MigrationRecord[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT id, name, applied_at FROM schema_migrations ORDER BY id")
    .all() as MigrationRecord[];
  return rows;
}

/**
 * Apply a single migration
 */
function applyMigration(migration: Migration): void {
  const db = getDb();

  log.info(`Applying migration: ${migration.name}`);

  const sql = readMigrationContent(migration.filename);

  // Run the migration SQL
  db.exec(sql);

  // Record the migration as applied
  db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(migration.name);

  log.success(`Applied migration: ${migration.name}`);
}

/**
 * Run all pending migrations
 * Returns number of migrations applied
 */
export function runMigrations(): number {
  ensureSchemaMigrationsTable();

  const appliedMigrations = getAppliedMigrations();
  const appliedNames = new Set(appliedMigrations.map((m) => m.name));
  const allMigrations = getMigrationFiles();

  const pendingMigrations = allMigrations.filter((m) => !appliedNames.has(m.name));

  if (pendingMigrations.length === 0) {
    return 0;
  }

  log.info(`Found ${pendingMigrations.length} pending migration(s)`);

  // Apply migrations in a transaction
  const result = transaction(() => {
    let applied = 0;
    for (const migration of pendingMigrations) {
      applyMigration(migration);
      applied++;
    }
    return applied;
  });

  log.success(`Applied ${result} migration(s) successfully`);
  return result;
}

/**
 * Get current migration status
 */
export function getMigrationStatus(): {
  applied: number;
  pending: number;
  latestApplied: string | null;
} {
  ensureSchemaMigrationsTable();

  const appliedMigrations = getAppliedMigrations();
  const allMigrations = getMigrationFiles();

  return {
    applied: appliedMigrations.length,
    pending: allMigrations.length - appliedMigrations.length,
    latestApplied:
      appliedMigrations.length > 0 ? appliedMigrations[appliedMigrations.length - 1].name : null,
  };
}

/**
 * Check if a specific migration has been applied
 */
export function isMigrationApplied(migrationName: string): boolean {
  ensureSchemaMigrationsTable();

  const db = getDb();
  const row = db
    .prepare("SELECT 1 FROM schema_migrations WHERE name = ? LIMIT 1")
    .get(migrationName) as { "1": number } | undefined;

  return row !== undefined;
}
