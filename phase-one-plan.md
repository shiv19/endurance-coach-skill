# Phase 1: Reflection as Data – Implementation Plan

**Version:** 1.0
**Status:** Draft
**Last Updated:** 2026-01-31

---

## Overview

Phase 1 introduces the Post-Workout Interview capability, converting subjective athlete feedback into structured coaching signal. The agent conducts a conversational interview, informed by workout data, and produces three distinct artifacts: Athlete Reflection Summary, Coach Notes, and Coach Confidence.

**Core Principle:** Athlete meaning is first-class data. Numbers inform questions, not conclusions.

---

## Architecture Summary

| Concern                                        | Owner                                        |
| ---------------------------------------------- | -------------------------------------------- |
| Data loading, prompt construction, persistence | CLI                                          |
| Data freshness (sync)                          | CLI (automatic)                              |
| Conversational flow, judgment, synthesis       | Agent                                        |
| Trigger configuration                          | Collaborative (agent proposes, user refines) |

The CLI remains stateless and pure. The agent orchestrates the interview experience.

---

## Design Principle: Transparent Auto-Sync

**Goal:** Agent never needs to think about sync. CLI ensures data freshness automatically.

**Pattern:**
Any CLI command that reads activity data should:

1. Check date of most recent activity in local DB
2. If stale (latest activity date < today) AND Strava configured:
   - Calculate sync window (today - latest date, capped at 30 days)
   - Run sync internally (silent unless verbose mode)
   - Handle failure gracefully (return cached data + warning)
3. Proceed with command execution using fresh data

**Commands affected:**
| Command | Auto-sync | Rationale |
|---------|-----------|-----------|
| `interview --list` | Yes | Must show recent workouts |
| `interview --latest` | Yes | Must return actual latest |
| `interview <id>` | No | Specific workout already exists |
| `interview --manual` | No | No Strava data needed |
| `stats` | Yes | Should reflect recent training |
| `training-load` | Yes | Must include recent activities |
| `foundation` | No | Historical analysis, not time-sensitive |

**Implementation:**

- Create shared `ensureFreshData()` utility in `src/lib/sync.ts`
- Returns `{ synced: boolean, syncedCount: number, warning?: string }`
- Commands call this before querying activity data
- Sync status included in command output for transparency

**Token efficiency:**

- Agent issues single command, gets fresh data
- No sync orchestration needed
- No "did you sync?" back-and-forth

**Resilience:**

- Network failure → cached data + warning (not hard failure)
- Strava not configured → skip silently, proceed with available data
- Rate limited → respect retry-after, return cached + warning

---

## Prerequisites

### ~~P0. Transparent Auto-Sync Utility~~ ✅ **COMPLETED**

**Summary:** Created `ensureFreshData()` utility in `src/lib/freshness.ts` that automatically syncs Strava activities when local data is stale.

**Implementation:**

- Checks Strava config status, queries latest activity date
- Returns `{ synced, reason, syncedCount, warning, cached }`
- Supports `--verbose` (show sync activity) and `--no-sync` (bypass for testing)
- Sync window capped at 30 days
- Integrated into `stats` and `training-load` commands
- Comprehensive test coverage (14 tests)
- Refactored `syncActivities()` for reuse

**Acceptance:** Any command can call `ensureFreshData()` and trust that local DB has latest available data. Auto-sync is transparent and resilient (graceful failure with cached data + warning).

---

### P1. Schema Versioning Infrastructure

**Goal:** Establish forward-only, idempotent migration system before adding new tables.

**Tasks:**

1. Create `schema_migrations` table with columns: `id`, `name`, `applied_at`
2. Implement migration runner that:
   - Reads migration files from a `migrations/` directory
   - Tracks applied migrations in `schema_migrations`
   - Applies pending migrations in order
   - Is idempotent (safe to run multiple times)
3. Refactor `initDatabase()` to call migration runner instead of executing raw `schema.sql`
4. Convert existing schema.sql into initial migration (migration 001)

**Acceptance:** Running `initDatabase()` on fresh DB applies all migrations. Running on existing DB applies only pending migrations.

**Future-proofing:** Phase 2 will add columns for pattern detection. Migration system must handle ALTER TABLE gracefully.

---

### P2. Interview Data Model

**Goal:** Add persistence layer for interview artifacts.

**Tasks:**

1. Create migration for `workout_interviews` table:
   - `id` (PK, autoincrement)
   - `workout_id` (FK to activities)
   - `athlete_reflection_summary` (TEXT)
   - `coach_notes` (TEXT)
   - `coach_confidence` (TEXT, constrained to Low/Medium/High)
   - `created_at` (timestamp, default now)
2. Create migration for `preliminary_coach_notes` table:
   - `id` (PK)
   - `workout_id` (FK)
   - `note_draft` (TEXT) – intentionally named "draft" to distinguish from final `coach_notes`
   - `created_at`
3. Create migration for `interview_triggers` table:
   - `id` (PK)
   - `trigger_type` (e.g., 'hr_drift', 'pace_deviation', 'lap_variability', 'early_fade')
   - `threshold_value` (REAL)
   - `threshold_unit` (TEXT, e.g., 'percent', 'bpm', 'seconds')
   - `enabled` (BOOLEAN)
   - `created_at`
   - `updated_at`

**Acceptance:** Tables exist after migration. Foreign keys enforce referential integrity. Multiple interviews per workout supported.

**Future-proofing:** Phase 2 needs to query across interviews for pattern detection. Ensure indexes on `workout_id` and `created_at`.

---

## Core Implementation

### C1. Interview CLI Command – Prompt Generation

**Goal:** CLI command that loads workout context and returns structured interview prompt.

**Command signatures:**

```
npx endurance-coach interview --latest [--laps] [--json]
npx endurance-coach interview --list [--days=7] [--json]
npx endurance-coach interview <workout_id> [--laps] [--json]
npx endurance-coach interview --manual [--json]
```

**Tiered context loading (token optimization):**

By default, interview prompt returns summary context (metadata, fired triggers, interview history). Lap data is optional via `--laps` flag.

| Flag      | What's included                              | Use case                     |
| --------- | -------------------------------------------- | ---------------------------- |
| (default) | Metadata, triggers, history, interview count | Easy runs, recovery sessions |
| `--laps`  | Above + full lap-level data                  | Workouts, intervals, races   |

Agent decides whether lap data is needed based on workout type. Easy run? Skip laps. Track workout? Include laps.

**Auto-sync behavior (Strava-enabled):**

The CLI automatically ensures data freshness. When `--list` or `--latest` is invoked:

1. Check date of most recent activity in local DB
2. If latest activity date < today → sync the diff (today minus latest date)
3. Return up-to-date results

This removes sync orchestration from the agent entirely. Token-efficient by design.

**Workflow (Strava-enabled):**

1. Agent runs `npx endurance-coach interview --list` (auto-syncs if stale)
2. Agent presents options to user: "Which workout would you like to review?"
3. Agent runs `npx endurance-coach interview <selected_id>` to get full context

**Three modes:**

**Mode A: Auto-select latest (`--latest` flag)**

- Selects most recent activity from local DB
- Fetches laps from Strava API
- Full data-aware interview
- Convenience shortcut when user says "let's review my last workout"

**Mode B: List recent activities (`--list` flag)**

- Returns list of recent activities (default last 7 days)
- Includes: id, date, type, name, duration, distance
- Agent uses this to present options to user

**Mode C: Specific workout (workout_id provided)**

- Fetch activity from local DB
- Fetch laps from Strava API
- Full data-aware interview

**Mode D: Manual entry (`--manual` flag)**

- No workout data available
- Returns interview prompt that guides agent to capture workout details conversationally
- Agent must first establish: type, duration, structure, and subjective experience

**Tasks:**

1. Define `InterviewArgs` type in `args.ts` following existing discriminated union pattern
   - Support mutually exclusive flags: `--latest`, `--list`, `--manual`, or positional `<workout_id>`
2. Add argument parsing for `interview` command (all modes)
3. Create `src/cli/commands/interview.ts` with handler function
4. Implement auto-sync logic (shared by `--list` and `--latest`):
   - Query date of most recent activity in local DB
   - If no activities or latest date < today:
     - Calculate days to sync (today - latest date, or default 7 if empty)
     - Call existing sync logic internally
     - Handle sync failure gracefully (return cached data with warning)
   - Skip auto-sync if Strava not configured (proceed to manual flow prompt)
5. Implement `--list` mode:
   - Run auto-sync check first
   - Query recent activities from local DB (default 7 days, configurable via `--days`)
   - Return array of activity summaries: id, date, type, name, duration, distance
   - Agent uses this to present selection to user
6. Implement `--latest` mode:
   - Run auto-sync check first
   - Query most recent activity from local DB
   - Proceed to full interview prompt generation
7. Implement data loading (specific workout_id or --latest):
   - Fetch activity from local DB
   - If `--laps` flag: fetch laps from Strava API
   - Load previous interview summaries for this workout (most recent first, limit 3, summaries only – not full coach_notes)
   - Load configured triggers
   - Count total interviews for this athlete (include in output, no separate command needed)
8. Implement `--manual` mode prompt:
   - Return prompt template for conversational workout capture
   - Include questions for: workout type, duration, structure, perceived effort
   - No trigger evaluation (no data yet)
9. Construct structured output containing:
   - Mode indicator (strava | manual | list)
   - Workout metadata (if applicable)
   - Lap-level metrics (only if `--laps` flag provided)
   - Active triggers with current values and threshold status (Strava modes only)
   - `athlete_interview_count` (total interviews for this athlete)
   - `preliminary_note_eligible` (boolean: true if count >= 5)
   - Previous interview summaries for this workout (if any)
   - Sync status (synced | cached | manual) for transparency
10. Return as JSON (default) or formatted text

**Token optimization note:** Interview count is always included in output. Agent never needs a separate query to check eligibility for preliminary note generation.

**Acceptance:** Command supports full agent-orchestrated workflow. User never needs to know workout IDs. No conversational state stored in CLI.

**Design constraint:** Output must be deterministic given same inputs. Agent can regenerate prompt if needed.

---

### C2. Interview Persistence Commands

**Goal:** CLI commands for persisting interview artifacts after agent completes interview.

**Commands:**

```
npx endurance-coach interview-save <workout_id> --reflection=<text> --notes=<text> --confidence=<Low|Medium|High>
npx endurance-coach preliminary-note-save <workout_id> --note=<text>
```

**Tasks:**

1. Define `InterviewSaveArgs` and `PreliminaryNoteSaveArgs` types
2. Add argument parsing for both commands
3. Implement `saveInterview()` function:
   - Validates inputs (confidence must be Low/Medium/High)
   - Inserts new row into `workout_interviews`
   - Returns created interview ID
4. Implement `savePreliminaryNote()` function:
   - Inserts into `preliminary_coach_notes`
   - One preliminary note per workout (upsert behavior)

**Acceptance:** Agent can persist structured artifacts via CLI. Each call creates audit trail with timestamp.

**Future-proofing:** Phase 3 (Strava write-back) will need to retrieve these artifacts. Ensure query functions exist.

---

### C2b. Manual Activity Recording Command

**Goal:** CLI command for persisting workout details captured conversationally (non-Strava users).

**Command signature:**

```
npx endurance-coach activity-record --type=<type> --duration=<minutes> [--distance=<km>] [--structure=<text>] [--notes=<text>]
```

**Tasks:**

1. Define `ActivityRecordArgs` type
2. Add argument parsing for `activity-record` command
3. Implement `recordManualActivity()` function:
   - Creates minimal activity record in `activities` table
   - Sets `source` field to 'manual' (vs 'strava')
   - Generates synthetic activity ID (negative integers or UUID to avoid Strava ID collision)
   - Stores structure description in `raw_json` for reference
4. Return created activity ID for use in subsequent `interview-save` call

**Acceptance:** Non-Strava users can persist workout records. Manual activities are distinguishable from Strava-synced.

**Schema consideration:** Add `source` column to activities table (default 'strava' for backward compatibility).

---

### C3. Trigger Configuration Commands

**Goal:** CLI commands for managing data-aware question triggers.

**Commands:**

```
npx endurance-coach triggers list
npx endurance-coach triggers set <type> --threshold=<value> --unit=<unit> [--enabled]
npx endurance-coach triggers disable <type>
```

**Tasks:**

1. Define `TriggersArgs` type with subcommands
2. Implement `listTriggers()` – returns all configured triggers with current state
3. Implement `setTrigger()` – upserts trigger configuration
4. Implement `disableTrigger()` – sets enabled=false
5. Seed default triggers on first run (disabled by default):
   - `hr_drift`: threshold 10, unit percent
   - `pace_deviation`: threshold 15, unit percent
   - `lap_variability`: threshold 20, unit percent
   - `early_fade`: threshold 10, unit percent

**Acceptance:** Agent can propose triggers, user can refine via agent, agent persists via CLI.

**Design note:** Thresholds are intentionally simple percentages initially. Avoid premature complexity around athlete-specific baselines.

**Philosophy note:** Defaults are seeded disabled and never fire unless explicitly enabled via trigger negotiation. They exist only to give the agent something concrete to propose during the configuration conversation.

---

### C4. Trigger Evaluation Logic

**Goal:** Given workout data, determine which triggers fire.

**Important constraint:** The system does NOT track planned workouts in coach.db. Plan files (YAML/HTML) exist but reading them is token-expensive. Therefore:

- `pace_deviation` trigger compares **within-workout variance**, not actual vs planned
- If athlete states an intention during interview ("I was aiming for 5:00/km"), agent may manually assess deviation
- Triggers operate purely on observed data patterns

**Tasks:**

1. Create `src/lib/triggers.ts` module
2. Implement evaluation functions for each trigger type:
   - `evaluateHRDrift(laps)` – compares first-half avg HR to second-half
   - `evaluatePaceDeviation(laps)` – measures variance from athlete's average pace across workout (NOT from plan)
   - `evaluateLapVariability(laps)` – coefficient of variation across laps
   - `evaluateEarlyFade(laps)` – compares first 25% pace/power to last 25%
3. Create `evaluateAllTriggers(laps, triggers)` function:
   - Runs each enabled trigger
   - Returns array of fired triggers with context (actual value, threshold, percentage over)
4. Integrate into interview prompt generation (C1, Mode A only)

**Acceptance:** Interview prompt includes list of fired triggers with explanatory context. Agent uses this to shape follow-up questions.

**Design constraint:** Evaluation is deterministic. No ML or heuristics initially.

**Trigger firing rules:**

- Triggers only fire for Strava-synced workouts with lap data
- If `--laps` flag not present, triggers are skipped entirely (no lap data to evaluate)
- Manual mode interviews never have trigger evaluation

---

### C5. Interview Query Commands

**Goal:** CLI commands for retrieving interview history.

**Commands:**

```
npx endurance-coach interviews list [--workout=<id>] [--limit=10]
npx endurance-coach interviews get <interview_id>
```

**Tasks:**

1. Implement `listInterviews()` – returns summary of past interviews
2. Implement `getInterview()` – returns full interview by ID

**Note:** `interview-count` command removed. Interview count is now included in every interview prompt output (see C1), eliminating the need for a separate query.

**Acceptance:** Agent can reference past interviews when needed.

**Future-proofing:** Phase 2 pattern detection will query across all interviews. Ensure these queries are efficient.

---

## Skill Integration

### S1. Update SKILL.md with Interview Workflow

**Goal:** Teach agent how to conduct post-workout interviews.

**Tasks:**

1. Add "Post-Workout Interview" section to SKILL.md
2. Document entry point: athlete explicitly requests interview
3. Document Strava-enabled flow:
   - Run `npx endurance-coach interview --list` to get recent workouts (auto-syncs if stale)
   - Present options to athlete: "Which workout would you like to review?"
   - Run `npx endurance-coach interview <selected_id>` to get context
   - Alternative: `npx endurance-coach interview --latest` for "my last workout" (also auto-syncs)
   - Note: Agent does NOT need to call `sync` explicitly - CLI handles freshness automatically
4. Document tiered context loading (token optimization):
   - Default: metadata + triggers + history (sufficient for easy runs, recovery)
   - With `--laps`: adds full lap data (use for workouts, intervals, races, tempo runs)
   - Rule: If workout type suggests structured effort, include `--laps`
5. Document non-Strava flow:
   - Run `npx endurance-coach interview --manual` to get conversational capture prompt
   - Establish workout details through conversation first
   - Run `npx endurance-coach activity-record` to persist minimal activity
   - Then proceed to interview persistence
6. Document interview flow:
   - Conduct 5-7 turn conversational interview
   - Hard cap at 10 turns
   - If unresolved at cap, summarize and stop
7. Document baseline questions (from roadmap)
8. Document data-aware trigger interpretation (Strava mode only)
9. Document artifact generation:
   - Athlete Reflection Summary: neutral, what athlete reported
   - Coach Notes: opinionated, may challenge perception
   - Coach Confidence: Low/Medium/High based on signal quality
10. Document persistence: call `interview-save` command

**Acceptance:** Agent can conduct complete interview workflow for both Strava and non-Strava users.

---

### S2. Document Trigger Negotiation Flow

**Goal:** Teach agent how to collaboratively configure triggers.

**Tasks:**

1. Add "Trigger Configuration" section to SKILL.md
2. Document flow:
   - Agent proposes candidate triggers based on observed patterns
   - Agent explains each trigger concept
   - User and agent discuss/refine thresholds
   - Agent persists agreed triggers via `triggers set` command
3. Document when to revisit triggers (after significant changes in training)

**Acceptance:** Agent can guide user through trigger setup conversation.

---

### S3. Document Conditional Preliminary Note Behavior

**Goal:** Teach agent the interview count threshold logic.

**Tasks:**

1. Add rule to SKILL.md: "Generate preliminary coach note only when interview_count ≥ 5"
2. Document that preliminary note is:
   - Generated silently (not shown to athlete)
   - Used only to shape question emphasis
   - Stored separately via `preliminary-note-save` command
3. Document example of shaped question vs. premature conclusion

**Acceptance:** Agent follows conditional logic correctly. Athlete never sees preliminary note directly.

---

## Testing Strategy

### T1. Unit Tests – Trigger Evaluation

**Tasks:**

1. Test `evaluateHRDrift()` with various lap data scenarios
2. Test `evaluatePaceDeviation()` with and without planned pace
3. Test `evaluateLapVariability()` edge cases (1 lap, identical laps)
4. Test `evaluateEarlyFade()` with progressive and regressive pacing
5. Test `evaluateAllTriggers()` with mixed enabled/disabled triggers

**Acceptance:** All trigger functions have >90% branch coverage.

---

### T2. Integration Tests – Interview Flow

**Tasks:**

1. Test auto-sync triggers when latest activity date < today
2. Test auto-sync skipped when latest activity date = today
3. Test auto-sync failure returns cached data with warning (not hard failure)
4. Test `interview --list` returns recent activities with expected fields
5. Test `interview --latest` returns context without lap data by default
6. Test `interview --latest --laps` includes lap data
7. Test `interview <id>` returns context without lap data by default
8. Test `interview <id> --laps` includes lap data (mock Strava API)
9. Test `interview --manual` returns conversational capture prompt
10. Test `activity-record` creates manual activity with synthetic ID
11. Test `interview-save` persists to database correctly
12. Test `interviews list` returns saved interviews
13. Test multiple interviews per workout creates separate rows
14. Test `athlete_interview_count` and `preliminary_note_eligible` included in output
15. Test schema migrations apply cleanly to fresh database
16. Test schema migrations are idempotent

**Acceptance:** Full interview lifecycle works end-to-end via CLI for both Strava and manual modes. Auto-sync is transparent and resilient.

---

### T3. Migration Tests

**Tasks:**

1. Test fresh database gets all tables
2. Test existing database (pre-versioning) migrates cleanly
3. Test migration runner skips already-applied migrations
4. Test migration with invalid SQL fails gracefully

**Acceptance:** No data loss during migration. Clear error messages on failure.

---

### T4. Auto-Sync Utility Tests

**Tasks:**

1. Test `ensureFreshData()` returns `fresh` when latest activity is today
2. Test `ensureFreshData()` triggers sync when latest activity is yesterday
3. Test sync window calculation is capped at 30 days
4. Test graceful failure returns cached data + warning
5. Test `--no-sync` flag bypasses auto-sync
6. Test returns `not_configured` when no Strava tokens
7. Test integration with existing `stats` command as validation

**Acceptance:** Auto-sync utility is robust, tested, and ready for use by any command.

---

## Rollout Considerations

### R1. Backward Compatibility

- Existing databases must continue working
- First migration must detect pre-existing schema and mark as applied
- No breaking changes to existing CLI commands

### R2. Documentation

- Update README with interview feature overview
- Add CHANGELOG entry for Phase 1
- Consider brief "Interview Guide" in reference docs

### R3. Manual Testing Checklist

Before release:

- [ ] Fresh install works (no prior database)
- [ ] Upgrade from 1.3.0 works (existing database)
- [ ] `interview --list` auto-syncs when data is stale
- [ ] `interview --list` skips sync when data is fresh (today's activity exists)
- [ ] `interview --list` handles sync failure gracefully (returns cached + warning)
- [ ] `interview --latest` auto-syncs and selects most recent activity
- [ ] `interview <id>` works with specific workout ID (no auto-sync needed)
- [ ] Interview with Strava-synced workout includes lap data and triggers
- [ ] `interview --manual` returns conversational capture prompt
- [ ] `activity-record` persists manual activity
- [ ] Interview without Strava (manual entry) works end-to-end
- [ ] Multiple interviews same workout works
- [ ] Trigger configuration persists across sessions

---

## Future-Proofing Notes

**Lap Data Calculations (Future Enhancement):**
Consider adding computed summaries alongside raw lap data:

- HR trend (rising/stable/falling)
- Pace coefficient of variation
- Fade detection (first-half vs second-half)
- Fastest/slowest lap identification

This would give the agent signal without needing to compute from raw data, further reducing token load. Defer until lap analysis patterns stabilize.

---

**For Phase 2 (Intelligence Compounding):**

- Interview artifacts must be queryable across workouts
- Consider adding `workout_date` denormalized column for efficient time-range queries
- Preliminary notes become input for cross-workout pattern detection
- Execution Reliability Score will aggregate interview data

**For Phase 3 (Strava Write-Back):**

- Coach Notes become source for Strava descriptions
- Consider adding `published_to_strava` flag to interviews
- Preserve original interview text even after Strava edit

**For Phase 4 (Web UI):**

- Interview prompt generation (C1) should be extractable as library function
- Consider JSON schema for interview prompt to enable UI consumption

---

## Task Summary

| ID  | Task                                                  | Depends On      | Effort |
| --- | ----------------------------------------------------- | --------------- | ------ |
| P0  | Transparent auto-sync utility                         | -               | Small  |
| P1  | Schema versioning infrastructure                      | -               | Medium |
| P2  | Interview data model (migrations)                     | P1              | Small  |
| C1  | Interview CLI command – prompt generation (all modes) | P0, P2          | Medium |
| C2  | Interview persistence commands                        | P2              | Small  |
| C2b | Manual activity recording command                     | P2              | Small  |
| C3  | Trigger configuration commands                        | P2              | Small  |
| C4  | Trigger evaluation logic                              | -               | Medium |
| C5  | Interview query commands                              | P2              | Small  |
| S1  | Update SKILL.md – interview workflow (both flows)     | C1, C2, C2b     | Medium |
| S2  | Document trigger negotiation flow                     | C3              | Small  |
| S3  | Document conditional preliminary note                 | C5              | Small  |
| T1  | Unit tests – trigger evaluation                       | C4              | Small  |
| T2  | Integration tests – interview flow (both modes)       | C1, C2, C2b, C5 | Medium |
| T3  | Migration tests                                       | P1              | Small  |
| T4  | Auto-sync utility tests                               | P0              | Small  |

**Recommended execution order:**

1. P0 + P1 (can parallelize – independent foundations)
2. P2 (depends on P1)
3. C4 (can parallelize with P1/P2)
4. C1 → C2 → C2b → C3 → C5 (CLI commands, C1 needs P0)
5. S1 → S2 → S3 (skill docs)
6. T1 → T2 → T3 → T4 (testing)

---

## Backlog (Deferred from Phase 1)

- **Structured pre-workout capture:** Readiness score, sleep, soreness inputs. Defer until interview patterns stabilize.
- **Interview type taxonomy:** Quick check vs deep dive. Defer until usage patterns emerge.
- **Local web interview UI:** Stretch goal. Same agent + schemas, but adds significant complexity.

---

## Definition of Done

Phase 1 is complete when:

1. Athlete can request post-workout interview via agent
2. **Strava users:** Agent syncs, lists workouts, athlete selects, interview proceeds with lap data
3. **Non-Strava users:** Agent captures workout details conversationally, records minimal activity, interview proceeds
4. Agent conducts 5-10 turn conversational interview
5. Data-aware triggers shape follow-up questions (Strava mode only)
6. Three artifacts persisted: Reflection Summary, Coach Notes, Confidence
7. Multiple interviews per workout supported
8. Triggers configurable via agent-guided conversation
9. All tests passing
10. Documentation updated (SKILL.md covers both flows)
