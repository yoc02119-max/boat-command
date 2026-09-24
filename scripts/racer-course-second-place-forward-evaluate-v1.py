#!/usr/bin/env python3
"""Evaluate immutable course-second-place forward SHADOW after verified results."""
from __future__ import annotations
import glob,json
from collections import defaultdict
from pathlib import Path
from datetime import datetime,timedelta

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/racer-course-second-place-forward-evaluation-v1.json"

def load(p):
    try:return json.loads(Path(p).read_text(encoding="utf-8"))
    except Exception:return None

def valid_shadow(x):
    if not x or x.get("schema")!="boat-command-course-second-place-forward-v1":return False
    if x.get("resultInput") is not False or x.get("payoutInput") is not False:return False
    if x.get("researchOnly") is not True or x.get("shadowOnly") is not True:return False
    if x.get("productionEnabled") is not False or x.get("tryEnabled") is not False:return False
    if x.get("immutableAfterFirstWrite") is not True:return False
    if x.get("policySelectionUsesFinalTest") is not False:return False
    try:
        g=datetime.fromisoformat(str(x["generatedAt"]).replace("Z","+00:00"))
        d=datetime.fromisoformat(f'{x["date"]}T{x["deadline"]}:00+09:00')
        if g>d-timedelta(minutes=float(x.get("freezeMarginMinutes") or 3)):return False
    except Exception:return False
    return True

def valid_result(x,s):
    if not x:return False
    if x.get("schema")!="boat-command-live-result-v1":return False
    if x.get("preRaceDataIncluded") is not False or x.get("resultEndpointsIncluded") is not True:return False
    if x.get("evaluationEligible") is False:return False
    if x.get("date")!=s.get("date") or x.get("venue")!=s.get("venue") or str(x.get("venueCode"))!=str(s.get("venueCode")):return False
    if int(x.get("race") or 0)!=int(s.get("race") or 0):return False
    parts=str(x.get("trifecta") or "").split("-")
    return len(parts)==3 and len(set(parts))==3 and all(p in "123456" for p in parts)

def empty():
    return {"snapshots":0,"evaluated":0,"firstCorrect":0,
            "baselineSecondHits":0,"candidateSecondHits":0,
            "baselineTop2Hits":0,"candidateTop2Hits":0,"changedEvaluated":0}

def finalize(m):
    fc=m["firstCorrect"]
    return {
      **m,
      "baselineSecondAccuracyWhenFirstCorrect":m["baselineSecondHits"]/fc if fc else None,
      "candidateSecondAccuracyWhenFirstCorrect":m["candidateSecondHits"]/fc if fc else None,
      "secondAccuracyDelta":(m["candidateSecondHits"]-m["baselineSecondHits"])/fc if fc else None,
      "baselineTop2CoverageWhenFirstCorrect":m["baselineTop2Hits"]/fc if fc else None,
      "candidateTop2CoverageWhenFirstCorrect":m["candidateTop2Hits"]/fc if fc else None,
      "top2CoverageDelta":(m["candidateTop2Hits"]-m["baselineTop2Hits"])/fc if fc else None,
    }

def main():
    total=empty();by=defaultdict(empty);rows=[]
    paths=sorted(glob.glob(str(ROOT/"live/*/*/shadow/course-second-place-v1/race-*.json")))
    for p in paths:
        s=load(p)
        if not valid_shadow(s):continue
        slug=s["slug"];total["snapshots"]+=1;by[slug]["snapshots"]+=1
        rp=ROOT/f'live/{slug}/{s["date"]}/post/race-{int(s["race"])}-result.json'
        r=load(rp)
        if not valid_result(r,s):continue
        actual=[int(x) for x in r["trifecta"].split("-")]
        total["evaluated"]+=1;by[slug]["evaluated"]+=1
        if s.get("changed"):
            total["changedEvaluated"]+=1;by[slug]["changedEvaluated"]+=1
        first_ok=actual[0]==int(s["predictedFirst"])
        if first_ok:
            total["firstCorrect"]+=1;by[slug]["firstCorrect"]+=1
            bh=actual[1]==int(s["baselineSecondRanking"][0])
            ch=actual[1]==int(s["candidateSecondRanking"][0])
            b2=actual[1] in [int(x) for x in s["baselineSecondTop2"]]
            c2=actual[1] in [int(x) for x in s["candidateSecondTop2"]]
            total["baselineSecondHits"]+=int(bh);by[slug]["baselineSecondHits"]+=int(bh)
            total["candidateSecondHits"]+=int(ch);by[slug]["candidateSecondHits"]+=int(ch)
            total["baselineTop2Hits"]+=int(b2);by[slug]["baselineTop2Hits"]+=int(b2)
            total["candidateTop2Hits"]+=int(c2);by[slug]["candidateTop2Hits"]+=int(c2)
        rows.append({
          "slug":slug,"date":s["date"],"race":s["race"],"gate":s["venueGateEnabled"],
          "changed":s["changed"],"actual":r["trifecta"],"firstCorrect":first_ok,
          "baselinePair":s["baselinePair"],"candidatePair":s["candidatePair"]
        })
    out={
      "schema":"boat-command-racer-course-second-place-forward-evaluation-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "evaluationRule":"Only immutable >=3min PRE-RACE shadow + verified POST result",
      "summary":finalize(total),
      "venues":[{"slug":slug,**finalize(m)} for slug,m in sorted(by.items())],
      "rows":rows
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("COURSE_SECOND_FORWARD_EVAL",json.dumps(out["summary"],ensure_ascii=False))

if __name__=="__main__":main()
