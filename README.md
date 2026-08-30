# BOAT COMMAND v0.12.3 — SELECTIVE CARD UI

PDF確認で、v0.12.2は判定文言は存在していたものの、実際の `renderPredictions()` が旧UIのままと判明。

## Fix
- 実際のレースカードrendererへ判定を直接統合
- 全レース上部に英日ステータスを常時表示
- 3R NO PREDICTIONは入力欄・根拠欄・HARD LOCKを完全撤去
- 3R右上は「見送り」
- 1R/2R/6Rは LIMITED DATA
- その他は PREDICTION READY
- 入力イベント側でもNO PREDICTIONを拒否
- lockRace側の強制ガードも維持
- cache bust v=123
