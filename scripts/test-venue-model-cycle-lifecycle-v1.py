#!/usr/bin/env python3
import copy
import json
import os
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
KIRYU = "kiryu"
CANDIDATE_ID = "candidateV2:KIRYU-CANDIDATE-V2"
CANDIDATE_VERSION = "KIRYU-CANDIDATE-V2"

def read_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))

def write_json(path, data):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def run(repo, *args, expect_ok=True):
    cmd = ["node", "scripts/venue-model-cycle-v1.js", *args]
    proc = subprocess.run(cmd, cwd=repo, text=True, capture_output=True)
    combined = (proc.stdout or "") + (proc.stderr or "")
    if expect_ok and proc.returncode != 0:
        raise AssertionError(f"command failed {cmd}\n{combined}")
    if not expect_ok and proc.returncode == 0:
        raise AssertionError(f"command unexpectedly succeeded {cmd}\n{combined}")
    return proc.returncode, combined

def semantic_state(path):
    x = read_json(path)
    x.pop("generatedAt", None)
    return x

def snapshot_others(repo):
    out = {}
    for p in sorted((repo / "venues").glob("*/model-cycle-v1.json")):
        if p.parent.name in {"_template", KIRYU}:
            continue
        out[p.parent.name] = semantic_state(p)
    assert len(out) == 23, len(out)
    return out

def assert_others_same(repo, before):
    after = snapshot_others(repo)
    assert before.keys() == after.keys()
    changed = [slug for slug in before if before[slug] != after[slug]]
    assert not changed, f"cross-venue mutation: {changed}"

def mutate_kiryu_to_live(repo):
    p = repo / "venues/kiryu/config-v1.json"
    cfg = read_json(p)
    cfg["state"] = "LIVE_SIMULATION"
    cfg["modelEnabled"] = True
    cfg["tryEnabled"] = True
    op = cfg.setdefault("operationPolicy", {})
    op.update({
        "mode": "30_DAY_VIRTUAL_OPERATION",
        "operationStartDate": "2026-09-22",
        "mainModelVersion": "KIRYU-RESEARCH-MODEL-V1",
        "mainLogicFrozen": True,
        "improvementsRunAsSeparateShadow": True,
        "realMoney": False,
    })
    promo = cfg.setdefault("promotionPolicy", {})
    promo.update({
        "targetReviewRaces": 60,
        "requireStrictWalkForwardHoldout": True,
        "requireHumanReview": True,
        "autoPromotion": False,
        "realMoneyEnable": False,
    })
    write_json(p, cfg)

def install_candidate_registry(repo):
    p = repo / "venues/kiryu/model-candidates-v1.json"
    x = read_json(p)
    x["candidates"] = [{
        "id": CANDIDATE_ID,
        "mode": "candidateV2",
        "modelVersion": CANDIDATE_VERSION,
        "status": "SHADOW",
        "artifact": "kiryu-research-model-v2.js",
        "activationEvidencePath": "venues/kiryu/model-cycle-deploy-evidence.txt",
        "historicalValidation": {
            "passed": True,
            "holdoutRaces": 340,
            "note": "synthetic lifecycle contract only"
        }
    }]
    write_json(p, x)

def install_synthetic_forward(repo):
    dates = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]
    race_index = 0
    for date in dates:
        rows = []
        for race in range(1, 13):
            race_index += 1
            actual = "1-2-3"
            miss = ["1-2-4", "1-3-2", "2-1-3", "2-3-1"]
            main_hit = race_index <= 6
            candidate_hit = race_index <= 12
            rows.append({
                "race": race,
                "actual": actual,
                "payout100": 2000,
                "classBaseline": {
                    "generatedAt": f"{date}T00:00:00Z",
                    "picks": miss,
                    "hit": False,
                    "modelVersion": "KIRYU-CLASS-BASELINE-V1"
                },
                "programOnly": {
                    "generatedAt": f"{date}T00:00:01Z",
                    "picks": [actual, *miss[:3]] if main_hit else miss,
                    "hit": main_hit,
                    "modelVersion": "KIRYU-RESEARCH-MODEL-V1"
                },
                "candidateV2": {
                    "generatedAt": f"{date}T00:00:02Z",
                    "picks": [actual, *miss[:3]] if candidate_hit else miss,
                    "hit": candidate_hit,
                    "modelVersion": CANDIDATE_VERSION
                }
            })
        write_json(
            repo / f"live/kiryu/{date}/research-evaluation-v1.json",
            {
                "schema": "boat-command-kiryu-shadow-evaluation-v1",
                "venue": "KIRYU",
                "venueCode": "01",
                "date": date,
                "rows": rows,
                "fundingScope": "NONE_RESEARCH_ONLY",
                "bankrollAffected": False,
                "tryAffected": False,
                "productionAffected": False,
            },
        )

def install_extension_forward(repo):
    dates = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-10-22"]
    for date in dates:
        rows = []
        for race in range(1, 13):
            actual = "1-2-3"
            miss = ["1-2-4", "1-3-2", "2-1-3", "2-3-1"]
            rows.append({
                "race": race,
                "actual": actual,
                "payout100": 2000,
                "classBaseline": {
                    "generatedAt": f"{date}T00:00:00Z",
                    "picks": miss,
                    "hit": False,
                    "modelVersion": "KIRYU-CLASS-BASELINE-V1"
                },
                "programOnly": {
                    "generatedAt": f"{date}T00:00:01Z",
                    "picks": miss,
                    "hit": False,
                    "modelVersion": "KIRYU-RESEARCH-MODEL-V1"
                }
            })
        write_json(
            repo / f"live/kiryu/{date}/research-evaluation-v1.json",
            {
                "schema": "boat-command-kiryu-shadow-evaluation-v1",
                "venue": "KIRYU",
                "venueCode": "01",
                "date": date,
                "rows": rows,
                "fundingScope": "NONE_RESEARCH_ONLY",
                "bankrollAffected": False,
                "tryAffected": False,
                "productionAffected": False,
            },
        )

def state(repo):
    return read_json(repo / "venues/kiryu/model-cycle-v1.json")

with tempfile.TemporaryDirectory(prefix="boat-command-cycle-lifecycle-") as td:
    repo = pathlib.Path(td) / "repo"
    shutil.copytree(
        ROOT,
        repo,
        ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"),
    )

    # 1) Baseline: KIRYU is not a formal 30-day mainline yet.
    run(repo, "--action", "refresh", "--date", "2026-09-22")
    s0 = state(repo)
    assert s0["phase"] == "WAITING_FOR_MAINLINE", s0
    assert s0["startDate"] is None and s0["cycleDay"] == 0
    other_waiting = snapshot_others(repo)

    # 2) Simulate venue-local approval of KIRYU mainline. Only KIRYU may transition.
    mutate_kiryu_to_live(repo)
    install_candidate_registry(repo)
    install_synthetic_forward(repo)
    run(repo, "--action", "refresh", "--date", "2026-09-22")
    s1 = state(repo)
    assert s1["phase"] == "ACTIVE", s1
    assert s1["cycleNumber"] == 1
    assert s1["startDate"] == "2026-09-22"
    assert s1["endDate"] == "2026-10-21"
    assert s1["cycleDay"] == 1 and s1["daysRemaining"] == 29
    assert s1["mainline"]["modelVersion"] == "KIRYU-RESEARCH-MODEL-V1"
    assert s1["mainline"]["frozen"] is True
    assert s1["isolation"]["scope"] == "VENUE_ONLY"
    assert s1["isolation"]["crossVenueTraining"] is False
    assert s1["isolation"]["crossVenueWeightReuse"] is False
    assert s1["isolation"]["crossVenuePromotion"] is False
    assert_others_same(repo, other_waiting)

    # 3) Day 30: enough venue-local forward evidence produces REVIEW_READY,
    #    but does not auto-promote.
    run(repo, "--action", "refresh", "--date", "2026-10-21")
    s30 = state(repo)
    assert s30["phase"] == "REVIEW_READY", s30
    assert s30["cycleDay"] == 30 and s30["daysRemaining"] == 0
    assert s30["mainline"]["evaluation"]["races"] == 60
    assert s30["mainline"]["evaluation"]["hits"] == 6
    candidate = next(x for x in s30["candidates"] if x["id"] == CANDIDATE_ID)
    assert candidate["pairedRaces"] == 60
    assert candidate["evaluation"]["hits"] == 12
    assert candidate["gates"]["historicalOk"] is True
    assert candidate["gates"]["forwardEligible"] is True
    assert candidate["gates"]["eligible"] is True
    assert s30["recommendation"]["state"] == "CANDIDATE_ELIGIBLE"
    assert s30["recommendation"]["candidateId"] == CANDIDATE_ID
    assert s30["review"]["humanDecision"] == "PENDING"
    assert s30["promotion"]["autoPromotion"] is False
    assert s30["mainline"]["modelVersion"] == "KIRYU-RESEARCH-MODEL-V1"

    # 4) Human approval changes only KIRYU and still does not activate the model.
    before_approve_others = snapshot_others(repo)
    run(
        repo,
        "--action", "approve",
        "--venue", KIRYU,
        "--candidate", CANDIDATE_ID,
        "--date", "2026-10-21",
    )
    approved = state(repo)
    assert approved["phase"] == "APPROVED_PENDING_DEPLOYMENT"
    assert approved["review"]["humanDecision"] == "APPROVE_CANDIDATE"
    assert approved["review"]["candidateId"] == CANDIDATE_ID
    assert approved["mainline"]["modelVersion"] == "KIRYU-RESEARCH-MODEL-V1"
    assert_others_same(repo, before_approve_others)

    # 5) Approval alone is insufficient. Missing deployment evidence must fail closed.
    rc, output = run(
        repo,
        "--action", "activate",
        "--venue", KIRYU,
        "--candidate", CANDIDATE_ID,
        "--date", "2026-10-22",
        expect_ok=False,
    )
    assert "MODEL_CYCLE_DEPLOYMENT_EVIDENCE_MISSING" in output, output

    # Normalize the next date, then prove an activation action still cannot mutate other venues.
    run(repo, "--action", "refresh", "--date", "2026-10-22")
    before_activate_others = snapshot_others(repo)

    # 6) Once deployment evidence exists, Cycle 2 may start with the verified candidate.
    evidence_path = repo / "venues/kiryu/model-cycle-deploy-evidence.txt"
    evidence_path.write_text(CANDIDATE_VERSION + "\n", encoding="utf-8")
    run(
        repo,
        "--action", "activate",
        "--venue", KIRYU,
        "--candidate", CANDIDATE_ID,
        "--date", "2026-10-22",
    )
    s2 = state(repo)
    assert s2["phase"] == "ACTIVE"
    assert s2["cycleNumber"] == 2
    assert s2["startDate"] == "2026-10-22"
    assert s2["endDate"] == "2026-11-20"
    assert s2["cycleDay"] == 1 and s2["daysRemaining"] == 29
    assert s2["mainline"]["modelVersion"] == CANDIDATE_VERSION
    assert s2["mainline"]["integrity"] == "ACTIVATION_VERIFIED"
    assert s2["review"]["humanDecision"] == "PENDING"
    assert_others_same(repo, before_activate_others)

    # 7) A normal refresh must not revert the newly activated Cycle 2 mainline
    #    to the stale config version. The cycle state is the frozen source of truth.
    before_refresh_others = snapshot_others(repo)
    run(repo, "--action", "refresh", "--date", "2026-10-22")
    s2_refresh = state(repo)
    assert s2_refresh["phase"] == "ACTIVE"
    assert s2_refresh["cycleNumber"] == 2
    assert s2_refresh["cycleId"] == s2["cycleId"]
    assert s2_refresh["cycleDay"] == 1 and s2_refresh["daysRemaining"] == 29
    assert s2_refresh["mainline"]["modelVersion"] == CANDIDATE_VERSION
    assert s2_refresh["mainline"]["integrity"] == "OK"
    assert_others_same(repo, before_refresh_others)

    # 8) Closed cycle is archived, while source evidence remains untouched.
    history_dir = repo / "venues/kiryu/model-cycle-history"
    archives = sorted(history_dir.glob("kiryu-cycle-001-*.json"))
    assert len(archives) == 1, archives
    archived = read_json(archives[0])
    assert archived["cycleNumber"] == 1
    assert archived["finalDecision"]["action"] == "ACTIVATE"
    assert archived["finalDecision"]["candidateId"] == CANDIDATE_ID
    assert (repo / "live/kiryu/2026-09-22/research-evaluation-v1.json").exists()
    assert s2["retention"]["sourceDataPreserved"] is True
    assert s2["retention"]["cycleHistoryPreserved"] is True

with tempfile.TemporaryDirectory(prefix="boat-command-cycle-extension-") as td:
    repo = pathlib.Path(td) / "repo"
    shutil.copytree(
        ROOT,
        repo,
        ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"),
    )

    # Evidence extension must actually accumulate post-day-30 races.
    mutate_kiryu_to_live(repo)
    install_extension_forward(repo)
    run(repo, "--action", "refresh", "--date", "2026-09-22")
    run(repo, "--action", "refresh", "--date", "2026-10-21")
    ext = state(repo)
    assert ext["phase"] == "EVIDENCE_EXTENSION", ext
    assert ext["cycleDay"] == 30 and ext["daysRemaining"] == 0
    assert ext["mainline"]["evaluation"]["races"] == 48
    assert ext["mainline"]["evidenceThroughDate"] == "2026-10-21"

    run(repo, "--action", "refresh", "--date", "2026-10-22")
    ready = state(repo)
    assert ready["phase"] == "REVIEW_READY", ready
    assert ready["mainline"]["evaluation"]["races"] == 60
    assert ready["mainline"]["evidenceThroughDate"] == "2026-10-22"

    # Once review-ready, freeze the evidence snapshot so later dates do not
    # move the review target underneath the human decision.
    run(repo, "--action", "refresh", "--date", "2026-10-23")
    frozen = state(repo)
    assert frozen["phase"] == "REVIEW_READY", frozen
    assert frozen["mainline"]["evaluation"]["races"] == 60
    assert frozen["mainline"]["evidenceThroughDate"] == "2026-10-22"

with tempfile.TemporaryDirectory(prefix="boat-command-cycle-continue-") as td:
    repo = pathlib.Path(td) / "repo"
    shutil.copytree(
        ROOT,
        repo,
        ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"),
    )

    # CONTINUE on the review date must archive Cycle 1, start Cycle 2 no
    # earlier than the next evidence day, and never carry Cycle 1 metrics.
    mutate_kiryu_to_live(repo)
    install_candidate_registry(repo)
    install_synthetic_forward(repo)
    run(repo, "--action", "refresh", "--date", "2026-09-22")
    run(repo, "--action", "refresh", "--date", "2026-10-21")
    before_continue_others = snapshot_others(repo)
    run(
        repo,
        "--action", "continue",
        "--venue", KIRYU,
        "--date", "2026-10-21",
    )
    continued = state(repo)
    assert continued["phase"] == "ACTIVE"
    assert continued["cycleNumber"] == 2
    assert continued["startDate"] == "2026-10-22"
    assert continued["endDate"] == "2026-11-20"
    assert continued["cycleDay"] == 0 and continued["daysRemaining"] == 30
    assert continued["mainline"]["modelVersion"] == "KIRYU-RESEARCH-MODEL-V1"
    assert continued["mainline"]["evaluation"]["races"] == 0
    assert continued["mainline"]["evaluation"]["hits"] == 0
    assert continued["mainline"]["evidenceThroughDate"] is None
    assert continued["candidates"] == []
    assert continued["review"]["humanDecision"] == "PENDING"
    assert_others_same(repo, before_continue_others)

    run(repo, "--action", "refresh", "--date", "2026-10-21")
    same_day = state(repo)
    assert same_day["cycleNumber"] == 2
    assert same_day["cycleDay"] == 0 and same_day["daysRemaining"] == 30
    assert same_day["mainline"]["evaluation"]["races"] == 0

    run(repo, "--action", "refresh", "--date", "2026-10-22")
    next_day = state(repo)
    assert next_day["cycleNumber"] == 2
    assert next_day["cycleDay"] == 1 and next_day["daysRemaining"] == 29
    assert next_day["mainline"]["evaluation"]["races"] == 0

    archives = sorted((repo / "venues/kiryu/model-cycle-history").glob("kiryu-cycle-001-*.json"))
    assert len(archives) == 1
    archived = read_json(archives[0])
    assert archived["finalDecision"]["action"] == "CONTINUE"
    assert archived["finalDecision"]["modelVersion"] == "KIRYU-RESEARCH-MODEL-V1"
    assert archived["mainline"]["evaluation"]["races"] == 60

with tempfile.TemporaryDirectory(prefix="boat-command-cycle-reject-") as td:
    repo = pathlib.Path(td) / "repo"
    shutil.copytree(
        ROOT,
        repo,
        ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"),
    )

    # REJECT must keep the current mainline, discard the candidate from the
    # new cycle, reset all evaluation totals, and preserve the other 23 venues.
    mutate_kiryu_to_live(repo)
    install_candidate_registry(repo)
    install_synthetic_forward(repo)
    run(repo, "--action", "refresh", "--date", "2026-09-22")
    run(repo, "--action", "refresh", "--date", "2026-10-21")
    before_reject_others = snapshot_others(repo)
    run(
        repo,
        "--action", "reject",
        "--venue", KIRYU,
        "--date", "2026-10-21",
    )
    rejected = state(repo)
    assert rejected["phase"] == "ACTIVE"
    assert rejected["cycleNumber"] == 2
    assert rejected["startDate"] == "2026-10-22"
    assert rejected["cycleDay"] == 0 and rejected["daysRemaining"] == 30
    assert rejected["mainline"]["modelVersion"] == "KIRYU-RESEARCH-MODEL-V1"
    assert rejected["mainline"]["evaluation"]["races"] == 0
    assert rejected["mainline"]["evidenceThroughDate"] is None
    assert rejected["candidates"] == []
    assert rejected["recommendation"]["reasons"] == ["CANDIDATE_REJECTED_NEW_CYCLE"]
    assert_others_same(repo, before_reject_others)

    archives = sorted((repo / "venues/kiryu/model-cycle-history").glob("kiryu-cycle-001-*.json"))
    assert len(archives) == 1
    archived = read_json(archives[0])
    assert archived["finalDecision"]["action"] == "REJECT"
    assert archived["finalDecision"]["modelVersion"] == "KIRYU-RESEARCH-MODEL-V1"
    assert archived["mainline"]["evaluation"]["races"] == 60

print("VENUE_MODEL_CYCLE_LIFECYCLE_SIMULATION_PASS")
