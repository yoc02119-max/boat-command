#!/usr/bin/env python3
"""Auditable 24-venue coverage of immutable third-party inverse research days.

Research-only diagnostic: distinguishes source history, archived day snapshots,
verified six-racer joins, and timestamp-eligible pre-race features. Nothing here
claims that all archived program-card features were known before the race.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECTIONS = ("tkz", "stt", "sui")


def load_history(history_dir: Path) -> tuple[dict, dict]:
    venues = {}
    expected_codes = set()
    for source in sorted(history_dir.glob("*-rich-history-v1.json")):
        doc = json.loads(source.read_text(encoding="utf-8"))
        slug = source.name.removesuffix("-rich-history-v1.json")
        code = str(doc["venueCode"]).zfill(2)
        if code in expected_codes or slug in venues:
            raise ValueError(f"DUPLICATE_VENUE_HISTORY: {source}")
        expected_codes.add(code)
        rows = doc.get("races", [])
        dates = {str(row["d"]) for row in rows}
        expected = set()
        for row in rows:
            rc = str(row["d"]).replace("-", "") + code + f"{int(row['r']):02d}"
            if rc in expected:
                raise ValueError(f"DUPLICATE_HISTORY_RACE: {rc}")
            expected.add(rc)
        venues[slug] = {
            "venueCode": code,
            "sourceRaces": len(expected),
            "sourceVenueDays": len(dates),
            "_expected": expected,
            "_dates": dates,
            "_archived": set(),
            "_accepted": 0,
            "_acceptedCodes": set(),
            "_reasons": collections.Counter(),
            "_preSectionStatus": {k: collections.Counter() for k in SECTIONS},
            "_preEligible": collections.Counter(),
            "_originalLabelMatched": 0,
            "_daysWithTargets": set(),
        }
    if len(venues) != 24 or len(expected_codes) != 24:
        raise ValueError(f"REQUIRES_COMPLETE_24_VENUE_HISTORY: {len(venues)}")
    return venues, {}


def build_coverage(history_dir: Path, days_dir: Path) -> dict:
    venues, _ = load_history(history_dir)
    seen = set()
    dates = set()
    no_target_days = []
    source_file_states = {k: collections.Counter() for k in
                          ("card", "tkz", "stt", "sui", "result", "payout")}
    all_days = sorted(days_dir.glob("????-??-??.json"))
    for file in all_days:
        raw = file.read_bytes()
        doc = json.loads(raw)
        if doc.get("schema") != "boat-command-inverse-join-v1":
            raise ValueError(f"INVALID_DAY_SCHEMA: {file}")
        if (doc.get("researchOnly") is not True or
                doc.get("productionChanged") is not False or
                doc.get("prePostSeparated") is not True):
            raise ValueError(f"UNSAFE_DAY: {file}")
        day = str(doc["date"])
        dt.date.fromisoformat(day)
        if file.stem != day or day in dates:
            raise ValueError(f"DUPLICATE_OR_WRONG_DAY: {file}")
        dates.add(day)
        audit = doc.get("sourceAudit") or {}
        for source in source_file_states:
            source_file_states[source][audit.get(source, {}).get("status", "UNRECORDED")] += 1
        races = doc.get("races", [])
        if not races:
            if doc.get("status") != "NO_EXISTING_TARGETS":
                raise ValueError(f"EMPTY_DAY_NOT_EXPLAINED: {day}")
            no_target_days.append(day)
        for row in races:
            rc = row["raceCode"]
            venue = row.get("venue")
            if rc in seen:
                raise ValueError(f"DUPLICATE_ARCHIVED_RACE: {rc}")
            if venue not in venues or rc not in venues[venue]["_expected"]:
                raise ValueError(f"ORPHAN_ARCHIVED_RACE: {rc} {venue}")
            seen.add(rc)
            v = venues[venue]
            v["_archived"].add(rc)
            v["_daysWithTargets"].add(day)
            status = row.get("status") or "UNKNOWN"
            v["_reasons"][status] += 1
            if status != "ACCEPTED":
                continue
            if row.get("identityMatch") is not True or not isinstance(row.get("post"), dict):
                raise ValueError(f"ACCEPTED_MISSING_IDENTITY_OR_POST: {rc}")
            v["_accepted"] += 1
            v["_acceptedCodes"].add(rc)
            if row.get("legacyLabelAvailable") is True:
                v["_originalLabelMatched"] += 1
            pre = row.get("pre") or {}
            eligible_all = True
            for section in SECTIONS:
                state = (pre.get(section) or {}).get("status") or "UNRECORDED"
                v["_preSectionStatus"][section][state] += 1
                if state == "ELIGIBLE_T_MINUS_3":
                    v["_preEligible"][section] += 1
                    if (pre[section].get("value") is None or
                            pre[section].get("acquiredAt") is None):
                        raise ValueError(f"INVALID_PRE_ELIGIBILITY: {rc} {section}")
                else:
                    eligible_all = False
                    if (pre.get(section) or {}).get("value") is not None:
                        raise ValueError(f"UNSAFE_PRE_VALUE: {rc} {section}")
            if eligible_all:
                v["_preEligible"]["allThree"] += 1

    output = []
    for slug, v in sorted(venues.items(), key=lambda x: x[1]["venueCode"]):
        if v["_accepted"] > len(v["_archived"]):
            raise ValueError(f"INVALID_ACCEPTED_COUNT: {slug}")
        source_count = v["sourceRaces"]
        archived = len(v["_archived"])
        accepted = v["_accepted"]
        missing = sorted(v["_dates"] - v["_daysWithTargets"])
        output.append({
            "venue": slug,
            "venueCode": v["venueCode"],
            "sourceRaces": source_count,
            "sourceVenueDays": v["sourceVenueDays"],
            "archivedTargetRaces": archived,
            "remainingUnarchivedRaces": source_count - archived,
            "acceptedJoinedRaces": accepted,
            "nonAcceptedArchivedRaces": archived - accepted,
            "sourceCoverageRatio": round(archived / source_count, 6) if source_count else None,
            "acceptedToSourceRatio": round(accepted / source_count, 6) if source_count else None,
            "archivedVenueDaysWithTargets": len(v["_daysWithTargets"]),
            "pendingVenueDaysWithTargets": len(missing),
            "nextPendingDay": missing[-1] if missing else None,
            "statusReasons": dict(sorted(v["_reasons"].items())),
            "legacyLabelMatchedRaces": v["_originalLabelMatched"],
            "preStrictTMinus3": dict(v["_preEligible"]),
            "preStatusReasons": {k: dict(sorted(v["_preSectionStatus"][k].items()))
                                 for k in SECTIONS},
            "cardFieldsStrictlyTimeVerified": False,
        })
    target = sum(v["sourceRaces"] for v in output)
    archived = sum(v["archivedTargetRaces"] for v in output)
    accepted = sum(v["acceptedJoinedRaces"] for v in output)
    unique_expected_dates = set().union(*(v["_dates"] for v in venues.values()))
    return {
        "schema": "boat-command-inverse-research-coverage-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False,
        "sourcePolicy": "THIRD_PARTY_PROVISIONAL_NOT_OFFICIALLY_VERIFIED",
        "caveat": "Card source timestamp unknown; strict pre eligibility counts previews only",
        "summary": {
            "venues": len(output), "sourceRaces": target,
            "archivedTargetRaces": archived,
            "remainingUnarchivedRaces": target - archived,
            "acceptedJoinedRaces": accepted,
            "nonAcceptedArchivedRaces": archived - accepted,
            "archivedCalendarDays": len(dates),
            "expectedCalendarDaysInSource": len(unique_expected_dates),
            "emptyArchivedCalendarDays": len(no_target_days),
            "preStrictTMinus3": {
                k: sum(v["preStrictTMinus3"].get(k, 0) for v in output)
                for k in (*SECTIONS, "allThree")},
            "sourceDailyFileStatus": {
                k: dict(v) for k, v in source_file_states.items()},
            "allSourceTargetsVisited": archived == target,
        },
        "venues": output,
        "archivedDayFiles": [{
            "date": p.stem, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
            for p in all_days],
    }


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--history-dir", type=Path, default=ROOT / "rich-history-24")
    cli.add_argument("--days-dir", type=Path, required=True)
    cli.add_argument("--output", type=Path, required=True)
    args = cli.parse_args()
    out = args.output.resolve()
    for root in ("live", "venues", "baseline", "daily-lab", "rich-history-24"):
        forbidden = ROOT / root
        if out == forbidden or forbidden in out.parents:
            cli.error("RESEARCH_OUTPUT_ONLY")
    if out.exists():
        cli.error("IMMUTABLE_OUTPUT_ALREADY_EXISTS")
    report = build_coverage(args.history_dir, args.days_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    print("INVERSE_RESEARCH_COVERAGE",
          json.dumps(report["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
