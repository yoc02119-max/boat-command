# BOAT COMMAND v0.9 — BACKTEST REPLAY

STRICT BACKTEST REPLAYの土台を追加。

- 蒲郡 2025/12/15 の実レース検証パックを内蔵
- 予想前に表示するのは基礎出走情報（艇番・選手名・レース種別）
- 公式3連単結果・払戻は12RすべてHARD LOCKするまでUI非表示
- 12/12 LOCK後に明示的なREVEAL操作で結果解禁
- REVEAL時に12Rを公式結果で一括精算
- BACKTESTとして保存され、LIVEとは分離
- LOCK時刻・買い目・根拠・戦略バージョンを従来通り固定
- 無課金・GitHub Pages + localStorage構成

注意:
この最初の実レースパックは「フロー検証用のENTRY BASELINE」です。
展示、直前気象、直前オッズなどはまだ収録していないため、
予想精度の本格評価用データセットとしては未完成です。
