#!/usr/bin/env python3
"""Research-only venue-isolated probability prototype with chronological holdout.

Reads immutable inverse-v1 days from a pinned *data branch checkout*. Never
uses same-race results, payouts, untimed cards, or other venues as predictors.
No LAB registration, live prediction, purchases or promotion.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import itertools
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTCOMES = tuple("-".join(t) for t in itertools.permutations("123456", 3))
TECHNIQUES = ("逃げ", "差し", "まくり", "まくり差し", "抜き", "恵まれ", "UNKNOWN")
COURSES = ("1", "2", "3", "4", "5", "6", "UNKNOWN")
SECTIONS = ("tkz", "stt", "sui")
VENUE_CODES = tuple(f"{i:02d}" for i in range(1, 25))


def parsed_time(value):
    try:
        stamp = dt.datetime.fromisoformat(value)
        return stamp if stamp.tzinfo is not None and stamp.utcoffset() is not None else None
    except (TypeError, ValueError):
        return None


def number(value, lower, upper):
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) and lower <= result <= upper else None


def safe_features(row):
    """PRE + cutoff only; pass a row only to enforce schema, never read its POST."""
    pre, cutoff = row.get("pre"), parsed_time(row.get("predictionCutoffJst"))
    if not isinstance(pre, dict) or cutoff is None:
        return None
    if cutoff.utcoffset() != dt.timedelta(hours=9):
        return None
    for section in SECTIONS:
        item = pre.get(section)
        if not isinstance(item, dict) or item.get("status") != "ELIGIBLE_T_MINUS_3":
            return None
        stamp = parsed_time(item.get("acquiredAt"))
        if (stamp is None or stamp > cutoff or stamp.date() != cutoff.date()
                or item.get("value") is None):
            return None
    tkz, stt, sui = (pre[k]["value"] for k in SECTIONS)
    if not isinstance(tkz, list) or len(tkz) != 6:
        return None
    if not isinstance(stt, list) or len(stt) != 6:
        return None
    if not isinstance(sui, dict):
        return None
    exhib = [number(boat.get("exhibitionTime"), 4, 10)
             if isinstance(boat, dict) else None for boat in tkz]
    if any(value is None for value in exhib):
        return None
    # Validate the entire start-exhibition section, even though v1 does not
    # use those ST measurements as predictors.
    if any(not isinstance(boat, dict) for boat in stt):
        return None
    wind = number(sui.get("windSpeedMps"), 0, 40)
    if wind is None:
        return None
    lowest = min(exhib)
    fastest = [i + 1 for i, value in enumerate(exhib) if abs(value - lowest) < 1e-9]
    if len(fastest) != 1:
        return None
    bucket = "0-1m" if wind < 2 else "2-3m" if wind < 4 else "4-5m" if wind < 6 else "6m+"
    return (str(fastest[0]), bucket)


def valid_label(row):
    if row.get("status") != "ACCEPTED" or row.get("identityMatch") is not True:
        return False
    post = row.get("post")
    return (isinstance(post, dict) and post.get("actual") in OUTCOMES
            and isinstance(post.get("payout100"), int)
            and post["payout100"] >= 0)


def technique(post):
    raw = re.sub(r"[\s\u3000]+", "", str(post.get("decisionRaw") or ""))
    return raw if raw in TECHNIQUES else "UNKNOWN"


def winner_course(post):
    winner = int(post["actual"][0])
    entries = post.get("actualCourseStart")
    if not isinstance(entries, list) or len(entries) != 6:
        return "UNKNOWN"
    match = [str(x.get("course")) for x in entries
             if isinstance(x, dict) and x.get("boat") == winner and x.get("course") in range(1, 7)]
    return match[0] if len(match) == 1 else "UNKNOWN"


def smooth(counter, labels, alpha=0.3):
    total = sum(counter.values()) + alpha * len(labels)
    return {key: (counter[key] + alpha) / total for key in labels}


def combine(prior, observed, strength):
    n = sum(observed.values())
    if n == 0:
        return dict(prior)
    return {key: (observed[key] + strength * prior[key]) / (n + strength)
            for key in prior}


def counts(rows, label_fn):
    overall = collections.Counter()
    fastest = collections.defaultdict(collections.Counter)
    joint = collections.defaultdict(collections.Counter)
    for features, row in rows:
        label = label_fn(row["post"])
        overall[label] += 1
        fastest[features[0]][label] += 1
        joint[features][label] += 1
    return overall, fastest, joint


def estimate(stats, features, labels):
    overall, fastest, joint = stats
    baseline = smooth(overall, labels)
    by_fast = combine(baseline, fastest[features[0]], 85)
    conditional = combine(by_fast, joint[features], 105)
    return baseline, conditional


def fit(train):
    # Caller guarantees only this venue and strictly earlier calendar days.
    return {
        "trifecta": counts(train, lambda post: post["actual"]),
        "technique": counts(train, technique),
        "winnerActualCourse": counts(train, winner_course),
    }


def predict(model, features):
    baseline, candidate = estimate(model["trifecta"], features, OUTCOMES)
    development = {}
    for name, labels in (("technique", TECHNIQUES), ("winnerActualCourse", COURSES)):
        _, development[name] = estimate(model[name], features, labels)
    return {
        "venuePrior": baseline,
        "candidate": candidate,
        "development": development,
        "winningBoatGroups": {
            "inside_1_2": sum(p for order, p in candidate.items() if order[0] in "12"),
            "middle_3_4": sum(p for order, p in candidate.items() if order[0] in "34"),
            "outside_5_6": sum(p for order, p in candidate.items() if order[0] in "56"),
        },
    }


def top_k_hit(probabilities, actual, count):
    top = sorted(OUTCOMES, key=lambda label: (-probabilities[label], label))[:count]
    return int(actual in top)


def winning_brier(probabilities, actual):
    return sum((sum(prob for order, prob in probabilities.items() if order[0] == str(boat))
                - int(actual[0] == str(boat))) ** 2 for boat in range(1, 7)) / 6


def evaluate_rows(rows, min_train=100, min_holdout=30):
    dates = sorted(set(row["date"] for row in rows))
    if len(dates) < 8:
        raise ValueError("REQUIRES_AT_LEAST_EIGHT_ARCHIVED_DATES")
    split_at = dates[max(1, math.floor(len(dates) * 0.75))]
    venue_rows = collections.defaultdict(list)
    for row in rows:
        code = str(row["venueCode"]).zfill(2)
        if code not in VENUE_CODES:
            raise ValueError("UNKNOWN_VENUE")
        venue_rows[code].append(row)
    report = []
    for code in VENUE_CODES:
        all_rows = venue_rows[code]
        train, held = [], []
        reasons = collections.Counter()
        for row in all_rows:
            features = safe_features(row)
            if features is None:
                reasons["PRE_UNQUALIFIED"] += 1
                continue
            if not valid_label(row):
                reasons["LABEL_UNQUALIFIED"] += 1
                continue
            (train if row["date"] < split_at else held).append((features, row))
        venue = {"venueCode": code, "totalArchivedRows": len(all_rows),
                 "trainRaces": len(train), "holdoutRaces": len(held),
                 "excluded": dict(reasons)}
        if len(train) < min_train or len(held) < min_holdout:
            venue["status"] = "INSUFFICIENT_CHRONOLOGICAL_EVIDENCE"
            report.append(venue)
            continue
        model = fit(train)
        metrics = {name: collections.Counter() for name in ("venuePrior", "candidate")}
        for features, row in held:
            prediction = predict(model, features)
            actual = row["post"]["actual"]  # Evaluation labels only, AFTER prediction.
            for name in metrics:
                p = prediction[name]
                metrics[name]["logLoss"] += -math.log(p[actual])
                metrics[name]["winningBoatBrier"] += winning_brier(p, actual)
                metrics[name]["top1Hits"] += top_k_hit(p, actual, 1)
                metrics[name]["top8Hits"] += top_k_hit(p, actual, 8)
        venue["status"] = "HOLDOUT_EVALUATED_NO_PROMOTION_CLAIM"
        venue["metrics"] = {
            name: {"meanTrifectaLogLoss": round(m["logLoss"] / len(held), 6),
                   "meanWinnerBrier": round(m["winningBoatBrier"] / len(held), 6),
                   "top1Hits": m["top1Hits"], "top8Hits": m["top8Hits"],
                   "top1Rate": round(m["top1Hits"] / len(held), 6),
                   "top8Rate": round(m["top8Hits"] / len(held), 6)}
            for name, m in metrics.items()}
        # This prototype makes NO claim of calibrated probabilities or profitability.
        venue["previewExample"] = {
            "date": held[0][1]["date"],
            "raceCode": held[0][1]["raceCode"],
            "features": {"fastestExhibitionBoat": held[0][0][0], "windBucket": held[0][0][1]},
            "developmentProbabilities": predict(model, held[0][0])["development"],
            "winningBoatGroups": predict(model, held[0][0])["winningBoatGroups"],
        }
        report.append(venue)
    return {
        "schema": "boat-command-inverse-venue-prototype-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "tryChanged": False,
        "autoPromotion": False, "claimLevel": "PRELIMINARY_CHRONOLOGICAL_HOLDOUT_ONLY",
        "featurePolicy": "T_MINUS_3_THREE_ELIGIBLE_PREVIEWS_ONLY_NO_UNTIMED_CARD",
        "trainEndExclusive": split_at,
        "holdoutStartInclusive": split_at,
        "holdoutDates": len([day for day in dates if day >= split_at]),
        "allArchivedDates": len(dates),
        "summary": {
            "venueCount": 24,
            "evaluatedVenues": sum(v.get("metrics") is not None for v in report),
            "totalTrainRaces": sum(v["trainRaces"] for v in report),
            "totalHoldoutRaces": sum(v["holdoutRaces"] for v in report),
            "unqualified": sum(sum(v["excluded"].values()) for v in report),
        },
        "venues": report,
    }


def load_verified_days(days_dir, coverage):
    expected = {item["date"]: item["sha256"] for item in coverage["archivedDayFiles"]}
    files = {item.stem: item for item in days_dir.glob("????-??-??.json")}
    if set(files) != set(expected) or len(files) != len(expected):
        raise ValueError("ARCHIVED_DAY_COVERAGE_INCONSISTENT")
    rows, seen = [], set()
    for date in sorted(expected):
        raw = files[date].read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected[date]:
            raise ValueError("IMMUTABLE_DAY_HASH_MISMATCH")
        doc = json.loads(raw)
        if (doc.get("date") != date or doc.get("researchOnly") is not True
                or doc.get("productionChanged") is not False
                or doc.get("prePostSeparated") is not True):
            raise ValueError("UNSAFE_DAY_DOCUMENT")
        for row in doc["races"]:
            race_code = row["raceCode"]
            if race_code in seen:
                raise ValueError("DUPLICATE_RACE_CODE")
            seen.add(race_code)
            # Rejected rows need their venue restored from immutable raceCode.
            item = dict(row)
            item.setdefault("venueCode", race_code[8:10])
            item.setdefault("date", date)
            rows.append(item)
    return rows


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--days-dir", type=Path, required=True)
    cli.add_argument("--coverage", type=Path, required=True)
    cli.add_argument("--data-sha", required=True)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    out = args.output.resolve()
    if out == ROOT or ROOT in out.parents or out.exists():
        cli.error("OUTPUT_MUST_BE_NEW_AND_OUTSIDE_REPOSITORY")
    if not re.fullmatch(r"[a-f0-9]{40}", args.data_sha):
        cli.error("REQUIRES_PINNED_DATA_BRANCH_SHA")
    coverage = json.loads(args.coverage.read_text(encoding="utf-8"))
    if (coverage.get("schema") != "boat-command-inverse-research-coverage-v1"
            or coverage.get("researchOnly") is not True
            or coverage.get("productionChanged") is not False
            or coverage["summary"]["venues"] != 24):
        raise ValueError("INVALID_RESEARCH_COVERAGE")
    rows = load_verified_days(args.days_dir, coverage)
    report = evaluate_rows(rows)
    report["dataBranchSHA"] = args.data_sha
    report["archivedDayFilesVerified"] = len(coverage["archivedDayFiles"])
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("RESEARCH_VENUE_PROTOTYPE", json.dumps(report["summary"]))


if __name__ == "__main__":
    main()
