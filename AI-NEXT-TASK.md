# App progress integration — roadmap v1.1

Owner requests app-first progress tracking. Follow AGENTS.md progress writeback contract. UI-03 public content is verified on Pages run41691269914; saved-plan auto-refresh verification is in progress. Existing failures are recorded in QA-02: regex syntax and developer-auth expectation reproduce on baseline; Edogawa schema glob mismatch and model-cycle fixture mainline DRIFT reproduces using the existing generator/date2026-09-22 with isolated output (not the candidate ledger). Do not weaken safety gates or claim full CI green. Keep OP/AN/EX completion states unchanged until separately verified. At each future task start/result/blocker, update docs/delivery-roadmap-v1.json (lastWork, updatedAt, evidence) and matching Markdown. App reads main every30s/resume and directly checks contents API about90s; rejects older updatedAt after newer data, independent of Pages shell sync. Plan changes require version/changelog update; downloaded SVG derives from the fetched plan.

---

# Delivery roadmap — v1.0, 2026-11-04 JST

Canonical plan: [docs/DELIVERY-ROADMAP.md](docs/DELIVERY-ROADMAP.md). Machine-readable status and image source: [docs/delivery-roadmap-v1.json](docs/delivery-roadmap-v1.json). Image renderer: scripts/render-delivery-roadmap-v1.py (Pillow + Japanese font). On every progress review, report stable check IDs, evidence/time and remaining blockers. When scope/order/completion conditions change, bump roadmap version, record why, regenerate and give the owner the latest image. Preserve prior versions in git. Do not treat this documentation change as new operational verification or predictive improvement.

Next checks: OP-01 actual >=07:30 JST freeze; OP-02 all24 venue coverage; OP-03 morning/calendar event path; OP-04 real-data settlement/UI/capital agreement; AN-01 equal-budget baseline. Tax page remains optional future scope. No production code/model/UI changed by this roadmap.

---

# Delivery brief — owner clarification, 2026-11-04 JST

- Recipient: one experienced BOAT RACE customer, not a mass-market beginner audience. The customer has high expectations; prioritize a dependable, evidence-backed handover.
- Priority: stable coverage of開催 venues and correct TRY eligibility; independent prediction/ROI verification; accurate, concise daily UI. Keep extensive research/admin controls out of the main customer flow while preserving their functions.
- UI review authorized by owner: consolidate repeated daily metrics; distinguish selection pending, no eligible TRY and collection failure; make status reflect freshness; align displayed30-day stats with the actual period. These UI changes are NOT yet implemented. Preserve DOM/event/API/model contracts.
- Tax-related page: possible FUTURE request, not an instruction to build now. Design candidate is an exportable record of dates, venues, races, actual stakes, actual payouts, annual totals and source receipts. Keep simulated TRY separate from confirmed actual transactions. Current virtual ledger is not evidence of the customer's real purchases or payouts. Do not invent tax liabilities, tax-saving eligibility, or treat current virtual entries as actual records. If tax guidance/calculation is requested, verify current official Japanese guidance before implementation.
- No delivery date, predictive improvement or profitability has been established. Record measured results and remaining blockers.

Verified operations update: timing repair8c1ccbf and collector recoverybea1f2b are on main. Shared contract41683567548 and portfolio41683567673 succeeded; actual overnight WAITING and unchanged52870 yen confirmed. Mikuni SHADOW41685350428 and Ashiya SHADOW41685469531 succeeded; Nov4 program-only PRE12/12 each on main, generated02:34 JST before1R. The actual07:30 selection and the calendar-completion event path still need observation. AI-STATE.json holds detailed evidence.

---

# Active objective — BOAT COMMAND, 2026-11-04 JST

1. Confirm this repair's Shared virtual TRY contract and Shared 24-venue portfolio Actions. Confirm overnight status WAITING with no new lock, and the first real Nov4 selection occurs no earlier than07:30 JST. Existing settlement must continue. Public data freshness is a separate check.
2. P0: trace missing morning PRE snapshots (Nov3 Mikuni1-4, Tokuyama1-5, Ashiya1-5). Compare first successful program/snapshot job times, job failures/queue delays and immutable source metadata. There are hourly early schedules already; do NOT assume a missing schedule. Protect all prior predictions. Repair future collection only, then validate morning end-to-end.
3. Quantify per-venue candidate availability at actual freeze. If a progressive selection protocol is needed, design it separately with fixed daily capital basis and immutable per-race commitments; do not append to existing day locks or silently refill risk limits. Mere07:30 gate does not guarantee complete24-venue coverage.
4. P1 accuracy: audit latest course/period second-place FORWARD snapshots, source timestamps and holdout independence; compare identical four-pick and stake budgets by venue. Conditional second-place improvement alone does not prove trifecta/TRY ROI improvement. No promotion by this repair.
5. Existing TRY odds observer ALREADY exists (.github/workflows/try-odds-observer-v1.yml). It captures PRE odds in3-8 minute window to90-day Actions artifacts; does not affect production. Inspect successful runs and artifacts before building a timestamped odds-aware SHADOW selection protocol with calibrated probabilities. Do not claim observer absent or positive-EV selector implemented. Set conditions before viewing validation results.

Done here: timing repair8c1ccbf is on main and all three relevant Actions succeeded; actual overnight WAITING and unchanged capital confirmed. Calendar-triggered recovery for3 morning collectors added as a second bounded repair; validate its new runs and first real morning PRE coverage. Sales readiness and prediction improvement remain unproven. User prefers concise results with evidence. All work is virtual; no real-money betting.
