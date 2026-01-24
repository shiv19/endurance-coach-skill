## Endurance Coach – Roadmap

This roadmap is organized to make **coaching correctness and judgment** the spine of the system, with tooling and UI serving that goal—not competing with it.

---

## Phase 0: Coaching Correctness (Foundation)

### Bugs / Invariants

- **Fix incorrect training start dates**
  - Current issue: `Athlete` YAML contains `eventDate` but no explicit `trainingStartDate`.
  - Investigate and document what currently determines the training start date.
  - Make the inference rule explicit and deterministic.
  - Add regression tests covering:
    - Event-based plans
    - Non-event-based plans
    - Edge cases (late config edits, timezone boundaries)

---

## Phase 1: Workout Template System (Expression Layer)

### Epic: Workout Template Enhancements

Goal: Treat workout templates as **first-class, inspectable, and safe-to-extend artifacts**.

- **Fail fast on unknown templates**
  - CLI expander throws a clear error if an unknown template name is used.
  - Error message should:
    - List closest matching known templates
    - Suggest creating a custom template if needed

- **Custom template precedence & discovery**
  - Custom templates live in:
    - `~/.endurance-coach/workout-templates/`

  - Template resolution order:
    1. User templates
    2. Built-in templates

- **Template inspectability & ergonomics**
  - Improve `templates` CLI command to clearly explain:
    - Template `id`
    - Template source (built-in vs user)

  - Add:
    - `templates list`
    - `templates show <template-id>`

- **Template validation**
  - Add command:
    - `templates validate --template <template-id>`

  - Validation behavior:
    - Checks user templates first, then built-ins
    - Validates schema, required variables, and unsupported fields

- **Template variable hygiene**
  - Audit all template variables
  - Identify variables not consumed by the Viewer project
  - Either:
    - Wire them through properly, or
    - Deprecate them explicitly

---

## Phase 2: Reflection as Data (Core Coaching Differentiator)

### Epic: Post-Workout Interview with Agent

Goal: Turn subjective athlete feedback into **structured coaching signal**, not just notes.

- **Post-workout interview entry point**
  - User can explicitly ask the agent to conduct a post-workout interview
  - Agent behavior:
    - Sync workout automatically if Strava is enabled
    - Otherwise, naturally prompt for workout details

- **Interview flow (baseline questions)**
  - How did the workout feel overall?
  - What were the key challenges or highlights?
  - Did you stick to the planned structure?
  - How were energy, hydration, and mental focus?
  - What would you change or improve next time?

- **Data-aware questioning**
  - Agent incorporates inferred signals from workout data:
    - Pace vs plan
    - Heart rate trends
    - Duration and completion fidelity

  - Questions and follow-ups should adapt based on these signals

- **Coaching judgment (not just summarization)**
  - Persist two distinct outputs:
    1. **Athlete Reflection Summary** (what the user said)
    2. **Coach Notes** (agent’s opinionated assessment)

  - Coach Notes may:
    - Challenge perceived effort vs objective data
    - Flag fatigue, overreaching, or execution issues

- **Persistence & schema evolution**
  - Store interviews in a dedicated table
    - Foreign key → workout ID
    - Support multiple interviews per workout

  - Introduce explicit DB schema versioning
    - Forward-only, idempotent migrations
    - Backwards compatibility guaranteed

- **Optional UX support**
  - Web UI reminder when a workout is marked complete
  - Reminder should be non-blocking and skippable

- **Stretch Goal (intentionally scoped)**
  - In-app interview chat via local web server
  - CLI launches a temporary local UI for the interview
  - Uses the same agent framework and configuration
  - If complexity grows, split into a separate epic

---

## Phase 3: Intelligence Compounding (Future-Facing)

_(Not implementation-heavy yet, but directionally important)_

- Cross-workout pattern detection:
  - Repeated perception vs data mismatches
  - Accumulating fatigue signals

- Agent-generated flags:
  - “Effort trending higher than expected”
  - “Execution consistency improving / degrading”

- Use interview insights to influence future workout recommendations

---

## Phase 4: Web UI Enhancements (Amplify Insight, Not Distract)

### Epic: Web UI Enhancements

Goal: Reduce friction **only where it surfaces coaching insight**.

- **Workout navigation ergonomics**
  - Floating left/right arrows on workout card
  - Navigate to previous/next workout without returning to calendar

- **Sidebar usability**
  - Expand sidebar to view full content without scrolling

> UI work should not precede coaching intelligence. It should surface and reinforce it.

---

## Guiding Principles

- Correctness before cleverness
- Judgment before conversation
- Data + perception > either alone
- UI exists to amplify insight, not replace it
