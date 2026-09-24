#!/usr/bin/env python3
"""Evaluate immutable course-second forward SHADOW predictions after results exist.

Reads:
- live/*/*/shadow/course-second-v1/race-*.json
- matching verified post result

Writes only:
- research/course-second-forward-evaluation-v1.json

Prediction snapshots are never modified.
"""
from __future__ import annotations
import argparse, json, re
from collections import defaultdict
from pathlib import Path
import datetime as dt

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/course-second-forward-evaluation-v1.json"

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def valid_order(v):
    return re.fullmatch(r"[1-6]-[1-6]-[1-6]",str(v or "")) is not None and len(set(str(v).split("-")))==3

def valid_snapshot(x):
    if x.get("schema")!="boat-command-course-second-forward-v1":return False
    if x.get("resultInput") is not False or x.get("payoutInput") is not False or x.get("postRaceRead") is not False:return False
    if x.get("researchOnly") is not True or x.get("shadowOnly") is not True:return False
    if x.get("productionEnabled") is not False or x.get("tryEnabled") is not False or x.get("hardLockEnabled") is not False:return False
    if x.get("immutableAfterFirstWrite") is not True:return False
    if x.get("laneAsCourseProxy") is not True or x.get("actualEntryCourseUsed") is not False:return False
    b=x.get("baseline") or {};c=x.get("candidate") or {}
    if not (1<=int(b.get("headLane") or 0)<=6 and int(b.get("headLane"))==int(c.get("headLane") or 0)):return False
    for q in (b,c):
        r=q.get("secondRanking") or []
        if len(r)!=5 or len(set(r))!=5 or int(q["headLane"]) in r:return False
        if any(not 1<=int(v)<=6 for v in r):return False
    try:
        gen=dt.datetime.fromisoformat(str(x["generatedAt"]).replace("Z","+00:00"))
        cut=dt.datetime.fromisoformat(str(x["freezeCutoff"]).replace("Z","+00:00"))
        if gen>cut:return False
    except Exception:return False
    return True

def valid_result(x,snap):
    if x.get("schema")!="boat-command-live-result-v1":return False
    if x.get("preRaceDataIncluded") is not False or x.get("resultEndpointsIncluded") is not True:return False
    if x.get("evaluationEligible") is False:return False
    if x.get("date")!=snap.get("date") or x.get("slug")!=snap.get("slug"):return False
    if str(x.get("venueCode"))!=str(snap.get("venueCode")) or int(x.get("race") or 0)!=int(snap.get("race") or 0):return False
    return valid_order(x.get("trifecta"))

def row_from(s,r):
    actual=[int(v) for v in r["trifecta"].split("-")]
    head=int(s["baseline"]["headLane"])
    b=[int(v) for v in s["baseline"]["secondRanking"]]
    c=[int(v) for v in s["candidate"]["secondRanking"]]
    hc=head==actual[0]
    return {
      "slug":s["slug"],"venueCode":s["venueCode"],"date":s["date"],"race":int(s["race"]),
      "generatedAt":s["generatedAt"],"deadline":s["deadline"],
      "actual":r["trifecta"],"headLane":head,"headCorrect":hc,
      "baselineSecondTop1":b[0],"candidateSecondTop1":c[0],
      "baselineSecondTop2":b[:2],"candidateSecondTop2":c[:2],
      "baselineTop1Hit":hc and b[0]==actual[1],
      "candidateTop1Hit":hc and c[0]==actual[1],
      "baselineTop2Hit":hc and actual[1] in b[:2],
      "candidateTop2Hit":hc and actual[1] in c[:2],
      "profile":s.get("selectedProfile",{}).get("name"),
      "safeJoinedSecondCandidates":s.get("safeJoinedSecondCandidates"),
    }

def metrics(rows):
    n=len(rows);hc=[x for x in rows if x["headCorrect"]]
    b1=sum(x["baselineTop1Hit"] for x in hc);c1=sum(x["candidateTop1Hit"] for x in hc)
    b2=sum(x["baselineTop2Hit"] for x in hc);c2=sum(x["candidateTop2Hit"] for x in hc)
    return {
      "evaluatedRaces":n,"headCorrectRaces":len(hc),
      "headAccuracy":len(hc)/n if n else None,
      "baselineSecondTop1Hits":b1,
      "candidateSecondTop1Hits":c1,
      "baselineSecondTop1Accuracy":b1/len(hc) if hc else None,
      "candidateSecondTop1Accuracy":c1/len(hc) if hc else None,
      "secondTop1Delta":(c1-b1)/len(hc) if hc else None,
      "baselineSecondTop2Hits":b2,
      "candidateSecondTop2Hits":c2,
      "baselineSecondTop2Coverage":b2/len(hc) if hc else None,
      "candidateSecondTop2Coverage":c2/len(hc) if hc else None,
      "secondTop2Delta":(c2-b2)/len(hc) if hc else None,
      "candidateMinusBaselineTop1Hits":c1-b1,
      "candidateMinusBaselineTop2Hits":c2-b2,
    }

def evaluate():
    rows=[];invalid=[];pending=0
    for sp in sorted(ROOT.glob("live/*/*/shadow/course-second-v1/race-*.json")):
        try:s=load(sp)
        except Exception:
            invalid.append({"path":str(sp.relative_to(ROOT)),"reason":"SNAPSHOT_JSON"});continue
        if not valid_snapshot(s):
            invalid.append({"path":str(sp.relative_to(ROOT)),"reason":"SNAPSHOT_BOUNDARY"});continue
        rp=ROOT/"live"/s["slug"]/s["date"]/"post"/f"race-{int(s['race'])}-result.json"
        if not rp.exists():
            pending+=1;continue
        try:r=load(rp)
        except Exception:
            invalid.append({"path":str(rp.relative_to(ROOT)),"reason":"RESULT_JSON"});continue
        if not valid_result(r,s):
            invalid.append({"path":str(rp.relative_to(ROOT)),"reason":"RESULT_BOUNDARY"});continue
        rows.append(row_from(s,r))

    by=defaultdict(list)
    for x in rows:by[x["slug"]].append(x)
    venues=[]
    for slug in sorted(by):
        m=metrics(by[slug])
        venues.append({"slug":slug,**m,"forwardReviewReady":m["headCorrectRaces"]>=36,"targetReviewReady":m["headCorrectRaces"]>=60})

    total=metrics(rows)
    total.update({
      "venuesEvaluated":len(venues),
      "pendingSnapshots":pending,
      "invalidArtifacts":len(invalid),
      "forwardReviewReady":total["headCorrectRaces"]>=200,
    })
    out={
      "schema":"boat-command-course-second-forward-evaluation-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "comparison":"IMMUTABLE_FORWARD_SNAPSHOTS_ONLY",
      "featureBoundary":{
        "laneAsCourseProxy":True,"actualEntryCourseUsed":False,
        "resultsUsedOnlyAfterSnapshot":True,
        "payoutUsed":False,
      },
      "summary":total,"venuesData":venues,
      "invalid":invalid[:100],
      "evaluatedRows":rows,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("COURSE_SECOND_FORWARD_EVALUATION",json.dumps(total,ensure_ascii=False))
    return out

def self_test():
    snap={
      "schema":"boat-command-course-second-forward-v1","resultInput":False,"payoutInput":False,"postRaceRead":False,
      "researchOnly":True,"shadowOnly":True,"productionEnabled":False,"tryEnabled":False,"hardLockEnabled":False,
      "immutableAfterFirstWrite":True,"laneAsCourseProxy":True,"actualEntryCourseUsed":False,
      "generatedAt":"2026-09-25T09:50:00+09:00","freezeCutoff":"2026-09-25T09:57:00+09:00",
      "date":"2026-09-25","slug":"kiryu","venueCode":"01","race":1,
      "baseline":{"headLane":1,"secondRanking":[2,3,4,5,6]},
      "candidate":{"headLane":1,"secondRanking":[3,2,4,5,6]},
      "selectedProfile":{"name":"TEST"},"safeJoinedSecondCandidates":5,"deadline":"10:00",
    }
    res={"schema":"boat-command-live-result-v1","preRaceDataIncluded":False,"resultEndpointsIncluded":True,
         "evaluationEligible":True,"date":"2026-09-25","slug":"kiryu","venueCode":"01","race":1,"trifecta":"1-3-2"}
    assert valid_snapshot(snap) and valid_result(res,snap)
    x=row_from(snap,res)
    assert x["candidateTop1Hit"] is True and x["baselineTop1Hit"] is False
    m=metrics([x]);assert m["secondTop1Delta"]==1
    print("COURSE_SECOND_FORWARD_EVAL_SELF_TEST_PASS")

def main():
    ap=argparse.ArgumentParser();ap.add_argument("--self-test",action="store_true");args=ap.parse_args()
    if args.self_test:self_test()
    else:evaluate()

if __name__=="__main__":main()
