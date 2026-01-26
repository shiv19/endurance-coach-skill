import { initDatabase, query, queryJson } from "../../db/client.js";
import type { QueryArgs } from "../args.js";

// ============================================================================
// Query Command
/**
 * Executes a SQL statement against the initialized database and prints the result.
 *
 * @param args - Command arguments: `args.sql` is the SQL statement to execute; if `args.json` is true the result is printed as formatted JSON, otherwise the raw result is printed.
 */

export async function runQuery(args: QueryArgs): Promise<void> {
  await initDatabase();

  if (args.json) {
    const results = queryJson(args.sql);
    console.log(JSON.stringify(results, null, 2));
  } else {
    const result = query(args.sql);
    console.log(result);
  }
}