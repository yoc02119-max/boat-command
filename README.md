# BOAT COMMAND v0.14.0 — SELECTIVE STRICT LOCK

Critical STRICT BACKTEST pipeline rebuild.

- 9R prediction target / 3R skip for 2025-12-15
- status becomes `0/9 TARGET LOCK`
- NO PREDICTION races are excluded from HARD LOCK target
- implemented missing `lockRace()` engine
- implemented bulk lock for eligible races only
- each lock stores timestamp, stake, rationale, gate status and hash
- result reveal remains impossible until all eligible races are locked
- reveal/settlement processes eligible locked races only
- skipped races are recorded separately and never counted as MISS, investment, hit rate or ROI
- result screen and DATA audit show SKIPPED explicitly
- cache bust v=140
