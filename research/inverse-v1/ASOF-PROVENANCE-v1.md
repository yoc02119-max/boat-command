# BOAT COMMAND — as-of PRE provenance audit v1

Research only. This document describes the next step after the negative [inverse prototype](https://github.com/yoc02119-max/boat-command/pull/125). None of its new conditional-probability weights should be promoted or tuned on that already inspected holdout.

## Evidence and strict boundaries
1. A vendor `programs/race_cards` CSV copied/retrieved after a race may contain complete racer, class, motor and recent-meet fields **without proving those values existed at the target T-3 cutoff**. The existing archived inverse-join explicitly tags `pre.cardTiming = UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL`. Identity checks establish *which race* a row belongs to; they do not establish *when* each field was observable.
2. Archived official `historical-beforeinfo-24` records may show complete exhibition, start-display and water values but contain **no contemporaneous, immutable, per-race as-of capture evidence**. Page HTML fetched after a race is diagnostic only. The displayed water reference or network fetch elapsed time is not a contemporaneous capture timestamp.
3. In live archived data, the current `program/race-N.json` may have `fetchedAt` later than `pre-rich/race-N.json`, and later than the original race cutoff. Example: Kiryu 2026-09-25 12R has the current official program pack fetched at 22:56 JST (deadline 20:35); independent `pre-rich` record shows 20:27. The current pair's shared boat values are **not evidence the late program file existed at 20:27**. This is a provenance gap, not evidence of proven prediction leakage.
4. Only separately captured third-party `tkz/stt/sui` observations with source-acquisition timestamps **at or before** the recorded race-specific deadline minus three minutes currently qualify for this research's strictly timestamp-gated preview sections. These are vendor timestamps, not independent official certification.
5. A green Action, a high field-completeness percentage, or a cross-source value match does **not** release additional PRE fields. POST outcome, actual entry/ST and payout are never inputs for the audited target race.

## Isolated repeatable diagnostic
`scripts/research-asof-provenance-v1.py` classifies current live program/pre-rich file pairs, audits all stored historical official pages for lack of strict as-of evidence, and SHA256-verifies every immutable inverse data-branch day against its published 24-venue manifest. All 24 venue outputs include raw counts and examples where a currently stored program has been rewritten later than pre-rich.

```sh
python -m unittest discover -s tests -p test_research_asof_provenance_v1.py -v
python scripts/research-asof-provenance-v1.py \
  --vendor-data-root /path/to/PINNED/data/inverse-research-v1/research/inverse-v1 \
  --vendor-sha FULL_40_CHAR_COMMIT_ID \
  --output /tmp/boat-research-asof-v1.json
```

The PR Action downloads the independent data branch read-only, pins its SHA, and stores the 24-venue diagnostic as an ephemeral artifact. `strictHistoricalCardFieldsReleased` is deliberately **zero**. Even `RELATIVE_TIMES_COMPATIBLE_UNPROVEN` is **not** an approved historical feature: a current file matching an earlier-looking timestamp is not independently immutable time-travel evidence.

## Concrete safe path to unlock more PRE information
- For **future prospective races**, write a standalone immutable, source-stamped *research* observation for the whole official race card as soon as received, keeping original source URL, raw response/content hash, verified six-racer identity, recorded observation UTC/JST, deadline and T-3 cutoff. Store versioned PRE observations rather than replacing an existing race-day file; audit the first durable commit/append time. Any source or deadline mismatch means quarantine.
- For **older races**, seek the actual original immutable source snapshot and acquisition timestamp at the intended cutoff. A race-page's present-day values, third-party CSV downloaded today or ordinary Git commit date after the event cannot fabricate that missing historical state.
- Consider independently effective-dated published racer-period reference data only after checking release timestamp, exact period coverage, six-racer identity and no later outcomes in the reference. Do not assume high coverage means safe.
- Continue the existing 24-venue inverse research backfill and the independent official collector unchanged. Each new conditional development hypothesis must pre-register venue/features/split on **training-only** data and preserve a genuinely uninspected future FORWARD period. The exposed 2026-08-18 onward experiment is not a fresh independent holdout.
- Compare any frozen candidate against *actual pre-locked current-model picks* on the same races; first demonstrate reproducible calibration and prospective paired evidence. Do not equate this audit or the earlier venue-prior comparison with a validated improvement.
- Keep production predictions, result separation, HARD LOCK, 24 independent cycles, SHADOW, FORWARD, LAB, TRY, existing odds logic and the 100,000 JPY virtual balance unchanged. No auto-buy or auto-promote.

## Handoff (2026-09-27)
- Base main SHA at branch creation: `f6542fc033c8aa603229db003dbe25bd9b240f18`. Recheck latest main and Action result before changes; main is independently auto-updated.
- Negative prototype retained as separate draft PR #125. This audit is **not** a fix to or merge of that prototype.
- Pinned inverse archive before this run: `421993f4b3d7067a56f2151af61a8e91e2f8141a`; code should always pin the **actual** revision it checks, never silently assume this remains latest.
- The prerequisite to calling this audit verified is Actions completing successfully, per-venue output inspected, and a negative test proving later program files cannot release card fields. A successful audit by itself leaves the missing original historical acquisition timestamps unresolved.

## Additional bounded GitHub-hosted as-of corroboration pilot

`scripts/research-github-asof-corroboration-v1.py` separately inspects earlier *committed* versions of current early PRE pairs **and** currently late-overwritten official program files. It never treats a self-reported `fetchedAt` or user-writable Git commit date as sufficient proof. For a specific committed program and PRE-rich pair it requires the **exact commit SHA** to have a corresponding GitHub-hosted workflow run with a GitHub-server `created_at` no later than the target T-3 cutoff. Six registration IDs and every overlapping card field must agree, and both files must explicitly exclude result endpoints.

A concrete pilot example found from GitHub before automation: Toda 2026-09-26 1R, deadline 10:47 JST (T-3 at 10:44). Original official program commit `4851b6209b62078419728e21cefd9c6bd12a1ca0` has a recorded fetch of 2026-09-25 21:26 JST; the PRE-rich commit `338536b37225569d7c4774e75da92b15516aa713` has a recorded capture of 2026-09-26 10:30 JST. GitHub independently recorded workflow runs against the exact program SHA at 2026-09-25 21:28 JST and against the exact PRE-rich SHA at 2026-09-26 10:32 JST, both before the race cutoff. All overlapping fields matched in the committed two files. This corroborates a **stored app program snapshot** for that specific race, not all vendor historical cards, not independently authenticated original official HTTP response bytes, and not model profitability.

The initial read-only Actions pilot sampled 100 of 296 candidate app-PRE pairs and found 49 pairs with server-corroborated original app snapshots under its first test gates. The follow-up tighter proof requires explicit original official/result-free flags and GitHub first-seen time **after both recorded fetches**; a bounded 300-pair run attempts all 296 current candidates fairly across venues. No independently uncorroborated pair is released, and each positive example includes exact SHA and GitHub-seen timestamps. Even successes remain **research-only and not imported into LAB or production models**. Next: inspect pilot counts and failures, then extend to remaining original committed snapshots before designing a new, forward-only candidate. Never test a new candidate as though the previous exposed holdout were untouched.
