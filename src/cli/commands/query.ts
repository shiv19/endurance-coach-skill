import { initDatabase, query, queryJson } from "../../db/client.js";
import type { QueryArgs } from "../args.js";

// ============================================================================
// Query Command
// ============================================================================

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
