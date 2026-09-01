# BOAT COMMAND v0.15.8 — AI 3-LAYER AUDIT

Free static GitHub Pages build.

## v0.15.8

- AI report now recognizes a settled RETEST RESULT as reference performance instead of saying no settlement data exists.
- AI report separates three layers: formal BACKTEST/LIVE, current RETEST reference result, and immutable ORIGINAL BLIND baseline.
- VERIFIED ORIGINAL BLIND BT-001 is restored into BACKTEST-only formal analytics when its raw original session is unavailable.
- Duplicate protection: a verified baseline is not added when raw non-RETEST BACKTEST data exists for the same date.
- RETEST remains excluded from formal BACKTEST/LIVE totals.
- Existing pack load, selective 9R/3R skip, HARD LOCK, settlement, comparison cards, audit IDs, and persistence logic are preserved.

## Regression rule

Source-level checks are not a substitute for iPad state-transition verification.
