# BOAT COMMAND v0.15.4 — REGRESSION GUARD

- Results view is rendered last so final score/comparison cannot be overwritten by later renderers.
- Auto-prediction verification uses saved prediction data as authority and UI fields as a secondary check.
- DATA screen exposes CRITICAL CHAIN PASS/FAIL.
- Required chain: PACK -> 12 snapshots -> 9 predictions + 3 skips -> 9/9 HARD LOCK -> reveal -> settlement -> RETEST vs ORIGINAL.
