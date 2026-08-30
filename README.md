# BOAT COMMAND v0.10.3 — SNAPSHOT RENDER FIX

BACKTESTパックがBLIND状態になっているのに各レースの事前SNAPSHOTが表示されない問題を修正。

- race番号をNumberで正規化してパック照合
- 1R FULL SNAPSHOTを明示レンダリング
- 2R / 4R〜12R VERIFIED SNAPSHOTを明示レンダリング
- 3RはINTEGRITY HOLDを必ず表示
- パック参照失敗時は無言で消さず、SNAPSHOT LINK ERRORを画面表示
- replay-active状態をrace cardに付与
- cache bust v=103
