# BOAT COMMAND — Inverse-outcome research plan v1 (2026-09-26)

Status: **research-only proposal branch**; do not change production prediction inputs, UI, live scheduling, bankroll, or automatic model promotion as part of this plan.

## One authoritative objective
Learn venue-specific, pre-race **probabilities** of race developments and trifecta outcomes, starting from recorded outcomes, decisional results, and actual payouts. Select races/picks only after **out-of-sample** validation and when contemporaneous pre-close odds make expected value defensible. Do not assume that a model showing historical improvements must be profitable.

## Data authority and research boundaries
- Treat BoatraceCSV third-party historical data as the **working research source** now. Continue official beforeinfo collection independently; wait for neither full official collection nor complete third-party↔official agreement to begin research.
- Keep existing 27,094 rich-history race labels. First join existing labels and third-party pre-race, actual-result, payout files on `YYYYMMDD + venue code + race number`. Six registration numbers must match BOAT COMMAND rich-history before accepting a third-party race card. Reuse verified original outcome/payout labels whenever equivalent; do not re-fetch 27k labels blindly.
- Preserve separately: (A) candidate pre-race observations with source timestamps, (B) post-race actual results, real start/exhibited/actual entry and decision labels, (C) actual payout; never feed B or C into the target race's prediction model.
- Before-score time validity: observation `取得日時` and original deadlines must show that each observation existed by the prediction cutoff. Unknown or later timestamps => quarantine from pre-race scoring; they may still be diagnostic. Historic race-card intra-meet result columns are **not** safe pre-race predictors without individual field timing proof.
- The third-party data's factual accuracy is NOT a blocker to starting research. Preserve provenance, gaps, and conflict flags to investigate later; do not silently fill conflicts.

## Architecture and responsibilities
| System | Decision |
|---|---|
| Existing 24-venue LIVE program/result, baseline models, bankroll | KEEP/FREEZE during this research |
| Existing LAB, SHADOW, FORWARD evaluations | REUSE; new candidate is isolated until validated |
| 24-venue model cycles, optional early review | KEEP; require paired historical & forward evidence and owner yes/no before promotion |
| BoatraceCSV coverage audit | REUSE as coverage-only predecessor; implement new immutable per-race research backfill |
| Historical official beforeinfo backfill | CONTINUE independently, no full backfill wait gate |
| Edogawa specialized research, legacy Gamagori v0.x, old per-venue probes | INVENTORY before consolidating; do not stop yet or discard historical evidence |
| LINE integrations / visual redesign | DEFER new work; don't disable live consumers |

## Five execution stages
1. Freeze policy and map existing dependencies in this document on isolated branch.
2. Add reproducible **date-scoped** third-party research join: pre-race cards/preview + post-race actual result + payouts; check six-racer identity, record source timestamp and original-vs-third-party label mismatches, write immutable research-only rows and coverage summary.
3. Add inverse-outcome exploratory analyzer: classifiable outcome/decision/actual course and start events, conditional pre-observable group comparisons, and **comparison denominator** including misses. Do not claim causal race mechanics from inferred association.
4. Add manually dispatchable research-only acquisition/analysis GitHub Actions with fixture-based unit tests; keep all production workflows untouched. Backfill progressively, and enable future LAB import **only after** validating the feature freeze.
5. Verify tests and sample historical date in CI; review repository diff and workflow isolation. PR to main only after review; model deployment remains explicitly out of scope.

## Cleanup gate / candidates — not yet authorized to delete
1. Legacy Gamagori standalone SHADOW compare v0.33.4: compare capabilities with the 24-venue pipeline before consolidating.
2. Legacy Gamagori public smoke and runtime audits: retain until identical protection is shown by the current shared smoke suite.
3. Standalone second-place/candidate/point-expansion studies: standardize **evaluation reporting**, not necessarily candidate models. Do not interrupt ongoing forward evidence.
4. Legacy one-off schema/source probes: archive only after mapped to an active substitute and after confirming no downstream workflow references.
5. LINE wind source/status: already manual-only; leave in place and defer new work.
6. Historic results: reuse existing labels; fetch the third-party results/payouts only to add decision/actual-course information and verify payout semantics.

## Non-negotiable research validity
- Hypothesis discovery may inspect results/payouts. Validity evaluation must freeze predictors/configs using historical cutoff before target races; same-day later results may not leak into earlier targets.
- Classify results by actual race evidence, not confident reconstruction of unobserved moves. An absent decision/course is unknown, never guessed.
- Compare 24 venues separately. Compare hits, per-pick cost, payout-only return (label it), realized odds availability, and worst losing streak; include controls and sample sizes.
- Never automatically buy, activate TRY, change virtual ¥100,000 bookkeeping, or auto-promote from this pipeline.
