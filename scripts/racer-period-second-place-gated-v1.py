#!/usr/bin/env python3
"""Three-way holdout for venue-gated second-place period features.

60% dates: choose profile.
20% dates: decide whether each venue is allowed to use the candidate.
20% dates: untouched final test.

The first-place prediction is frozen to the existing rich score. Only second
ranking can change. LIVE prediction/TRY/HARD LOCK/SHADOW/FORWARD are untouched.
"""
from __future__ import annotations
import importlib.util,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"scripts/racer-period-second-place-audit-v1.py"
spec=importlib.util.spec_from_file_location("second_place_base",BASE)
R=importlib.util.module_from_spec(spec);spec.loader.exec_module(R)
OUT=ROOT/"research/racer-period-second-place-gated-v1.json"

MIN_HEAD_CORRECT_VALIDATION=50
MIN_SECOND_DELTA=0.005
REQUIRE_TOP2_NONREGRESSION=True

def delta(a,b):
    return None if a is None or b is None else b-a

def rows_for_dates(rows,dates):
    s=set(dates);return [x for x in rows if x["d"] in s]

def choose_profile(cal):
    tested=[]
    for p in R.PROFILES:
        rec=R.eval_rows(cal,p);m=R.metrics(rec)
        tested.append({"profile":p,"metrics":m})
    tested.sort(key=lambda x:(
      x["metrics"]["secondAccuracyWhenHeadCorrect"] or 0,
      x["metrics"]["secondTop2CoverageWhenHeadCorrect"] or 0,
      x["metrics"]["pairAccuracy"] or 0
    ),reverse=True)
    return tested[0],tested

def gate(base_m,cand_m):
    sd=delta(base_m["secondAccuracyWhenHeadCorrect"],cand_m["secondAccuracyWhenHeadCorrect"])
    t2=delta(base_m["secondTop2CoverageWhenHeadCorrect"],cand_m["secondTop2CoverageWhenHeadCorrect"])
    enough=base_m["headCorrectRaces"]>=MIN_HEAD_CORRECT_VALIDATION
    pass_second=sd is not None and sd>=MIN_SECOND_DELTA
    pass_top2=(not REQUIRE_TOP2_NONREGRESSION) or (t2 is not None and t2>=0)
    return bool(enough and pass_second and pass_top2),{
      "enoughHeadCorrect":enough,"secondDelta":sd,"top2Delta":t2,
      "minHeadCorrect":MIN_HEAD_CORRECT_VALIDATION,"minSecondDelta":MIN_SECOND_DELTA,
      "requireTop2NonRegression":REQUIRE_TOP2_NONREGRESSION
    }

def venue(slug):
    db=R.load(ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json")
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({x["d"] for x in rows})
    n=len(dates);c1=max(1,int(n*.60));c2=max(c1+1,int(n*.80))
    cal=rows_for_dates(rows,dates[:c1])
    val=rows_for_dates(rows,dates[c1:c2])
    test=rows_for_dates(rows,dates[c2:])

    best,tested=choose_profile(cal)
    profile=best["profile"]

    vb=R.eval_rows(val,None);vc=R.eval_rows(val,profile)
    vbm=R.metrics(vb);vcm=R.metrics(vc)
    enabled,decision=gate(vbm,vcm)

    tb=R.eval_rows(test,None);tc=R.eval_rows(test,profile)
    chosen=tc if enabled else tb
    tbm=R.metrics(tb);tcm=R.metrics(tc);cm=R.metrics(chosen)

    return {
      "slug":slug,"venueCode":db.get("venueCode"),
      "split":{
        "calibrationDates":c1,"validationDates":c2-c1,"testDates":n-c2,
        "calibrationLastDate":dates[c1-1] if dates else None,
        "validationFirstDate":dates[c1] if n>c1 else None,
        "validationLastDate":dates[c2-1] if n>=c2 else None,
        "testFirstDate":dates[c2] if n>c2 else None,
      },
      "selectedProfile":profile,
      "calibrationTopProfiles":tested[:4],
      "validation":{
        "baseline":vbm,"candidate":vcm,
        "decision":decision,"candidateEnabled":enabled
      },
      "test":{
        "baseline":tbm,"rawCandidate":tcm,"gatedPolicy":cm,
        "secondAccuracyDeltaVsBaseline":delta(tbm["secondAccuracyWhenHeadCorrect"],cm["secondAccuracyWhenHeadCorrect"]),
        "secondTop2DeltaVsBaseline":delta(tbm["secondTop2CoverageWhenHeadCorrect"],cm["secondTop2CoverageWhenHeadCorrect"]),
        "pairAccuracyDeltaVsBaseline":delta(tbm["pairAccuracy"],cm["pairAccuracy"]),
      },
      "firstPredictionFrozen":True,"productionChanged":False,"promotionEligible":False,
    },tb,chosen

def agg(groups):
    return R.metrics([x for g in groups for x in g])

def main():
    venues=[];base_groups=[];chosen_groups=[]
    for slug in R.VENUES:
        v,b,c=venue(slug);venues.append(v);base_groups.append(b);chosen_groups.append(c)
        print(slug,json.dumps({
          "enabled":v["validation"]["candidateEnabled"],
          "validationSecondDelta":v["validation"]["decision"]["secondDelta"],
          "validationTop2Delta":v["validation"]["decision"]["top2Delta"],
          "testSecondDelta":v["test"]["secondAccuracyDeltaVsBaseline"],
          "testTop2Delta":v["test"]["secondTop2DeltaVsBaseline"],
          "profile":v["selectedProfile"]["name"],
        },ensure_ascii=False))
    bm=agg(base_groups);gm=agg(chosen_groups)
    enabled=[v["slug"] for v in venues if v["validation"]["candidateEnabled"]]
    summary={
      "venues":24,"enabledVenues":enabled,"enabledVenueCount":len(enabled),
      "testRaces":bm["races"],"baseline":bm,"gatedPolicy":gm,
      "headAccuracyDelta":delta(bm["headAccuracy"],gm["headAccuracy"]),
      "secondAccuracyDelta":delta(bm["secondAccuracyWhenHeadCorrect"],gm["secondAccuracyWhenHeadCorrect"]),
      "secondTop2CoverageDelta":delta(bm["secondTop2CoverageWhenHeadCorrect"],gm["secondTop2CoverageWhenHeadCorrect"]),
      "pairAccuracyDelta":delta(bm["pairAccuracy"],gm["pairAccuracy"]),
      "enabledVenuesTestSecondImproved":sum(1 for v in venues if v["validation"]["candidateEnabled"] and (v["test"]["secondAccuracyDeltaVsBaseline"] or 0)>0),
      "enabledVenuesTestSecondRegressed":sum(1 for v in venues if v["validation"]["candidateEnabled"] and (v["test"]["secondAccuracyDeltaVsBaseline"] or 0)<0),
    }
    out={
      "schema":"boat-command-racer-period-second-place-gated-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "question":"Can venue-specific validation gating turn recovered racer-period features into a robust second-place improvement?",
      "selectionPolicy":"60% calibration profile selection -> 20% validation gate -> untouched final 20% test",
      "gatePolicy":{
        "minValidationHeadCorrectRaces":MIN_HEAD_CORRECT_VALIDATION,
        "minValidationSecondAccuracyDelta":MIN_SECOND_DELTA,
        "requireValidationTop2NonRegression":REQUIRE_TOP2_NONREGRESSION
      },
      "featureBoundary":{
        "firstPredictionFrozen":True,
        "featuresAddedToSecondOnly":["periodAvgST","periodFCountDerived","periodLCountDerived","currentAbility","period3RateDerived"],
        "courseSpecificStatsUsed":False,
        "joinPolicy":"RACE_DATE_HALF_YEAR + REGISTRATION + CLASS_MATCH",
        "resultsUsedForFeatureConstruction":False,
        "resultsUsedForEvaluationOnly":True
      },
      "summary":summary,"venuesData":venues
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RACER_PERIOD_SECOND_PLACE_GATED",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__":main()
