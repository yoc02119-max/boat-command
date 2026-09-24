#!/usr/bin/env python3
"""Three-way holdout for course-specific racer-period features on second place.

First-place prediction remains frozen to the existing rich score.
Only second-place candidate ranking can use course-specific PRE-RACE-safe
racer-period data from the official half-year archives.

60% dates: choose profile
20% dates: venue gate
20% dates: untouched final test

No production model, TRY, HARD LOCK, SHADOW, FORWARD or bankroll mutation.
"""
from __future__ import annotations
import importlib.util,json,math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"scripts/racer-period-second-place-audit-v1.py"
spec=importlib.util.spec_from_file_location("second_place_base",BASE)
R=importlib.util.module_from_spec(spec);spec.loader.exec_module(R)
OUT=ROOT/"research/racer-course-second-place-gated-v1.json"

MIN_HEAD_CORRECT_VALIDATION=50
MIN_SECOND_DELTA=0.005
REQUIRE_TOP2_NONREGRESSION=True

PROFILES=[
 {"name":"COURSE_ST","cStW":4.0,"c2W":0.0,"cStartRankW":0.0,"c3W":0.0,"cFW":0.00,"overallStW":0.0,"abilityW":0.0},
 {"name":"COURSE_2RATE","cStW":0.0,"c2W":1.2,"cStartRankW":0.0,"c3W":0.0,"cFW":0.00,"overallStW":0.0,"abilityW":0.0},
 {"name":"COURSE_ST_2RATE","cStW":4.0,"c2W":1.0,"cStartRankW":0.0,"c3W":0.0,"cFW":0.00,"overallStW":0.0,"abilityW":0.0},
 {"name":"COURSE_START","cStW":3.0,"c2W":0.8,"cStartRankW":0.18,"c3W":0.0,"cFW":0.00,"overallStW":0.0,"abilityW":0.0},
 {"name":"COURSE_BALANCED","cStW":4.5,"c2W":1.0,"cStartRankW":0.20,"c3W":0.55,"cFW":0.04,"overallStW":0.0,"abilityW":0.0},
 {"name":"COURSE_PLUS_PERIOD","cStW":4.0,"c2W":0.9,"cStartRankW":0.18,"c3W":0.45,"cFW":0.04,"overallStW":1.5,"abilityW":0.02},
 {"name":"COURSE_STRONG","cStW":6.0,"c2W":1.4,"cStartRankW":0.28,"c3W":0.75,"cFW":0.06,"overallStW":2.0,"abilityW":0.03},
]

def finite(v):
    try:
        x=float(v);return x if math.isfinite(x) else None
    except Exception:return None

def delta(a,b):
    return None if a is None or b is None else b-a

def course3rate(c):
    fs=c.get("finishCounts")
    if not isinstance(fs,list) or len(fs)!=6:return None
    vals=[finite(x) for x in fs]
    if any(x is None for x in vals):return None
    den=sum(vals)
    return (vals[0]+vals[1]+vals[2])/den if den>0 else None

def candidate_score(date_s,b,profile):
    s=R.base_score(b)
    if s is None:return None,False,None
    rec,status=R.safe_rec(date_s,b)
    if not rec:return s,False,status

    lane=int(b.get("lane") or 0)
    courses=rec.get("courses") or []
    c=next((x for x in courses if int(x.get("course") or 0)==lane),None)
    if not c:return s,False,"COURSE_MISSING"

    entries=finite(c.get("entries")) or 0
    reliability=max(0.0,min(1.0,entries/30.0))

    cst=finite(c.get("avgST"))
    c2=finite(c.get("twoRate"))
    rank=finite(c.get("avgStartRank"))
    c3=course3rate(c)
    cf=finite(c.get("fCount"))
    overall_st=finite(rec.get("periodAvgST"))
    ability=finite(rec.get("currentAbility"))

    if cst is not None:s+=reliability*profile["cStW"]*(.18-cst)
    if c2 is not None:s+=reliability*profile["c2W"]*(c2-.30)
    if rank is not None:s+=reliability*profile["cStartRankW"]*(3.5-rank)
    if c3 is not None:s+=reliability*profile["c3W"]*(c3-.45)
    if cf is not None:s-=reliability*profile["cFW"]*cf
    if overall_st is not None:s+=profile["overallStW"]*(.18-overall_st)
    if ability is not None:s+=profile["abilityW"]*((ability-50)/10)
    return s,True,status

def predict(row,profile=None):
    boats=sorted(row.get("boats",[]),key=lambda x:int(x.get("lane") or 0))
    if len(boats)!=6 or not R.valid_order(row.get("o")):return None

    base=[R.base_score(b) for b in boats]
    if any(x is None for x in base):return None
    first=max(range(6),key=lambda i:(base[i],-i))

    ranked=[];safe=0;miss={}
    for i,b in enumerate(boats):
        if i==first:continue
        if profile is None:
            s=base[i];ok=False;status=None
        else:
            s,ok,status=candidate_score(row["d"],b,profile)
        ranked.append((s,-i,i))
        if ok:safe+=1
        elif status:miss[status]=miss.get(status,0)+1
    ranked.sort(reverse=True)
    second_rank=[i for _,__,i in ranked]
    actual=[int(x)-1 for x in str(row["o"]).split("-")]
    return {
      "id":row["id"],"d":row["d"],"r":row["r"],
      "predFirst":first,"actualFirst":actual[0],"actualSecond":actual[1],
      "secondRank":second_rank,"safeSecondCandidates":safe,"joinMiss":miss,
    }

def metrics(rows):
    return R.metrics(rows)

def eval_rows(rows,profile=None):
    out=[]
    for r in rows:
        x=predict(r,profile)
        if x:out.append(x)
    return out

def rows_for_dates(rows,dates):
    s=set(dates);return [x for x in rows if x["d"] in s]

def choose_profile(cal):
    tested=[]
    for p in PROFILES:
        rec=eval_rows(cal,p);m=metrics(rec)
        tested.append({"profile":p,"metrics":m})
    tested.sort(key=lambda x:(
      x["metrics"]["secondAccuracyWhenHeadCorrect"] or 0,
      x["metrics"]["secondTop2CoverageWhenHeadCorrect"] or 0,
      x["metrics"]["pairAccuracy"] or 0
    ),reverse=True)
    return tested[0],tested

def gate(bm,cm):
    sd=delta(bm["secondAccuracyWhenHeadCorrect"],cm["secondAccuracyWhenHeadCorrect"])
    t2=delta(bm["secondTop2CoverageWhenHeadCorrect"],cm["secondTop2CoverageWhenHeadCorrect"])
    enough=bm["headCorrectRaces"]>=MIN_HEAD_CORRECT_VALIDATION
    enabled=bool(
      enough and sd is not None and sd>=MIN_SECOND_DELTA
      and ((not REQUIRE_TOP2_NONREGRESSION) or (t2 is not None and t2>=0))
    )
    return enabled,{
      "enoughHeadCorrect":enough,"secondDelta":sd,"top2Delta":t2,
      "minHeadCorrect":MIN_HEAD_CORRECT_VALIDATION,"minSecondDelta":MIN_SECOND_DELTA,
      "requireTop2NonRegression":REQUIRE_TOP2_NONREGRESSION
    }

def venue(slug):
    db=R.load(ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json")
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({x["d"] for x in rows});n=len(dates)
    c1=max(1,int(n*.60));c2=max(c1+1,int(n*.80))
    cal=rows_for_dates(rows,dates[:c1])
    val=rows_for_dates(rows,dates[c1:c2])
    test=rows_for_dates(rows,dates[c2:])

    best,tested=choose_profile(cal);profile=best["profile"]

    vb=eval_rows(val,None);vc=eval_rows(val,profile)
    vbm=metrics(vb);vcm=metrics(vc)
    enabled,decision=gate(vbm,vcm)

    tb=eval_rows(test,None);tc=eval_rows(test,profile)
    chosen=tc if enabled else tb
    tbm=metrics(tb);tcm=metrics(tc);cm=metrics(chosen)

    safe=sum(x["safeSecondCandidates"] for x in tc)
    den=sum(len(x["secondRank"]) for x in tc)
    misses={}
    for x in tc:
        for k,v in x["joinMiss"].items():misses[k]=misses.get(k,0)+v

    return {
      "slug":slug,"venueCode":db.get("venueCode"),
      "split":{
        "calibrationDates":c1,"validationDates":c2-c1,"testDates":n-c2,
        "calibrationLastDate":dates[c1-1] if dates else None,
        "validationFirstDate":dates[c1] if n>c1 else None,
        "validationLastDate":dates[c2-1] if n>=c2 else None,
        "testFirstDate":dates[c2] if n>c2 else None,
      },
      "selectedProfile":profile,"calibrationTopProfiles":tested[:4],
      "validation":{"baseline":vbm,"candidate":vcm,"candidateEnabled":enabled,"decision":decision},
      "test":{
        "baseline":tbm,"rawCandidate":tcm,"gatedPolicy":cm,
        "secondAccuracyDeltaVsBaseline":delta(tbm["secondAccuracyWhenHeadCorrect"],cm["secondAccuracyWhenHeadCorrect"]),
        "secondTop2DeltaVsBaseline":delta(tbm["secondTop2CoverageWhenHeadCorrect"],cm["secondTop2CoverageWhenHeadCorrect"]),
        "pairAccuracyDeltaVsBaseline":delta(tbm["pairAccuracy"],cm["pairAccuracy"]),
        "rawCandidateSafeCourseJoinCoverage":safe/den if den else None,
        "rawCandidateJoinMiss":misses,
      },
      "firstPredictionFrozen":True,"productionChanged":False,"promotionEligible":False,
    },tb,chosen

def agg(groups):
    return metrics([x for g in groups for x in g])

def main():
    venues=[];base_groups=[];chosen_groups=[]
    for slug in R.VENUES:
        v,b,c=venue(slug);venues.append(v);base_groups.append(b);chosen_groups.append(c)
        print(slug,json.dumps({
          "enabled":v["validation"]["candidateEnabled"],
          "validationSecondDelta":v["validation"]["decision"]["secondDelta"],
          "testSecondDelta":v["test"]["secondAccuracyDeltaVsBaseline"],
          "testTop2Delta":v["test"]["secondTop2DeltaVsBaseline"],
          "safeCourseJoin":v["test"]["rawCandidateSafeCourseJoinCoverage"],
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
      "schema":"boat-command-racer-course-second-place-gated-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "question":"Do PRE-RACE-safe course-specific half-year racer features robustly improve second-place ranking?",
      "selectionPolicy":"60% calibration profile -> 20% validation venue gate -> untouched final 20% test",
      "gatePolicy":{
        "minValidationHeadCorrectRaces":MIN_HEAD_CORRECT_VALIDATION,
        "minValidationSecondAccuracyDelta":MIN_SECOND_DELTA,
        "requireValidationTop2NonRegression":REQUIRE_TOP2_NONREGRESSION
      },
      "featureBoundary":{
        "firstPredictionFrozen":True,
        "featuresAddedToSecondOnly":[
          "courseAvgST","course2Rate","courseAvgStartRank","course3RateDerived",
          "courseFCount","periodAvgST","currentAbility"
        ],
        "courseReliabilityShrinkage":"min(1, courseEntries/30)",
        "joinPolicy":"RACE_DATE_HALF_YEAR + REGISTRATION + CLASS_MATCH + CURRENT_LANE_COURSE",
        "resultsUsedForFeatureConstruction":False,
        "resultsUsedForEvaluationOnly":True
      },
      "summary":summary,"venuesData":venues
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RACER_COURSE_SECOND_PLACE_GATED",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__":main()
