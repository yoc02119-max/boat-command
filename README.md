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


## v0.17.4 — RELAY TIMING INGEST

- Feeds a verified same-origin relay JSON into the 12R LIVE TIMING AUDIT table.
- Records GitHub fetch time, app receive time, relay delay, deadline, and purchase-time margin.
- Distinguishes READY from LATE without weakening the PRE-RACE/result boundary.
- Keeps result acquisition, prediction, and HARD LOCK disabled in this audit phase.
- Existing BACKTEST/RETEST records and relay safety validation remain unchanged.

## v0.17.3 — RELAY SAFETY FIX

- Fixes false-positive `RESULT_DATA_DETECTED` caused by the safety metadata key `resultEndpointsIncluded: false`.
- Keeps fail-closed result protection by checking only PRE-RACE payload branches and source URLs for forbidden result content/endpoints.
- Requires all relay safety flags to remain explicitly `false` during this audit phase.
- No prediction, HARD LOCK, or result acquisition is enabled by this release.

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


## v0.17.5 — DATE-AWARE TIMING

- Distinguishes TODAY / PAST AUDIT / FUTURE before interpreting deadline margin.
- Historical relay checks are labeled PAST instead of being confused with a live LATE race.
- Keeps the numeric after-deadline audit value, but clearly marks it as historical evidence.
- Result endpoints, prediction, and HARD LOCK remain disconnected in the LIVE audit monitor.
- Existing BACKTEST / RETEST / AUTO PREP / AUTO FINISH code paths are retained.


## v0.17.6 — DATE-ISOLATED AUDIT
- 12R LIVE TIMING AUDIT を日付ごとの独立バケットに分離
- 9/1 の PAST 監査が 9/4 画面へ残る表示混在を解消
- 日付/レース選択変更時に、旧レースのRELAY/直接監査表示を自動クリア
- 過去の単一 `liveTimingAudit` は初回だけ日付別領域へ安全移行
- 結果取得・予想・HARD LOCK は引き続き AUDIT ONLY で無効


## v0.17.7 — PUBLICATION WAIT
- PRE-RACE JSONは届いているが公式ページがまだ本番形式でない場合、`BLOCKED` ではなく `WAITING` と判定。
- `UNEXPECTED_PRE_RACE_FORMAT` / `HTTP_404` を「公式PRE-RACE公開待ち」として扱う。
- 真の通信・安全性エラーは従来どおり fail-closed (`LIMITED` / `BLOCKED`)。
- 結果取得・予想・HARD LOCKは引き続き接続しない。


## v0.17.8 — READY SAFETY GATE
- PRE-RACE取得成功だけでは `READY` にしない安全ゲートを追加。
- FUTURE（開催前）はデータが揃っても `WAITING`。
- TODAYのみ、締切時刻が判定でき、アプリ受信時点で購入余裕5分以上なら `READY`。
- 締切不明は `LIMITED`、購入余裕5分未満は `LATE` として予想接続を禁止する前提を固定。
- PASTは従来どおり監査証跡として `PAST`。
- 結果取得・予想・HARD LOCKは引き続き AUDIT ONLY で未接続。


## v0.17.9 — FRESHNESS GATE
- TODAYのTIMING READYにPRE-RACE鮮度条件を追加。
- GitHub取得時刻が対象日当日で、アプリ受信時点から10分以内のJSONだけをTIMING READY候補にする。
- 古いJSONは `WAITING · PRE-RACE更新待ち`。開催前/FUTUREは従来どおりWAITING。
- READY表記を `TIMING READY` に明確化し、予想可能判定とは分離。
- 結果取得・予想・HARD LOCKは引き続きAUDIT ONLYで未接続。
- 内部状態機械セルフテスト（FUTURE/STALE/LIMITED/READY/LATE/PAST）を追加。


## v0.18.0 — LIVE GATE SELF-TEST
- Added an audit-only synthetic self-test for the LIVE safety state machine.
- Verifies FUTURE→WAITING, stale TODAY→WAITING, missing deadline→LIMITED, >=5 min→READY, <5 min→LATE, PAST→PAST.
- Verifies the self-test does not mutate session or relay state.
- Does not fetch results, generate predictions, or HARD LOCK.
