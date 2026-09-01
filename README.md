# BOAT COMMAND v0.17.1 — LIVE DATA GATE v1

Audit-only first step toward LIVE automation.

- Adds DATA → LIVE DATA GATE v1.
- Probes only official BOAT RACE pre-race endpoints: `racelist` and `beforeinfo`.
- No result/resultlist request exists in the LIVE monitor.
- No prediction and no HARD LOCK can be triggered by the monitor.
- Records fetched time, deadline when parsable, time margin, CORS/HTTP outcome, and a small audit history.
- Fails closed: any unavailable/partial data remains BLOCKED/PARTIAL and cannot become a prediction.
- Existing BACKTEST/RETEST/HARD LOCK/AUTO PREP/AUTO FINISH/AI logic is left intact.

GitHub Pages static hosting remains free. Browser CORS behavior must be verified on the actual iPad; source checks are not an operational PASS.


## v0.17.1
- 12R LIVE TIMING AUDIT receiver/table for the 2026-09-04 Gamagori live timing test.
- Records per-race fetch time, READY time, deadline and purchase-time margin.
- Statuses: WAITING / READY / LIMITED / LATE / BLOCKED.
- Audit-only: prediction, HARD LOCK and result endpoints remain disconnected.
- Clearing the timing audit does not alter BACKTEST/RETEST/LIVE core records.

## v0.17.2 — RELAY PROBE
- Adds a same-origin `RELAY受信テスト` to DATA.
- Relay JSON path: `live/gamagori/YYYY-MM-DD/pre/race-N.json`.
- Includes a **manual-only** GitHub Actions workflow at `.github/workflows/pre-race-relay-probe.yml`.
- The workflow has no schedule/cron and makes at most two PRE-RACE requests for one user-selected race: `racelist` + `beforeinfo`.
- No `result` / `resultlist` URL is present in the workflow.
- The committed relay artifact stores only audit metadata, not copied official HTML.
- Prediction and HARD LOCK remain disabled in this phase.
- Browser direct-fetch probe is retained for comparison.

`SETUP-relay-workflow.yml` is a visible duplicate for iPad setup; the active copy must live at `.github/workflows/pre-race-relay-probe.yml`.
