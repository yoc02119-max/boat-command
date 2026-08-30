# BOAT COMMAND v0.13.1 — GENERATOR PIPELINE

v0.13.0で「BLIND予想を自動生成」を押しても無反応だった問題を修正。

## Fix
- generator buttonを直接listener依存からdocument delegated clickへ変更
- ボタンが後から再描画されてもイベントを捕捉
- 生成処理を5段階で画面診断:
  1. GENERATOR START
  2. DATA GATE CHECK
  3. BLIND SCORE
  4. PICKS GENERATED
  5. READY TO LOCK
- 失敗時は FAILED + 段階/レース番号を表示
- 生成後にUI上の予想入力件数を再検証
- 結果データは生成処理から参照しない
- 自動HARD LOCKはしない
- cache bust v=131
