# BOAT COMMAND v0.10.5 — VERIFIED MAP FIX

## Root cause
2R以降の検証済み直前データは `VERIFIED_BEFOREINFO_20251215` に保存されているが、
旧rendererは先に `pack.races` の詳細オブジェクトを要求してreturnしていた。
そのためPRE-RACE DATA ACTIVEまでは出てもSNAPSHOT本体が空になっていた。

## Fix
- verified mapを最優先でraceNo照合
- 2R / 4R〜12Rはbase packの詳細race objectがなくても描画
- 1R FULL SNAPSHOTは従来どおり
- 3RはINTEGRITY HOLD
- 照合不能時はSNAPSHOT LINK ERROR
- cache bust v=105
