#!/usr/bin/env python3
"""Rebuild historical six-boat program facts from official daily B/K archives.

Results and payouts are labels only. A rich row is published only when its
race ID, six grades, trifecta result and payout match the existing base row.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import importlib.util
import sys


def load_parser():
    path = Path(__file__).resolve().parent / "edogawa-rich-history-builder-v1.py"
    spec = importlib.util.spec_from_file_location("rich_parser", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


PARSER = load_parser()
FEATURES = ("nationalWinRate", "national2Rate", "localWinRate", "local2Rate",
            "motor2Rate", "boat2Rate")
# Some official B lines join a two-decimal motor rate to the boat number:
# "60 44.91164 34.70" means motor 60, 44.91%, boat 164, 34.70%.
JOINED = re.compile(
    r"^(\s*[1-6]\s*\d{4}.*?(?:A1|A2|B1|B2)\s+"
    r"(?:\d+(?:\.\d+)?\s+){4}\d+\s+)"
    r"(\d{1,3}\.\d{2})(\d{1,3})\s+(\d{1,3}\.\d{2})(.*)$"
)


def program_section(section):
    fixed = []
    for line in section.splitlines():
        line = PARSER.norm(line)
        if not PARSER.ENTRY.search(line):
            joined = JOINED.search(line)
            if joined:
                line = (joined.group(1) + joined.group(2) + " "
                        + joined.group(3) + " " + joined.group(4) + joined.group(5))
        fixed.append(line)
    return PARSER.parse_program("\n".join(fixed))


def exact_block(text, code, kind):
    section = PARSER.block(text, code, kind)
    marker = rf"(?m)^\s*{code}{kind}BGN\s*$"
    # The shared parser's last-resort fallback searches the first 40 lines.
    # That can mistake a racer's prefecture (e.g. 福岡) for the venue name.
    label = "［番組］" if kind == "B" else "［成績］"
    title = PARSER._base.VENUE_NAMES[code]
    named = any(title in PARSER._base._compact(line) and label in line
                for line in section.splitlines()[:2])
    # Official single-venue archives can use "ボートレース 津" without [番組].
    # Require it in the title, not somewhere in a racer's name or prefecture.
    titled = any(PARSER._base._compact(line).startswith("ボートレース" + title)
                 for line in section.splitlines()[:2])
    if re.search(marker, section) or named or titled:
        return section
    # Some official days omit a venue marker or use another leading marker.
    # Slice at the *venue heading* instead of accepting the whole archive.
    lines = text.splitlines()
    headings = [(i, PARSER._base._compact(line)[len("ボートレース"):])
                for i, line in enumerate(lines)
                if PARSER._base._compact(line).startswith("ボートレース")]
    for start, heading in headings:
        if not heading.startswith(title):
            continue
        end = next((i for i, _ in headings if i > start), len(lines))
        end = min(end, next((i for i in range(start + 1, end)
                             if re.match(r"^\s*\d{2}[BK](?:BGN|END)\s*$", lines[i])), end))
        return "\n".join(lines[start:end])
    return ""


def extract_day(b: Path, k: Path):
    if PARSER.date_from(b) != PARSER.date_from(k):
        raise ValueError("B_K_DATE_MISMATCH")
    date = PARSER.date_from(b)
    b_text, k_text = PARSER.read(b), PARSER.read(k)
    rows = []
    for number in range(1, 25):
        code = f"{number:02d}"
        pb, kb = exact_block(b_text, code, "B"), exact_block(k_text, code, "K")
        if not pb or not kb:
            continue
        programs = program_section(pb)
        results = PARSER.parse_results(kb)
        for race in sorted(programs.keys() & results.keys()):
            p = programs[race]
            o, payout = results[race]
            boats = p["boats"]
            rows.append({"id": f"{date}-{code}-{race:02d}", "d": date,
                         "r": race, "t": p["t"], "c": [x["class"] for x in boats],
                         "boats": boats, "o": o, "p": payout})
    return rows


def match(base, candidate):
    return (base["id"] == candidate["id"]
            and base["c"] == candidate["c"]
            and base["o"] == candidate["o"]
            and int(base["p"]) == int(candidate["p"]))


def complete(candidate):
    boats = candidate.get("boats", [])
    return (len(boats) == 6 and all(
        b.get("lane") == i and b.get("class") == candidate["c"][i-1]
        and isinstance(b.get("registration"), int)
        and all(isinstance(b.get(f), (int, float)) for f in FEATURES)
        for i, b in enumerate(boats, 1)))


def merge(base_dir: Path, day_dir: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    candidate = defaultdict(list)
    for path in sorted(day_dir.glob("*.json")):
        for row in json.loads(path.read_text(encoding="utf-8"))["races"]:
            candidate[row["id"]].append(row)
    audit = {"schema": "boat-command-venue-rich-history-audit-v1",
             "source": "OFFICIAL_DAILY_B_K", "venues": []}
    for path in sorted(base_dir.glob("*-history-bootstrap-v1.json")):
        base = json.loads(path.read_text(encoding="utf-8"))
        code = base["venueCode"]
        accepted = []
        rejected = []
        missing = []
        for row in base["races"]:
            options = candidate.get(row["id"], [])
            if not options:
                missing.append(row["id"])
            elif len(options) != 1 or not match(row, options[0]) or not complete(options[0]):
                rejected.append(row["id"])
            else:
                accepted.append(options[0])
        # Never permit a mismatch into research data, even if most rows match.
        records = {"schema": "boat-command-venue-rich-history-v1",
                   "venueCode": code, "cutoff": base.get("cutoff"),
                   "resultUse": "HISTORICAL_LABEL_ONLY_STRICTLY_BEFORE_TARGET_DATE",
                   "avgSTAvailable": False, "exhibitionIncluded": False,
                   "features": ["class", *FEATURES, "raceType", "raceNumber"],
                   "races": accepted}
        slug = path.name.removesuffix("-history-bootstrap-v1.json")
        (out_dir / f"{slug}-rich-history-v1.json").write_text(
            json.dumps(records, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        audit["venues"].append({"slug": slug, "code": code, "baseRaces": len(base["races"]),
                                "richRaces": len(accepted), "missing": len(missing),
                                "rejected": len(rejected), "missingIds": missing[:30],
                                "rejectedIds": rejected[:30],
                                "coverage": len(accepted) / len(base["races"]) if base["races"] else 0})
    audit["baseRaces"] = sum(x["baseRaces"] for x in audit["venues"])
    audit["richRaces"] = sum(x["richRaces"] for x in audit["venues"])
    audit["rejected"] = sum(x["rejected"] for x in audit["venues"])
    (out_dir / "venue-rich-history-audit-v1.json").write_text(
        json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
    return audit


def self_test():
    joined = "1 5330安河内鈴22福岡51A2 6.02 40.59 5.38 32.59 60 44.91164 34.70 11"
    section = "21BBGN\n 1R 予選 H1800m\n" + "\n".join(
        joined.replace("1 5330", f"{i} 5330", 1) for i in range(1, 7))
    parsed = program_section(section)
    assert parsed[1]["boats"][0]["motor2Rate"] == .4491
    assert parsed[1]["boats"][0]["boat"] == 164
    assert not exact_block("24BBGN\n1 1234選手23福岡52B1", "22", "B")
    assert exact_block("ボートレース 津\n 1R 予選 H1800m", "09", "B")
    multi = "24BBGN\nボートレース大村\n1R 予選 H1800m\nボートレース福 岡\n1R 予選 H1800m"
    assert exact_block(multi, "22", "B").startswith("ボートレース福 岡")
    base = {"id": "2026-01-01-03-01", "c": ["B1"]*6, "o": "1-2-3", "p": 900}
    rich = {**base, "boats": [{"lane": i, "class": "B1", "registration": 4000+i,
                              **{f: .3 for f in FEATURES}} for i in range(1, 7)]}
    assert match(base, rich) and complete(rich)
    assert not match(base, {**rich, "p": 901})
    assert not complete({**rich, "boats": rich["boats"][:-1]})
    print("VENUE_RICH_HISTORY_SELF_TEST_PASS")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--b", type=Path)
    ap.add_argument("--k", type=Path)
    ap.add_argument("--day-out", type=Path)
    ap.add_argument("--base-dir", type=Path)
    ap.add_argument("--day-dir", type=Path)
    ap.add_argument("--out-dir", type=Path)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        self_test()
    elif args.b and args.k and args.day_out:
        args.day_out.parent.mkdir(parents=True, exist_ok=True)
        rows = extract_day(args.b, args.k)
        args.day_out.write_text(json.dumps({"races": rows}, ensure_ascii=False,
                                           separators=(",", ":")), encoding="utf-8")
        print(json.dumps({"date": PARSER.date_from(args.b), "races": len(rows)}))
    elif args.base_dir and args.day_dir and args.out_dir:
        result = merge(args.base_dir, args.day_dir, args.out_dir)
        print(json.dumps({k: result[k] for k in ("baseRaces", "richRaces", "rejected")}))
    else:
        ap.error("provide --b --k --day-out, or --base-dir --day-dir --out-dir")
