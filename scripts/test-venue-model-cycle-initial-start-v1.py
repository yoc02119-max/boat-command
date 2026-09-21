#!/usr/bin/env python3
import json
import pathlib
import re
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EFFECTIVE_DATE = "2026-09-22"
START_DATE = "2026-09-23"
WAITING = [
    "kiryu","heiwajima","tamagawa","hamanako","tokoname","tsu","biwako","suminoe",
    "amagasaki","marugame","kojima","miyajima","shimonoseki","wakamatsu","fukuoka","omura"
]

def read_json(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))

def write_json(path, data):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

def run(repo, *args, expect_ok=True):
    cmd = ["node", "scripts/venue-model-cycle-v1.js", *args]
    proc = subprocess.run(cmd, cwd=repo, text=True, capture_output=True)
    if expect_ok and proc.returncode != 0:
        raise AssertionError(f"command failed {cmd}\n{proc.stdout}\n{proc.stderr}")
    if not expect_ok and proc.returncode == 0:
        raise AssertionError(f"command unexpectedly passed {cmd}\n{proc.stdout}")
    return proc.returncode, proc.stdout + proc.stderr

def semantic_cycle(path):
    x = read_json(path)
    x.pop("generatedAt", None)
    return x

def snapshot_cycles(repo, exclude=None):
    exclude = set(exclude or [])
    out = {}
    for p in sorted((repo / "venues").glob("*/model-cycle-v1.json")):
        slug = p.parent.name
        if slug == "_template" or slug in exclude:
            continue
        out[slug] = semantic_cycle(p)
    return out

def assert_others_same(repo, before, exclude=None):
    after = snapshot_cycles(repo, exclude=exclude)
    assert before.keys() == after.keys(), (before.keys(), after.keys())
    changed = [slug for slug in before if before[slug] != after[slug]]
    assert not changed, f"cross-venue mutation: {changed}"

def artifact_version(repo, slug):
    p = repo / f"{slug}-research-model-v1.js"
    text = p.read_text(encoding="utf-8")
    m = re.search(r"const VERSION=['\"]([^'\"]+)['\"]", text)
    assert m, slug
    return m.group(1)

# Negative gate: an unready venue must fail closed and leave config/state unchanged.
with tempfile.TemporaryDirectory(prefix="boat-command-initial-start-negative-") as td:
    repo = pathlib.Path(td) / "repo"
    shutil.copytree(ROOT, repo, ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"))

    run(repo, "--action", "refresh", "--date", EFFECTIVE_DATE)
    cfg_path = repo / "venues/kiryu/config-v1.json"
    ready_path = repo / "venues/kiryu/readiness-v1.json"
    cfg_before = read_json(cfg_path)
    cycle_before = semantic_cycle(repo / "venues/kiryu/model-cycle-v1.json")
    others_before = snapshot_cycles(repo, exclude={"kiryu"})

    readiness = read_json(ready_path)
    readiness["baseline"]["ready"] = False
    write_json(ready_path, readiness)

    rc, output = run(
        repo,
        "--action", "start",
        "--venue", "kiryu",
        "--date", EFFECTIVE_DATE,
        expect_ok=False,
    )
    assert "MODEL_CYCLE_START_BASELINE_NOT_READY" in output, output
    assert read_json(cfg_path) == cfg_before
    assert semantic_cycle(repo / "venues/kiryu/model-cycle-v1.json") == cycle_before
    assert_others_same(repo, others_before, exclude={"kiryu"})

# Positive fleet contract: all current WAITING venues can enter Cycle 1 independently
# once their build gate (history + baseline + PRE-RACE isolation + model artifact) is ready.
with tempfile.TemporaryDirectory(prefix="boat-command-initial-start-fleet-") as td:
    repo = pathlib.Path(td) / "repo"
    shutil.copytree(ROOT, repo, ignore=shutil.ignore_patterns(".git", "node_modules", "__pycache__"))

    run(repo, "--action", "refresh", "--date", EFFECTIVE_DATE)
    fleet0 = read_json(repo / "venue-model-cycle-fleet-v1.json")
    waiting0 = [x["slug"] for x in fleet0["venueStates"] if x["phase"] == "WAITING_FOR_MAINLINE"]
    assert waiting0 == WAITING, waiting0
    assert fleet0["active"] == 8 and fleet0["waiting"] == 16, fleet0

    for slug in WAITING:
        readiness = read_json(repo / f"venues/{slug}/readiness-v1.json")
        assert readiness["history"]["ready"] is True, slug
        assert readiness["baseline"]["ready"] is True, slug

        cfg_before = read_json(repo / f"venues/{slug}/config-v1.json")
        assert cfg_before["state"] == "BUILDING", slug
        assert cfg_before["modelEnabled"] is False, slug
        assert cfg_before["realMoneyEnabled"] is False, slug

        others_before = snapshot_cycles(repo, exclude={slug})
        run(
            repo,
            "--action", "start",
            "--venue", slug,
            "--date", EFFECTIVE_DATE,
        )

        cfg = read_json(repo / f"venues/{slug}/config-v1.json")
        state = read_json(repo / f"venues/{slug}/model-cycle-v1.json")
        expected_model = cfg_before.get("operationPolicy", {}).get("mainModelVersion") or artifact_version(repo, slug)

        assert cfg["state"] == "LIVE_SIMULATION", slug
        assert cfg["modelEnabled"] is True, slug
        assert cfg["tryEnabled"] is True, slug
        assert cfg["realMoneyEnabled"] is False, slug
        assert cfg["operationPolicy"]["mode"] == "30_DAY_VIRTUAL_OPERATION", slug
        assert cfg["operationPolicy"]["operationStartDate"] == START_DATE, slug
        assert cfg["operationPolicy"]["mainModelVersion"] == expected_model, slug
        assert cfg["operationPolicy"]["mainLogicFrozen"] is True, slug
        assert cfg["operationPolicy"]["realMoney"] is False, slug

        assert state["phase"] == "ACTIVE", slug
        assert state["cycleNumber"] == 1, slug
        assert state["startDate"] == START_DATE, slug
        assert state["endDate"] == "2026-10-22", slug
        assert state["cycleDay"] == 0 and state["daysRemaining"] == 30, slug
        assert state["mainline"]["modelVersion"] == expected_model, slug
        assert state["mainline"]["integrity"] == "INITIAL_START_VERIFIED", slug
        assert state["mainline"]["evaluation"]["races"] == 0, slug
        assert state["promotion"]["humanReviewRequired"] is True, slug
        assert state["promotion"]["autoPromotion"] is False, slug
        assert state["promotion"]["realMoneyEnable"] is False, slug
        assert state["isolation"]["scope"] == "VENUE_ONLY", slug
        assert state["isolation"]["crossVenueTraining"] is False, slug
        assert state["isolation"]["crossVenueWeightReuse"] is False, slug
        assert state["isolation"]["crossVenuePromotion"] is False, slug
        assert_others_same(repo, others_before, exclude={slug})

    fleet_started = read_json(repo / "venue-model-cycle-fleet-v1.json")
    assert fleet_started["venues"] == 24
    assert fleet_started["active"] == 24, fleet_started
    assert fleet_started["waiting"] == 0, fleet_started
    assert fleet_started["reviewReady"] == 0, fleet_started
    assert fleet_started["blocked"] == 0, fleet_started

    # The following day, all 16 newly-started venues advance to Cycle day 1.
    # No old same-day SHADOW evidence may leak into their new cycle.
    run(repo, "--action", "refresh", "--date", START_DATE)
    for slug in WAITING:
        state = read_json(repo / f"venues/{slug}/model-cycle-v1.json")
        assert state["cycleNumber"] == 1, slug
        assert state["cycleDay"] == 1 and state["daysRemaining"] == 29, slug
        assert state["startDate"] == START_DATE, slug
        assert state["mainline"]["evaluation"]["races"] == 0, slug
        assert state["mainline"]["integrity"] == "OK", slug

    fleet_day1 = read_json(repo / "venue-model-cycle-fleet-v1.json")
    assert fleet_day1["venues"] == 24
    assert fleet_day1["active"] == 24, fleet_day1
    assert fleet_day1["waiting"] == 0, fleet_day1

print("VENUE_MODEL_CYCLE_INITIAL_START_16_PASS")
