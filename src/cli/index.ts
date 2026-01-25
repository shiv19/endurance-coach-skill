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
import { runAuth, runSync } from "./commands/strava.js";
import { runModify } from "./commands/modify.js";

// ============================================================================
// Proxy Configuration
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
// Main Dispatcher
// ============================================================================

async function main(): Promise<void> {
  const args = parseArgs();

  switch (args.command) {
    case "help":
      printHelp();
      break;
    case "auth":
      await runAuth(args);
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
