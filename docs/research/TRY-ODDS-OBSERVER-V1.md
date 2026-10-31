# TRY odds observation — V1, 2026-11-01 JST

Owner authorized development in the current BOAT COMMAND conversation after the Oct 31 assessment. This authorizes this isolated odds observation work, not the entire old paused backlog. Baseline main before implementation: 1a000753ab816ba0472ad6f5ab6139b21b7831aa.

## Hypothesis and provenance

Hypothesis ID: TRY-EV-OBSERVATION-001. The Oct 31 assessment found the saved TRY selector orders relative within-venue pick coverage without odds. The owner asked how to improve the app and then permitted changes. This is the prospective reason for investigating price-aware selection. No observed profitable odds threshold motivated this choice; no threshold search or demonstrated profitability is claimed.

The first stage records timestamped odds with the exact frozen base-four prediction. It does NOT implement a calibrated EV selector, alter TRY allocation, or promote a model. Current model probabilities are uncalibrated. The diagnostic `sum(p_i * decimal_odds_i) / 4` is an equal-stake expected gross return estimate under those probabilities; it is not a profit forecast, payout, observed ROI, or BUY signal. Every record remains SKIP with promotionEligible=false.

## Fixed observation contract

- All 24 configured venues remain separate; 12 race statuses per venue per run. Missing prediction is MISSING_PRE_RACE_INPUT, never inferred non開催. Schedule is every five minutes during 09:00–22:59 JST; GitHub scheduling delays are possible.
- Reads only the current JST date's immutable PROGRAM_ONLY PRE predictions and adapter configuration. The exact prediction bytes and SHA256 accompany successful/parse-failed HTTP responses. No POST file, ledger or selection is read.
- Fetch only official odds3t URLs. Redirects fail before a second HTTP request. Both request start and response completion must be 180–480 seconds before the PRE deadline. This is an observation window, NOT a claim of exact three-minute capture. Up to 12 requests/run, ordered by deadline then venue/race; capacity skips remain recorded. No synthetic or retrospective live observations.
- Require current-menu source identity, all 120 unique valid trifecta orders, positive numeric odds; reject final/closing-price label, missing grid, cancellation tokens, unexpected structure, late completion or contaminated/future prediction. Fetch time is recorded; upstream quote freshness is not established by fetch time.
- Persist raw HTML, immutable prediction copy, source URL, hashes, request/receipt time and all 288 statuses in a unique GitHub Actions artifact per attempt, retained 90 days. These are not permanent research archives; export before expiry is required before any later study relies on them. Each collection attempt is distinct, never overwrites another. Failed HTTP retrieval is recorded as failure, never successful coverage.
- Artifact-only output, enforced outside repo. Workflow contents permission is read-only. Existing workflows, predictions, PRE/POST, shared capital, approvals and HARD LOCK remain untouched. Recovery: disable/revert only this workflow and its two new scripts; keep collected evidence.

## Validation and next stages

Tests cover 120-order mapping, malformed/cancelled grids, 24-venue reporting, wrong page identity, closing odds, late responses, future/result-tainted predictions, missing inputs and bytewise protection of every fixture file including deliberately unreadable POST. A real official Oct 31 Hamanako 12R page yielded 120 parsed prices (1-2-3 14.1; 1-2-4 7.3). That historical page is parser QA only and is rejected for live use by its closing-price label. An official Nov 1 Kiryu 1R request returned HTTP 200 with "データがありません。"; HTTP 200 alone is not collection success.

Next: verify workflow artifact contents and actual PRE-window capture; audit quote freshness, missed windows and per-venue completeness. Then pre-register a chronological per-venue calibration/training window, untouched evaluation window, sample sufficiency criteria, same-budget/current-TRY comparator, skip accounting, drawdown/outlier checks and explicit adoption/rejection criteria BEFORE studying outcome performance. None of those choices is fixed or validated by this observation release; promotion remains prohibited. Early-day HARD LOCK candidate-readiness audit is still a separate outstanding task; no existing lock is changed.

## Verified handoff — 2026-11-01 00:49 JST

- PR #135 merged as bd2f9dbe0103f8fb33f66c0635a86fd79bb47006; current implementation f3416475d0ca9e926a29580df5252a598d3dcfb1. Follow-up accepts missing optional slug in existing Toda/Edogawa schemas while still rejecting a supplied wrong slug and validating venue code, date and race.
- PR test run 41216391576 SUCCESS. Main run 41216541337 SUCCESS after follow-up. Downloaded and inspected artifact 13048875820: 24 venues, 288 statuses, 264 MISSING_PREDICTION and 24 OUTSIDE_CAPTURE_WINDOW; zero requests and zero odds captured. At this midnight snapshot only Toda/Edogawa current-day PRE files existed. This is not a 24-venue collector failure count and not proof of any venue's non開催 status.
- Initial main run 41216429456 exposed 24 false INVALID_PREDICTION classifications due to optional slug; fixed with missing-slug/wrong-slug regression cases. No operational data changed.
- Added files only: new workflow, collector, tests, this protocol. Existing workflows and operational files have zero changes in this implementation. No UI change and no profitability claim.
- New schedule installed: five-minute GitHub schedule, 09:00–22:59 JST. Future schedule invocation and real deadline-window odds capture remain UNVERIFIED. Artifact retention is 90 days, not permanent storage.
- Next task: inspect the first scheduled daytime artifacts for exact source identity, request/receipt margin and parsed odds; audit capture gaps. Do not label deployment success as successful odds acquisition. Then design and pre-register calibration and fair current-selector comparison as described above. No auto-promotion or new live selector exists.
- Independent old failure observed before merge: Toda readiness 41216270906 failed; subsequent run 41216301399 succeeded. Not diagnosed or altered here. Do not describe the repository as universally green.
- Resume from GitHub main and this protocol; recheck latest HEAD before writes. Recovery removes only new observation code/workflow. Preserve all historical TRY, PRE, POST, capital and approvals.

Evidence: https://github.com/yoc02119-max/boat-command/pull/135 and https://github.com/yoc02119-max/boat-command/actions/runs/41216541337 .
