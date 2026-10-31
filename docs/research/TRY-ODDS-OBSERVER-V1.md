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
