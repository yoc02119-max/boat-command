# BOAT COMMAND — delivery progress contract

Repository: yoc02119-max/boat-command. Read AI-NEXT-TASK.md and the latest main before changes. Preserve all existing prediction, PRE/POST, HARD LOCK, SHADOW/FORWARD/LAB, 24 independent venue models, shared capital/history, approval and public-navigation contracts.

## Required progress writeback

The owner uses the app as the primary delivery tracker. `docs/delivery-roadmap-v1.json` is the authoritative app plan; `docs/DELIVERY-ROADMAP.md` is its detailed companion. Do not leave progress solely in chat.

- At task start, verification, scope changes or blockers, update lastWork, updatedAt, affected stable check IDs, actual statuses and evidence URLs/timestamps. This UI request does not authorize prediction/model/workflow changes.
- Preserve the six stages and existing check IDs. Add IDs for newly authorized work. Do not mark a stage complete merely because a subtask or Actions run succeeded.
- Keep evidenceLastVerifiedAt for the actual operational verification time; refresh/fetch/build time is not that evidence. Record per-check verifiedAt only after the stated check happened.
- A change to plan/scope/order/completion conditions requires version increment and a dated reason in changelog plus corresponding Markdown updates. Ordinary progress evidence updates need updatedAt and an auditable git commit, not a fabricated new plan version.
- delivery-progress-v1.js polls main read-only every 30 seconds while visible and on resume. Data-only plan updates require no shell deployment. The download image is generated from the fetched plan, so it must stay aligned. Shell/assets still use existing Pages publication.
- For requested image delivery, regenerate with scripts/render-delivery-roadmap-v1.py from the same JSON. Update the existing user image identity when available; do not leave a stale image described as current.
- Verify changed contracts plus actual public UI where possible. Report implementation, publication and real-screen verification separately. Never infer profitability, all24 coverage, or active AI work from a successful fetch.
- Re-read main and affected blobs immediately before writing; use a non-forced lease or fast-forward. Preserve concurrent bot data. Roll back only this feature's files from its baseline, without resetting operational data.
