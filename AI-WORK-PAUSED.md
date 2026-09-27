# BOAT COMMAND — USER-REQUESTED WORK PAUSE

Status: PAUSED. Recorded 2026-09-27 JST. Main HEAD observed before writing: c5b4e0e0414386fa9545f9244e799fd72a8f98e9.

The owner explicitly requested: "検証が多すぎて全然先に進まないので一旦今行なっているプロジェクト全て中止してください。" Do not autonomously resume new development, research, model tuning, backfills, PR creation, CI experiments, UI redesign, LAB promotion, or automated code changes without an explicit NEW instruction from the owner.

Actions taken:
- Closed all 10 outstanding PRs without merging or deleting their branches: #4 #5 #62 #70 #71 #76 #125 #126 #127 #128. Their histories and reports remain available for future deliberate review.
- Stopped automatic schedule and push execution of `.github/workflows/inverse-research-backfill-v1.yml`; manual dispatch retained but must not be used without explicit approval.
- Stopped automatic schedule of `.github/workflows/historical-beforeinfo-backfill-v1.yml`; manual and PR triggers retained but no open PRs remain.
- All ChatGPT task automations inspected on 2026-09-27 were already disabled.
- At last inspection GitHub had 0 open PRs and 0 active listed recent runs.

IMPORTANT SCOPE / SAFETY: Existing stable 24-venue LIVE program, POST results, SHADOW, FORWARD, LAB and model-cycle GitHub workflows were intentionally NOT disabled at this stage because turning off the existing app's operating system would affect current functionality. If the owner explicitly confirms a *full operational shutdown*, pause those existing workflows separately and reversibly. Do not infer that closing PRs or disabling two backfills stopped ongoing built-in app operation.

Preserve all existing race predictions, PRE/POST separation, HARD LOCK, 24-venue isolation, old snapshots, virtual bankroll/settlements and historical records. Never delete branches, force-push, roll back successful main, wipe artifacts or change production logic as part of pausing. Any future resume requires explicitly scoping and prioritizing work with the owner; do not automatically reopen the entire backlog.
