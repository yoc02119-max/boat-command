# BOAT COMMAND v0.10.4 — SNAPSHOT PIPELINE

SNAPSHOTをrace-cardテンプレート内で直接展開する方式をやめ、
レースカード描画後に専用slotへ明示挿入する2段階描画へ変更。

- 各race cardに `data-snapshot-race` slotを作成
- DOM生成後に raceNo で照合して `replaySnapshotHtml()` を挿入
- BACKTESTで空なら `SNAPSHOT PIPELINE EMPTY` を必ず表示
- レース見出しに `PRE-RACE DATA ACTIVE` を表示
- 1R FULL / 2R・4R〜12R VERIFIED / 3R INTEGRITY HOLD の構成は維持
- cache bust v=104
