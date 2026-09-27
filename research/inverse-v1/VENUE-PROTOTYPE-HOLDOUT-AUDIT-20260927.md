# Research audit — first 24-venue chronological holdout, 2026-09-27

**Result: hypothesis not supported for deployment.** Green Actions confirms the pipeline ran, NOT that probability estimates improved. Neither this PR nor its candidate should enter current prediction/LAB without a new, independently frozen evaluation.

## Immutable provenance
- Research code PR: #125, head `8236c05dbec98801fa90feb85c79ebed1090b54d` at first run.
- CI: https://github.com/yoc02119-max/boat-command/actions/runs/36316796574 (unit tests + data-branch read + run succeeded).
- Source data-branch SHA `421993f4b3d7067a56f2151af61a8e91e2f8141a` (143 archived calendar days with SHA256 crosschecks).
- Global calendar-date train/holdout boundary `2026-08-18`; training from earlier archived dates; holdout 36 later archived calendar dates. Per-venue rows are isolated.
- 21,415 archived rows: 11,426 strict PRE-qualified training races, 4,234 strict PRE-qualified held-out races, 5,755 excluded (5,563 PRE insufficient or feature invalid; 192 valid PRE but unusable outcome labels). This candidate also skips tied exhibition leaders and malformed wind; the archival data's PRE section eligibility totals are a separate metric.
- Research comparison only: venue historical outcome prior trained on EXACTLY the same earlier races versus experimental fastest exhibition lane + wind-speed-conditioned probability. This is **not** a pairwise comparison with production predictions and uses no historical odds.

## Outcome evidence

| Venue | Holdout races | Prior top-8 hits | Conditioned top-8 hits | Prior trifecta log loss | Conditioned log loss |
|---|---:|---:|---:|---:|---:|
| 01 Kiryu | 162 | 54 | 48 | 4.289 | 4.475 |
| 02 Toda | 140 | 33 | 26 | 4.606 | 4.841 |
| 03 Edogawa | 110 | 24 | 24 | 4.553 | 4.712 |
| 04 Heiwajima | 218 | 44 | 45 | 4.604 | 4.814 |
| 05 Tamagawa | 187 | 77 | 72 | 4.165 | 4.253 |
| 06 Hamanako | 196 | 58 | 61 | 4.392 | 4.547 |
| 07 Gamagori | 196 | 67 | 56 | 4.297 | 4.521 |
| 08 Tokoname | 134 | 47 | 51 | 4.247 | 4.425 |
| 09 Tsu | 203 | 80 | 59 | 4.190 | 4.377 |
| 10 Mikuni | 172 | 63 | 47 | 4.262 | 4.489 |
| 11 Biwako | 223 | 73 | 65 | 4.322 | 4.519 |
| 12 Suminoe | 157 | 52 | 54 | 4.307 | 4.458 |
| 13 Amagasaki | 231 | 73 | 63 | 4.308 | 4.479 |
| 14 Naruto | 162 | 43 | 50 | 4.490 | 4.619 |
| 15 Marugame | 134 | 44 | 45 | 4.318 | 4.519 |
| 16 Kojima | 219 | 74 | 61 | 4.451 | 4.685 |
| 17 Miyajima | 203 | 58 | 55 | 4.356 | 4.534 |
| 18 Tokuyama | 179 | 72 | 62 | 4.246 | 4.472 |
| 19 Shimonoseki | 171 | 71 | 65 | 4.032 | 4.190 |
| 20 Wakamatsu | 217 | 81 | 82 | 4.192 | 4.412 |
| 21 Ashiya | 155 | 64 | 53 | 4.210 | 4.397 |
| 22 Fukuoka | 192 | 82 | 81 | 4.080 | 4.257 |
| 23 Karatsu | 110 | 46 | 43 | 4.065 | 4.257 |
| 24 Omura | 163 | 65 | 60 | 4.164 | 4.229 |

- Paired held-out top-eight totals: historical prior **1,445 / 4,234** vs conditional prototype **1,328 / 4,234**.
- Paired held-out top-one totals: historical prior **297 / 4,234** vs prototype **267 / 4,234**.
- Race-weighted average held-out trifecta log loss (lower is better): prior **4.298447** vs prototype **4.480411**; conditioned prototype worse in **all 24 venues** by this score.
- Candidate winner-lane Brier is lower in 17 venues at six-decimal report rounding, but that does **not** offset worse full-trifecta log loss or establish an overall improvement; independently assess lane-specific hypotheses.
- Report is descriptive for this single archived chronological boundary only. No significance/cost/odds/prospective paired evaluation or calibration is established.

## Decision and next safe tasks
1. Preserve this negative experiment as a baseline and do **not** promote or tune it against the just-inspected 36-date holdout. A green CI run is not evidence of model benefit.
2. Validate per-field missingness, preview observation timestamps, timing of race-card/motor attributes, course availability and the distinction between forecast odds and settled payouts. Complete the ongoing isolated backfill; the source target is still not fully visited.
3. Independently design/preregister new hypotheses **using older training dates and internal validation only**. If a stronger candidate appears, use *new genuinely unseen prospective dates* and immutable SHADOW/FORWARD predictions; don't call the existing inspected 2026-08-18+ holdout untouched again.
4. For a future production-model comparison, compare the same actual races with previously hard-locked production predictions; do not substitute this per-venue prior for the actual production model. Keep all existing protections, owner yes/no approval and no automatic buying.
