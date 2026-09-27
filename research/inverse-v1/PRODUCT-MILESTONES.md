# BOAT COMMAND — the ONLY user-facing 5/5 completion counter

Canonical scope: These are PRODUCT milestones. The five internal setup stages in
DEVELOPMENT-PLAN.md are not the same five tasks and must never be reported as 5/5
product completion.

Status when this file was authored: **0/5 complete**.
The coverage ledger below is dynamic; this text is NOT an automated success claim.

| No. | Product milestone | Objective closure evidence |
|---|---|---|
| 1 | Integrate historical cards, exhibition, motor, weather, result and payout **per race** | All 24 archived source venues visited in \`research/inverse-v1/coverage-v1.json\` on isolated data branch, unresolved non-joins individually counted, feature missingness/timing clearly distinguished, no post-result contamination. Any unverified fields must be flagged unusable for strict PRE scoring. |
| 2 | Reverse-engineer observed race developments | Across archived races, descriptive conditional frequencies for known actual order, recorded winning technique, actual entry course and start; count **all** matching races including losing contrasts; missing labels and sample uncertainty disclosed. No causal or predictive claim from in-sample associations. |
| 3 | Develop new per-venue probability models for 24 venues | Reproducible venue-isolated candidate, explicitly timestamp-qualified pre inputs, calibrated three-boat outcome distribution and development probabilities, with data-adequacy exclusions instead of invented weights; existing models untouched. |
| 4 | Research buying decisions | Freeze a pre-close (approximately T−3 min) odds observation, distinguish odds from settled payouts; out-of-sample pick/race-selection/stake/skip policies with fair same-race comparisons and ¥100 unit safeguards. Where historical odds are absent, say so and collect prospectively. |
| 5 | LAB → SHADOW → FORWARD validation | Frozen candidate predictions with chronological holdout and genuine prospective paired evaluation vs the **same races** under the existing model, safety/regression gates and owner yes/no promotion review. No research script may auto-promote or place bets. |

## Current implementation, NOT completion evidence
- Independent \`scripts/boatracecsv-inverse-join-v1.py\` and bounded data-branch backfill exist.
- \`scripts/inverse-outcome-patterns-v1.py\` produces **in-sample** exploratory conditional patterns, not validated model probabilities.
- \`scripts/inverse-research-coverage-v1.py\` gives trustworthy source-vs-archived-vs-accepted totals per venue and PRE field status. An archival scan can be complete even when fields lack trusted observation timestamps, so count those separately.
- `scripts/inverse-research-exceptions-v1.py` records each rejected race's exact code, reason and provenance without changing original snapshots; missing diagnostic details in older immutable days are explicitly marked unknown. The report must reconcile exactly with the 24-venue coverage report.
- `scripts/inverse-legacy-label-overlay-v1.py` supplies existing original outcome/payout labels **only when both vendor result and payout rows are demonstrably absent**, without rewriting the vendor day archive; provenance and unknown decision/course/ST remain explicit. Its recovered count is distinct from third-party-complete counts.
- Existing LAB/SHADOW/FORWARD programs remain operational but are NOT yet connected to this new inverse-outcome candidate.
- Closing a task requires an independently runnable artifact and verifiable evaluation output, not only a commit, CI unit tests, or an internal setup milestone.

## Safety boundary
No automatic model activation, no live prediction or production UI mutation,
no alteration of shared virtual bankroll. Official historical pre-race backfill
runs independently; full official collection or source equality is never the
prerequisite for third-party research.
