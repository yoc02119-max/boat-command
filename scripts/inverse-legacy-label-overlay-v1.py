#!/usr/bin/env python3
"""Immutable research-only legacy-label overlay for demonstrably absent vendor outcomes.

Existing BOAT COMMAND history supplies *labels only*, never extra pre-race
predictors. Original joined day snapshots are never rewritten. Skip ambiguous,
conflicting, partially present, or un-timestamped-source-diagnostic cases.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "boatracecsv-inverse-join-v1.py"
spec = importlib.util.spec_from_file_location("inverse_join_v1", SRC)
join = importlib.util.module_from_spec(spec)
spec.loader.exec_module(join)


def history_index(path: Path) -> dict:
    index = {}
    for src in sorted(path.glob("*-rich-history-v1.json")):
        doc_bytes = src.read_bytes()
        obj = json.loads(doc_bytes)
        code = str(obj["venueCode"]).zfill(2)
        venue = join.VENUES.get(code)
        if not venue or src.name != f"{venue}-rich-history-v1.json":
            raise ValueError(f"INVALID_SOURCE_VENUE: {src}")
        digest = hashlib.sha256(doc_bytes).hexdigest()
        for r in obj.get("races", []):
            race_code = join.compact_code(str(r["d"]), code, int(r["r"]))
            if race_code in index:
                raise ValueError(f"DUPLICATE_HISTORY_LABEL: {race_code}")
            labels = join.legacy_labels(r)
            index[race_code] = {
                "venue": venue, "originalSourceSha256": digest,
                "originalSourceFile": "rich-history-24/" + src.name,
                "labels": labels,
            }
    if len(set(v["venue"] for v in index.values())) != 24:
        raise ValueError("REQUIRES_COMPLETE_24_VENUE_ORIGINAL_HISTORY")
    return index


def vendor_fully_absent(row: dict) -> bool:
    details = row.get("labelAvailability")
    return bool(
        row.get("status") == "LABEL_INCOMPLETE" and
        row.get("identityMatch") is True and
        row.get("legacyLabelAvailable") is True and
        not row.get("conflicts") and
        isinstance(row.get("pre"), dict) and
        isinstance(details, dict) and
        details.get("resultRowPresent") is False and
        details.get("payoutRowPresent") is False
    )


def build_overlay(history_dir: Path, days_dir: Path) -> dict:
    index = history_index(history_dir)
    overrides = {}
    visited = set()
    skip = collections.Counter()
    archived_files = []
    pre_eligible = collections.Counter()
    for filename in sorted(days_dir.glob("????-??-??.json")):
        raw = filename.read_bytes()
        day_doc = json.loads(raw)
        day = filename.stem
        if (day_doc.get("schema") != "boat-command-inverse-join-v1" or
            day_doc.get("date") != day or
            day_doc.get("researchOnly") is not True or
            day_doc.get("productionChanged") is not False or
            day_doc.get("prePostSeparated") is not True):
            raise ValueError(f"UNSAFE_DAY: {filename}")
        dt.date.fromisoformat(day)
        snapshot_sha = hashlib.sha256(raw).hexdigest()
        archived_files.append({"date": day, "sha256": snapshot_sha})
        for row in day_doc.get("races", []):
            rc = row.get("raceCode")
            if not isinstance(rc, str) or len(rc) != 12 or rc in visited:
                raise ValueError(f"INVALID_OR_DUPLICATE_RACE: {rc}")
            if not rc.startswith(day.replace("-", "")) or not rc.isdigit():
                raise ValueError(f"BAD_RACE_DATE: {rc}")
            visited.add(rc)
            if not vendor_fully_absent(row):
                skip[row.get("status") or "UNKNOWN"] += 1
                continue
            original = index.get(rc)
            if original is None:
                skip["MISSING_ORIGINAL_LABEL_ROW"] += 1
                continue
            if original["venue"] != join.VENUES.get(rc[8:10]):
                raise ValueError(f"FALLBACK_VENUE_MISMATCH: {rc}")
            label = original["labels"]
            if label["actual"] is None or label["payout100"] is None or label["payout100"] <= 0:
                skip["ORIGINAL_STANDARD_TRIFECTA_UNAVAILABLE"] += 1
                continue
            eligible = all((row["pre"].get(section) or {}).get("status")
                           == "ELIGIBLE_T_MINUS_3" for section in ("tkz", "stt", "sui"))
            if eligible:
                pre_eligible[original["venue"]] += 1
            overrides[rc] = {
                "raceCode": rc, "date": day, "venue": original["venue"],
                "archivedDaySha256": snapshot_sha,
                "originalSourceSha256": original["originalSourceSha256"],
                "originalSourceFile": original["originalSourceFile"],
                "labelSource": "EXISTING_HISTORY_ONLY_WHEN_BOTH_VENDOR_ROWS_ABSENT",
                "preEligibleAllThreeAtTMinus3": eligible,
                "post": {
                    "actual": label["actual"], "payout100": label["payout100"],
                    "winningBoat": int(label["actual"][0]),
                    "decisionRaw": None, "actualCourseStart": [],
                    "resultAcquiredAt": None, "payoutAcquiredAt": None,
                },
            }
    return {
        "schema": "boat-command-legacy-label-overlay-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "tryChanged": False,
        "immutableOriginalDaysPreserved": True,
        "provenance": "EXISTING_RICH_HISTORY_AFTER_CONFIRMED_VENDOR_RESULT_AND_PAYOUT_ABSENCE",
        "strictLimitation": "NO_DECISION_OR_ACTUAL_ENTRY_OR_REAL_START_FROM_FALLBACK",
        "summary": {
            "visitedArchivedRaces": len(visited),
            "researchOnlyFallbackLabels": len(overrides),
            "fallbackWithAllThreeStrictPre": sum(pre_eligible.values()),
            "fallbackByVenue": dict(sorted(collections.Counter(
                x["venue"] for x in overrides.values()).items())),
            "skippedOtherStatuses": dict(sorted(skip.items())),
        },
        "archiveDaySources": archived_files,
        "overrides": overrides,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--history-dir", type=Path, default=ROOT / "rich-history-24")
    p.add_argument("--days-dir", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    out = args.output.resolve()
    blocked = [ROOT / p for p in ("live", "venues", "baseline", "daily-lab", "rich-history-24")]
    if out.exists() or any(out == x or x in out.parents for x in blocked):
        p.error("RESEARCH_ONLY_IMMUTABLE_OUTPUT_REQUIRED")
    report = build_overlay(args.history_dir, args.days_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    print("INVERSE_LEGACY_OVERLAY", json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
