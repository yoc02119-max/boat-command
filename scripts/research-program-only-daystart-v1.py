#!/usr/bin/env python3
"""Read-only, conservative program-only historical availability inventory.

For original LIVE program records missing a current PRE-rich companion:
* Requires the exact ORIGINAL Git blob and an independent GitHub-hosted
  workflow run for the exact commit SHA after the recorded fetch.
* Only classifies a record as day-start corroborated if that hosted run
  predates MIDNIGHT JST on the target race date. A same-day run which merely
  predates the self-reported deadline is diagnostic-only.
* NEVER imports race cards into LIVE, LAB or any model; NEVER reads POST.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import hashlib
import importlib.util
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JST = dt.timezone(dt.timedelta(hours=9))
PROGRAM_FIELDS = (
    "registration", "class", "fCount", "lCount", "avgST",
    "nationalWinRate", "national2Rate", "national3Rate",
    "localWinRate", "local2Rate", "local3Rate", "motor",
    "motor2Rate", "boat", "boat2Rate",
)
PASS = "APP_PROGRAM_HOSTED_BEFORE_RACE_DAY"
DAY_ONLY = "BEFORE_SELF_REPORTED_T_MINUS_3_ONLY"


def imports():
    def module(path, name):
        spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / path)
        result = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(result)
        return result
    return module("research-asof-provenance-v1.py", "asof_source_v1"), module(
        "research-github-asof-corroboration-v1.py", "github_asof_source_v1")


def safe_card(doc, slug, code, date, race, source):
    if (doc.get("schema") != "boat-command-program-pack-v1"
            or doc.get("date") != date or doc.get("race") != race
            or doc.get("venueCode") != code
            or doc.get("source") != "BOAT RACE official racelist"
            or doc.get("programReady") is not True
            or doc.get("exhibitionIncluded") is not False
            or doc.get("resultEndpointsIncluded") is not False
            or doc.get("resultIncluded") is not False):
        return None
    if source.six_identity(doc) is None:
        return None
    observed_at = source.observed(doc.get("fetchedAt"))
    cutoff = source.cutoff_for(date, doc.get("deadline"))
    if observed_at is None or cutoff is None or observed_at > cutoff:
        return None
    # Deliberately omit any unrecognized or post-label key.
    boats = sorted(doc["boats"], key=lambda b: b["lane"])
    allowed_boats = [{k: b[k] for k in PROGRAM_FIELDS
                      if k in b and b[k] is not None} for b in boats]
    return {"observedAt": observed_at, "selfReportedCutoff": cutoff,
            "safeCardFieldsOnly": allowed_boats}


def verify_case(repo, slug, code, date, race, source, gh, seen, max_revisions=40):
    filename = f"live/{slug}/{date}/program/race-{race}.json"
    revisions = gh.revisions(repo, filename, max_revisions)
    if not revisions:
        return {"status": "NO_COMMITTED_PROGRAM_REVISIONS", "importedToModel": False}
    day_start = dt.datetime.fromisoformat(date + "T00:00:00").replace(tzinfo=JST)
    diagnostics = collections.Counter()
    tentative = None
    for sha in reversed(revisions):  # Older versions first; do NOT trust latest.
        try:
            raw = gh.git(repo, "show", f"{sha}:{filename}")
            doc = json.loads(raw)
        except subprocess.CalledProcessError as exc:
            # git log -- <path> includes deletion commits. Prove that the
            # commit object exists before skipping just the absent path.
            try:
                gh.git(repo, "cat-file", "-e", sha)
            except subprocess.CalledProcessError as missing:
                raise RuntimeError("INCOMPLETE_GIT_HISTORY") from missing
            diagnostics["FILE_ABSENT_AT_HISTORICAL_COMMIT"] += 1
            continue
        except (OSError, ValueError, json.JSONDecodeError):
            diagnostics["UNREADABLE_COMMITTED_VERSION"] += 1
            continue
        candidate = safe_card(doc, slug, code, date, race, source)
        if candidate is None:
            diagnostics["INVALID_OR_LATE_PROGRAM_VERSION"] += 1
            continue
        observed_at, cutoff = candidate["observedAt"], candidate["selfReportedCutoff"]
        # Passing source cutoff to server query is not independent proof of
        # that cutoff. A PRE-day run has the stronger independent day-start gate.
        hosted = seen(sha, cutoff)
        if hosted is None:
            diagnostics["NO_GITHUB_SERVER_WITNESS_BEFORE_SELF_REPORTED_CUTOFF"] += 1
            continue
        if hosted < observed_at.astimezone(dt.timezone.utc):
            diagnostics["SERVER_WITNESS_PREDATES_RECORDED_FETCH"] += 1
            continue
        exact = {
            "commit": sha,
            "programBlobSha256": hashlib.sha256(raw.encode("utf-8")).hexdigest(),
            "programRecordedFetchAt": observed_at.isoformat(),
            "githubServerSeenAt": hosted.isoformat(),
            "selfReportedTMinus3": cutoff.isoformat(),
        }
        if hosted.astimezone(JST) < day_start:
            return {
                "status": PASS, **exact,
                "observedBeforeRaceDayJst": True,
                "cardFields": candidate["safeCardFieldsOnly"],
                "originalOfficialHttpResponseHashUnavailable": True,
                "independentOfficialRaceDeadlineUnverified": True,
                "eligibleForStrictHistoricalModel": False,
                "importedToModel": False,
            }
        if tentative is None:
            tentative = {
                "status": DAY_ONLY, **exact,
                "observedBeforeRaceDayJst": False,
                "independentOfficialRaceDeadlineUnverified": True,
                "eligibleForStrictHistoricalModel": False,
                "importedToModel": False,
            }
    if tentative is not None:
        return tentative
    return {"status": "PROGRAM_SERVER_ASOF_NOT_CORROBORATED",
            "checkedGitVersions": len(revisions),
            "diagnostics": dict(diagnostics), "eligibleForStrictHistoricalModel": False,
            "importedToModel": False}


def scan(repo, source, gh, seen, cap=120):
    cases, by_venue = [], collections.Counter()
    for code, slug in source.VENUES.items():
        for file in sorted((repo / "live" / slug).glob(
                "????-??-??/program/race-*.json")):
            race_match = re.fullmatch(r"race-(\d+)\.json", file.name)
            if not race_match:
                continue
            date, race = file.parent.parent.name, int(race_match.group(1))
            if (file.parent.parent / "pre-rich" / file.name).exists():
                continue
            cases.append((code, slug, date, race))
            by_venue[slug] += 1
    # Fair pilot: round-robin through all 24 venues.
    pools = collections.defaultdict(list)
    for case in cases:
        pools[case[1]].append(case)
    selected = []
    while len(selected) < cap and any(pools.values()):
        for slug in source.VENUES.values():
            if pools[slug] and len(selected) < cap:
                selected.append(pools[slug].pop(0))
    records = {}
    counts = collections.Counter()
    for code, slug, date, race in selected:
        result = verify_case(repo, slug, code, date, race, source, gh, seen)
        records.setdefault(slug, []).append({"date": date, "race": race, **result})
        counts[result["status"]] += 1
    return {
        "eligibleCurrentNoPreRichProgramRows": len(cases),
        "scanned": len(selected),
        "notScanned": len(cases) - len(selected),
        "candidatePerVenue": dict(sorted(by_venue.items())),
        "byStatus": dict(sorted(counts.items())),
        "perVenue": records,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", type=Path, default=ROOT)
    parser.add_argument("--github-repo", default="yoc02119-max/boat-command")
    parser.add_argument("--limit", type=int, default=120)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    repo, output = args.repo.resolve(), args.output.resolve()
    if output == repo or repo in output.parents or output.exists():
        parser.error("NEW_REPORT_OUTSIDE_REPO_ONLY")
    if not 1 <= args.limit <= 200:
        parser.error("BOUNDED_PROGRAM_ONLY_PILOT_MAX_200")
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", args.github_repo):
        parser.error("INVALID_REPOSITORY")
    token = os.environ.get("GH_READ_TOKEN")
    if not token:
        parser.error("GITHUB_SERVER_CREATED_AT_TOKEN_REQUIRED")
    source, gh = imports()
    cache = {}
    def seen(sha, cutoff):
        return gh.github_seen_before("https://api.github.com", args.github_repo,
                                     token, sha, cutoff, cache)
    report = scan(repo, source, gh, seen, args.limit)
    report.update({
        "schema": "boat-command-program-only-daystart-provenance-v1",
        "sourceHead": gh.git(repo, "rev-parse", "HEAD").strip(),
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "postFieldsRead": False,
        "strictVendorCardFieldsReleased": 0, "strictHistoricalModelImportCount": 0,
        "autoPromotion": False, "scope": "CURRENTLY_MISSING_PRE_RICH_ONLY",
        "dayStartPolicy": "HOSTED_GITHUB_RUN_BEFORE_TARGET_DATE_MIDNIGHT_JST",
        "limitation": ("Independent GitHub app-snapshot presence, not authenticated "
                       "official raw HTTP bytes; day-of T-3 evidence based only on "
                       "program-supplied deadline remains quarantined."),
    })
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    print("PROGRAM_ONLY_DAYSTART_PILOT", json.dumps({
        "candidates": report["eligibleCurrentNoPreRichProgramRows"],
        "scanned": report["scanned"], "remaining": report["notScanned"],
        "byStatus": report["byStatus"],
    }))


if __name__ == "__main__":
    main()
