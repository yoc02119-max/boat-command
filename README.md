# BOAT COMMAND v0.13.0 — BLIND PREDICTION ENGINE

- 「BLIND予想を自動生成」追加
- 結果を参照せず、表示済み締切前データだけを固定ルールで採点
- 最大4点と予想根拠を自動入力
- 自動生成ではHARD LOCKしない
- 2R / 3R / 6Rは重要データ不足のためNO PREDICTION
- 1Rは気象除外でも他の主要データが揃うためLIMITED DATAのまま
- 4R-12R（6R除く）はPREDICTION READY
- cache bust v=130
