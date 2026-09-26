# LAB interface for outcome-first research v1

Status: **interface specification only**. Do NOT import this into production LAB until a separate validated candidate is registered. Existing LAB, live prediction, 24-venue model cycles, and 100,000 JPY virtual balance remain unchanged.

## Available research artifacts
- Code: `scripts/boatracecsv-inverse-join-v1.py`, `scripts/inverse-research-batch-v1.py`, `scripts/inverse-outcome-patterns-v1.py`.
- Samples: draft PR's `Inverse outcome research v1` Action artifacts.
- Bounded automatically archived daily rows and in-sample patterns: **only** the dedicated `data/inverse-research-v1` Git branch under `research/inverse-v1/days/*.json`, `research/inverse-v1/patterns/latest.json`. The main app must never assume these exist or follow this branch at runtime.
- The analysis report is descriptive; `inSamplePayoutOnlyRoiIfBetEveryMatchingRace` is an **in-sample counterfactual observation**, not expected ROI, a forward result, an actionable signal, or a promotion metric.

## Stable data interface
Join key `raceCode` is `YYYYMMDD + venueCode(2) + raceNumber(2)`. Six original and third-party registration IDs must match before labels are accepted. Every daily document carries source URLs and SHA256 hashes. `status=ACCEPTED` means six-racer join, third-party actual trifecta and third-party payout order agree, and available existing legacy labels agree; it does **not** mean official data verification.

`race.pre.boats` card fields: provenance kept, acquisition time unknown; **diagnostic-only** until a genuine cutoff can be verified. Never ingest `節D` meet outcomes from full-day race cards in a strict historical feature. `race.pre.tkz.value`, `race.pre.stt.value`, `race.pre.sui.value` are eligible for a cutoff-safe candidate ONLY if section status is `ELIGIBLE_T_MINUS_3`; when not eligible, their `value` is null. `race.post` contains actual ordered trifecta, payout100, decision and real course/ST: label/analysis ONLY, never same-race predictive inputs.

Unknown or conflicting legacy/third-party labels are quarantined. In the research phase, provisional third-party source is accepted for investigation with later official comparison independent of development.

## Research-to-LAB promotion path (NOT wired yet)
1. Collect multiple non-overlapping past dates; require adequate support per venue and explain missingness. For now each venue must earn its own hypotheses from **all** eligible races rather than selected high payouts only.
2. Pre-register a candidate's exact venue, input fields, training cutoff, evaluation window, selection and stake policy. Build the model with history strictly BEFORE each target race.
3. Freeze target-race predictions before target results/payout are accessed. Use chronological held-out tests and subsequent live SHADOW/FORWARD (same races and purchase constraints as frozen current baseline).
4. Compare hit rate AND **per-pick stake-adjusted payout-only ROI**, variance/outlier concentration, skip frequency, and missing-data behavior. Compare realistic simulated use of pre-deadline odds only if matching dated snapshots really exist; never substitute settled payout for earlier odds.
5. Register only qualifying candidates in the existing venue-local candidate ledger. Existing early-review gates and explicit human yes/no approval remain unchanged. No candidate or purchase is activated by the scripts here.

## Integrity gates
- Never replay labels from the target date into earlier same-day target predictions.
- Do not use result rows or realized payout to **select** a target race retroactively.
- Never copy in-sample pattern report frequencies directly into a deployed predictor.
- No cross-venue weight reuse/promotion; at most use shared source parser and test harness.
- All dataset fetch, provenance report and exploratory analysis runs operate independently of the official beforeinfo archive. Official matching is supplementary rather than a full-collection wait gate.

## Efficiency / existing projects
Retain existing historical label stores and all running LAB/SHADOW/FORWARD evidence; do not duplicate third-party whole-archive outcome downloads unless they add missing decision, real-course/ST or provenance. Existing legacy specialized Gamagori, Edogawa and one-off tests are **only** cleanup candidates until their exact downstream dependencies are mapped and replacements demonstrate equivalent coverage.
