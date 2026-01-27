import { initDatabase, queryJson } from "../../db/client.js";
import { formatTable } from "../utils/format-table.js";
import type { QueryArgs } from "../args.js";

// ============================================================================
// MARK: Query Command
// ============================================================================
/**
 * Executes a SQL statement against the initialized database and prints the result.
 *
 * @param args - Command arguments: `args.sql` is the SQL statement to execute; if `args.json` is true the result is printed as formatted JSON, otherwise the raw result is printed.
 */

export async function runQuery(args: QueryArgs): Promise<void> {
  await initDatabase();

  const results = queryJson<Record<string, unknown>>(args.sql);

  if (args.json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    if (results.length === 0) return;
    const keys = Object.keys(results[0]);
    console.log(formatTable(results, keys, keys));
  }
}
