#!/usr/bin/env python3
# BOAT COMMAND GAMAGORI BET-TYPE ROI AUDIT v0.34.2
# Historical research only. Gate/picks are frozen from PRE-derived replay predictions
# before official payout/result pages are read.
import json, re, time
from pathlib import Path
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

PRED = Path("gamagori-replay-predictions-v0333.json")
COMBO = Path("gamagori-win-pattern-combo-v0339.json")
RESULT = Path("gamagori-replay-results-v0333.json")
OUT = Path("gamagori-bet-type-roi-v0342.json")
JST = timezone(timedelta(hours=9))

pred = json.loads(PRED.read_text(encoding="utf-8"))
combo = json.loads(COMBO.read_text(encoding="utf-8"))
result = json.loads(RESULT.read_text(encoding="utf-8"))

if pred.get("resultsIncluded") is not False or pred.get("payoutsIncluded") is not False or pred.get("exhibitionIncluded") is not False or pred.get("futureDataIncluded") is not False:
    raise SystemExit("PRED_BOUNDARY_INVALID")
if combo.get("decision") != "SHADOW_ONLY" or combo.get("liveImported") is not False:
    raise SystemExit("COMBO_BOUNDARY_INVALID")
if result.get("predictionInputsIncluded") is not False:
    raise SystemExit("RESULT_BOUNDARY_INVALID")

train = set(combo.get("split", {}).get("trainDates", []))
validation = set(combo.get("split", {}).get("validationDates", []))
test = set(combo.get("split", {}).get("testDates", []))
if not train or not validation or not test:
    raise SystemExit("SPLIT_MISSING")

def split_of(date):
    if date in train: return "train"
    if date in validation: return "validation"
    if date in test: return "test"
    return None

def a_class_count(classes):
    return sum(1 for c in classes if str(c).upper() in {"A1", "A2"})

# Freeze the primary gate + all candidate picks BEFORE touching official result pages.
locked = []
for x in pred.get("races", []):
    date = str(x.get("d", ""))
    race = int(x.get("r", 0) or 0)
    classes = list(x.get("c") or [])
    picks3 = [str(p) for p in (x.get("f") or [])]
    if race != 7 or a_class_count(classes) != 3:
        continue
    split = split_of(date)
    if split is None:
        continue
    picks2 = sorted(set("-".join(p.split("-")[:2]) for p in picks3 if len(p.split("-")) == 3))
    picks1 = sorted(set(p.split("-")[0] for p in picks3 if len(p.split("-")) == 3))
    locked.append({
        "id": f"{date}|{race}",
        "date": date,
        "race": race,
        "split": split,
        "classes": classes,
        "trifectaPicks": picks3,
        "exactaPicks": picks2,
        "winPicks": picks1,
    })

if len(locked) != 199:
    raise SystemExit(f"PRIMARY_GATE_COUNT_CHANGED:{len(locked)}")

by_result = {f"{x.get('d')}|{x.get('r')}": x for x in result.get("races", [])}
headers = {"User-Agent": "Mozilla/5.0 BOAT-COMMAND/0.34.2"}
session = requests.Session()
session.headers.update(headers)

def clean(s):
    return re.sub(r"\s+", "", str(s or "")).replace("–", "-").replace("—", "-")

def parse_row(soup, label, combo_pattern):
    for tr in soup.find_all("tr"):
        cells = [" ".join(td.stripped_strings) for td in tr.find_all(["th", "td"])]
        if len(cells) < 3 or clean(cells[0]) != label:
            continue
        cm = re.search(combo_pattern, clean(cells[1]))
        pm = re.search(r"([\d,]+)", cells[2].replace("¥", "").replace("￥", ""))
        if cm and pm:
            combo_value = "-".join(cm.groups()) if len(cm.groups()) > 1 else cm.group(1)
            return combo_value, int(pm.group(1).replace(",", ""))
    return None, None

cache = {}
missing = []
rows = []

for i, x in enumerate(locked, 1):
    date, race = x["date"], x["race"]
    existing = by_result.get(x["id"])
    if not existing:
        missing.append({"id": x["id"], "reason": "TRIFECTA_RESULT_MISSING"})
        continue
    outcome3 = str(existing.get("o", ""))
    payout_odds3 = existing.get("x")
    if not re.fullmatch(r"[1-6]-[1-6]-[1-6]", outcome3) or not isinstance(payout_odds3, (int, float)):
        missing.append({"id": x["id"], "reason": "TRIFECTA_RESULT_INVALID"})
        continue

    key = x["id"]
    if key not in cache:
        hd = date.replace("-", "")
        url = f"https://www.boatrace.jp/owpc/pc/race/raceresult?hd={hd}&jcd=07&rno={race}"
        last_err = None
        for attempt in range(3):
            try:
                res = session.get(url, timeout=20)
                res.raise_for_status()
                soup = BeautifulSoup(res.text, "html.parser")
                exacta, exacta_payout = parse_row(soup, "2連単", r"([1-6])-([1-6])")
                win, win_payout = parse_row(soup, "単勝", r"([1-6])")
                if exacta and exacta_payout is not None and win and win_payout is not None:
                    cache[key] = {
                        "officialSource": url,
                        "exacta": exacta,
                        "exactaPayout100": exacta_payout,
                        "win": win,
                        "winPayout100": win_payout,
                    }
                    last_err = None
                    break
                last_err = "PAYOUT_ROWS_NOT_FOUND"
            except Exception as e:
                last_err = str(e)
            time.sleep(1.0 + attempt)
        if key not in cache:
            missing.append({"id": key, "reason": last_err or "OFFICIAL_FETCH_FAILED"})
            continue
        time.sleep(0.15)

    p = cache[key]
    rows.append({
        **x,
        "trifecta": outcome3,
        "trifectaPayout100": round(float(payout_odds3) * 100),
        "exacta": p["exacta"],
        "exactaPayout100": p["exactaPayout100"],
        "win": p["win"],
        "winPayout100": p["winPayout100"],
        "officialSource": p["officialSource"],
    })
    if i % 25 == 0:
        print("FETCH_PROGRESS", i, "/", len(locked))

def bet_stats(rs, pick_key, outcome_key, payout_key):
    tickets = sum(len(x[pick_key]) for x in rs)
    hits = [x for x in rs if x[outcome_key] in x[pick_key]]
    stake = tickets * 100
    ret = sum(int(x[payout_key]) for x in hits)
    return {
        "races": len(rs),
        "tickets": tickets,
        "averagePicksPerRace": tickets / len(rs) if rs else 0,
        "hitRaces": len(hits),
        "hitRate": len(hits) / len(rs) if rs else 0,
        "stakeYen": stake,
        "returnYen": ret,
        "profitYen": ret - stake,
        "roi": ret / stake if stake else 0,
        "averageWinningPayout100": (sum(int(x[payout_key]) for x in hits) / len(hits)) if hits else 0,
    }

def split_report(name):
    rs = [x for x in rows if x["split"] == name]
    return {
        "win": bet_stats(rs, "winPicks", "win", "winPayout100"),
        "exacta": bet_stats(rs, "exactaPicks", "exacta", "exactaPayout100"),
        "trifecta": bet_stats(rs, "trifectaPicks", "trifecta", "trifectaPayout100"),
    }

report = {
    "schema": "boat-command-gamagori-bet-type-roi-v0342",
    "generatedAt": datetime.now(JST).isoformat(),
    "analysisOnly": True,
    "liveImported": False,
    "decision": "SHADOW_ONLY",
    "primaryGate": "race=7 & aClassCount=3",
    "gateRaceCountExpected": 199,
    "gateRaceCountUsable": len(rows),
    "missingCount": len(missing),
    "boundary": "Primary gate and frozen PRE-derived picks are fixed before official result/payout pages are read. Same 100-yen stake per unique bet is used for win, exacta and trifecta.",
    "method": {
        "win": "Unique first-place heads derived from the frozen trifecta picks.",
        "exacta": "Unique first-two ordered pairs derived from the frozen trifecta picks.",
        "trifecta": "Original frozen four trifecta picks.",
        "ticketStakeYen": 100,
        "selectionOrRankingChangedAfterPayoutRead": False,
    },
    "split": {
        "train": split_report("train"),
        "validation": split_report("validation"),
        "test": split_report("test"),
    },
    "overall": {
        "win": bet_stats(rows, "winPicks", "win", "winPayout100"),
        "exacta": bet_stats(rows, "exactaPicks", "exacta", "exactaPayout100"),
        "trifecta": bet_stats(rows, "trifectaPicks", "trifecta", "trifectaPayout100"),
    },
    "missing": missing,
    "promotionRule": "Do not promote or change LIVE staking from this historical audit. Fresh forward evidence remains required.",
}
OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps({
    "usable": len(rows),
    "missing": len(missing),
    "split": report["split"],
    "overall": report["overall"],
}, ensure_ascii=False, indent=2))
