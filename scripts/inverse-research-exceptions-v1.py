#!/usr/bin/env python3
"""Audit immutable inverse-research exceptions without inventing missing labels.

This script is deliberately read-only to all source data. A missing source row
is not necessarily a scraper failure (race cancellation is another possibility).
Legacy snapshots without labelAvailability remain 'diagnosis not recorded'.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_NAMES = ("card", "tkz", "stt", "sui", "result", "payout")
STATUS_ACTIONS = {
    "NO_CARD": "VERIFY_THIRD_PARTY_CARD_FOR_RACE; LEAVE_ORIGINAL_INTACT",
    "SIX_RACER_IDENTITY_REJECTED": "MANUAL_IDENTITY_REVIEW; DO_NOT_FORCE_JOIN",
    "SOURCE_DATE_CONFLICT": "REVIEW_SOURCE_DATE_AND_PROVENANCE",
    "LABEL_CONFLICT": "REVIEW_ORIGINAL_VS_THIRD_PARTY_RESULT_OR_PAYOUT",
    "LABEL_INCOMPLETE": "DIAGNOSE_NON_STANDARD_RESULT_OR_MISSING_SOURCE",
}


def classify_missing(details):
    if not isinstance(details, dict):
        return ["DETAIL_NOT_RECORDED_IN_IMMUTABLE_SNAPSHOT"]
    missing = []
    for key in ("resultRowPresent", "resultTrifectaUsable", "payoutRowPresent",
                "payoutTrifectaUsable", "payoutYenUsable"):
        if details.get(key) is False:
            missing.append("NOT_" + key.upper())
    return missing or ["NO_MISSING_FIELDS_RECORDED"]


def audit_days(days_dir: Path) -> dict:
    seen, entries, statuses, per_venue, per_date = set(), [], collections.Counter(), {}, {}
    source_not_ok = collections.Counter()
    archived_dates = set()
    for path in sorted(days_dir.glob("????-??-??.json")):
        doc = json.loads(path.read_text(encoding="utf-8"))
        day = doc.get("date")
        if (doc.get("schema") != "boat-command-inverse-join-v1" or
            doc.get("researchOnly") is not True or
            doc.get("productionChanged") is not False or
            doc.get("prePostSeparated") is not True or
            day != path.stem or day in archived_dates):
            raise ValueError(f"UNSAFE_OR_DUPLICATE_DAY: {path}")
        dt.date.fromisoformat(day)
        archived_dates.add(day)
        sources = doc.get("sourceAudit") or {}
        for name in SOURCE_NAMES:
            if sources.get(name, {}).get("status") != "OK":
                source_not_ok[name] += 1
        for item in doc.get("races", []):
            rc = item.get("raceCode")
            if not isinstance(rc, str) or not re.fullmatch(r"\d{12}", rc) or rc[:8] != day.replace("-", ""):
                raise ValueError(f"INVALID_RACE_CODE: {rc}")
            if rc in seen:
                raise ValueError(f"DUPLICATE_RACE_ACROSS_DAYS: {rc}")
            seen.add(rc)
            status = item.get("status")
            if status == "ACCEPTED":
                if item.get("identityMatch") is not True or not isinstance(item.get("post"), dict):
                    raise ValueError(f"ACCEPTED_WITHOUT_VALID_LABEL: {rc}")
                continue
            venue = str(item.get("venue") or "") or None
            venue_code = rc[8:10]
            # Missing card/identity-rejected rows in existing immutable snapshots
            # intentionally omit venue text. Keep their numeric venue code.
            if venue is None:
                venue = "CODE_" + venue_code
            elif str(item.get("venueCode") or "") != venue_code:
                raise ValueError(f"VENUE_CODE_MISMATCH: {rc}")
            detail = item.get("labelAvailability")
            case = {
                "raceCode": rc, "date": day, "venue": venue,
                "venueCode": venue_code, "status": status or "UNKNOWN",
                "conflictReasons": item.get("conflicts") or [],
                "labelMissingReasons": classify_missing(detail)
                    if status in ("LABEL_CONFLICT", "LABEL_INCOMPLETE") else [],
                "archiveDetailRecorded": isinstance(detail, dict),
                "archiveDailySources": {
                    key: sources.get(key, {}).get("status", "UNKNOWN")
                    for key in SOURCE_NAMES
                },
                "nextStep": STATUS_ACTIONS.get(status,
                                               "MANUAL_UNCLASSIFIED_INVESTIGATION"),
            }
            statuses[case["status"]] += 1
            per_venue.setdefault(venue_code, collections.Counter())[case["status"]] += 1
            per_date.setdefault(day, collections.Counter())[case["status"]] += 1
            entries.append(case)
    return {
        "schema": "boat-command-inverse-exception-audit-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "immutableSourcesPreserved": True,
        "sourceAuthority": "THIRD_PARTY_PROVISIONAL_RESEARCH",
        "summary": {
            "archivedCalendarDays": len(archived_dates),
            "visitedRaces": len(seen),
            "unacceptedRaces": len(entries),
            "byStatus": dict(sorted(statuses.items())),
            "byVenueCode": {k: dict(sorted(v.items()))
                            for k, v in sorted(per_venue.items())},
            "daysWithSourceFileNotOk": dict(sorted(source_not_ok.items())),
            "unresolvedLegacyWithoutDetailedReason": sum(
                c["status"] in ("LABEL_INCOMPLETE", "LABEL_CONFLICT") and
                not c["archiveDetailRecorded"] for c in entries),
        },
        "byDate": {k: dict(sorted(v.items())) for k, v in sorted(per_date.items())},
        "exceptions": entries,
        "sourceDays": [{
            "date": p.stem, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()
        } for p in sorted(days_dir.glob("????-??-??.json"))],
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--days-dir", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    out = args.output.resolve()
    for name in ("live", "venues", "daily-lab", "rich-history-24", "baseline"):
        blocked = ROOT / name
        if out == blocked or blocked in out.parents:
            p.error("RESEARCH_ONLY_OUTPUT")
    if out.exists():
        p.error("IMMUTABLE_OUTPUT_ALREADY_EXISTS")
    result = audit_days(args.days_dir)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    print("INVERSE_EXCEPTION_REPORT",
          json.dumps(result["summary"], ensure_ascii=False))


if __name__ == "__main__":
    main()
