#!/usr/bin/env python3
"""Research-only as-of audit of stored official and vendor PRE provenance.

A later official web page or a current rewritten program pack is NOT evidence
that its contents existed at an earlier prediction cutoff. This script NEVER
releases historical card fields to a model and NEVER reads same-race POST labels.
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
JST = dt.timezone(dt.timedelta(hours=9))
VENUES = {
    "01": "kiryu", "02": "toda", "03": "edogawa", "04": "heiwajima",
    "05": "tamagawa", "06": "hamanako", "07": "gamagori", "08": "tokoname",
    "09": "tsu", "10": "mikuni", "11": "biwako", "12": "suminoe",
    "13": "amagasaki", "14": "naruto", "15": "marugame", "16": "kojima",
    "17": "miyajima", "18": "tokuyama", "19": "shimonoseki",
    "20": "wakamatsu", "21": "ashiya", "22": "fukuoka", "23": "karatsu",
    "24": "omura",
}
# One current file is not historical proof: the pair may have been rewritten.
PROGRAM_FIELDS = (
    "registration", "class", "fCount", "lCount", "avgST",
    "nationalWinRate", "national2Rate", "national3Rate",
    "localWinRate", "local2Rate", "local3Rate", "motor",
    "motor2Rate", "boat", "boat2Rate",
)


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def observed(value):
    try:
        stamp = dt.datetime.fromisoformat(value)
    except (TypeError, ValueError):
        return None
    if stamp.tzinfo is None or stamp.utcoffset() != dt.timedelta(hours=9):
        return None
    return stamp


def cutoff_for(date, deadline):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(date)):
        return None
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", str(deadline)):
        return None
    try:
        return dt.datetime.fromisoformat(date + "T" + deadline).replace(
            tzinfo=JST) - dt.timedelta(minutes=3)
    except ValueError:
        return None


def six_identity(doc):
    boats = doc.get("boats")
    if not isinstance(boats, list) or len(boats) != 6:
        return None
    result = {}
    for b in boats:
        if not isinstance(b, dict) or type(b.get("lane")) is not int:
            return None
        lane = b["lane"]
        if lane not in range(1, 7) or lane in result:
            return None
        try:
            reg = int(b["registration"])
        except (ValueError, TypeError, KeyError):
            return None
        if reg <= 0:
            return None
        result[lane] = reg
    return tuple(result.get(i) for i in range(1, 7)) if len(result) == 6 else None


def program_field_drift(program, pre):
    a = {b["lane"]: b for b in program["boats"]}
    b = {x["lane"]: x for x in pre["boats"]}
    fields = {}
    for lane in range(1, 7):
        for name in PROGRAM_FIELDS:
            if name in a[lane] and name in b[lane] and a[lane][name] != b[lane][name]:
                fields[name] = fields.get(name, 0) + 1
    return fields


def audit_live_pair(program, pre, date, race):
    """A compatible timestamp is still NOT independently signed/immutable proof."""
    if pre is None:
        return {"status": "NO_PRE_RICH_CAPTURE", "strictCardUsePermitted": False}
    if (pre.get("date") != date or pre.get("race") != race
            or pre.get("resultEndpointsIncluded") is not False
            or pre.get("payoutEndpointsIncluded") is not False):
        return {"status": "PRE_RICH_BOUNDARY_INVALID", "strictCardUsePermitted": False}
    deadline = pre.get("deadline")
    if program is not None and (program.get("date") != date
                                or program.get("race") != race
                                or program.get("deadline") != deadline
                                or program.get("resultEndpointsIncluded") is not False
                                or program.get("resultIncluded") is not False):
        return {"status": "PROGRAM_BOUNDARY_INVALID", "strictCardUsePermitted": False}
    cutoff = cutoff_for(date, deadline)
    pre_stamp = observed(pre.get("fetchedAt"))
    if cutoff is None or pre_stamp is None:
        return {"status": "PRE_RICH_TIME_UNVERIFIABLE", "strictCardUsePermitted": False}
    if pre_stamp > cutoff:
        return {"status": "PRE_RICH_AFTER_T_MINUS_3", "strictCardUsePermitted": False}
    if program is None:
        return {"status": "PROGRAM_SNAPSHOT_MISSING", "strictCardUsePermitted": False}
    a, b = six_identity(program), six_identity(pre)
    if a is None or b is None or a != b:
        return {"status": "SIX_RACER_IDENTITY_MISMATCH", "strictCardUsePermitted": False}
    drift = program_field_drift(program, pre)
    program_stamp = observed(program.get("fetchedAt"))
    if program_stamp is None:
        status = "PROGRAM_TIME_UNVERIFIABLE"
    elif program_stamp > cutoff or program_stamp > pre_stamp:
        status = "CURRENT_PROGRAM_IS_LATER_THAN_PRE_RICH"
    elif drift:
        status = "PROGRAM_FIELD_DRIFT"
    else:
        status = "RELATIVE_TIMES_COMPATIBLE_UNPROVEN"
    # Git as-of blob + commit evidence for this exact pair has NOT been checked.
    return {"status": status, "strictCardUsePermitted": False,
            "preRichCapturedAt": pre_stamp.isoformat(),
            "currentProgramCapturedAt": program_stamp.isoformat() if program_stamp else None,
            "cutoff": cutoff.isoformat(), "fieldDrift": drift}


def scan_live(live_root):
    counts, examples = {}, {}
    for code, slug in VENUES.items():
        by_status = collections.Counter()
        drift = collections.Counter()
        samples = []
        for folder in sorted((live_root / slug).glob("????-??-??")):
            pdir, rich = folder / "program", folder / "pre-rich"
            races = sorted({int(m.group(1)) for base in (pdir, rich)
                            for path in base.glob("race-*.json")
                            if (m := re.fullmatch(r"race-(\d+)\.json", path.name))})
            for race in races:
                pfile, qfile = pdir / f"race-{race}.json", rich / f"race-{race}.json"
                try:
                    p = load(pfile) if pfile.is_file() else None
                    q = load(qfile) if qfile.is_file() else None
                    item = audit_live_pair(p, q, folder.name, race)
                except (ValueError, OSError, KeyError, json.JSONDecodeError):
                    item = {"status": "STORED_FILE_INVALID", "strictCardUsePermitted": False}
                by_status[item["status"]] += 1
                drift.update(item.get("fieldDrift") or {})
                if len(samples) < 3 and item["status"] in (
                        "CURRENT_PROGRAM_IS_LATER_THAN_PRE_RICH",
                        "PROGRAM_FIELD_DRIFT", "RELATIVE_TIMES_COMPATIBLE_UNPROVEN"):
                    samples.append({"date": folder.name, "race": race,
                                    "status": item["status"],
                                    "currentProgramCapturedAt": item.get("currentProgramCapturedAt"),
                                    "preRichCapturedAt": item.get("preRichCapturedAt"),
                                    "cutoff": item.get("cutoff")})
        counts[slug] = {"venueCode": code, "pairedOrUnpairedRows": sum(by_status.values()),
                        "byStatus": dict(sorted(by_status.items())),
                        "comparedFieldDrift": dict(sorted(drift.items()))}
        examples[slug] = samples
    return counts, examples


def scan_historical(historic_root):
    output = {}
    for code, slug in VENUES.items():
        days, rows, field_complete, unknown = 0, 0, 0, 0
        for path in sorted((historic_root / slug).glob("????-??-??.json")):
            doc = load(path)
            if (doc.get("venueCode") != code or doc.get("date") != path.stem
                    or doc.get("resultEndpointsIncluded") is not False
                    or doc.get("payoutEndpointsIncluded") is not False):
                raise ValueError(f"UNSAFE_OFFICIAL_HISTORICAL_ARCHIVE: {path}")
            days += 1
            for item in doc["races"]:
                rows += 1
                count = (item.get("fieldStatus") or {})
                if (count.get("exhibitionTimeCount") == 6
                        and count.get("startExhibitionSTCount") == 6
                        and count.get("weatherCoreCount") == 4):
                    field_complete += 1
                # Fetch duration and water's "as of" display text are NOT
                # an authenticated per-race fetch timestamp at the target cutoff.
                unknown += 1
        output[slug] = {"venueCode": code, "storedDays": days,
                        "racePages": rows, "allThreeParsed": field_complete,
                        "strictPreTimingUnproven": unknown, "strictCardUsePermitted": False}
    return output


def scan_vendor(data_root):
    coverage_file = data_root / "coverage-v1.json"
    coverage = load(coverage_file)
    if (coverage.get("schema") != "boat-command-inverse-research-coverage-v1"
            or coverage.get("researchOnly") is not True
            or coverage.get("productionChanged") is not False
            or len(coverage.get("venues", [])) != 24):
        raise ValueError("VENDOR_COVERAGE_INVALID")
    manifests = {d["date"]: d["sha256"] for d in coverage["archivedDayFiles"]}
    found = {p.stem: p for p in (data_root / "days").glob("????-??-??.json")}
    if len(manifests) != len(coverage["archivedDayFiles"]) or set(manifests) != set(found):
        raise ValueError("VENDOR_ARCHIVE_DATE_MISMATCH")
    per_venue = {slug: collections.Counter() for slug in VENUES.values()}
    for date in sorted(manifests):
        path = found[date]
        raw = path.read_bytes()
        if hashlib.sha256(raw).hexdigest() != manifests[date]:
            raise ValueError("VENDOR_ARCHIVED_DAY_HASH_MISMATCH")
        doc = json.loads(raw)
        if not (doc.get("date") == date and doc.get("researchOnly") is True
                and doc.get("productionChanged") is False
                and doc.get("prePostSeparated") is True):
            raise ValueError("UNSAFE_ARCHIVED_VENDOR_DAY")
        for row in doc["races"]:
            slug = VENUES.get(str(row["raceCode"])[8:10])
            if slug is None:
                raise ValueError("UNKNOWN_ARCHIVED_VENUE")
            per_venue[slug]["visited"] += 1
            pre = row.get("pre")
            if not isinstance(pre, dict):
                per_venue[slug]["noJoinedCard"] += 1
                continue
            # Even a perfectly complete full-day card cannot prove pre-cutoff.
            if pre.get("cardTiming") != "UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL":
                raise ValueError("UNKNOWN_VENDOR_CARD_TIME_POLICY_CHANGED_REVIEW_REQUIRED")
            per_venue[slug]["identityJoinedCardButUntimed"] += 1
            if row.get("status") == "ACCEPTED":
                per_venue[slug]["acceptedLabels"] += 1
                if all((pre.get(k) or {}).get("status") == "ELIGIBLE_T_MINUS_3"
                       for k in ("tkz", "stt", "sui")):
                    per_venue[slug]["eligibleThreePreviewSections"] += 1
    output = {}
    for item in coverage["venues"]:
        slug = item["venue"]
        counts = per_venue[slug]
        if (counts["visited"] != item["archivedTargetRaces"]
                or counts["acceptedLabels"] != item["acceptedJoinedRaces"]
                or counts["eligibleThreePreviewSections"] != item["preStrictTMinus3"]["allThree"]):
            raise ValueError(f"VENDOR_MANIFEST_RECONCILIATION_FAILED: {slug}")
        output[slug] = {"venueCode": item["venueCode"],
                        **{k: counts[k] for k in ("visited", "noJoinedCard",
                            "identityJoinedCardButUntimed", "acceptedLabels",
                            "eligibleThreePreviewSections")},
                        "strictCardUsePermitted": False}
    return {"pinnedArchiveDays": len(manifests), "venues": output,
            "sourceTotals": coverage["summary"]}


def main():
    cli = argparse.ArgumentParser()
    cli.add_argument("--live-root", type=Path, default=ROOT / "live")
    cli.add_argument("--historical-root", type=Path,
                     default=ROOT / "historical-beforeinfo-24")
    cli.add_argument("--vendor-data-root", required=True, type=Path)
    cli.add_argument("--vendor-sha", required=True)
    cli.add_argument("--output", required=True, type=Path)
    args = cli.parse_args()
    output = args.output.resolve()
    if output == ROOT or ROOT in output.parents or output.exists():
        cli.error("OUTPUT_MUST_BE_NEW_OUTSIDE_REPOSITORY")
    if not re.fullmatch(r"[a-f0-9]{40}", args.vendor_sha):
        cli.error("VENDOR_DATA_SHA_REQUIRED")
    live, examples = scan_live(args.live_root)
    historical = scan_historical(args.historical_root)
    vendor = scan_vendor(args.vendor_data_root)
    report = {
        "schema": "boat-command-research-asof-provenance-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "hardLockChanged": False,
        "autoPromotion": False, "strictHistoricalCardFieldsReleased": 0,
        "vendorDataSHA": args.vendor_sha,
        "policy": ("Official historical page retrieval is AFTER-EVENT evidence; "
                   "vendor full-day cards lack proven as-of time; current live "
                   "program file may be overwritten. A relative fetchedAt match "
                   "does not prove immutable pre-cutoff program contents."),
        "summary": {
            "venues": 24,
            "liveRaceRows": sum(x["pairedOrUnpairedRows"] for x in live.values()),
            "liveStatusCounts": dict(sum(
                (collections.Counter(x["byStatus"]) for x in live.values()),
                collections.Counter())),
            "historicalOfficialRacePages": sum(x["racePages"] for x in historical.values()),
            "historicalOfficialUntimedPages": sum(
                x["strictPreTimingUnproven"] for x in historical.values()),
            "vendorUntimedJoinedCards": sum(
                x["identityJoinedCardButUntimed"] for x in vendor["venues"].values()),
            "vendorEligibleAllThreePreviewAccepted": sum(
                x["eligibleThreePreviewSections"] for x in vendor["venues"].values()),
        },
        "venues": {
            slug: {"code": code, "live": live[slug], "officialHistorical": historical[slug],
                   "vendor": vendor["venues"][slug], "liveExamples": examples[slug]}
            for code, slug in VENUES.items()
        },
        "vendorSourceTotals": vendor["sourceTotals"],
        "vendorArchivedDaysVerified": vendor["pinnedArchiveDays"],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    print("RESEARCH_ASOF_PROVENANCE_AUDIT", json.dumps(report["summary"]))


if __name__ == "__main__":
    main()
