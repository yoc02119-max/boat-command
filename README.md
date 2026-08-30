# BOAT COMMAND v0.15.0 — PERSISTENCE RECOVERY

- v0.14.1のFINAL SCORE挿入位置バグを除去し、v0.14.0 clean baseから再構築
- 保存を primary localStorage + mirror localStorage + sessionStorage の3系統化
- revision/updatedAtで最新コピーを自動復旧
- 結果・精算画面末尾にFINAL SCOREを正しく表示
- 2025/12/15 BT-001は確定済み集計をSUMMARY-ONLY RECOVERYとして表示
- 消失したrace-level LOCK ID等は捏造せず復元しない
- 結果既知の2025/12/15を再BLIND生成しない安全ガード
- DATA画面にSAVE REVを表示
