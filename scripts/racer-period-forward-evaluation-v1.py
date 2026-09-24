#!/usr/bin/env python3
"""Evaluate immutable racer-period second-place FORWARD SHADOW snapshots.

POST results are read only for scoring after a result-blind snapshot already
exists. This file never feeds predictions and never mutates bankroll/TRY/models.
"""
from __future__ import annotations

import glob
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/racer-period-second-forward-evaluation-v1.json"
ORDER=re.compile(r"^[1-6]-[1-6]-[1-6]$")

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def valid_order(v):
    s=str(v or "")
    return bool(ORDER.fullmatch(s)) and len(set(s.split("-")))==3

def metric(rows,key):
    paired=len(rows)
    first_correct=second_hits=exact=returns=0
    for x in rows:
        pred=x[key]
        pa,pb,_=map(int,pred.split("-"))
        aa,ab,_=map(int,x["actual"].split("-"))
        if pa==aa:
            first_correct+=1
            if pb==ab:second_hits+=1
        if pred==x["actual"]:
            exact+=1
            returns+=int(x.get("payout100") or 0)
    return {
      "pairedRaces":paired,
      "firstCorrect":first_correct,
      "secondHitsWhenFirstCorrect":second_hits,
      "secondRateWhenFirstCorrect":round(second_hits/first_correct,6) if first_correct else None,
      "exactHits":exact,
      "exactRate":round(exact/paired,6) if paired else None,
      "singleOrderStake":paired*100,
      "singleOrderReturns":returns,
      "singleOrderRoi":round(returns/(paired*100),6) if paired else None,
    }

def evaluate():
    rows=[]
    skips=defaultdict(int)
    for sp in sorted(glob.glob(str(ROOT/"live/*/*/shadow/racer-period-second/race-*.json"))):
        try:s=load(sp)
        except Exception:
            skips["snapshotRead"]+=1;continue
        if s.get("schema")!="boat-command-racer-period-forward-shadow-v1":
            skips["snapshotSchema"]+=1;continue
        if not (
          s.get("resultInput") is False and s.get("payoutInput") is False
          and s.get("researchOnly") is True and s.get("productionEnabled") is False
          and s.get("tryEnabled") is False and s.get("bankrollMutation") is False
          and s.get("firstPlaceMutation") is False
        ):
            raise AssertionError(f"SNAPSHOT_BOUNDARY {sp}")
        slug=s["slug"];date=s["date"];race=int(s["race"])
        pp=ROOT/"live"/slug/date/"post"/f"race-{race}-result.json"
        if not pp.exists():
            skips["postMissing"]+=1;continue
        try:p=load(pp)
        except Exception:
            skips["postRead"]+=1;continue
        if p.get("schema")!="boat-command-live-result-v1":
            skips["postSchema"]+=1;continue
        if p.get("preRaceDataIncluded") is not False or p.get("resultEndpointsIncluded") is not True:
            raise AssertionError(f"POST_BOUNDARY {pp}")
        actual=p.get("trifecta")
        if not valid_order(actual):
            skips["resultInvalid"]+=1;continue
        variants={
          "baseline":s.get("baselineTopOrder"),
          "marginal":s.get("marginalSecondOrder"),
          "period":s.get("periodCandidateOrder"),
        }
        if not all(valid_order(v) for v in variants.values()):
            skips["predictionInvalid"]+=1;continue
        heads={int(v.split("-")[0]) for v in variants.values()}
        if len(heads)!=1 or next(iter(heads))!=int(s["baselineFirst"]):
            raise AssertionError(f"FIRST_MUTATION {sp}")
        rows.append({
          "slug":slug,"venueCode":s["venueCode"],"date":date,"race":race,
          "baseline":variants["baseline"],"marginal":variants["marginal"],"period":variants["period"],
          "actual":actual,"payout100":int(p.get("payout100") or 0),
          "selectedPreset":s.get("selectedPreset"),"selectedLambda":s.get("selectedLambda"),
          "snapshotPath":str(Path(sp).relative_to(ROOT)),
          "postPath":str(pp.relative_to(ROOT)),
        })
    return rows,dict(skips)

def main():
    rows,skips=evaluate()
    groups=defaultdict(list)
    for r in rows:groups[r["slug"]].append(r)
    total={k:metric(rows,k) for k in ("baseline","marginal","period")}
    venues=[]
    for slug in sorted(groups):
        g=groups[slug]
        mm={k:metric(g,k) for k in ("baseline","marginal","period")}
        venues.append({
          "slug":slug,"venueCode":g[0]["venueCode"],"pairedRaces":len(g),
          "metrics":mm,
          "periodSecondDeltaVsMarginal":(
            round((mm["period"]["secondRateWhenFirstCorrect"] or 0)-(mm["marginal"]["secondRateWhenFirstCorrect"] or 0),6)
            if mm["period"]["firstCorrect"] else None
          ),
          "periodSecondDeltaVsBaseline":(
            round((mm["period"]["secondRateWhenFirstCorrect"] or 0)-(mm["baseline"]["secondRateWhenFirstCorrect"] or 0),6)
            if mm["period"]["firstCorrect"] else None
          ),
          "minimumVenueSampleReached":len(g)>=20,
        })
    paired=len(rows)
    venues20=sum(1 for v in venues if v["minimumVenueSampleReached"])
    period_delta_marg=(
      round((total["period"]["secondRateWhenFirstCorrect"] or 0)-(total["marginal"]["secondRateWhenFirstCorrect"] or 0),6)
      if total["period"]["firstCorrect"] else None
    )
    period_delta_base=(
      round((total["period"]["secondRateWhenFirstCorrect"] or 0)-(total["baseline"]["secondRateWhenFirstCorrect"] or 0),6)
      if total["period"]["firstCorrect"] else None
    )
    review_ready=(
      paired>=300 and len(venues)>=12 and
      total["period"]["firstCorrect"]>=150 and
      period_delta_marg is not None and period_delta_marg>0
    )
    report={
      "schema":"boat-command-racer-period-second-forward-evaluation-v1",
      "version":"RACER-PERIOD-SECOND-FORWARD-EVALUATION-V1",
      "researchOnly":True,
      "productionChanged":False,
      "predictionInputChanged":False,
      "tryChanged":False,
      "bankrollChanged":False,
      "hardLockChanged":False,
      "firstPlaceMutation":False,
      "source":{
        "snapshot":"IMMUTABLE_RESULT_BLIND_RACER_PERIOD_FORWARD_SHADOW",
        "post":"VERIFIED_POST_RESULT_SCORING_ONLY",
        "historicalEvidence":"MIXED_ACROSS_METHODS_SO_FORWARD_REQUIRED"
      },
      "gate":{
        "minimumPairedRacesOverall":300,
        "minimumVenuesRepresented":12,
        "minimumFirstCorrectOverall":150,
        "minimumPairedRacesPerVenueForVenueReview":20,
        "requirePeriodSecondRateAboveMarginal":True,
      },
      "status":"FORWARD_REVIEW_READY" if review_ready else "COLLECTING",
      "reviewGatePass":review_ready,
      "promotionEligible":False,
      "promotionReason":"HUMAN_REVIEW_AND_ADDITIONAL_FORWARD_VALIDATION_REQUIRED" if review_ready else "MINIMUM_FORWARD_SAMPLE_NOT_REACHED",
      "summary":{
        "pairedRaces":paired,
        "venuesRepresented":len(venues),
        "venuesWith20PlusPairs":venues20,
        "metrics":total,
        "periodSecondDeltaVsMarginal":period_delta_marg,
        "periodSecondDeltaVsBaseline":period_delta_base,
      },
      "skips":skips,
      "venues":venues,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RACER_PERIOD_FORWARD_EVALUATION",json.dumps(report["summary"],ensure_ascii=False))
    print("FORWARD_STATUS",report["status"],"PROMOTION_ELIGIBLE",report["promotionEligible"])

if __name__=="__main__":
    main()
