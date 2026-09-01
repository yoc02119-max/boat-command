# BOAT COMMAND v0.16.0 — BLIND AUTO PREP

Free static GitHub Pages build.

## v0.16.0

- Adds the first guarded internal automation stage: `BLIND AUTO PREP`.
- One confirmed action starts a fresh RETEST, validates the replay pack, generates only time-safe BLIND predictions, HARD LOCKs eligible races, and then **stops before result reveal**.
- Adds a critical post-lock assertion: if any result is revealed or any race is settled during AUTO PREP, the pipeline stops with `CRITICAL FAIL · RESULT GATE VIOLATION`.
- Stores an `autoPrepAudit` record with start/completion timestamps, eligible/skipped/locked counts and `resultGate: HIDDEN`.
- Existing manual pack load, generator, HARD LOCK, result settlement, RETEST/ORIGINAL separation, AI 3-layer report and refresh audit remain available.

## Intended verification

1. Open v0.16.0.
2. Go to 12R予想 and press `BLIND AUTO PREP`.
3. Confirm once.
4. Expected stop state: `RETEST · LOCKED`, `9/9 TARGET LOCK`, `3R SKIP`, results hidden, separate result-release button visible.
5. Do not reveal results until that state is visually confirmed on iPad.
