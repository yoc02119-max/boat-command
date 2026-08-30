# BOAT COMMAND v0.11.0 — REPLAY PIPELINE REBUILD

パック読込を4段階に再構築:
1. PACK CHECK
2. BACKTEST SESSION
3. 12R DATA LINK
4. SNAPSHOT RENDER

成功時は `LOAD COMPLETE · 12/12 SNAPSHOT READY`。
失敗時は無反応にせず、失敗段階を画面表示。

修正:
- 欠落していた VERIFIED_BEFOREINFO_20251215 定義を復元
- 壊れた旧重複loaderを削除
- 1つのloadReplayPack経路に統一
- 12R snapshotの事前検証とDOM描画数チェック
- cache bust v=110
