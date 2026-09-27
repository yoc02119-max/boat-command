#!/usr/bin/env python3
"""Prospective official raw PRE capture: research only, zero model imports.

Fetch only the ORIGINAL official racelist and beforeinfo page for an
imminent race. Persist their actual bytes + SHA256 and acquire timestamps.
A runner's wall clock is NOT independent GitHub publication evidence:
snapshots remain ineligible until a separate server-hosted before-cutoff audit.
Neither LIVE nor any existing prediction/TRY/finance data is ever written.
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import gzip
import hashlib
import importlib.util
import json
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
JST = ZoneInfo("Asia/Tokyo")
MIN_MINUTES_BEFORE_DEADLINE = 8
MAX_MINUTES_BEFORE_DEADLINE = 25
PUBLICATION_BUFFER = dt.timedelta(minutes=2)
MAX_RAW_BYTES = 400_000


class RejectedObservation(ValueError):
    pass


def import_script(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def valid_clock(value):
    if (not isinstance(value, dt.datetime) or value.tzinfo is None
            or value.utcoffset() != dt.timedelta(hours=9)):
        raise RejectedObservation("UNTRUSTED_RUNNER_TIMEZONE")
    return value


def timestamp(raw):
    try:
        return valid_clock(dt.datetime.fromisoformat(raw))
    except (ValueError, TypeError):
        return None


def cutoff(date, deadline):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(date)):
        return None
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", str(deadline)):
        return None
    try:
        return dt.datetime.fromisoformat(date+"T"+deadline).replace(
            tzinfo=JST)-dt.timedelta(minutes=3)
    except ValueError:
        return None


def original_urls(date, code, race):
    if (not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(date))
            or not re.fullmatch(r"\d{2}", str(code))
            or type(race) is not int or not 1 <= race <= 12):
        raise RejectedObservation("INVALID_SOURCE_ID")
    if code not in tuple(f"{n:02d}" for n in range(1, 25)):
        raise RejectedObservation("INVALID_VENUE_CODE")
    hd = date.replace("-", "")
    base = "https://www.boatrace.jp/owpc/pc/race/"
    tail = f"?hd={hd}&jcd={code}&rno={race}"
    return base+"racelist"+tail, base+"beforeinfo"+tail


def valid_bytes(raw):
    if not isinstance(raw, bytes) or not 1 <= len(raw) <= MAX_RAW_BYTES:
        raise RejectedObservation("EMPTY_OR_OVERSIZE_HTTP_RESPONSE")
    return raw


def decode(raw):
    for encoding in ("utf-8", "cp932", "shift_jis", "euc_jp"):
        try:
            return raw.decode(encoding)
        except UnicodeError:
            pass
    raise RejectedObservation("UNDECODABLE_OFFICIAL_SOURCE")


def as_captured(raw, url, started, ended):
    raw = valid_bytes(raw)
    return {
        "url": url, "byteLength": len(raw),
        "sha256OriginalBytes": hashlib.sha256(raw).hexdigest(),
        "gzipBase64OriginalBytes": base64.b64encode(
            gzip.compress(raw, mtime=0)).decode("ascii"),
        "fetchStartedAt": valid_clock(started).isoformat(),
        "fetchCompletedAt": valid_clock(ended).isoformat(),
    }


def runner_fetch(url):
    # No URL input from a saved document can reach this function.
    addr = urllib.parse.urlparse(url)
    if (addr.scheme != "https" or addr.hostname != "www.boatrace.jp"
            or addr.path not in ("/owpc/pc/race/racelist",
                                 "/owpc/pc/race/beforeinfo")):
        raise RejectedObservation("DISALLOWED_HTTP_ENDPOINT")
    req = urllib.request.Request(
        url, headers={"User-Agent": "BOAT-COMMAND-RAW-PRE-RESEARCH/1.0"})
    with urllib.request.urlopen(req, timeout=12) as r:
        redirected = urllib.parse.urlparse(r.geturl())
        if (redirected.scheme != "https" or redirected.hostname != "www.boatrace.jp"
                or redirected.path != addr.path):
            raise RejectedObservation("UNTRUSTED_HTTP_REDIRECT")
        raw = r.read(MAX_RAW_BYTES+1)
    return valid_bytes(raw)


def baseline_ok(program, now, code, date, race):
    if (program.get("schema") != "boat-command-program-pack-v1"
            or program.get("venueCode") != code
            or program.get("date") != date
            or program.get("race") != race
            or program.get("source") != "BOAT RACE official racelist"
            or program.get("programReady") is not True
            or program.get("exhibitionIncluded") is not False
            or program.get("resultEndpointsIncluded") is not False
            or program.get("resultIncluded") is not False
            or not isinstance(program.get("boats"), list)):
        return None
    saved = sorted(program["boats"], key=lambda boat: boat.get("lane", 0))
    if (len(saved) != 6 or [b.get("lane") for b in saved] != list(range(1, 7))
            or not all(type(b.get("registration")) is int and
                       b["registration"] > 0 for b in saved)):
        return None
    saved_at, target_cutoff = timestamp(program.get("fetchedAt")), cutoff(
        date, program.get("deadline"))
    if (saved_at is None or target_cutoff is None or saved_at > now
            or now.date().isoformat() != date):
        return None
    deadline_dt = target_cutoff + dt.timedelta(minutes=3)
    margin = (deadline_dt - now).total_seconds() / 60
    if not MIN_MINUTES_BEFORE_DEADLINE <= margin <= MAX_MINUTES_BEFORE_DEADLINE:
        return None
    return target_cutoff


def same_six_and_card(saved, fresh):
    if (not isinstance(fresh, dict) or fresh.get("source") !=
            "BOAT RACE official racelist" or fresh.get("resultIncluded") is not False):
        return False
    current, original = fresh.get("boats"), saved.get("boats")
    if not isinstance(current, list) or len(current) != 6:
        return False
    a, b = sorted(original, key=lambda z: z["lane"]), sorted(
        current, key=lambda z: z.get("lane", 0))
    if [x.get("lane") for x in b] != list(range(1, 7)):
        return False
    # A last-minute card or motor change is real but requires fresh independent
    # investigation: quarantine, never silently splice unlike original cards.
    for s, c in zip(a, b):
        for key in ("registration", "class", "motor", "boat"):
            if s.get(key) != c.get(key):
                return False
    return True


def capture_one(saved, code, slug, date, race, *,
                raw_fetcher, clock, fresh_card_parser, before_parser):
    now = valid_clock(clock())
    target_cutoff = baseline_ok(saved, now, code, date, race)
    if target_cutoff is None:
        raise RejectedObservation("NOT_A_SAFE_CURRENT_PROGRAM_CANDIDATE")
    official_list, official_pre = original_urls(date, code, race)
    t1 = valid_clock(clock())
    first = valid_bytes(raw_fetcher(official_list))
    t2 = valid_clock(clock())
    if t2 > target_cutoff-PUBLICATION_BUFFER:
        raise RejectedObservation("RACELIST_FETCH_TOO_LATE")
    fresh = fresh_card_parser(decode(first), date, race,
                              saved["venue"], code)
    if (fresh is None or fresh.get("deadline") != saved.get("deadline")
            or fresh.get("date") != date or fresh.get("race") != race
            or not same_six_and_card(saved, fresh)):
        raise RejectedObservation("FRESH_OFFICIAL_CARD_OR_DEADLINE_CONFLICT")
    t3 = valid_clock(clock())
    second = valid_bytes(raw_fetcher(official_pre))
    t4 = valid_clock(clock())
    if (t4.date().isoformat() != date
            or t4 > target_cutoff-PUBLICATION_BUFFER
            or min(t1, t2, t3, t4) < now
            or not (t1 <= t2 <= t3 <= t4)):
        raise RejectedObservation("SOURCE_FETCH_NOT_FROZEN_BEFORE_CUTOFF")
    parsed = before_parser(decode(second))
    if (not isinstance(parsed, dict) or
            not any(parsed.get(k, 0) > 0 for k in
                    ("exhibitionTimes", "startDisplayRows", "weatherFields"))):
        raise RejectedObservation("UNVERIFIED_BEFOREINFO_BODY")
    snapshot = {
        "schema": "boat-command-prospective-raw-pre-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "resultEndpointsIncluded": False,
        "payoutEndpointsIncluded": False, "hardLockChanged": False,
        "tryChanged": False, "autoPromotion": False,
        "strictModelUseEnabled": False,
        "independentServerPublicationProved": False,
        "evidenceTier": "RUNNER_CAPTURED_UNATTESTED_UNTIL_SERVER_PUBLISHED",
        "venueCode": code, "venue": slug, "date": date, "race": race,
        "deadlineJst": fresh["deadline"], "cutoffJst": target_cutoff.isoformat(),
        "registrations": [b["registration"] for b in sorted(fresh["boats"],
                                                           key=lambda z: z["lane"])],
        "sourceQuality": parsed,
        "officialRacelist": as_captured(first, official_list, t1, t2),
        "officialBeforeinfo": as_captured(second, official_pre, t3, t4),
        "sourceTimestampNote": (
            "Runner clock and raw source bytes are archived; independently "
            "verify GitHub artifact or commit publication before target T-3. "
            "This snapshot is NOT yet an approved historical PRE input."),
    }
    validate_snapshot(snapshot)
    return snapshot


def validate_snapshot(item):
    if (item.get("schema") != "boat-command-prospective-raw-pre-v1"
            or item.get("researchOnly") is not True
            or item.get("productionChanged") is not False
            or item.get("strictModelUseEnabled") is not False
            or item.get("independentServerPublicationProved") is not False
            or item.get("resultEndpointsIncluded") is not False
            or item.get("payoutEndpointsIncluded") is not False):
        raise RejectedObservation("UNSAFE_PROSPECTIVE_SNAPSHOT")
    window = dt.datetime.fromisoformat(item["cutoffJst"])
    if valid_clock(window) is None:
        raise RejectedObservation("INVALID_CUTOFF")
    for key, expected_path in (
            ("officialRacelist", "/owpc/pc/race/racelist"),
            ("officialBeforeinfo", "/owpc/pc/race/beforeinfo")):
        obj = item[key]
        parsed = urllib.parse.urlparse(obj["url"])
        if (parsed.scheme != "https" or parsed.hostname != "www.boatrace.jp"
                or parsed.path != expected_path):
            raise RejectedObservation("UNSAFE_SOURCE_URL")
        data = gzip.decompress(base64.b64decode(obj["gzipBase64OriginalBytes"]))
        if (len(data) != obj["byteLength"]
                or hashlib.sha256(data).hexdigest() != obj["sha256OriginalBytes"]):
            raise RejectedObservation("RAW_BYTES_HASH_MISMATCH")
        begun = valid_clock(dt.datetime.fromisoformat(obj["fetchStartedAt"]))
        ended = valid_clock(dt.datetime.fromisoformat(obj["fetchCompletedAt"]))
        if begun > ended or ended > window-PUBLICATION_BUFFER:
            raise RejectedObservation("RAW_SOURCE_LATE_OR_INVALID")
    return True


def candidates(live_root, archived_root, now, venue_table):
    date = valid_clock(now).date().isoformat()
    selected = []
    for code, (_key, slug) in venue_table.items():
        for file in (live_root / slug / date / "program").glob("race-*.json"):
            match = re.fullmatch(r"race-(\d+)\.json", file.name)
            if not match:
                continue
            number = int(match.group(1))
            if (archived_root / date / slug / f"{number:02d}.json").exists():
                continue
            try:
                saved = json.loads(file.read_text(encoding="utf-8"))
                allowed = baseline_ok(saved, now, code, date, number)
            except (OSError, ValueError, KeyError, TypeError):
                continue
            if allowed is not None:
                selected.append((allowed, code, slug, number, saved))
    # One race per venue on a run, ordered by nearest safe T-3 cutoff.
    seen, result = set(), []
    for _time, code, slug, number, saved in sorted(
            selected, key=lambda x: (x[0], x[1], x[3])):
        if slug not in seen:
            seen.add(slug)
            result.append((code, slug, number, saved))
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--live-root", type=Path, default=ROOT/"live")
    p.add_argument("--archived-root", type=Path, required=True)
    p.add_argument("--output-root", type=Path, required=True)
    p.add_argument("--max-fetch", type=int, default=4)
    args = p.parse_args()
    root, out, archive = (args.live_root.resolve(), args.output_root.resolve(),
                          args.archived_root.resolve())
    if (out == ROOT or ROOT in out.parents or out.exists()
            or out == archive or archive in out.parents or not 1 <= args.max_fetch <= 4):
        p.error("NEW_OUTPUT_OUTSIDE_REPO_AND_ARCHIVE_ONLY_MAX_FOUR")
    pmod = import_script("venue-program-collector-v1.py", "prospective_program_parser")
    premod = import_script("venue-pre-race-rich-collector-v1.py",
                           "prospective_beforeinfo_parser")

    def parse_beforeinfo(text):
        tables = premod.table_rows(text)
        exhibition = premod.parse_exhibition(tables)
        starts = premod.parse_start_exhibition(tables)
        water = premod.parse_weather(text)
        return {
            "exhibitionTimes": sum(b.get("exhibitionTime") is not None
                                   for b in exhibition.values()),
            "startDisplayRows": len(starts),
            "weatherFields": sum(water.get(k) is not None for k in
                                 ("airTempC", "windSpeedMps", "waterTempC",
                                  "waveHeightCm")),
        }

    errors, stored = [], []
    now = dt.datetime.now(JST)
    jobs = candidates(root, archive, now, premod.VENUES)
    for code, slug, race, saved in jobs[:args.max_fetch]:
        try:
            snapshot = capture_one(
                saved, code, slug, now.date().isoformat(), race,
                raw_fetcher=runner_fetch, clock=lambda: dt.datetime.now(JST),
                fresh_card_parser=pmod.parse_race,
                before_parser=parse_beforeinfo)
            file = out / snapshot["date"] / slug / f"{race:02d}.json"
            file.parent.mkdir(parents=True, exist_ok=True)
            # Atomic no-overwrite protects against concurrent duplicate output.
            with file.open("x", encoding="utf-8") as dest:
                json.dump(snapshot, dest, ensure_ascii=False, indent=2)
                dest.write("\n")
            stored.append({"date": snapshot["date"], "venue": slug, "race": race,
                           "cutoff": snapshot["cutoffJst"],
                           "readEnd": snapshot["officialBeforeinfo"]["fetchCompletedAt"]})
        except (RejectedObservation, OSError, ValueError) as error:
            errors.append({"venue": slug, "race": race,
                           "reason": type(error).__name__ + ": " + str(error)})
    print("RAW_PROSPECTIVE_RESEARCH_CAPTURE", json.dumps({
        "researchOnly": True, "eligibleCandidates": len(jobs),
        "attempted": min(len(jobs), args.max_fetch),
        "snapshots": stored, "rejected": errors,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
