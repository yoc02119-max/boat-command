#!/usr/bin/env python3
import copy
import json
import pathlib
import re
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EFFECTIVE_DATE = "2026-10-25"

STANDARD = {
    "gamagori": {
        "venue": "GAMAGORI",
        "start": "2026-09-18",
        "model": "GAMAGORI-MAIN-MODEL-V0.32.0",
        "scenario": "KEEP_NO_CANDIDATE",
    },
    "toda": {
        "venue": "TODA",
        "start": "2026-09-20",
        "model": "TODA-RESEARCH-MODEL-V1",
        "scenario": "KEEP_NO_CANDIDATE",
    },
    "edogawa": {
        "venue": "EDOGAWA",
        "start": "2026-09-21",
        "model": "EDOGAWA-RESEARCH-MODEL-V2",
        "scenario": "CANDIDATE_ELIGIBLE",
    },
    "mikuni": {
        "venue": "MIKUNI",
        "start": "2026-09-22",
        "model": "MIKUNI-RESEARCH-MODEL-V1",
        "scenario": "EVIDENCE_EXTENSION",
    },
    "naruto": {
        "venue": "NARUTO",
        "start": "2026-09-23",
        "model": "NARUTO-RESEARCH-MODEL-V1",
        "scenario": "MODEL_DRIFT",
    },
    "tokuyama": {
        "venue": "TOKUYAMA",
        "start": "2026-09-24",
        "model": "TOKUYAMA-RESEARCH-MODEL-V1",
        "scenario": "UNREGISTERED_CANDIDATE",
    },
    "ashiya": {
        "venue": "ASHIYA",
        "start": "2026-09-25",
        "model": "ASHIYA-RESEARCH-MODEL-V1",
        "scenario": "HISTORICAL_FAIL",
    },
    "karatsu": {
        "venue": "KARATSU",
        "start": "2026-09-26",
        "model": "KARATSU-RESEARCH-MODEL-V1",
        "scenario": "NO_FORWARD_IMPROVEMENT",
    },
}
GAMAGORI = "gamagori"
ACTIVE = set(STANDARD)

def read_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))

def write_json(path, data):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def run(repo, *args):
    cmd = ["node", "scripts/venue-model-cycle-v1.js", *args]
    proc = subprocess.run(cmd, cwd=repo, text=True, capture_output=True)
    if proc.returncode != 0:
        raise AssertionError(f"command failed {cmd}\n{proc.stdout}\n{proc.stderr}")
    return proc.stdout

def registry(repo):
    text = (repo / "venue-registry-v1.js").read_text(encoding="utf-8")
    rows = re.findall(r"\['(\d{2})','([^']+)','([^']+)','([^']+)'\]", text)
    assert len(rows) == 24, len(rows)
    return {slug: {"code": code, "name": name, "key": key} for code, name, slug, key in rows}

def semantic_state(path):
    x = read_json(path)
    x.pop("generatedAt", None)
    return x

def snapshot(repo, exclude=None):
    exclude = set(exclude or [])
    out = {}
    for p in sorted((repo / "venues").glob("*/model-cycle-v1.json")):
        slug = p.parent.name
        if slug == "_template" or slug in exclude:
            continue
        out[slug] = semantic_state(p)
    return out

def assert_same(repo, before, exclude=None):
    after = snapshot(repo, exclude=exclude)
    assert before.keys() == after.keys(), (before.keys(), after.keys())
    changed = [slug for slug in before if before[slug] != after[slug]]
    assert not changed, f"unexpected venue mutation: {changed}"

def configure_waiting(repo, slug):
    p = repo / f"venues/{slug}/config-v1.json"
    cfg = read_json(p)
    cfg["state"] = "BUILDING"
    cfg["modelEnabled"] = False
    cfg["tryEnabled"] = False
    cfg["realMoneyEnabled"] = False
    op = cfg.setdefault("operationPolicy", {})
    op["mode"] = "BUILD_FIRST_THEN_30_DAY_VIRTUAL_OPERATION"
    op["operationStartDate"] = None
    op["mainModelVersion"] = None
    op["mainLogicFrozen"] = False
    op["realMoney"] = False
    write_json(p, cfg)

def configure_active(repo, slug, meta):
    p = repo / f"venues/{slug}/config-v1.json"
    cfg = read_json(p)
    cfg["state"] = "LIVE_SIMULATION"
    cfg["modelEnabled"] = True
    cfg["tryEnabled"] = True
    cfg["realMoneyEnabled"] = False
    op = cfg.setdefault("operationPolicy", {})
    op.update({
        "mode": "30_DAY_VIRTUAL_OPERATION",
        "operationStartDate": meta["start"],
        "mainModelVersion": meta["model"],
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

def install_registry(repo, slug, candidate=None, historical_pass=True):
    p = repo / f"venues/{slug}/model-candidates-v1.json"
    x = read_json(p)
    if candidate is None:
        x["candidates"] = []
    else:
        x["candidates"] = [{
            "id": candidate["id"],
            "mode": candidate["mode"],
            "modelVersion": candidate["modelVersion"],
            "status": "SHADOW",
            "artifact": f"{slug}-fleet-candidate-v2.js",
            "activationEvidencePath": f"venues/{slug}/model-cycle-deploy-evidence.txt",
            "historicalValidation": {
                "passed": historical_pass,
                "holdoutRaces": 340,
                "note": "synthetic 8-venue mixed lifecycle contract only"
            }
        }]
    write_json(p, x)

def add_days(date, days):
    from datetime import date as date_cls, timedelta
    y, m, d = map(int, date.split("-"))
    return (date_cls(y, m, d) + timedelta(days=days)).isoformat()

def write_standard_evidence(repo, slug, meta):
    live_dir = repo / "live" / slug
    if live_dir.exists():
        shutil.rmtree(live_dir)

    scenario = meta["scenario"]
    main_model = meta["model"]
    candidate = {
        "id": f"candidateV2:{meta['venue']}-CANDIDATE-FLEET-V2",
        "mode": "candidateV2",
        "modelVersion": f"{meta['venue']}-CANDIDATE-FLEET-V2",
    }

    if scenario == "CANDIDATE_ELIGIBLE":
        install_registry(repo, slug, candidate, historical_pass=True)
    elif scenario == "HISTORICAL_FAIL":
        install_registry(repo, slug, candidate, historical_pass=False)
    elif scenario == "NO_FORWARD_IMPROVEMENT":
        install_registry(repo, slug, candidate, historical_pass=True)
    else:
        install_registry(repo, slug, None)

    day_count = 4 if scenario == "EVIDENCE_EXTENSION" else 5
    if scenario == "MODEL_DRIFT":
        day_count = 6

    race_index = 0
    for day_offset in range(day_count):
        date = add_days(meta["start"], day_offset)
        rows = []
        for race in range(1, 13):
            race_index += 1
            actual = "1-2-3"
            miss = ["1-2-4", "1-3-2", "2-1-3", "2-3-1"]
            main_hit = race_index <= 6
            row_model = main_model
            if scenario == "MODEL_DRIFT" and day_offset == 5:
                row_model = f"{meta['venue']}-RESEARCH-MODEL-DRIFT"
            row = {
                "race": race,
                "actual": actual,
                "payout100": 2000,
                "classBaseline": {
                    "generatedAt": f"{date}T00:00:00Z",
                    "picks": miss,
                    "hit": False,
                    "modelVersion": f"{meta['venue']}-CLASS-BASELINE-V1",
                },
                "programOnly": {
                    "generatedAt": f"{date}T00:00:01Z",
                    "picks": [actual, *miss[:3]] if main_hit else miss,
                    "hit": main_hit,
                    "modelVersion": row_model,
                },
            }
            if scenario in {"CANDIDATE_ELIGIBLE", "UNREGISTERED_CANDIDATE", "HISTORICAL_FAIL", "NO_FORWARD_IMPROVEMENT"}:
                candidate_hit = main_hit if scenario == "NO_FORWARD_IMPROVEMENT" else race_index <= 12
                row["candidateV2"] = {
                    "generatedAt": f"{date}T00:00:02Z",
                    "picks": [actual, *miss[:3]] if candidate_hit else miss,
                    "hit": candidate_hit,
                    "modelVersion": candidate["modelVersion"],
                }
            rows.append(row)
        write_json(
            repo / f"live/{slug}/{date}/research-evaluation-v1.json",
            {
                "schema": f"boat-command-{slug}-shadow-evaluation-v1",
                "venue": meta["venue"],
                "venueCode": registry(repo)[slug]["code"],
                "date": date,
                "rows": rows,
                "fundingScope": "NONE_RESEARCH_ONLY",
                "bankrollAffected": False,
                "tryAffected": False,
                "productionAffected": False,
            },
        )
    return candidate

with tempfile.TemporaryDirectory(prefix="boat-command-8venue-mixed-") as td:
    repo = pathlib.Path(td) / "repo"
    shutil.copytree(
        ROOT,
        repo,
        ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"),
    )

    reg = registry(repo)
    assert ACTIVE == {"toda", "edogawa", "gamagori", "mikuni", "naruto", "tokuyama", "ashiya", "karatsu"}

    # Build a deterministic mixed fleet in the temporary copy only:
    # all eight active venues use the same standard venue-local lifecycle.
    for slug in reg:
        cycle = repo / f"venues/{slug}/model-cycle-v1.json"
        if cycle.exists():
            cycle.unlink()
        history = repo / f"venues/{slug}/model-cycle-history"
        if history.exists():
            shutil.rmtree(history)

        if slug in STANDARD:
            configure_active(repo, slug, STANDARD[slug])
        else:
            configure_waiting(repo, slug)

    candidates = {}
    for slug, meta in STANDARD.items():
        candidates[slug] = write_standard_evidence(repo, slug, meta)

    # Baseline proves all eight clocks coexist while the other sixteen remain waiting.
    run(repo, "--action", "refresh", "--date", "2026-09-18")
    fleet0 = read_json(repo / "venue-model-cycle-fleet-v1.json")
    assert fleet0["venues"] == 24
    assert fleet0["active"] == 8, fleet0
    assert fleet0["waiting"] == 16, fleet0
    controls_before = snapshot(repo, exclude=ACTIVE)
    assert len(controls_before) == 16

    # Advance the mixed fleet in one refresh. Each venue must respect its own start/end,
    # evidence count, candidate ledger and terminal decision.
    run(repo, "--action", "refresh", "--date", EFFECTIVE_DATE)
    fleet = read_json(repo / "venue-model-cycle-fleet-v1.json")
    states = {x["slug"]: x for x in (read_json(repo / f"venues/{x['slug']}/model-cycle-v1.json") for x in fleet["venueStates"])}

    expected_windows = {
        "gamagori": ("2026-09-18", "2026-10-17"),
        "toda": ("2026-09-20", "2026-10-19"),
        "edogawa": ("2026-09-21", "2026-10-20"),
        "mikuni": ("2026-09-22", "2026-10-21"),
        "naruto": ("2026-09-23", "2026-10-22"),
        "tokuyama": ("2026-09-24", "2026-10-23"),
        "ashiya": ("2026-09-25", "2026-10-24"),
        "karatsu": ("2026-09-26", "2026-10-25"),
    }
    for slug, (start, end) in expected_windows.items():
        s = states[slug]
        assert s["startDate"] == start, (slug, s["startDate"])
        assert s["endDate"] == end, (slug, s["endDate"])
        assert s["cycleDay"] == 30 and s["daysRemaining"] == 0, (slug, s["cycleDay"], s["daysRemaining"])
        assert s["isolation"]["scope"] == "VENUE_ONLY"
        assert s["isolation"]["crossVenueTraining"] is False
        assert s["isolation"]["crossVenueWeightReuse"] is False
        assert s["isolation"]["crossVenuePromotion"] is False

    toda = states["toda"]
    assert toda["phase"] == "REVIEW_READY"
    assert toda["mainline"]["evaluation"]["races"] == 60
    assert toda["recommendation"]["state"] == "KEEP_CURRENT"

    edogawa = states["edogawa"]
    assert edogawa["phase"] == "REVIEW_READY"
    assert edogawa["mainline"]["evaluation"]["races"] == 60
    assert edogawa["recommendation"]["state"] == "CANDIDATE_ELIGIBLE"
    assert edogawa["recommendation"]["candidateId"] == candidates["edogawa"]["id"]
    edogawa_candidate = next(x for x in edogawa["candidates"] if x["id"] == candidates["edogawa"]["id"])
    assert edogawa_candidate["pairedRaces"] == 60
    assert edogawa_candidate["gates"]["historicalOk"] is True
    assert edogawa_candidate["gates"]["forwardEligible"] is True
    assert edogawa_candidate["gates"]["eligible"] is True

    mikuni = states["mikuni"]
    assert mikuni["phase"] == "EVIDENCE_EXTENSION"
    assert mikuni["mainline"]["evaluation"]["races"] == 48
    assert mikuni["recommendation"]["state"] == "EXTEND_EVIDENCE"

    naruto = states["naruto"]
    assert naruto["phase"] == "REVIEW_BLOCKED"
    assert naruto["mainline"]["evaluation"]["races"] == 60
    assert naruto["mainline"]["integrity"] == "DRIFT_DETECTED"
    assert naruto["recommendation"]["state"] == "BLOCKED"

    tokuyama = states["tokuyama"]
    assert tokuyama["phase"] == "REVIEW_READY"
    assert tokuyama["mainline"]["evaluation"]["races"] == 60
    assert tokuyama["recommendation"]["state"] == "KEEP_CURRENT"
    tokuyama_candidate = next(x for x in tokuyama["candidates"] if x["id"] == candidates["tokuyama"]["id"])
    assert tokuyama_candidate["registered"] is False
    assert tokuyama_candidate["gates"]["eligible"] is False

    ashiya = states["ashiya"]
    assert ashiya["phase"] == "REVIEW_READY"
    assert ashiya["mainline"]["evaluation"]["races"] == 60
    ashiya_candidate = next(x for x in ashiya["candidates"] if x["id"] == candidates["ashiya"]["id"])
    assert ashiya_candidate["gates"]["forwardEligible"] is True
    assert ashiya_candidate["gates"]["historicalOk"] is False
    assert ashiya_candidate["gates"]["eligible"] is False
    assert ashiya["recommendation"]["state"] == "KEEP_CURRENT"

    karatsu = states["karatsu"]
    assert karatsu["phase"] == "REVIEW_READY"
    assert karatsu["mainline"]["evaluation"]["races"] == 60
    karatsu_candidate = next(x for x in karatsu["candidates"] if x["id"] == candidates["karatsu"]["id"])
    assert karatsu_candidate["gates"]["historicalOk"] is True
    assert karatsu_candidate["gates"]["forwardEligible"] is False
    assert "NO_FORWARD_METRIC_IMPROVEMENT" in karatsu_candidate["gates"]["reasons"]
    assert karatsu["recommendation"]["state"] == "KEEP_CURRENT"

    gamagori = states["gamagori"]
    assert gamagori["phase"] == "REVIEW_READY"
    assert gamagori["mainline"]["evaluation"]["races"] == 60
    assert gamagori["mainline"]["modelVersion"] == "GAMAGORI-MAIN-MODEL-V0.32.0"
    assert gamagori["mainline"]["integrity"] == "OK"
    assert gamagori["recommendation"]["state"] == "KEEP_CURRENT"

    assert fleet["venues"] == 24
    assert fleet["active"] == 0
    assert fleet["reviewReady"] == 6
    assert fleet["waiting"] == 16
    assert fleet["blocked"] == 2
    assert_same(repo, controls_before, exclude=ACTIVE)

    # A venue-local decision in this mixed terminal state must mutate EDOGAWA only.
    before_approve = snapshot(repo, exclude={"edogawa"})
    run(
        repo,
        "--action", "approve",
        "--venue", "edogawa",
        "--candidate", candidates["edogawa"]["id"],
        "--date", EFFECTIVE_DATE,
    )
    approved = read_json(repo / "venues/edogawa/model-cycle-v1.json")
    assert approved["phase"] == "APPROVED_PENDING_DEPLOYMENT"
    assert approved["review"]["humanDecision"] == "APPROVE_CANDIDATE"
    assert approved["review"]["candidateId"] == candidates["edogawa"]["id"]
    assert_same(repo, before_approve, exclude={"edogawa"})

print("VENUE_MODEL_CYCLE_8VENUE_MIXED_SIMULATION_PASS")
