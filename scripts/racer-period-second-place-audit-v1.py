#!/usr/bin/env python3
"""Isolate second-place prediction value of PRE-RACE-safe racer-period features.

The predicted first lane is intentionally frozen to the existing rich-feature
lane score. Only the ranking of second-place candidates is changed. This makes
the experiment answer one narrow question: when the first lane is already
right, do recovered period ST/F-L/ability features improve second place?

No production model or ticket set is changed.
"""
from __future__ import annotations
import json,math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/racer-period-second-place-audit-v1.json"
CLASS={"A1":3,"A2":2,"B1":1,"B2":0}
VENUES=[
 "amagasaki","ashiya","biwako","edogawa","fukuoka","gamagori","hamanako","heiwajima",
 "karatsu","kiryu","kojima","marugame","mikuni","miyajima","naruto","omura",
 "shimonoseki","suminoe","tamagawa","toda","tokoname","tokuyama","tsu","wakamatsu",
]
PROFILES=[
 {"name":"ST_LIGHT","stW":2.0,"fW":0.02,"lW":0.05,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_MED","stW":4.0,"fW":0.03,"lW":0.08,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_FL","stW":4.0,"fW":0.06,"lW":0.14,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_ABILITY","stW":4.0,"fW":0.04,"lW":0.10,"abilityW":0.05,"threeW":0.00},
 {"name":"ST_3RATE","stW":4.0,"fW":0.04,"lW":0.10,"abilityW":0.00,"threeW":0.50},
 {"name":"BALANCED","stW":4.5,"fW":0.05,"lW":0.12,"abilityW":0.04,"threeW":0.35},
 {"name":"BALANCED_STRONG","stW":6.0,"fW":0.07,"lW":0.16,"abilityW":0.06,"threeW":0.50},
]

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def finite(v):
    try:
        x=float(v);return x if math.isfinite(x) else None
    except Exception:return None

def period_key(d):
    y=int(d[:4]);m=int(d[5:7]);return (y,1 if m<=6 else 2)

PERIODS={}
for p in sorted((ROOT/"racer-period-24").glob("20??-[12].json")):
    x=load(p)
    PERIODS[(int(x["year"]),int(x["term"]))]={int(r["registration"]):r for r in x["racers"]}

def base_score(b):
    c=str(b.get("class"))
    if c not in CLASS:return None
    s=.36*CLASS[c]
    nw=finite(b.get("nationalWinRate"));n2=finite(b.get("national2Rate"))
    lw=finite(b.get("localWinRate"));l2=finite(b.get("local2Rate"))
    m2=finite(b.get("motor2Rate"));bt=finite(b.get("boat2Rate"))
    if nw is not None:s+=.12*(nw-5)
    if n2 is not None:s+=.42*(n2-.30)
    if lw is not None:s+=.17*(lw-5)
    if l2 is not None:s+=.58*(l2-.30)
    if nw is not None and lw is not None:s+=.08*max(-3,min(3,lw-nw))
    if m2 is not None:s+=.42*(m2-.35)
    if bt is not None:s+=.18*(bt-.35)
    return s

def safe_rec(date_s,b):
    rec=PERIODS.get(period_key(date_s),{}).get(int(b.get("registration") or 0))
    if not rec:return None,"NO_REGISTRATION_MATCH"
    if str(rec.get("class"))!=str(b.get("class")):return None,"CLASS_MISMATCH"
    return rec,"SAFE"

def second_score(date_s,b,profile):
    s=base_score(b)
    if s is None:return None,False,None
    rec,status=safe_rec(date_s,b)
    if not rec:return s,False,status
    st=finite(rec.get("periodAvgST"));f=finite(rec.get("periodFCountDerived"))
    l=finite(rec.get("periodLCountDerived"));ab=finite(rec.get("currentAbility"))
    r3=finite(rec.get("period3RateDerived"))
    if st is not None:s+=profile["stW"]*(.18-st)
    if f is not None:s-=profile["fW"]*f
    if l is not None:s-=profile["lW"]*l
    if ab is not None:s+=profile["abilityW"]*((ab-50)/10)
    if r3 is not None:s+=profile["threeW"]*(r3-.40)
    return s,True,status

def valid_order(v):
    p=str(v or "").split("-")
    return len(p)==3 and len(set(p))==3 and all(x in {"1","2","3","4","5","6"} for x in p)

def predict(row,profile=None):
    boats=sorted(row.get("boats",[]),key=lambda x:int(x.get("lane") or 0))
    if len(boats)!=6 or not valid_order(row.get("o")):return None
    bs=[base_score(b) for b in boats]
    if any(x is None for x in bs):return None
    first=max(range(6),key=lambda i:(bs[i],-i))
    ranked=[]
    safe=0;miss={}
    for i,b in enumerate(boats):
        if i==first:continue
        if profile is None:
            s=bs[i];ok=False;status=None
        else:
            s,ok,status=second_score(row["d"],b,profile)
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
    n=len(rows)
    if not n:return {"races":0,"headCorrect":0,"headAccuracy":None,"headCorrectRaces":0,
                     "secondHitsWhenHeadCorrect":0,"secondAccuracyWhenHeadCorrect":None,
                     "secondTop2HitsWhenHeadCorrect":0,"secondTop2CoverageWhenHeadCorrect":None,
                     "pairHits":0,"pairAccuracy":None}
    hc=[x for x in rows if x["predFirst"]==x["actualFirst"]]
    sh=sum(1 for x in hc if x["secondRank"][0]==x["actualSecond"])
    s2=sum(1 for x in hc if x["actualSecond"] in x["secondRank"][:2])
    pair=sh
    return {
      "races":n,"headCorrect":len(hc),"headAccuracy":len(hc)/n,
      "headCorrectRaces":len(hc),
      "secondHitsWhenHeadCorrect":sh,
      "secondAccuracyWhenHeadCorrect":sh/len(hc) if hc else None,
      "secondTop2HitsWhenHeadCorrect":s2,
      "secondTop2CoverageWhenHeadCorrect":s2/len(hc) if hc else None,
      "pairHits":pair,"pairAccuracy":pair/n,
    }

def eval_rows(rows,profile=None):
    out=[]
    for r in rows:
        x=predict(r,profile)
        if x:out.append(x)
    return out

def choose(cal):
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

def venue(slug):
    db=load(ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json")
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({x["d"] for x in rows});cut=max(1,int(len(dates)*.70))
    cald=set(dates[:cut]);holdd=set(dates[cut:])
    cal=[x for x in rows if x["d"] in cald];hold=[x for x in rows if x["d"] in holdd]
    best,tested=choose(cal)
    b=eval_rows(hold,None);c=eval_rows(hold,best["profile"])
    bm=metrics(b);cm=metrics(c)
    safe=sum(x["safeSecondCandidates"] for x in c);den=sum(len(x["secondRank"]) for x in c)
    miss={}
    for x in c:
        for k,v in x["joinMiss"].items():miss[k]=miss.get(k,0)+v
    return {
      "slug":slug,"venueCode":db.get("venueCode"),
      "calibrationLastDate":dates[cut-1] if dates else None,
      "holdoutFirstDate":dates[cut] if len(dates)>cut else None,
      "selectedProfile":best["profile"],"calibrationTopProfiles":tested[:4],
      "holdout":{
        "baseline":bm,"periodCandidate":cm,
        "headAccuracyDelta":cm["headAccuracy"]-bm["headAccuracy"],
        "secondAccuracyDelta":cm["secondAccuracyWhenHeadCorrect"]-bm["secondAccuracyWhenHeadCorrect"] if bm["secondAccuracyWhenHeadCorrect"] is not None else None,
        "secondTop2CoverageDelta":cm["secondTop2CoverageWhenHeadCorrect"]-bm["secondTop2CoverageWhenHeadCorrect"] if bm["secondTop2CoverageWhenHeadCorrect"] is not None else None,
        "pairAccuracyDelta":cm["pairAccuracy"]-bm["pairAccuracy"],
        "safeJoinCoverageAmongSecondCandidates":safe/den if den else None,
        "joinMiss":miss,
      },
      "firstPredictionFrozen":True,"productionChanged":False,"promotionEligible":False,
    },b,c

def merge_metrics(groups):
    rows=[x for g in groups for x in g]
    return metrics(rows)

def main():
    reports=[];base_groups=[];cand_groups=[]
    for slug in VENUES:
        v,b,c=venue(slug);reports.append(v);base_groups.append(b);cand_groups.append(c)
        print(slug,json.dumps({
          "head":v["holdout"]["baseline"]["headAccuracy"],
          "secondBase":v["holdout"]["baseline"]["secondAccuracyWhenHeadCorrect"],
          "secondCand":v["holdout"]["periodCandidate"]["secondAccuracyWhenHeadCorrect"],
          "secondDelta":v["holdout"]["secondAccuracyDelta"],
          "top2Delta":v["holdout"]["secondTop2CoverageDelta"],
          "profile":v["selectedProfile"]["name"],
        },ensure_ascii=False))
    bm=merge_metrics(base_groups);cm=merge_metrics(cand_groups)
    summary={
      "venues":24,"holdoutRaces":bm["races"],
      "baseline":bm,"periodCandidate":cm,
      "headAccuracyDelta":cm["headAccuracy"]-bm["headAccuracy"],
      "secondAccuracyDelta":cm["secondAccuracyWhenHeadCorrect"]-bm["secondAccuracyWhenHeadCorrect"],
      "secondTop2CoverageDelta":cm["secondTop2CoverageWhenHeadCorrect"]-bm["secondTop2CoverageWhenHeadCorrect"],
      "pairAccuracyDelta":cm["pairAccuracy"]-bm["pairAccuracy"],
      "venuesSecondAccuracyImproved":sum(1 for v in reports if v["holdout"]["secondAccuracyDelta"]>0),
      "venuesSecondTop2Improved":sum(1 for v in reports if v["holdout"]["secondTop2CoverageDelta"]>0),
      "venuesNoSecondRegression":sum(1 for v in reports if v["holdout"]["secondAccuracyDelta"]>=0),
    }
    out={
      "schema":"boat-command-racer-period-second-place-audit-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "question":"With first-place prediction frozen, do PRE-RACE-safe period features improve second place?",
      "featureBoundary":{
        "firstPredictionFrozen":True,
        "featuresAddedToSecondOnly":["periodAvgST","periodFCountDerived","periodLCountDerived","currentAbility","period3RateDerived"],
        "courseSpecificStatsUsed":False,
        "joinPolicy":"RACE_DATE_HALF_YEAR + REGISTRATION + CLASS_MATCH",
        "resultsUsedForFeatureSelection":False,
        "resultsUsedForEvaluationOnly":True,
      },
      "summary":summary,"venuesData":reports,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RACER_PERIOD_SECOND_PLACE_AUDIT",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__":main()
