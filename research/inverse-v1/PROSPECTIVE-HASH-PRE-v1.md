# BOAT COMMAND — bounded prospective official PRE hash research v1

**Status: offline research fixture only until authorization and a real future PRE observation are independently verified.** This is separate from previous retrospective as-of PR #126 and program-only PR #127. None of the new source data or scripts feed production predictions, LAB, HARD LOCK, SHADOW, FORWARD, odds, TRY, bankroll or model promotion.

## Why the proposed raw-HTML archive was explicitly NOT deployed

The official [BOAT RACE site policy](https://www.boatrace.jp/owsp/sp/extra/policy.html) protects website content, restricts unauthorized reproduction/distribution beyond legally permitted uses and prohibits access volume that interferes with the site. We therefore did **not** retain or push entire HTML response bodies to this public research repository. Neither a Base64 encoding nor gzip makes redistribution of full website content safe. Additional live automated requests have **no schedule** and must not run until source use/authorization and rate limits are reviewed.

The original HTTP bytes are read **in memory only**, immediately hashed with SHA256 and parsed to minimal structured diagnostic counts. The durable output contains just the response SHA256, original byte length, canonical source URL, source-read started/completed times, six registration numbers and exhibition/start/weather section counts. No full original page, personal betting data or same-race result/payout is published.

**Limitation:** A stored SHA256 of discarded bytes cannot independently reconstruct the original response. It strengthens the contemporaneous provenance audit but is **not** equivalent to retaining and authenticating original HTTP source bytes. Do not label this as fully authenticated PRE history or use it in historical model scoring on its own.

## Implemented guardrails

- Candidate race comes exclusively from a result-free official `live/<venue>/<JST-today>/program/race-N.json` file, is between 8 and 25 minutes before its recorded deadline, and has six valid registrations.
- Fetcher constructs just `https://www.boatrace.jp/owpc/pc/race/racelist` and `beforeinfo` for exactly the identified venue/date/race. It refuses other endpoints and untrusted cross-domain redirects. It fetches no result or payout URLs.
- The freshly fetched official race card must **agree** with the earlier stored card on venue/date/race, all six registration/class/motor/boat identifiers, and deadline. Any conflict is excluded rather than inferred from later information.
- Both official response bodies must finish download at least **two minutes before T-minus-3**, on the correct Japanese race day, with monotonic recorded acquisition order. Capture fails shut on late results, race-day rollover, malformed identity, empty/oversized responses or absent beforeinfo markings.
- Two original response hashes and acquisition intervals, original source URLs, separate section counts, original exact racer IDs, research-only flags and the warning `independentServerPublicationProved=false` are written to new files **outside the repository**. No existing files are overwritten.
- Even a source with a green offline test **cannot** enable model input or prove the source was already saved on GitHub before the cutoff. An independent server-hosted artifact/commit-time gate would still be needed. This workflow does **not** claim that gate, nor does it create an auto-renewing workflow.

## Contract and bounded manual trial

```sh
python -m unittest discover -s tests -p test_research_prospective_raw_pre_v1.py -v
python scripts/research-prospective-raw-pre-v1.py \
  --archived-root /tmp/existing-research-hashes \
  --output-root /tmp/new-research-hashes \
  --max-fetch 4
```

The pull-request Action runs **offline tests only**. The separate manual `workflow_dispatch` job is gated behind `confirm_authorized_use=true` after checking access permissions and resource limits. If explicitly enabled after the workflow is merged, a single invocation selects at most four venues and two original official GET requests per selected race (up to eight requests), and uploads only hash/metadata JSON as a temporary seven-day artifact. It does not schedule or automatically collect anything. If no races satisfy its cutoff, it completes with zero observations rather than backfilling after results.

## Required next steps before any live or model use

1. Inspect the offline tests and code for leak-free boundaries, parser fidelity, forbidden endpoints and duplicate handling. If those checks fail, keep this PR draft and fix the observed failure rather than altering the old data.
2. Review official source-use rights and request limits for the intended research purpose. The code is ready for a bounded manual capture **only after** that review; do not bypass it with a cron.
3. Execute a real future race with authorization. Compare official raw response **in memory**, source SHA256, parsed field counts, fixed six-racer identity, independently observed deadline and actual on-server artifact creation time, verifying it all occurred before the T-minus-3 deadline.
4. Design a separate append-only, rights-compliant storage and independent GitHub server publication proof if ongoing collection is permitted; do not automatically rewrite any previous PRE snapshot or current prediction.
5. Keep all 24 venue model cycles independent and preserve the original negative holdout from PR #125. No new model or early approval follows automatically from obtaining more source fields.

Base main at this branch's creation: `464ce073f90caf986e6b97e5ab8cbdea0d53f487`. Re-read main and relevant workflow statuses before merging any research-only change; the repository's own workflows continue to advance independently.
