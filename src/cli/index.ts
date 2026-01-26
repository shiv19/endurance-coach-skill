import { ProxyAgent, setGlobalDispatcher } from "undici";
import { log } from "../lib/logging.js";
import { parseArgs } from "./args.js";
import { printHelp } from "./help.js";
import { runSchema } from "./commands/schema.js";
import { runQuery } from "./commands/query.js";
import { runRender } from "./commands/render.js";
import { runValidate } from "./commands/validate.js";
import { runExpand } from "./commands/expand.js";
import { runTemplates } from "./commands/templates.js";
import { runActivityLaps, runAuth, runSync } from "./commands/strava.js";
import { runModify } from "./commands/modify.js";
import { runStats } from "./commands/stats.js";
import { runTrainingLoad } from "./commands/training-load.js";
import { runFoundation } from "./commands/foundation.js";
import { runStrength } from "./commands/strength.js";
import { runSchedulePreferences } from "./commands/schedule-preferences.js";
import { runHrZones } from "./commands/hr-zones.js";

// ============================================================================
// MARK: Proxy Configuration
// ============================================================================

// Configure proxy for fetch() if HTTP_PROXY or HTTPS_PROXY is set
const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}

// ============================================================================
// MARK: Main Dispatcher
// ============================================================================
/**
 * Parse command-line arguments and dispatch to the matching CLI command handler.
 *
 * The function selects and invokes the appropriate command implementation based on
 * the parsed `args.command` value; some handlers are awaited when asynchronous.
 */

async function main(): Promise<void> {
  const args = parseArgs();

  switch (args.command) {
    case "help":
      printHelp();
      break;
    case "auth":
      await runAuth(args);
      break;
    case "activity":
      await runActivityLaps(args);
      break;
    case "sync":
      await runSync(args);
      break;
    case "schema":
      runSchema();
      break;
    case "validate":
      runValidate(args);
      break;
    case "expand":
      runExpand(args);
      break;
    case "templates":
      runTemplates(args);
      break;
    case "render":
      runRender(args);
      break;
    case "stats":
      await runStats(args);
      break;
    case "training-load":
      await runTrainingLoad(args);
      break;
    case "foundation":
      await runFoundation(args);
      break;
    case "strength":
      await runStrength(args);
      break;
    case "schedule-preferences":
      await runSchedulePreferences(args);
      break;
    case "hr-zones":
      await runHrZones(args);
      break;
    case "query":
      await runQuery(args);
      break;
    case "modify":
      runModify(args);
      break;
  }
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
