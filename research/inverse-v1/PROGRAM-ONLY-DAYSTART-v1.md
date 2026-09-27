# BOAT COMMAND — independent original program-only day-start evidence pilot

**Separate research-only stacked PR** on `research/asof-provenance-audit-v1` (PR #126), not direct LIVE/model changes. The negative retrospective model experiment PR #125 remains unpromoted.

## Reason and scope
The complete 24-venue audit on PR #126 reviewed 1,332 current stored program rows:
- 296 had a current PRE-rich record with potentially recoverable original content: 143 were GitHub-hosted before target T-minus-3 under strict app-record gates, 81 lacked PRE-rich server-time proof, 72 lacked matching program server-time proof.
- **1,034 lacked a corresponding current PRE-rich snapshot**. The previous 296-case checker intentionally did not examine their original program-only Git history.
- Two program/PRE deadline conflicts were excluded from the previous pilot and remain quarantined.

This independent program-only experiment examines *only* currently PRE-rich-absent program files. For each race it inspects at most 40 historical **committed program versions** and accepts neither today's rewritten program contents nor git's author/committer timestamps as a substitute for external publication evidence. A version must:
1. Be an original, six-racer complete, result-free, exhibition-free BOAT RACE official-racelist app program pack for exactly the file's venue/date/race, with a valid recorded JST `fetchedAt` and syntactically valid deadline.
2. Have an exact-commit SHA present in an independently GitHub-hosted workflow run; its server `created_at` must not predate the app's own recorded acquisition time.
3. To receive `APP_PROGRAM_HOSTED_BEFORE_RACE_DAY`, the independent GitHub timestamp **must be earlier than 00:00 JST on the target race date**. This strong day-start gate does not trust the snapshot's claimed deadline for positive classification. A program first hosted during the race day but before its self-reported T−3 is counted separately as `BEFORE_SELF_REPORTED_T_MINUS_3_ONLY` and remains quarantined.

Records matching neither gate are explicitly uncorroborated. The batch uses a bounded, round-robin sample across the existing 24 venues rather than disproportionately testing a single venue. The job never reads same-race POST files, actual ranks or payouts.

**Important limits:** A positive status establishes early availability of the **stored app-parsed record**, not authenticity of the upstream official HTTP response body; original raw response hashes have not been saved. Also, a record with no PRE-rich companion cannot supply exhibition, weather, race entry or start information by implication. Even the day-start group remains **research-only**, not automatically eligible for strict model training, LAB, SHADOW/FORWARD, purchases, promotions or user-facing live prediction.

## Reproducibility
```bash
python -m unittest discover -s tests -p test_research_program_only_daystart_v1.py -v
GH_READ_TOKEN=<read-only GitHub Actions token> \
  python scripts/research-program-only-daystart-v1.py \
  --limit 120 --output /tmp/boat-program-daystart-v1.json
```

The isolated workflow `research-program-only-daystart-v1.yml` runs 7 provenance regression tests, 6 GitHub commit/server-time regression tests and new day-start negative controls before the bounded 24-venue pilot. All generated outputs are temporary Actions artifacts. No existing production workflow schedule or file is modified.

## After the pilot
- Inspect full exact per-venue counts and the distribution among independently corroborated day-start records, only-self-reported T−3, and uncrosschecked rows.
- Extend the bounded coverage to the remaining program-only candidates without changing provenance gates, making each batch and source HEAD immutable.
- For future races, prospectively archive **raw official source response bytes+SHA256** with source-read timestamp and original program snapshot, then verify before race cutoff. That additional proof cannot be retroactively fabricated for old races.
- Model development is independently gated on timestamp-safe PRE observations, preserved 24-venue isolation, previously frozen predictions and genuinely unseen prospective SHADOW/FORWARD. No uplift, calibration or expected ROI is claimed by this file.

## Verified first production-repository read-only pilot — 2026-09-27

- Green Actions run: https://github.com/yoc02119-max/boat-command/actions/runs/36318623200
- Source checkout HEAD inside the GitHub pull-request run: `f87741a850324b54eb410f9ad1cbf819830b6a67` (PR merge ref; NOT an additional main commit). This pilot did not read the external third-party data branch.
- Across 24 venues the pinned checkout had exactly **1,034 current program-only rows** with no corresponding current PRE-rich file. The bounded, round-robin first pass reviewed **120** of those, leaving **914 unexamined**.
- **0/120** records met the strong independent **GitHub-hosted before race-day midnight JST** proof.
- **76/120** records had independently hosted app program files before the program's **own** recorded T−3. Those are **NOT proven by an independent deadline reference**, so they remain excluded from strict model inputs.
- **44/120** could not establish server as-of proof even against the program's own cutoff. Lack of proof should not be misreported as proof the data did not exist.
- Offline tests: 7 existing timestamp/isolation + 6 existing GitHub-history gates + 8 new program-only gates = **21 passed**; live read-only pilot succeeded. An initial failure exposed real deleted-and-readded Git paths: `git log -- <path>` includes deletion commits even when `git show SHA:path` cannot read the absent file. The final implementation verifies the commit object then skips only the pathless deletion; an actually missing Git object fails closed. The temporary test fixture also recreates a folder after `git rm`. Keep both negative regression tests.
- **No historical model input was released, no POST files were read and no production collector or scheduled workflow was modified.** For all positive app snapshots the original upstream raw HTTP body is still missing.

### Recommended next implementation priority

Do **not** count the 76 self-reported-cutoff rows as proven safe or automatically fetch 914 more just to boost superficial coverage. The first 24-venue sample yielded **zero** stronger previous-day corroborations. Instead prototype a **prospective research-only raw official response capture** that records original bytes (or losslessly compressed original bytes), a SHA256 source hash, source URL, local acquisition time, original Git/host publication evidence, verified racer identity, and deadline. Write only an independent append-only research branch, never rewrite LIVE packs or the legacy history. Freeze a raw observation before the race and gate the whole feature record at T−3. Add unit tests for race-day clock rollover, late download, inconsistent deadline, result-path contamination, duplicate/rewritten observations and Github push conflict.

Then evaluate whether any of the 914 unexamined older program rows warrant selective independent investigation (e.g., particular 24-venue gaps); do not bypass provenance gates to increase accepted sample size. PR #126 remains the dependency for this stacked research PR #127; recheck both heads and main immediately before any merge.
