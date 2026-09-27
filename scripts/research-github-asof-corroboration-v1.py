#!/usr/bin/env python3
"""Bounded independent GitHub as-of corroboration of current live PRE pairs.

A recorded file's fetchedAt alone is insufficient. This second audit demands:
(1) exact six-racer and card-field agreement between committed, earlier official
    program and independently committed pre-rich record;
(2) both commit objects were already OBSERVED by GitHub's own workflow-run
    creation clock by the target T-3 cutoff.
No model inputs are released. GitHub first-seen evidence is scoped to original
app snapshots, not proof of original third-party/vendor CSV field timestamps.
"""
from __future__ import annotations

import argparse
import collections
import datetime as dt
import json
import os
import re
import subprocess
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JST = dt.timezone(dt.timedelta(hours=9))

def source_mod():
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "research_asof_provenance_v1", ROOT / "scripts/research-asof-provenance-v1.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m

def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args],
                          capture_output=True, text=True, check=True).stdout

def revisions(repo, relative_path, max_count=10):
    result = git(repo, "log", "--format=%H", "--", relative_path)
    return result.splitlines()[:max_count]

def at_revision(repo, sha, path):
    raw = git(repo, "show", f"{sha}:{path}")
    return json.loads(raw)

def github_seen_before(api_base, repository, token, sha, cutoff, cache=None):
    """True only with GitHub SERVER created_at of a run for the exact head SHA."""
    if cache is None:
        cache = {}
    if sha not in cache:
        dates = []
        # Scan at most three pages; never mistake a truncated or failed lookup
        # for positive proof. "head_sha" must be exact for each workflow run.
        for page in range(1, 4):
            query = urllib.parse.urlencode({"head_sha": sha, "per_page": 100, "page": page})
            url = f"{api_base}/repos/{repository}/actions/runs?{query}"
            request = urllib.request.Request(url, headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "BOAT-COMMAND-READ-ONLY-RESEARCH-ASOF/1.0",
            })
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.load(response)
            runs = payload.get("workflow_runs") or []
            for run in runs:
                if run.get("head_sha") != sha:
                    continue
                try:
                    when = dt.datetime.fromisoformat(run["created_at"].replace("Z", "+00:00"))
                except (ValueError, KeyError):
                    continue
                if when.tzinfo and when.utcoffset() is not None:
                    dates.append(when)
            if len(runs) < 100:
                break
        cache[sha] = sorted(dates)
    cutoff_utc = cutoff.astimezone(dt.timezone.utc)
    return next((date for date in cache[sha] if date <= cutoff_utc), None)

def candidate_research_pair(repo, slug, date, race, source, seen, max_revisions=10):
    """Find historical versions; a current rewritten program is NOT used."""
    pfile = f"live/{slug}/{date}/program/race-{race}.json"
    qfile = f"live/{slug}/{date}/pre-rich/race-{race}.json"
    q_versions = revisions(repo, qfile, max_revisions)
    p_versions = revisions(repo, pfile, max_revisions)
    if not q_versions or not p_versions:
        return {"status": "NO_COMMITTED_PAIR"}
    q_candidates = []
    for q_sha in q_versions:
        try:
            pre = at_revision(repo, q_sha, qfile)
            base = source.audit_live_pair  # reuse exact timestamp/identity policy
            cutoff = source.cutoff_for(date, pre.get("deadline"))
            pre_stamp = source.observed(pre.get("fetchedAt"))
            if (pre.get("date") != date or pre.get("race") != race
                    or pre.get("source", {}).get("program") != "stored result-free program pack"
                    or pre.get("resultEndpointsIncluded") is not False
                    or pre.get("payoutEndpointsIncluded") is not False
                    or cutoff is None or pre_stamp is None or pre_stamp > cutoff):
                continue
            if source.six_identity(pre) is None:
                continue
            # No early GitHub-hosted run for this exact PRE commit => not proven.
            first_seen = seen(q_sha, cutoff)
            if first_seen is None:
                continue
            q_candidates.append((q_sha, pre, cutoff, first_seen))
        except (json.JSONDecodeError, ValueError, KeyError):
            continue
    if not q_candidates:
        return {"status": "PRE_RICH_NO_SERVER_ASOF_PROOF"}
    for q_sha, pre, cutoff, q_seen in q_candidates:
        pre_stamp = source.observed(pre["fetchedAt"])
        for p_sha in p_versions:
            try:
                program = at_revision(repo, p_sha, pfile)
                check = source.audit_live_pair(program, pre, date, race)
                if check["status"] != "RELATIVE_TIMES_COMPATIBLE_UNPROVEN":
                    continue
                seen_at = seen(p_sha, cutoff)
                if seen_at is None:
                    continue
                if source.observed(program["fetchedAt"]) > pre_stamp:
                    continue
                # The exact pre-rich content and exact earlier official pack
                # already existed in hosted GitHub by cutoff.
                return {
                    "status": "EARLIER_APP_SNAPSHOT_HOSTED_BEFORE_T_MINUS_3",
                    "programCommit": p_sha, "preRichCommit": q_sha,
                    "programFetchAt": program["fetchedAt"],
                    "preRichFetchAt": pre["fetchedAt"],
                    "programGitHubSeenAt": seen_at.isoformat(),
                    "preRichGitHubSeenAt": q_seen.isoformat(),
                    "cutoff": cutoff.isoformat(),
                    "strictVendorFullDayCardReleased": False,
                    "automaticallyImportedToModel": False,
                    "originalOfficialResponseHashUnavailable": True,
                }
            except (json.JSONDecodeError, ValueError, KeyError):
                continue
    return {"status": "PROGRAM_NO_MATCHING_SERVER_ASOF_PROOF"}

def scan_repo(repo, source, seen, candidate_limit):
    roster, results = collections.Counter(), {}
    all_cases = []
    # Only the already identified timestamp-compatible current pairs. Older
    # overwritten program files are a separate recovery phase.
    for code, slug in source.VENUES.items():
        for qfile in sorted((repo / "live" / slug).glob(
                "????-??-??/pre-rich/race-*.json")):
            try:
                pre = source.load(qfile)
                date, race = pre.get("date"), pre.get("race")
                if not isinstance(date, str) or type(race) is not int:
                    continue
                pfile = qfile.parent.parent / "program" / qfile.name
                program = source.load(pfile) if pfile.is_file() else None
                result = source.audit_live_pair(program, pre, date, race)
                if result["status"] != "RELATIVE_TIMES_COMPATIBLE_UNPROVEN":
                    continue
                all_cases.append((slug, date, race))
                roster[slug] += 1
            except (ValueError, OSError, KeyError):
                continue
    for slug, date, race in all_cases[:candidate_limit]:
        item = candidate_research_pair(repo, slug, date, race, source, seen)
        results.setdefault(slug, []).append({
            "date": date, "race": race, **item,
        })
    statuses = collections.Counter(item["status"] for values in results.values()
                                   for item in values)
    return {
        "candidateCurrentCompatiblePairs": len(all_cases),
        "scannedPairs": sum(statuses.values()),
        "unscannedPairsDueToBound": max(0, len(all_cases) - candidate_limit),
        "byStatus": dict(sorted(statuses.items())),
        "candidateByVenue": dict(sorted(roster.items())),
        "perVenue": results,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--repo", type=Path, default=ROOT)
    p.add_argument("--output", required=True, type=Path)
    p.add_argument("--github-repo", default="yoc02119-max/boat-command")
    p.add_argument("--limit", type=int, default=100)
    args = p.parse_args()
    repo = args.repo.resolve()
    out = args.output.resolve()
    if out == repo or repo in out.parents or out.exists():
        p.error("NEW_OUTPUT_OUTSIDE_REPO_ONLY")
    if not 1 <= args.limit <= 100:
        p.error("MAX_100_CURRENT_COMPATIBLE_PAIRS")
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", args.github_repo):
        p.error("INVALID_GITHUB_REPO")
    token = os.environ.get("GH_READ_TOKEN")
    if not token:
        p.error("GITHUB_SERVER_FIRST_SEEN_TOKEN_REQUIRED")
    source = source_mod()
    cache = {}
    def seen(sha, cutoff):
        return github_seen_before("https://api.github.com", args.github_repo,
                                  token, sha, cutoff, cache)
    report = scan_repo(repo, source, seen, args.limit)
    report.update({
        "schema": "boat-command-github-corroborated-pre-asof-pilot-v1",
        "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "automaticModelImport": False,
        "vendorUntimedCardFieldsReleased": 0,
        "sourceHistoryHead": git(repo, "rev-parse", "HEAD").strip(),
        "method": ("Both exact committed official app program and pre-rich snapshots "
                   "must predate cutoff and each commit SHA must have independently "
                   "GitHub-hosted run created at or before cutoff; unproven data stays quarantined. "
                   "Raw official HTTP response hash is still unavailable."),
    })
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    print("GITHUB_ASOF_CORROBORATION_PILOT", json.dumps({
        "candidateCurrentCompatiblePairs": report["candidateCurrentCompatiblePairs"],
        "scannedPairs": report["scannedPairs"],
        "unscannedPairsDueToBound": report["unscannedPairsDueToBound"],
        "byStatus": report["byStatus"],
    }))

if __name__ == "__main__":
    main()
