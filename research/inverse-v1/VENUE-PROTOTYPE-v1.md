# Inverse venue probability prototype v1 — research branch only

Status: **experimental, not a complete product milestone and not a validated improvement**.

## Scope
- Read all archived `research/inverse-v1/days` from one pinned SHA of the **separate** `data/inverse-research-v1` branch. Verify every day against its archived SHA256 and coverage-v1 manifest. Report missing, rejected and untimed rows rather than inventing them.
- For each of the 24 venue codes, build a **separate** prior for all 120 three-boat outcomes. A candidate updates each venue prior using its own earlier, strictly T-minus-3-eligible exhibition leader and wind-speed bucket observations only.
- The preliminary candidate uses fixed smoothing (trifecta pseudocount 0.3, exhibition backoff strength 85, joint exhibition/wind backoff strength 105). No validation-window tuning or shared cross-venue weighting.
- Recorded winning technique and actual winning entry course are training **labels** only; their conditional probabilities are separate experimental outputs. Same-race actual outcome, actual ST, decision and payout are never features. Untimed full-day race cards are excluded entirely.
- Freeze a single date-based chronological 75%/25% train/holdout split across archived calendar dates. Train each venue **only on its own earlier days**. Evaluate that venue's baseline prior and candidate on the same later races. Min 100 strictly eligible training races and 30 strictly eligible held-out races per venue. Insufficient venues must explicitly abstain.
- Report trifecta log loss, winning-boat Brier score and frozen top-one/top-eight hit observations per venue; don't promote based on a single aggregate. These are not calibrated/approved production probabilities. No prices, settled payouts, bankroll actions, purchase selection or claims of profitable ROI.
- All generated artifacts stay in temporary CI storage. Do not merge or wire into LAB until the comparison is audited and the user has a clear independent promotion review.

## Reproduce
From an existing checkout of the pinned research data branch, separately from the working main/PR checkout:

```sh
python -m unittest discover -s tests -p test_inverse_venue_prototype_v1.py -v
python scripts/inverse-venue-prototype-v1.py \
  --days-dir /path/to/pinned-data/research/inverse-v1/days \
  --coverage /path/to/pinned-data/research/inverse-v1/coverage-v1.json \
  --data-sha "$(git -C /path/to/pinned-data rev-parse HEAD)" \
  --output /tmp/inverse-venue-prototype-v1-report.json
```

This first candidate is deliberately simple. It is a research **benchmark**, not an assertion that two selected PRE fields capture all the true mechanics. In particular, timestamp-certified card motor/grade inputs and historical T-3 odds remain unverified here, and even satisfactory retrospective fit does not replace a prospective, immutable SHADOW/FORWARD comparison with the actual current model.
