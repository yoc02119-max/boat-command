# BOAT COMMAND — 24-venue as-of provenance findings (2026-09-27)

**Research evidence, NOT model approval.** The production predictor, HARD LOCK, bankroll, LAB, SHADOW, FORWARD, 24 independent model cycles, UI and existing history were not changed.

## Reproducibility / exact evidence
- Draft PR: https://github.com/yoc02119-max/boat-command/pull/126
- Successful full 296-case GitHub Actions run: https://github.com/yoc02119-max/boat-command/actions/runs/36317862411
- Its archived read-only data-branch SHA: `421993f4b3d7067a56f2151af61a8e91e2f8141a` (`data/inverse-research-v1`). The as-of Git evidence job's source checkout HEAD was GitHub's PR merge ref `99a88f318aef5b0c59493a7cdd086a7e4321dd24`, not an extra main or production commit.
- New verification: 7 offline provenance tests + 6 offline immutable Git / GitHub server-time tests passed; both run jobs succeeded. A separate existing inverse research contract also passed on the PR head.
- Program provenance uses both exact earlier Git blobs **and** GitHub-hosted `workflow_run.created_at` no later than T−3 for **both** exact commit SHAs; the independent GitHub time must also be later than the records' self-reported acquisition timestamps. Six racer IDs, cutoff, result-free source and all overlapping program fields must agree. Same-race actual results and paid outcomes were NEVER read by the proof scripts.

## Exact baseline audit totals (all 24 venues)
- LIVE stored program race rows inspected: **1,332**. Of these, **1,034** currently lack a corresponding PRE-rich capture; **212** have a current program file timestamp **later** than its corresponding PRE-rich record; **84** have relatively compatible timestamps but were initially NOT immutable-hosting-proven; **2** have inconsistent program/PRE deadline metadata. Later program versions are a recoverable **history problem**, not proof of leaked predictions.
- The two deadline mismatches are **Tokoname 2026-09-26 2R** (current program 11:06; PRE-rich 11:05) and **Tokoname 2026-09-26 6R** (program 12:59; PRE-rich 13:00). Both stay quarantined until an original matching as-of source is verified; a one-minute difference can change T−3 eligibility.
- Archived official historical beforeinfo: **8,869** retrieved pages, **7,667** with all three exhibition/ST/weather sections parsed; **all 8,869** lack immutable contemporaneous target-cutoff capture proof. Complete retrospective values are diagnostic only.
- Pinned third-party inverse data archive: **21,415** visited target races; **21,068** have a joined but time-UNVERIFIED full-day vendor card and **347** had no joined card. **18,722** accepted label races have all three vendor PRE preview section timestamps meeting the recorded T−3 test (vendor provenance, not independently authenticated official HTTP source time). Full-day vendor race-card fields remain disallowed for strict historical PRE scoring.

## Exact complete GitHub-as-of evidence over all 296 PRE-rich candidates

The follow-up checked **all 296** existing PRE-rich/current-program pairs that were either timestamp-compatible (84) or had a subsequently overwritten program file (212); no selected pair was omitted. **143** have both earlier immutable app snapshots independently observed by GitHub before their race-specific T−3. **81** could not corroborate PRE-rich publication by cutoff. **72** had no matching, independently corroborated earlier program publication. All 153 uncorroborated pairs remain quarantined. The original raw official HTTP response/body hashes were not archived, **including for the 143 corroborated app snapshots**. These 143 may inform future research provenance but are NOT automatically enrolled into prediction training or production.

| Code | Venue | Investigated PRE-rich pairs | Hosted-before-T−3 corroborated | PRE proof unavailable | Program proof unavailable |
|---:|---|---:|---:|---:|---:|
| 01 | Kiryu | 11 | 11 | 0 | 0 |
| 02 | Toda | 13 | 9 | 4 | 0 |
| 03 | Edogawa | 12 | 8 | 4 | 0 |
| 04 | Heiwajima | 0 | 0 | 0 | 0 |
| 05 | Tamagawa | 24 | 15 | 9 | 0 |
| 06 | Hamanako | 0 | 0 | 0 | 0 |
| 07 | Gamagori | 0 | 0 | 0 | 0 |
| 08 | Tokoname | 23 | 10 | 3 | 10 |
| 09 | Tsu | 23 | 5 | 5 | 13 |
| 10 | Mikuni | 10 | 7 | 3 | 0 |
| 11 | Biwako | 25 | 2 | 8 | 15 |
| 12 | Suminoe | 0 | 0 | 0 | 0 |
| 13 | Amagasaki | 25 | 12 | 7 | 6 |
| 14 | Naruto | 0 | 0 | 0 | 0 |
| 15 | Marugame | 13 | 9 | 4 | 0 |
| 16 | Kojima | 0 | 0 | 0 | 0 |
| 17 | Miyajima | 0 | 0 | 0 | 0 |
| 18 | Tokuyama | 23 | 6 | 8 | 9 |
| 19 | Shimonoseki | 23 | 13 | 9 | 1 |
| 20 | Wakamatsu | 22 | 14 | 3 | 5 |
| 21 | Ashiya | 25 | 18 | 7 | 0 |
| 22 | Fukuoka | 24 | 4 | 7 | 13 |
| 23 | Karatsu | 0 | 0 | 0 | 0 |
| 24 | Omura | 0 | 0 | 0 | 0 |
| **TOTAL** | **24 venues** | **296** | **143** | **81** | **72** |

Nine venues with **zero pairs** in this table are NOT nine venues missing third-party historical research data: this table is solely about BOAT COMMAND's *corresponding original LIVE PRE-rich/program Git snapshots*. Never mix these denominators.

## Next safe work, in order
1. Keep this full report and all 143 exact per-race SHA/time proofs regenerable via PR #126. The full machine-readable Actions artifact has short retention, so preserve source code, fixed gates, aggregate report and linked run. Before re-running after Actions retention, check for expired GitHub run evidence instead of pretending absent evidence means the original data was never captured.
2. Separate **program-only** evidence inventory for the 1,034 LIVE rows lacking PRE-rich snapshots: inspect original early official program Git versions and GitHub-server publication time. Never backfill PRE-rich exhibition/weather from a later page or derive target outcomes from program current-meet columns.
3. Separately confirm effective/publication dates of existing half-year official racer-period archives before declaring historical racer-period features strict PRE safe, and check actual field missingness for each of the 24 venues (section timestamp eligibility is not the same as every field being present).
4. Continue the existing independent vendor bounded backfill and official collector untouched. Original inverse archive at pinned SHA still had **5,679** target races unvisited; acquisition and label exceptions remain open.
5. After feature policy is preregistered using **earlier training dates only**, freeze new candidate on genuine **future** paired SHADOW/FORWARD races against the actual hard-locked production predictions. Prior inverse prototype PR #125 is a negative experiment (not a promoted model), and its inspected holdout cannot be reused as if unseen.
6. Keep research PR #126 **draft**, no deployment or promotion. Independent project product milestones in `PRODUCT-MILESTONES.md` are **not 5/5 complete**.

## Technical state / handoff
Base main at creation: `f6542fc033c8aa603229db003dbe25bd9b240f18`; main observed at this final audit review: `464ce073f90caf986e6b97e5ab8cbdea0d53f487`. Main auto-updates; refresh before any merge, conflict handling or follow-on writes. Draft branch `research/asof-provenance-audit-v1`. Changed files before this report were **only** two new read-only research scripts, two new offline test files, one new isolated Action workflow and one research documentation file. No existing production scripts or workflows altered; no publishing of external URL UI changes required. The untrusted third-party full-day race card remains strict-PRE disallowed.

## Artifact byte-level verification (while GitHub retains it)

The full 296-case machine-readable CI artifact is attached to the successful run above as `github-hosted-pre-snapshot-asof-pilot` (GitHub artifact ID `10931432470`). It includes each successful pair's exact program/pre-rich commit SHA, both GitHub-hosted observation times, source fetch times and race-specific cutoff. Keep a copy before the Action retention period ends; after that the aggregate Markdown report and reproducible audit scripts remain, but missing historical GitHub run logs cannot be reconstructed by assumption.

- Downloaded ZIP SHA256: `55f97e6867f75b213b37efd0d67ebe54aa3626327aac3f8e61b48226d30a51df`.
- Contained `boat-github-asof-corroboration-v1.json` uncompressed SHA256: `983100deeb6c3b6ecde95651168919c4e68b1f802c9b80e4d548f3c190b1dad9`.
- These fingerprints attest only to the saved research report's byte-for-byte identity, **not** to the original official HTTP bytes (not archived for these races) and never authorize live model use.
