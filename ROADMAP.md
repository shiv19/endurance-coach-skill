## Endurance Coach – Polished Roadmap

This roadmap is organized to make **coaching correctness and judgment** the spine of the system, with tooling and UI serving that goal—not competing with it.

---

## Phase 1: Reflection as Data (Core Coaching Differentiator)

### Epic: Post-Workout Interview with Agent

Goal: Turn subjective athlete feedback into **structured coaching signal**, not just notes.

- **Post-workout interview entry point**
  - User can explicitly ask the agent to conduct a post-workout interview
  - Agent behavior:
    - Sync workout automatically if Strava is enabled, and gets the Lap Details
    - Otherwise, naturally prompt for workout details

- **Interview flow using natural back and forth, open ended (baseline questions)**
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

## Phase 2: Intelligence Compounding (Future-Facing)

_(Not implementation-heavy yet, but directionally important)_

- Cross-workout pattern detection:
  - Repeated perception vs data mismatches
  - Accumulating fatigue signals

- Agent-generated flags:
  - “Effort trending higher than expected”
  - “Execution consistency improving / degrading”

- Use interview insights to influence future workout recommendations

---

## Phase 3: Public Expression Loop (Strava Write-Back)

### Epic: Coach-Authored Strava Titles & Descriptions

Goal: Close the loop between **experience → reflection → coaching judgment → public expression**.

This phase turns private insight into a visible artifact, while preserving athlete voice and trust.

- **Strava write-back as a suggestion, not automation (by default)**
  - Agent generates a _suggested_ Strava title and description after the post-workout interview.
  - User explicitly approves before anything is published.
  - Original Strava title/description are preserved for rollback.

- **Tone-aware generation**
  - User can select or customize tone, for example:
    - Neutral / factual
    - Coach-direct
    - Reflective
    - Light / minimal

  - Tone preference is stored per user and can be overridden per workout.

- **Iterative refinement loop**
  - User can ask for revisions:
    - “Make it shorter”
    - “Less harsh”
    - “More honest”
    - “Focus on execution, not feeling”

  - Agent revises copy while preserving factual grounding in workout + interview data.

- **Copy structure constraints (to avoid AI voice leakage)**
  - Title: short, human, opinionated
  - Description:
    1. What happened
    2. Key mismatch or confirmation
    3. One coaching takeaway

- **Publishing controls**
  - Configurable modes:
    - `off` – no Strava write-back
    - `suggest` – generate and ask for approval (default)
    - `auto` – publish automatically after interview

- **Audit & safety**
  - Persist applied copy, timestamps, and approval source
  - Allow one-command rollback to original Strava text

This phase is intentionally opinionated: the coach must _commit to a perspective_, but the athlete retains final authority.

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

---

## Guiding Principles

- Correctness before cleverness
- Judgment before conversation
- Data + perception > either alone
- UI exists to amplify insight, not replace it
