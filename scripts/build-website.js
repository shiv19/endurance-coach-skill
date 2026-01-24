#!/usr/bin/env node

/**
 * Build script for the Endurance Coach marketing docs.
 *
 * This script:
 * 1. Renders demo training plan JSON files to HTML
 * 2. Injects a script to pre-populate localStorage with completed workouts
 *
 * Prerequisites:
 * - Run `npm run build:viewer` first to generate the template
 * - Run `npm run build:ts` to compile the CLI
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const demosDir = join(rootDir, "docs", "demos");

// Script to inject into demo HTML files
// This pre-populates localStorage with completed workouts from the plan data
const COMPLETION_SCRIPT = `<script>(function(){var p=document.getElementById("plan-data");if(!p)return;var plan=JSON.parse(p.textContent);var c={};plan.weeks.forEach(function(w){w.days.forEach(function(d){d.workouts.forEach(function(x){if(x.completed)c[x.id]=true});})});localStorage.setItem("endurance-coach-completed",JSON.stringify(c))})();</script>`;

function renderDemos() {
  console.log("Rendering demo training plans...\n");

  // Find all JSON plan files in the demos directory
  const files = readdirSync(demosDir).filter((f) => f.endsWith("-plan.json"));

  for (const jsonFile of files) {
    const baseName = jsonFile.replace("-plan.json", "");
    const jsonPath = join(demosDir, jsonFile);
    const htmlPath = join(demosDir, `${baseName}.html`);

    console.log(`  ${jsonFile} -> ${baseName}.html`);

    // Render using CLI
    execSync(`node dist/cli.js render "${jsonPath}" --output "${htmlPath}"`, {
      cwd: rootDir,
      stdio: "pipe",
    });

    // Inject completion script
    let html = readFileSync(htmlPath, "utf-8");
    html = html.replace("</body>", `${COMPLETION_SCRIPT}</body>`);
    writeFileSync(htmlPath, html);
  }

  console.log(`\nRendered ${files.length} demo plans.`);
}

function main() {
  console.log("Building Endurance Coach docs...\n");

  try {
    renderDemos();
    console.log("\nWebsite build complete!");
    console.log("Output: docs/");
  } catch (error) {
    console.error("Build failed:", error.message);
    process.exit(1);
  }
}

main();
