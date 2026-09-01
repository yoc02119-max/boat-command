# BOAT COMMAND v0.16.1 — RESULT AUTO FINISH

Free static GitHub Pages build.

## v0.16.1

- Adds a second, independent automation boundary after BLIND AUTO PREP.
- RESULT AUTO FINISH is visible only after every eligible race is HARD LOCKED.
- Before reveal it re-verifies 9/9 locks and validates the official replay result source for every eligible race.
- Only after both gates pass: result reveal -> batch settlement -> analytics-ready state.
- Writes an `autoFinishAudit` record with timestamps, lock count, result-source verification, settled count, skipped count, and post-state.
- Manual result reveal remains available as a fallback and now uses the same verified settlement core.
- ORIGINAL BLIND BT-001 and RETEST separation remain unchanged.

## iPad verification

1. Open v0.16.1 and confirm previous RETEST LOCKED state is preserved.
2. Confirm RESULT AUTO FINISH is visible only at 9/9 LOCK.
3. Tap RESULT AUTO FINISH and inspect the confirmation text.
4. Execute it once.
5. Verify RETEST RESULT, 9/9 settled, 3R skipped, comparison cards, and analytics state.
6. Verify DATA audit includes lock records and no formal-stat mixing.
