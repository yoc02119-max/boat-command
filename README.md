# BOAT COMMAND v0.12.0 — SELECTIVE PREDICTION

「全レースを無理に予想しない」を正式仕様化。

- PREDICTION READY: 十分な締切前データあり
- LIMITED DATA: 一部欠損/除外を明示して判断可能
- NO PREDICTION: 重要データ不足。入力とHARD LOCKを無効化
- 見送り理由をレースカードに常時表示
- STRICT BACKTESTの完了条件を「12/12」ではなく「予想対象レース全件LOCK」に変更
- 2025/12/15 pack:
  - 1R LIMITED DATA（気象除外）
  - 2R LIMITED DATA（展示/展示ST欠損）
  - 3R NO PREDICTION（直前データ不足）
  - 6R LIMITED DATA（展示/展示ST欠損）
  - その他 READY

注意: LIMITED DATAは「完全データ」と同一評価にしない。今後、見送り率/理由別統計へ拡張。
