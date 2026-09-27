#!/usr/bin/env python3
"""Bounded incremental batch for archived inverse-join research day snapshots.

Runs only in independent research workflow. Never opens LIVE app files for write.
Successful per-day snapshots are immutable; failed dates are not marked complete.
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMPL = ROOT / "scripts" / "boatracecsv-inverse-join-v1.py"
spec = importlib.util.spec_from_file_location("boatracecsv_inverse_join_v1", IMPL)
join = importlib.util.module_from_spec(spec)
spec.loader.exec_module(join)


def candidates(start: str, end: str, done: set[str], limit: int, newest_first: bool = False) -> list[str]:
    a, b = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
    if b < a or (b - a).days > 366:
        raise ValueError("INVALID_OR_EXCESSIVE_DATE_RANGE")
    if not isinstance(limit, int) or not 1 <= limit <= 16:
        raise ValueError("MAX_DATES_PER_JOB_IS_16")
    eligible = []
    day = b if newest_first else a
    while (day >= a if newest_first else day <= b) and len(eligible) < limit:
        iso = day.isoformat()
        if iso not in done:
            eligible.append(iso)
        day += dt.timedelta(days=-1 if newest_first else 1)
    return eligible


def existing_dates(path: Path | None) -> set[str]:
    if path is None:
        return set()
    result = set()
    for line in path.read_text(encoding="utf-8").splitlines():
        date = line.strip()
        if not date:
            continue
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date):
            raise ValueError(f"INVALID_EXISTING_DATE: {date}")
        dt.date.fromisoformat(date)
        result.add(date)
    return result


def bounded_backfill(root: Path, output_dir: Path, selected: list[str],
                     builder=None) -> dict:
    if builder is None:
        builder = lambda date: join.build_day(root, date)
    output_dir.mkdir(parents=True, exist_ok=True)
    successes, errors = [], []
    for date in selected:
        dest = output_dir / (date + ".json")
        if dest.exists():
            errors.append({"date": date, "error": "OUTPUT_ALREADY_EXISTS"})
            continue
        try:
            report = builder(date)
            if not (report.get("schema") == "boat-command-inverse-join-v1"
                    and report.get("researchOnly") is True
                    and report.get("productionChanged") is False
                    and report.get("prePostSeparated") is True):
                raise ValueError("UNSAFE_REPORT_BOUNDARY")
            dest.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
            successes.append({
                "date": date, "targetRaces": report["summary"]["targetRaces"],
                "accepted": report["summary"]["accepted"],
                "sourceFilesOK": report["summary"].get("sourceFileCountOK", 0),
            })
        except (ValueError, OSError, KeyError, TypeError) as exc:
            errors.append({"date": date, "error": f"{type(exc).__name__}: {exc}"})
    return {
        "schema": "boat-command-inverse-batch-status-v1",
        "researchOnly": True, "productionChanged": False,
        "selectedDates": selected, "completedDates": successes,
        "failedDates": errors, "newFiles": len(successes),
        "targetRaces": sum(x["targetRaces"] for x in successes),
        "accepted": sum(x["accepted"] for x in successes),
    }


def aggregate_rounds(reports: list[dict]) -> dict:
    """Keep the existing status schema while reporting every attempt honestly."""
    completed = [item for report in reports for item in report["completedDates"]]
    failed = [item for report in reports for item in report["failedDates"]]
    selected = [date for report in reports for date in report["selectedDates"]]
    if len(selected) != len(set(selected)):
        raise ValueError("DUPLICATE_DATE_ATTEMPT_IN_ONE_RUN")
    return {
        "schema": "boat-command-inverse-batch-status-v1",
        "researchOnly": True, "productionChanged": False,
        "selectedDates": selected, "completedDates": completed,
        "failedDates": failed, "newFiles": len(completed),
        "targetRaces": sum(item["targetRaces"] for item in completed),
        "accepted": sum(item["accepted"] for item in completed),
        "roundsExecuted": len(reports),
        "maxSelectedDatesThisRun": len(selected),
    }


def bounded_backfill_rounds(root: Path, output_dir: Path, start: str, end: str,
                            existing: set[str], limit: int = 8, rounds: int = 1,
                            newest_first: bool = False, builder=None) -> dict:
    """At most two separately bounded 16-day passes; rate/timeout safety gate.

    The next pass skips ALL dates already attempted in this run, including
    transiently failed days, so one 503 cannot starve older dates. Failed days
    remain eligible on the next independent scheduled execution.
    """
    if type(rounds) is not int or not 1 <= rounds <= 2:
        raise ValueError("MAX_TWO_BOUNDED_ROUNDS")
    if not isinstance(existing, set):
        raise TypeError("EXISTING_DATES_MUST_BE_SET")
    attempted = set(existing)
    reports = []
    for _ in range(rounds):
        chosen = candidates(start, end, attempted, limit, newest_first)
        if not chosen:
            break
        # Never reattempt a failed date within the same workflow run.
        attempted.update(chosen)
        result = bounded_backfill(root, output_dir, chosen, builder=builder)
        reports.append(result)
    report = aggregate_rounds(reports)
    if len(report["selectedDates"]) > 32:
        raise ValueError("EXCEEDED_32_DATE_RUN_LIMIT")
    return report


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--start", required=True)
    p.add_argument("--end", required=True)
    p.add_argument("--existing-list", type=Path)
    p.add_argument("--limit", type=int, default=8)
    p.add_argument("--rounds", type=int, default=1,
                   help="1 or 2 bounded 16-date passes per workflow, never more")
    p.add_argument("--newest-first", action="store_true",
                   help="Prioritize recent available pre-race observations; archive older days later")
    p.add_argument("--output-dir", type=Path, required=True)
    p.add_argument("--status-out", type=Path, required=True)
    args = p.parse_args()
    output = args.output_dir.resolve()
    status_out = args.status_out.resolve()
    blocked = [ROOT / n for n in ("live", "venues", "baseline", "daily-lab",
                                   "rich-history-24")]
    for dest in (output, status_out):
        if any(dest == folder or folder in dest.parents for folder in blocked):
            p.error("RESEARCH_OUTPUT_ONLY")
    status = bounded_backfill_rounds(
        ROOT, output, args.start, args.end, existing_dates(args.existing_list),
        args.limit, rounds=args.rounds, newest_first=args.newest_first)
    status_out.parent.mkdir(parents=True, exist_ok=True)
    status_out.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n",
                          encoding="utf-8")
    print("INVERSE_BATCH", json.dumps(status, ensure_ascii=False))
    # If selected records all fail, CI should not silently mark a batch successful.
    if status["selectedDates"] and not status["completedDates"]:
        raise SystemExit("INVERSE_BATCH_ALL_SELECTED_DATES_FAILED")


if __name__ == "__main__":
    main()
