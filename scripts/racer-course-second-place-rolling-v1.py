#!/usr/bin/env python3
"""Rolling-origin robustness test for course-specific second-place features.

Four disjoint final test windows cover the latter half of each venue history.
Each fold re-selects its profile from earlier dates and re-applies the same
validation gate before touching that fold's test window.

No production model or ticket writer is changed.
"""
from __future__ import annotations
import importlib.util,json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"scripts/racer-course-second-place-gated-v1.py"
spec=importlib.util.spec_from_file_location("course_gated",BASE)
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
R=C.R
OUT=ROOT/"research/racer-course-second-place-rolling-v1.json"

# train_end, validation_end, test_end as fractions of ordered dates.
FOLDS=[
  ("F1",0.30,0.50,0.60),
  ("F2",0.40,0.60,0.70),
  ("F3",0.50,0.70,0.80),
  ("F4",0.60,0.80,1.00),
]

def dlt(a,b):
    return None if a is None or b is None else b-a

def rows_for_dates(rows,dates):
    s=set(dates);return [x for x in rows if x["d"] in s]

def choose_profile(cal):
    tested=[]
    for p in C.PROFILES:
        rec=C.eval_rows(cal,p);m=C.metrics(rec)
        tested.append({"profile":p,"metrics":m})
    tested.sort(key=lambda x:(
      x["metrics"]["secondAccuracyWhenHeadCorrect"] or 0,
      x["metrics"]["secondTop2CoverageWhenHeadCorrect"] or 0,
      x["metrics"]["pairAccuracy"] or 0
    ),reverse=True)
    return tested[0],tested

def fold_venue(slug,fold):
    name,train_f,val_f,test_f=fold
    db=R.load(ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json")
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({x["d"] for x in rows});n=len(dates)
    a=max(1,int(n*train_f));b=max(a+1,int(n*val_f));c=max(b+1,min(n,int(n*test_f)))
    cal=rows_for_dates(rows,dates[:a])
    val=rows_for_dates(rows,dates[a:b])
    test=rows_for_dates(rows,dates[b:c])

    best,tested=choose_profile(cal);profile=best["profile"]

    vb=C.eval_rows(val,None);vc=C.eval_rows(val,profile)
    vbm=C.metrics(vb);vcm=C.metrics(vc)
    enabled,decision=C.gate(vbm,vcm)

    tb=C.eval_rows(test,None);tc=C.eval_rows(test,profile)
    chosen=tc if enabled else tb
    tbm=C.metrics(tb);tcm=C.metrics(tc);cm=C.metrics(chosen)

    return {
      "slug":slug,"venueCode":db.get("venueCode"),"fold":name,
      "split":{
        "trainDates":a,"validationDates":b-a,"testDates":c-b,
        "trainLastDate":dates[a-1],
        "validationFirstDate":dates[a],"validationLastDate":dates[b-1],
        "testFirstDate":dates[b],"testLastDate":dates[c-1],
      },
      "selectedProfile":profile,
      "validation":{"baseline":vbm,"candidate":vcm,"candidateEnabled":enabled,"decision":decision},
      "test":{
        "baseline":tbm,"rawCandidate":tcm,"gatedPolicy":cm,
        "secondAccuracyDeltaVsBaseline":dlt(tbm["secondAccuracyWhenHeadCorrect"],cm["secondAccuracyWhenHeadCorrect"]),
        "secondTop2DeltaVsBaseline":dlt(tbm["secondTop2CoverageWhenHeadCorrect"],cm["secondTop2CoverageWhenHeadCorrect"]),
        "pairAccuracyDeltaVsBaseline":dlt(tbm["pairAccuracy"],cm["pairAccuracy"]),
      },
      "firstPredictionFrozen":True,"productionChanged":False,"promotionEligible":False,
    },tb,chosen

def agg(groups):
    return C.metrics([x for g in groups for x in g])

def main():
    fold_reports=[];all_base=[];all_chosen=[]
    for fold in FOLDS:
        name=fold[0];vr=[];bg=[];cg=[]
        for slug in R.VENUES:
            v,b,c=fold_venue(slug,fold);vr.append(v);bg.append(b);cg.append(c)
        bm=agg(bg);gm=agg(cg)
        enabled=[v["slug"] for v in vr if v["validation"]["candidateEnabled"]]
        summary={
          "fold":name,"enabledVenues":enabled,"enabledVenueCount":len(enabled),
          "testRaces":bm["races"],"baseline":bm,"gatedPolicy":gm,
          "headAccuracyDelta":dlt(bm["headAccuracy"],gm["headAccuracy"]),
          "secondAccuracyDelta":dlt(bm["secondAccuracyWhenHeadCorrect"],gm["secondAccuracyWhenHeadCorrect"]),
          "secondTop2CoverageDelta":dlt(bm["secondTop2CoverageWhenHeadCorrect"],gm["secondTop2CoverageWhenHeadCorrect"]),
          "pairAccuracyDelta":dlt(bm["pairAccuracy"],gm["pairAccuracy"]),
          "enabledVenuesTestSecondImproved":sum(1 for v in vr if v["validation"]["candidateEnabled"] and (v["test"]["secondAccuracyDeltaVsBaseline"] or 0)>0),
          "enabledVenuesTestSecondRegressed":sum(1 for v in vr if v["validation"]["candidateEnabled"] and (v["test"]["secondAccuracyDeltaVsBaseline"] or 0)<0),
        }
        print(name,json.dumps(summary,ensure_ascii=False))
        fold_reports.append({"summary":summary,"venues":vr})
        all_base.extend(bg);all_chosen.extend(cg)

    bm=agg(all_base);gm=agg(all_chosen)
    positive_second=sum(1 for f in fold_reports if (f["summary"]["secondAccuracyDelta"] or 0)>0)
    positive_top2=sum(1 for f in fold_reports if (f["summary"]["secondTop2CoverageDelta"] or 0)>0)
    summary={
      "folds":len(FOLDS),"testRaces":bm["races"],
      "baseline":bm,"gatedPolicy":gm,
      "headAccuracyDelta":dlt(bm["headAccuracy"],gm["headAccuracy"]),
      "secondAccuracyDelta":dlt(bm["secondAccuracyWhenHeadCorrect"],gm["secondAccuracyWhenHeadCorrect"]),
      "secondTop2CoverageDelta":dlt(bm["secondTop2CoverageWhenHeadCorrect"],gm["secondTop2CoverageWhenHeadCorrect"]),
      "pairAccuracyDelta":dlt(bm["pairAccuracy"],gm["pairAccuracy"]),
      "positiveSecondAccuracyFolds":positive_second,
      "positiveSecondTop2Folds":positive_top2,
      "allSecondAccuracyFoldsPositive":positive_second==len(FOLDS),
      "allSecondTop2FoldsPositive":positive_top2==len(FOLDS),
    }
    out={
      "schema":"boat-command-racer-course-second-place-rolling-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "selectionPolicy":"Each fold selects profile on earlier train dates, gates on subsequent validation dates, then evaluates once on a disjoint later test block.",
      "foldsDefinition":[{"name":n,"trainEnd":a,"validationEnd":b,"testEnd":c} for n,a,b,c in FOLDS],
      "gatePolicy":{
        "minValidationHeadCorrectRaces":C.MIN_HEAD_CORRECT_VALIDATION,
        "minValidationSecondAccuracyDelta":C.MIN_SECOND_DELTA,
        "requireValidationTop2NonRegression":C.REQUIRE_TOP2_NONREGRESSION
      },
      "featureBoundary":{
        "firstPredictionFrozen":True,
        "joinPolicy":"RACE_DATE_HALF_YEAR + REGISTRATION + CLASS_MATCH + CURRENT_LANE_COURSE",
        "resultsUsedForFeatureConstruction":False,
        "resultsUsedForEvaluationOnly":True
      },
      "summary":summary,"foldReports":fold_reports
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RACER_COURSE_SECOND_PLACE_ROLLING",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__":main()
