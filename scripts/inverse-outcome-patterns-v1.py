#!/usr/bin/env python3
"""Descriptive, outcome-first per-venue pattern discovery over joined day snapshots.

This is a hypothesis generator, NOT an evaluated or deployable prediction model.
Never read POST fields while deriving PRE feature keys. In-sample payouts cannot
justify a purchase or promotion. Replay/forward evidence must be separate.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
import statistics
from pathlib import Path


def numeric(v):
    try:
        n = float(v)
        return n if math.isfinite(n) else None
    except (ValueError, TypeError):
        return None


def wind_bucket(wind):
    n = numeric(wind)
    if n is None or not 0 <= n <= 40:
        return None
    if n < 2:
        return "0-1m"
    if n < 4:
        return "2-3m"
    if n < 6:
        return "4-5m"
    return "6m+"


def fast_exhibition_lane(value):
    if not isinstance(value, list) or len(value) != 6:
        return None
    t = [numeric(b.get("exhibitionTime")) for b in value]
    if any(x is None or not 4.0 <= x <= 10 for x in t):
        return None
    fastest = min(t)
    winners = [i + 1 for i, n in enumerate(t) if abs(n - fastest) < 1e-8]
    return winners[0] if len(winners) == 1 else None


def pre_features(row):
    """Feature derivation is restricted to timestamp-approved pre observations."""
    pre = row.get("pre") or {}
    tkz, sui = pre.get("tkz") or {}, pre.get("sui") or {}
    fast = (fast_exhibition_lane(tkz.get("value"))
            if tkz.get("status") == "ELIGIBLE_T_MINUS_3" else None)
    met = sui.get("value") if sui.get("status") == "ELIGIBLE_T_MINUS_3" else None
    wind = wind_bucket(met.get("windSpeedMps")) if isinstance(met, dict) else None
    return {"fastExhibitionBoat": fast, "windBucket": wind}


def load_documents(paths):
    seen, rows, dates, sources = set(), [], set(), []
    for path in paths:
        raw = Path(path).read_bytes()
        doc = json.loads(raw)
        if doc.get("schema") != "boat-command-inverse-join-v1":
            raise ValueError(f"INVALID_RESEARCH_SCHEMA: {path}")
        if not (doc.get("researchOnly") is True
                and doc.get("productionChanged") is False
                and doc.get("prePostSeparated") is True):
            raise ValueError(f"UNSAFE_INPUT_CONTRACT: {path}")
        sources.append({"path": str(path), "sha256": hashlib.sha256(raw).hexdigest()})
        dates.add(doc.get("date"))
        for row in doc.get("races", []):
            rc = row.get("raceCode")
            if not rc or rc in seen:
                raise ValueError(f"MISSING_OR_DUPLICATE_RACE_CODE: {rc}")
            seen.add(rc)
            rows.append(row)
    return rows, sorted(dates), sources


def classify_post(post):
    """Actual course and result labels only: never invent visual race movements."""
    start = post.get("actualCourseStart") or []
    first_course = next((x["course"] for x in start
                         if x.get("boat") == post.get("winningBoat")), None)
    return {
        "winningBoat": post.get("winningBoat"),
        "winningActualCourse": first_course,
        "decisionRaw": post.get("decisionRaw") or "UNKNOWN",
    }


def summarize(rows, min_support=20):
    if min_support < 1:
        raise ValueError("MIN_SUPPORT_MUST_BE_POSITIVE")
    accepted = [r for r in rows if r.get("status") == "ACCEPTED" and r.get("post")]
    venue_total = collections.Counter(r["venue"] for r in accepted)
    venue_decisions = collections.defaultdict(collections.Counter)
    venue_win_lane = collections.defaultdict(collections.Counter)
    missing = collections.Counter()
    groups = collections.defaultdict(list)

    for r in accepted:
        post = r["post"]
        actual = post.get("actual")
        if not actual or not isinstance(post.get("payout100"), int):
            raise ValueError("ACCEPTED_ROW_REQUIRES_POST_LABELS")
        venue = r["venue"]
        c = classify_post(post)
        venue_decisions[venue][c["decisionRaw"]] += 1
        venue_win_lane[venue][str(c["winningBoat"])] += 1
        pre = pre_features(r)  # MUST NOT receive post data.
        fast, wind = pre["fastExhibitionBoat"], pre["windBucket"]
        if fast is None:
            missing["noEligibleFastExhibition"] += 1
        if wind is None:
            missing["noEligibleWindBucket"] += 1
        # Denominators count ALL accepted races matching pre conditions, not only wins.
        values = [("VENUE_ONLY", "all")]
        if wind is not None:
            values.append(("WIND", wind))
        if fast is not None:
            values.append(("FAST_EXHIBITION", str(fast)))
        if fast is not None and wind is not None:
            values.append(("WIND_AND_FAST", wind + "|boat" + str(fast)))
        for dimension, condition in values:
            groups[(venue, dimension, condition)].append(
                (actual, post["payout100"]))

    supported = []
    unsupported = collections.Counter()
    for (venue, dimension, condition), events in sorted(groups.items()):
        denominator = len(events)
        if denominator < min_support:
            unsupported[dimension] += 1
            continue
        counts = collections.Counter(actual for actual, _ in events)
        # In-sample descriptive outcomes: payout-only observed ROI is NOT predictive ROI.
        outcome_rows = []
        for order, count in counts.most_common():
            winnings = [pay for actual, pay in events if actual == order]
            outcome_rows.append({
                "order": order, "historicalHits": count,
                "denominatorAllMatchingRaces": denominator,
                "observedConditionalFrequency": round(count / denominator, 6),
                "observedMeanPayout100Yen": round(statistics.mean(winnings), 2),
                "inSamplePayoutOnlyRoiIfBetEveryMatchingRace":
                    round(sum(winnings) / (denominator * 100), 6),
            })
        supported.append({
            "venue": venue, "dimension": dimension, "preCondition": condition,
            "denominatorAllMatchingRaces": denominator,
            "outcomes": outcome_rows,
            "purpose": "HYPOTHESIS_DISCOVERY_ONLY_NOT_FORWARD_VALIDATED",
        })

    venues = [{
        "venue": venue,
        "acceptedRaces": total,
        "decisionObserved": dict(venue_decisions[venue]),
        "winningBoatObserved": dict(venue_win_lane[venue]),
    } for venue, total in sorted(venue_total.items())]
    return {
        "schema": "boat-command-inverse-patterns-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "autoPromotion": False,
        "claimLevel": "IN_SAMPLE_DESCRIPTIVE_ASSOCIATIONS_ONLY",
        "strictPredictorSources": ["pre.tkz.ELIGIBLE_T_MINUS_3",
                                   "pre.sui.ELIGIBLE_T_MINUS_3"],
        "excludedUntilTimeValidated": ["pre.boats", "pre.cardTiming",
                                       "post", "payout", "actualCourseStart",
                                       "decisionRaw"],
        "sampleGate": {"minGroupRaces": min_support, "noCausalClaims": True},
        "totals": {
            "inputRows": len(rows), "acceptedLabeledRaces": len(accepted),
            "excludedNonAccepted": len(rows) - len(accepted),
            "venuesWithAcceptedRaces": len(venue_total),
            "supportedGroups": len(supported),
            "insufficientSampleGroupCounts": dict(unsupported),
            "preMissing": dict(missing),
        },
        "venues": venues,
        "conditionalPatterns": supported,
    }


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--input", required=True, action="append", type=Path,
                     help="Repeat for multiple independent joined day snapshots")
    cli.add_argument("--output", required=True, type=Path)
    cli.add_argument("--min-group-races", type=int, default=20)
    args = cli.parse_args()
    root = Path(__file__).resolve().parents[1]
    out = args.output.resolve()
    blocked = [root / p for p in ("live", "venues", "baseline", "daily-lab",
                                   "rich-history-24")]
    if any(out == p or p in out.parents for p in blocked):
        cli.error("RESEARCH_OUTPUT_ONLY")
    if out.exists():
        cli.error("IMMUTABLE_OUTPUT_ALREADY_EXISTS")
    rows, dates, sources = load_documents(args.input)
    report = summarize(rows, args.min_group_races)
    report["inputDates"] = dates
    report["inputSources"] = sources
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("INVERSE_PATTERNS", json.dumps(report["totals"], ensure_ascii=False))


if __name__ == "__main__":
    main()
