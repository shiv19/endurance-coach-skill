// ============================================================================
// Schema Command
/**
 * Prints the YAML v2.0 Training Plan Format, a complete example, workout templates, zone auto-calculation notes, and example CLI commands to the console.
 *
 * Used as the CLI `schema` command handler to display schema documentation and usage guidance.
 */

export function runSchema(): void {
  console.log(`
# YAML v2.0 Training Plan Format

## Complete Example

\`\`\`yaml
version: "2.0"

athlete:
  name: "Athlete Name"
  event: "Half Marathon"
  eventDate: "2026-05-15"
  paces:
    easy: "5:45/km"
    long: "6:00/km"
    tempo: "5:00/km"
    threshold: "4:30/km"
    r400: "1:35"           # For intervals.400()
    r800: "3:20"           # For intervals.800()
  zones:
    hr:
      lthr: 170            # Auto-calculates Z1-Z5
  unit: km                 # km or mi
  firstDayOfWeek: monday

assessment:
  foundation:
    foundationLevel: intermediate  # beginner|intermediate|advanced|elite
    yearsInSport: 2
  currentForm:
    weeklyVolume: { total: 4, run: 4 }
    consistency: 4

phases:
  - name: "Base"
    weeks: "1-4"
    focus: "Aerobic foundation"

weeks:
  - week: 1
    phase: Base
    focus: "Build consistency"
    workouts:
      Mon: tempo(20)
      Tue: rest
      Wed: easy(35)
      Thu: strides(40, 6)
      Fri: rest
      Sat: long(60)
      Sun: rest
\`\`\`

## Workout Templates

**Run** (default): easy(mins), recovery(mins), long(mins), tempo(mins),
threshold(mins), progression(mins), fartlek(mins), strides(mins, count),
intervals.400(reps), intervals.800(reps), intervals.1k(reps), hills(reps), rest

**Swim**: swim.easy(mins), swim.technique(mins), swim.aerobic(reps),
swim.threshold(reps), swim.vo2max(reps), swim.openwater(mins), swim.rest

**Bike**: bike.easy(mins), bike.endurance(mins), bike.tempo(mins),
bike.sweetspot(mins), bike.threshold(reps), bike.vo2max(reps), bike.rest

**Brick**: brick.sprint(bike_mins, run_mins), brick.olympic(bike_mins, run_mins)

**Strength**: strength.foundation(mins), strength.full(mins), strength.core(mins)

## Zone Auto-Calculation

Specify only threshold values - zones are calculated automatically:
- \`zones.hr.lthr: 170\` → HR zones derived from LTHR
- \`zones.power.ftp: 250\` → Power zones derived from FTP
- \`zones.swim.css: "1:45"\` → Swim zones derived from CSS

## Commands

\`\`\`bash
npx endurance-coach templates              # List all templates
npx endurance-coach templates show tempo   # Show template details
npx endurance-coach validate plan.yaml     # Validate plan
npx endurance-coach render plan.yaml -o plan.html  # Render to HTML
\`\`\`
`);
}