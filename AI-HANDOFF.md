# 24-venue continuous operations repair — 2026-10-26 JST

Owner authorized 24-venue fully automatic operation on 2026-10-26. This supersedes the development pause only for this repair; no model tuning or promotion is authorized by this patch.

Baseline: c4036316ba9f2831bc66591a663b9f2bb5a2b841. Recheck main before publishing.

Confirmed causes: shared TRY configuration enabled only 8 adapters; selection stopped after operationStartDate 2026-09-20 + 30 days. Daily empty OUTSIDE_30_DAY_WINDOW records are immutable and are deliberately preserved. Continuous mode becomes effective 2026-10-27 JST. Existing 24 independent model and collector workflows are retained. Daily cap, stakes, selection ranking, PRE/POST isolation, model promotion contracts and shared initial capital remain unchanged.

Changes: register all 24 existing adapters; continue selection beyond initial window from effective date; reject new historical/future selections; retry empty candidate mornings rather than freezing them; recover only POST results for immutable selected races; rebuild settlement against latest main in publication retry and reject conflicting immutable files.

Validation: shared-try-contract-v1.js; test-shared-try-continuous-v1.js (24 candidates, capital identity, immutable selection, empty retry, no historical/future selection); venue-collector-boundary-contract-v1.js; test-venue-result-coverage.py (missing/late predictions, historical POST recovery, immutable results, no prediction backfill); YAML parsing and bash syntax.

Not yet proven at implementation: successful Actions after publication; next-day live selection; actual public browser rendering; all 24 venues across future開催 days. No claim of full operational completion until these are verified. Non開催 and unavailable input must remain distinguishable from collector success.

Recovery: revert only repair code/config/workflow files; never roll back ledger, selections, PRE or POST records. Pending historical results may remain unavailable from official source and must never be invented.

Post-publication evidence: repair commit 5f75d3b109f5c48fdceee0d0c89d006ed50dffd4. Actions 40279080638 (shared contract), 40279080654 (collector boundary), 40279080662 (recovery/settlement/publication) succeeded. Latest observed portfolio at 2026-10-26T06:19:59.495Z: pending=0, settled=150, hits=44, confirmed/available=64000, profit=-36000, ROI=0.88. Six formerly pending results recovered without changing selections. Public portal rendered in browser; Pages deployment propagation was still pending at that point.

Challenge found: generic POST publish run 40279080630 failed because concurrent collections of Hamanako race 10 differed bytewise (fetchedAt metadata). Follow-up preserves first immutable result and compares venue/date/race/trifecta/payout plus mutually populated optional outcomes; genuine result conflicts still stop publication. Regression tests cover differing timestamps, differing payouts and cross-venue results. No existing result is overwritten.
