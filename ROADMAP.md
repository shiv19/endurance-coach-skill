# Endurance Coach – Polished Roadmap

This roadmap makes **coaching correctness and judgment** the spine of the system.
Tooling and UI exist only to surface and reinforce that judgment.

---

# Phase 1: Reflection as Data (Core Differentiator)

### Epic: Post-Workout Interview with Agent

Goal: Convert subjective athlete feedback into **structured coaching signal**, not journaling.

---

## Entry Point

- User explicitly requests a post-workout interview
- If Strava enabled:
  - Auto-sync workout
  - Load lap-level details

- Else:
  - Prompt for workout summary (type, duration, structure)

_No reminders yet. Manual trigger only._

---

## Interview Flow

Natural, conversational, open-ended.

Baseline questions:

- How did the workout feel overall?
- What were the key challenges or highlights?
- Did you stick to the planned structure?
- How were energy, hydration, and mental focus?
- What would you change or improve next time?

Constraints:

- Target: 5–7 turns
- Hard cap: 10 turns
- If unresolved at cap → summarize and stop

---

## Data-Aware Question Triggers

Small, explicit rule set:

- HR drift > threshold → ask about fatigue / fueling
- Pace or power deviates from plan → ask about execution vs environment
- High lap variability → ask about focus or pacing strategy
- Early fade → ask about warmup or opening intensity

Rules are deterministic, not learned (initially).

---

## Coaching Judgment Output

Persist **three distinct artifacts**:

1. Athlete Reflection Summary
   - Neutral summary of what the athlete reported

2. Coach Notes
   - Opinionated assessment
   - May challenge athlete perception
   - May flag fatigue, underfueling, execution issues, or misplaced intensity

3. Coach Confidence
   - Low / Medium / High
   - Represents confidence in correctness of Coach Notes

Never merge (1) and (2).

---

## Persistence

- New table: `workout_interviews`
  - id
  - workout_id (FK)
  - athlete_reflection_summary
  - coach_notes
  - coach_confidence
  - created_at

- Support multiple interviews per workout

- Introduce explicit DB schema versioning
  - Forward-only, idempotent migrations
  - Backward compatible reads

---

## CLI Output (Initial)

After interview:

- Show Athlete Summary
- Show Coach Notes
- Show Confidence

No UI yet.

---

## Stretch Goal (Scoped)

- Local web interview UI launched from CLI
- Same agent + schemas
- If complexity grows, becomes separate epic

---

# Phase 2: Intelligence Compounding

Goal: Build **memory + trend awareness**, not automation.

---

## Primary North Star Metric

**Execution Reliability Score**

Composite of:

- Planned vs actual alignment
- Perception vs data alignment
- Completion fidelity

All future intelligence feeds this.

---

## Capabilities

- Cross-workout pattern detection:
  - Repeated perception vs data mismatches
  - Repeated under/over-execution
  - Rising effort at stable outputs

- Agent-generated flags:
  - “Effort trending higher than expected”
  - “Execution consistency improving”
  - “Possible accumulating fatigue”

- Interview insights influence future workout recommendations

No dashboards required initially.

---

# Phase 3: Public Expression Loop (Strava Write-Back)

### Epic: Coach-Authored Strava Titles & Descriptions

Goal: Turn private judgment into **public narrative**, with athlete control.

---

## Default Behavior

- Agent generates suggested title + description after interview
- User must approve before publishing
- Original Strava text preserved

---

## Tone Control

Selectable tone:

- Neutral / factual
- Coach-direct
- Reflective
- Light / minimal

Stored per user; override per workout.

---

## Copy Constraints

- No emojis
- No hashtags

Title:

- Short
- Human
- Opinionated

Description structure:

1. What happened
2. Key mismatch or confirmation
3. One coaching takeaway

---

## Iteration Loop

User may request:

- Shorter
- Less harsh
- More honest
- Focus on execution, not feeling
- Etc.

Agent revises while remaining grounded in data + interview.

---

## Publishing Modes

- off
- suggest (default)
- auto

---

## Audit & Safety

- Persist applied copy
- Timestamp
- Approval source
- One-command rollback

---

# Phase 4: Web UI Enhancements

Goal: Reduce friction **only where it surfaces coaching insight**.

---

## Workout Navigation

- Floating previous / next arrows
- No return-to-calendar required

---

## Sidebar

- Expandable to view full content

---

## Hard Rule

No new visualization unless it directly surfaces:

- Coach Notes
- Execution Reliability trend
- Pattern flag

No exploratory graphs.

---

# Guiding Principles

- Correctness before cleverness
- Judgment before conversation
- Data + perception > either alone
- UI amplifies insight, never replaces it
- Discomfort in service of improvement is acceptable

## Roadmap Suggestions

1. Pre-workout state capture - Consider adding a lightweight "how do you feel going in" signal. "Felt terrible, executed well" is a different story than "felt great, still faded." Could be as simple as a 1-5 readiness score before the workout. Informs the post-workout interpretation significantly.
2. Auto-draft Coach Notes from laps - You already have activity --laps. Before the interview starts, generate a preliminary coach assessment from the data alone. Then the interview validates, challenges, or adds context. This gives the athlete something concrete to react to rather than open-ended "how did it feel?"
3. Close the loop to plan modification - Phase 2 detects patterns and flags them. But what's the action? Consider explicitly
   connecting intelligence outputs to plan adjustment suggestions. "Accumulating fatigue detected → recommend recovery week" or
   "Execution improving → ready for intensity progression."
4. Phase 3 might be lower priority - Strava write-back is appealing but Phase 2's intelligence compounding is where the coaching value
   compounds. I'd consider swapping their order unless the public accountability loop is core to your vision.
5. Interview completion criteria - Beyond turn count, consider explicit signal: "Do I have enough to write confident Coach Notes?" If confidence would be Low after 7 turns, maybe that's fine - just surface it.
