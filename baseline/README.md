# Frozen production baseline

`live-two-stage-v0260-frozen.js` is the complete production source snapshot taken before the main-prediction refactor (only the terminal newline is normalized).

- Baseline strategy: `GAMAGORI-TWO-STAGE-V0.29.1`
- Frozen source: `live-two-stage-v0260.js`
- Original source SHA-256: `aece1c8a96a229ac10e9b23e973c096d95c3baea1b605f083b2a7c119097c795`
- Frozen normalized snapshot SHA-256: `4b566de78d6d68fe302befb2ce830be8836895fd7e16f597ac763f444fa06847`
- Production loading: forbidden; this directory is only for reproducible comparison.
- Mutation rule: do not edit this snapshot. New experiments must use new versioned files.

The baseline evaluator must use only rows with `history.date < target.date`.
