# BOAT COMMAND v0.15.7 — RESULT RENDER FIX

Free static GitHub Pages build.

## v0.15.7
- RETEST final score + ORIGINAL BLIND BT-001 comparison is rendered directly at the top of the settlement race list.
- Added explicit `パック未読込に戻す` control so pack-load behavior can be tested from a true unloaded state.
- `RETESTを最初からやり直す` keeps its intended meaning: start a fresh RETEST with the same pack.
- ORIGINAL BLIND BT-001 baseline remains immutable.
- Existing selective 9R prediction / 3R skip, auto prediction, HARD LOCK, reveal+settlement, snapshot rendering, and formal-stat RETEST exclusion remain intact.

Deploy all six files to the repository root.

- Fixed settlement/result rendering crash caused by undefined `yen()` calls in final score cards; all currency formatting now uses the existing `money()` helper.
- Keeps v0.15.6 pack unload/reload audit flow and RETEST/ORIGINAL separation unchanged.
