import Database from "better-sqlite3";
import { getDbPath } from "../lib/config.js";

// ============================================================================
// MARK: SQLite Backend Abstraction
// ============================================================================

interface SqliteBackend {
  query(sql: string): string;
  queryJson<T>(sql: string): T[];
  execute(sql: string): void;
}

let cachedBackend: SqliteBackend | null = null;
let dbInstance: Database.Database | null = null;

/**
 * Initialize the SQLite backend using better-sqlite3.
 */
function createBackend(): SqliteBackend {
  const dbPath = getDbPath();
  const db = new Database(dbPath);
  dbInstance = db;

  // Add safety pragmas
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  return {
    query(sql: string): string {
      const stmt = db.prepare(sql);
      const rows = stmt.all();
      if (rows.length === 0) return "";
      // Format as simple text output (column values separated by |)
      return rows
        .map((row) =>
          Object.values(row as Record<string, unknown>)
            .map((v) => (v === null ? "" : String(v)))
            .join("|")
        )
        .join("\n");
    },
    queryJson<T>(sql: string): T[] {
      const stmt = db.prepare(sql);
      return stmt.all() as T[];
    },
    execute(sql: string): void {
      db.exec(sql);
    },
  };
}

/**
 * Initialize the SQLite backend. Must be called before using other functions.
 */
export async function initDatabase(): Promise<void> {
  if (!cachedBackend) {
    cachedBackend = createBackend();
  }

  // Run any pending migrations
  const { runMigrations } = await import("./migrations.js");
  runMigrations();
}

/**
 * Reset the cached database connection.
 * This is primarily used for testing to ensure each test gets a fresh connection.
 */
export function resetDatabaseCache(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  cachedBackend = null;
}

/**
 * Get the backend, throwing if not initialized.
 */
function getBackend(): SqliteBackend {
  if (!cachedBackend) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return cachedBackend;
}

// ============================================================================
// MARK: Public API (synchronous after initialization)
// ============================================================================

export function query(sql: string): string {
  return getBackend().query(sql);
}

export function queryJson<T>(sql: string): T[] {
  return getBackend().queryJson<T>(sql);
}

export function execute(sql: string): void {
  getBackend().execute(sql);
}

export function runScript(script: string): void {
  execute(script);
}

/**
 * Get the raw better-sqlite3 database instance.
 * Useful for transactions or other advanced features.
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return dbInstance;
}

/**
 * Helper to run code within a transaction.
 */
export function transaction<T>(fn: () => T): T {
  return getDb().transaction(fn)();
}
