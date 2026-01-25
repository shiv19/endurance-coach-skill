import { readFile } from "node:fs/promises";
import path from "node:path";
import { generateFit } from "../src/viewer/lib/export/fit.js";

const jsonPath = path.resolve(process.cwd(), "tests/test-all-templates.json");
const data = JSON.parse(await readFile(jsonPath, "utf8"));

const settings = {
  units: { swim: "meters", bike: "kilometers", run: "kilometers" },
};

const workouts: Array<{ name: string; sport: string }> = [];
for (const week of data.weeks ?? []) {
  for (const day of week.days ?? []) {
    for (const workout of day.workouts ?? []) {
      workouts.push(workout);
    }
  }
}

const errors: string[] = [];
let exported = 0;
let skipped = 0;

for (const workout of workouts) {
  if (workout.sport === "rest" || workout.sport === "race") {
    skipped++;
    continue;
  }

  try {
    await generateFit(workout as any, settings as any);
    exported++;
  } catch (error) {
    errors.push(`${workout.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

const summary = `exported=${exported} skipped=${skipped} errors=${errors.length}`;
if (errors.length > 0) {
  console.error(summary);
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(summary);
