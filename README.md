# BOAT COMMAND v0.5

iPad-first personal BOAT RACE blind-prediction and analytics prototype.

## v0.5
- Gamagori 1R–12R prediction entry
- 1–4 trifecta picks, ¥500 each
- Per-race HARD LOCK with timestamp and audit ID
- RESULT MODE stays closed until all 12 races are locked
- Result + official trifecta payout entry
- Automatic virtual settlement / hit rate / ROI / P&L / bankroll / max drawdown
- Dynamic bankroll chart
- Head-boat ROI and winner distribution
- Day history
- Local rule-based analyst and chat commands
- JSON backup / restore
- Offline-first browser storage (localStorage)
- GitHub Pages compatible
- No paid API or subscription required

## Important limitations
This version does not automatically fetch BOAT RACE data and does not call an external LLM.
HARD LOCK is enforced by the UI and stored with a timestamp/hash, but local browser data is not a tamper-proof server ledger.
Back up your data regularly from the DATA screen.
