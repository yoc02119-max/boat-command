#!/usr/bin/env python3
"""Venue-gated second-place SHADOW audit.

Uses the already-audited racer-period second-place experiment as a library.
The gate is decided only on each venue's first 70% calibration dates, then
frozen and evaluated on the untouched last 30%.

Goal: avoid the aggregate regression seen when period features are forced on
all 24 venues. First-place prediction remains frozen to the baseline.
"""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/"scripts/racer-period-second-place-audit-v1.py"
OUT=ROOT/"research/second-place-venue-gate-v1.json"

spec=importlib.util.spec_from_file_location("second_audit",SRC)
M=importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)

MIN_HEAD_CORRECT_CAL=100
MIN_SECOND_UPLIFT=0.015
MAX_TOP2_REGRESSION=0.0

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def split_rows(slug):
    db=load(ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json")
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({x["d"] for x in rows})
    cut=max(1,int(len(dates)*.70))
    cald=set(dates[:cut]);holdd=set(dates[cut:])
    return db,[x for x in rows if x["d"] in cald],[x for x in rows if x["d"] in holdd],dates,cut

def gate_decision(base, cand):
    if base["headCorrectRaces"] < MIN_HEAD_CORRECT_CAL:
        return False,"CAL_HEAD_SAMPLE_LT_100"
    d1=(cand["secondAccuracyWhenHeadCorrect"] or 0)-(base["secondAccuracyWhenHeadCorrect"] or 0)
    d2=(cand["secondTop2CoverageWhenHeadCorrect"] or 0)-(base["secondTop2CoverageWhenHeadCorrect"] or 0)
    if d1 < MIN_SECOND_UPLIFT:
        return False,"SECOND_UPLIFT_LT_1_5PT"
    if d2 < -MAX_TOP2_REGRESSION:
        return False,"TOP2_REGRESSION"
    return True,"CALIBRATION_GATE_PASS"

def apply_gate(base_rows,cand_rows,enabled):
    cmap={x["id"]:x for x in cand_rows}
    out=[]
    for b in base_rows:
        c=cmap.get(b["id"])
        if not c:
            out.append(b);continue
        x=dict(b)
        if enabled:
            x["secondRank"]=list(c["secondRank"])
            x["safeSecondCandidates"]=c.get("safeSecondCandidates",0)
            x["joinMiss"]=dict(c.get("joinMiss",{}))
        out.append(x)
    return out

def merge(groups):
    return M.metrics([x for g in groups for x in g])

def main():
    venues=[];base_groups=[];gated_groups=[]
    for slug in M.VENUES:
        db,cal,hold,dates,cut=split_rows(slug)
        best,tested=M.choose(cal)
        base_cal=M.metrics(M.eval_rows(cal,None))
        cand_cal=M.metrics(M.eval_rows(cal,best["profile"]))
        enabled,reason=gate_decision(base_cal,cand_cal)

        base_hold=M.eval_rows(hold,None)
        cand_hold=M.eval_rows(hold,best["profile"])
        gated_hold=apply_gate(base_hold,cand_hold,enabled)
        bm=M.metrics(base_hold);gm=M.metrics(gated_hold)
        base_groups.append(base_hold);gated_groups.append(gated_hold)

        venues.append({
          "slug":slug,"venueCode":db.get("venueCode"),
          "selectedProfile":best["profile"],
          "gate":{
            "enabled":enabled,"reason":reason,
            "fixedPolicy":{
              "minCalibrationHeadCorrect":MIN_HEAD_CORRECT_CAL,
              "minSecondAccuracyUplift":MIN_SECOND_UPLIFT,
              "maxTop2Regression":MAX_TOP2_REGRESSION,
            },
            "calibrationBaseline":base_cal,
            "calibrationCandidate":cand_cal,
            "calibrationSecondAccuracyDelta":cand_cal["secondAccuracyWhenHeadCorrect"]-base_cal["secondAccuracyWhenHeadCorrect"],
            "calibrationTop2Delta":cand_cal["secondTop2CoverageWhenHeadCorrect"]-base_cal["secondTop2CoverageWhenHeadCorrect"],
          },
          "holdout":{
            "baseline":bm,"gated":gm,
            "headAccuracyDelta":gm["headAccuracy"]-bm["headAccuracy"],
            "secondAccuracyDelta":gm["secondAccuracyWhenHeadCorrect"]-bm["secondAccuracyWhenHeadCorrect"],
            "secondTop2CoverageDelta":gm["secondTop2CoverageWhenHeadCorrect"]-bm["secondTop2CoverageWhenHeadCorrect"],
            "pairAccuracyDelta":gm["pairAccuracy"]-bm["pairAccuracy"],
          },
          "calibrationLastDate":dates[cut-1] if dates else None,
          "holdoutFirstDate":dates[cut] if len(dates)>cut else None,
        })
        print(slug,json.dumps({
          "gate":enabled,"reason":reason,
          "calSecondDelta":venues[-1]["gate"]["calibrationSecondAccuracyDelta"],
          "calTop2Delta":venues[-1]["gate"]["calibrationTop2Delta"],
          "holdSecondDelta":venues[-1]["holdout"]["secondAccuracyDelta"],
          "holdTop2Delta":venues[-1]["holdout"]["secondTop2CoverageDelta"],
          "profile":best["profile"]["name"],
        },ensure_ascii=False))

    base=merge(base_groups);gated=merge(gated_groups)
    enabled=[v for v in venues if v["gate"]["enabled"]]
    summary={
      "venues":24,"enabledVenues":len(enabled),
      "enabledVenueSlugs":[v["slug"] for v in enabled],
      "holdoutRaces":base["races"],
      "baseline":base,"gated":gated,
      "headAccuracyDelta":gated["headAccuracy"]-base["headAccuracy"],
      "secondAccuracyDelta":gated["secondAccuracyWhenHeadCorrect"]-base["secondAccuracyWhenHeadCorrect"],
      "secondTop2CoverageDelta":gated["secondTop2CoverageWhenHeadCorrect"]-base["secondTop2CoverageWhenHeadCorrect"],
      "pairAccuracyDelta":gated["pairAccuracy"]-base["pairAccuracy"],
      "enabledVenuesHoldoutSecondImproved":sum(1 for v in enabled if v["holdout"]["secondAccuracyDelta"]>0),
      "enabledVenuesHoldoutSecondRegressed":sum(1 for v in enabled if v["holdout"]["secondAccuracyDelta"]<0),
    }
    out={
      "schema":"boat-command-second-place-venue-gate-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "question":"Can a calibration-only venue gate prevent the all-venue second-place regression?",
      "gateSelectionUsesHoldout":False,
      "firstPredictionFrozen":True,
      "policy":{
        "minCalibrationHeadCorrect":MIN_HEAD_CORRECT_CAL,
        "minSecondAccuracyUplift":MIN_SECOND_UPLIFT,
        "maxTop2Regression":MAX_TOP2_REGRESSION,
      },
      "summary":summary,"venuesData":venues,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("SECOND_PLACE_VENUE_GATE",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__": main()
