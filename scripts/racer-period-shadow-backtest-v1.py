#!/usr/bin/env python3
"""24-venue SHADOW backtest for racer-period feature uplift.

This experiment isolates the incremental value of newly recovered PRE-RACE-safe
racer-period features. It does not modify any venue model or LIVE prediction.

Inputs:
- rich-history-24/*-rich-history-v1.json
- racer-period-24/2026-{1,2}.json

Safety:
- feature construction never reads race result/payout
- result/payout are used only after picks are frozen in-memory for evaluation
- racer-period join requires target half-year + registration + class match
- no production/TRY/HARD LOCK/SHADOW/FORWARD files are written
"""
from __future__ import annotations

import itertools
import json
import math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/racer-period-shadow-backtest-v1.json"
CLASS={"A1":3,"A2":2,"B1":1,"B2":0}
ORDERS=[o for o in itertools.permutations(range(6),3)]
VENUES=[
 "amagasaki","ashiya","biwako","edogawa","fukuoka","gamagori","hamanako","heiwajima",
 "karatsu","kiryu","kojima","marugame","mikuni","miyajima","naruto","omura",
 "shimonoseki","suminoe","tamagawa","toda","tokoname","tokuyama","tsu","wakamatsu",
]

BASE={
 "classW":0.36,"nationalWinW":0.12,"national2W":0.42,
 "localWinW":0.17,"local2W":0.58,"localDeltaW":0.08,
 "motorW":0.42,"boatW":0.18,
}
PROFILES=[
 {"name":"ST_LIGHT","stW":2.0,"fW":0.025,"lW":0.05,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_MED","stW":4.0,"fW":0.035,"lW":0.08,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_FL","stW":4.0,"fW":0.060,"lW":0.14,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_ABILITY","stW":4.0,"fW":0.040,"lW":0.10,"abilityW":0.040,"threeW":0.00},
 {"name":"ST_3RATE","stW":4.0,"fW":0.040,"lW":0.10,"abilityW":0.00,"threeW":0.45},
 {"name":"BALANCED","stW":4.5,"fW":0.050,"lW":0.12,"abilityW":0.030,"threeW":0.30},
 {"name":"BALANCED_STRONG","stW":6.0,"fW":0.070,"lW":0.16,"abilityW":0.045,"threeW":0.45},
]

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def period_key(date_s):
    y=int(date_s[:4]);m=int(date_s[5:7])
    return (y,1 if m<=6 else 2)

def load_periods():
    out={}
    for p in sorted((ROOT/"racer-period-24").glob("20??-[12].json")):
        x=load(p)
        assert x["schema"]=="boat-command-racer-period-pack-v1"
        assert x["researchOnly"] is True and x["predictionInputEnabled"] is False
        key=(int(x["year"]),int(x["term"]))
        out[key]={int(r["registration"]):r for r in x["racers"]}
    return out

PERIODS=load_periods()

def finite(v):
    try:
        x=float(v)
        return x if math.isfinite(x) else None
    except Exception:return None

def valid_order(v):
    s=str(v or "")
    p=s.split("-")
    return len(p)==3 and len(set(p))==3 and all(x in {"1","2","3","4","5","6"} for x in p)

def base_score(b):
    c=str(b.get("class"))
    if c not in CLASS:return None
    s=BASE["classW"]*CLASS[c]
    nw=finite(b.get("nationalWinRate"));n2=finite(b.get("national2Rate"))
    lw=finite(b.get("localWinRate"));l2=finite(b.get("local2Rate"))
    m2=finite(b.get("motor2Rate"));bt=finite(b.get("boat2Rate"))
    if nw is not None:s+=BASE["nationalWinW"]*(nw-5)
    if n2 is not None:s+=BASE["national2W"]*(n2-.30)
    if lw is not None:s+=BASE["localWinW"]*(lw-5)
    if l2 is not None:s+=BASE["local2W"]*(l2-.30)
    if nw is not None and lw is not None:s+=BASE["localDeltaW"]*max(-3,min(3,lw-nw))
    if m2 is not None:s+=BASE["motorW"]*(m2-.35)
    if bt is not None:s+=BASE["boatW"]*(bt-.35)
    return s

def safe_period_record(date_s,b):
    key=period_key(date_s);idx=PERIODS.get(key,{})
    reg=int(b.get("registration") or 0)
    rec=idx.get(reg)
    if not rec:return None,"NO_REGISTRATION_MATCH"
    if str(rec.get("class"))!=str(b.get("class")):return None,"CLASS_MISMATCH"
    return rec,"SAFE"

def enriched_score(date_s,b,profile):
    s=base_score(b)
    if s is None:return None,False,None
    rec,status=safe_period_record(date_s,b)
    if not rec:return s,False,status
    st=finite(rec.get("periodAvgST"))
    f=finite(rec.get("periodFCountDerived"))
    l=finite(rec.get("periodLCountDerived"))
    ab=finite(rec.get("currentAbility"))
    r3=finite(rec.get("period3RateDerived"))
    if st is not None:s+=profile["stW"]*(.18-st)
    if f is not None:s-=profile["fW"]*f
    if l is not None:s-=profile["lW"]*l
    if ab is not None:s+=profile["abilityW"]*((ab-50)/10)
    if r3 is not None:s+=profile["threeW"]*(r3-.40)
    return s,True,status

def top_orders(scores,n=8):
    ex=[math.exp(max(-12,min(12,x))) for x in scores]
    rows=[]
    for a,b,c in ORDERS:
        d1=sum(ex)
        p=ex[a]/d1
        d2=d1-ex[a]
        p*=ex[b]/d2
        d3=d2-ex[b]
        p*=ex[c]/d3
        rows.append((p,f"{a+1}-{b+1}-{c+1}"))
    rows.sort(reverse=True)
    return [o for _,o in rows[:n]]

def prepare_row(row,profile=None):
    boats=sorted(row.get("boats",[]),key=lambda x:int(x.get("lane") or 0))
    if len(boats)!=6 or [int(b.get("lane") or 0) for b in boats]!=list(range(1,7)):return None
    if not valid_order(row.get("o")):return None
    scores=[];safe=0;miss={}
    for b in boats:
        if profile is None:
            s=base_score(b);ok=False;status=None
        else:
            s,ok,status=enriched_score(row["d"],b,profile)
        if s is None:return None
        scores.append(s)
        if ok:safe+=1
        elif status:miss[status]=miss.get(status,0)+1
    return {
      "id":row["id"],"d":row["d"],"r":row["r"],"actual":row["o"],"payout":int(row.get("p") or 0),
      "picks":top_orders(scores,8),"safeJoinedBoats":safe,"joinMiss":miss,
    }

def metrics(records,n=4):
    if not records:return {"races":0,"hits":0,"hitRate":None,"stake":0,"returns":0,"roi":None,
                           "top1Exact":0,"top1ExactRate":None,"firstCorrect":0,"firstAccuracy":None,
                           "secondCorrect":0,"secondAccuracy":None,"thirdCorrect":0,"thirdAccuracy":None}
    hits=ret=exact=first=second=third=0
    for x in records:
        actual=x["actual"].split("-")
        top=x["picks"][0].split("-")
        if x["actual"] in x["picks"][:n]:
            hits+=1;ret+=x["payout"]
        exact+=x["actual"]==x["picks"][0]
        first+=actual[0]==top[0];second+=actual[1]==top[1];third+=actual[2]==top[2]
    stake=len(records)*n*100
    return {
      "races":len(records),"hits":hits,"hitRate":hits/len(records),"stake":stake,"returns":ret,"roi":ret/stake if stake else None,
      "top1Exact":exact,"top1ExactRate":exact/len(records),
      "firstCorrect":first,"firstAccuracy":first/len(records),
      "secondCorrect":second,"secondAccuracy":second/len(records),
      "thirdCorrect":third,"thirdAccuracy":third/len(records),
    }

def eval_rows(rows,profile=None):
    out=[]
    for r in rows:
        x=prepare_row(r,profile)
        if x:out.append(x)
    return out

def choose_profile(cal):
    tested=[]
    for p in PROFILES:
        rec=eval_rows(cal,p);m=metrics(rec,4)
        tested.append({"profile":p,"metrics4":m})
    tested.sort(key=lambda x:(
      x["metrics4"]["hitRate"] or 0,
      x["metrics4"]["secondAccuracy"] or 0,
      x["metrics4"]["roi"] or 0,
      x["metrics4"]["firstAccuracy"] or 0
    ),reverse=True)
    return tested[0],tested

def aggregate(records):
    return metrics(records,4)

def venue_report(slug):
    path=ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json"
    db=load(path)
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({r["d"] for r in rows})
    cut=max(1,int(len(dates)*.70))
    cal_dates=set(dates[:cut]);hold_dates=set(dates[cut:])
    cal=[r for r in rows if r["d"] in cal_dates]
    hold=[r for r in rows if r["d"] in hold_dates]
    base_cal=eval_rows(cal,None);base_hold=eval_rows(hold,None)
    best,tested=choose_profile(cal)
    cand_hold=eval_rows(hold,best["profile"])
    b4=metrics(base_hold,4);c4=metrics(cand_hold,4)
    safe=sum(x["safeJoinedBoats"] for x in cand_hold);boats=len(cand_hold)*6
    misses={}
    for x in cand_hold:
        for k,v in x["joinMiss"].items():misses[k]=misses.get(k,0)+v
    return {
      "slug":slug,"venueCode":db.get("venueCode"),"source":str(path.relative_to(ROOT)),
      "strictHoldout":True,"calibrationDateCount":cut,"holdoutDateCount":len(dates)-cut,
      "calibrationLastDate":dates[cut-1] if dates else None,
      "holdoutFirstDate":dates[cut] if len(dates)>cut else None,
      "selectedProfile":best["profile"],
      "calibrationTopProfiles":tested[:4],
      "holdout":{
        "richBase4":b4,"periodEnriched4":c4,
        "hitRateDelta":c4["hitRate"]-b4["hitRate"] if b4["hitRate"] is not None else None,
        "roiDelta":c4["roi"]-b4["roi"] if b4["roi"] is not None else None,
        "firstAccuracyDelta":c4["firstAccuracy"]-b4["firstAccuracy"] if b4["firstAccuracy"] is not None else None,
        "secondAccuracyDelta":c4["secondAccuracy"]-b4["secondAccuracy"] if b4["secondAccuracy"] is not None else None,
        "thirdAccuracyDelta":c4["thirdAccuracy"]-b4["thirdAccuracy"] if b4["thirdAccuracy"] is not None else None,
        "safeJoinedBoats":safe,"boatRows":boats,
        "safeJoinCoverage":safe/boats if boats else None,"joinMiss":misses,
      },
      "promotionEligible":False,"productionChanged":False,"tryChanged":False,
    },base_hold,cand_hold

def main():
    venues=[];all_base=[];all_cand=[]
    for slug in VENUES:
        v,b,c=venue_report(slug);venues.append(v);all_base.extend(b);all_cand.extend(c)
        print(slug,json.dumps({
          "hitDelta":v["holdout"]["hitRateDelta"],
          "secondDelta":v["holdout"]["secondAccuracyDelta"],
          "roiDelta":v["holdout"]["roiDelta"],
          "safeJoin":v["holdout"]["safeJoinCoverage"],
          "profile":v["selectedProfile"]["name"],
        },ensure_ascii=False))
    base=aggregate(all_base);cand=aggregate(all_cand)
    summary={
      "venues":24,
      "holdoutRaces":base["races"],
      "aggregateBase4":base,"aggregatePeriodEnriched4":cand,
      "aggregateHitRateDelta":cand["hitRate"]-base["hitRate"],
      "aggregateRoiDelta":cand["roi"]-base["roi"],
      "aggregateFirstAccuracyDelta":cand["firstAccuracy"]-base["firstAccuracy"],
      "aggregateSecondAccuracyDelta":cand["secondAccuracy"]-base["secondAccuracy"],
      "aggregateThirdAccuracyDelta":cand["thirdAccuracy"]-base["thirdAccuracy"],
      "venuesHitRateImproved":sum(1 for v in venues if v["holdout"]["hitRateDelta"]>0),
      "venuesSecondAccuracyImproved":sum(1 for v in venues if v["holdout"]["secondAccuracyDelta"]>0),
      "venuesBothImproved":sum(1 for v in venues if v["holdout"]["hitRateDelta"]>0 and v["holdout"]["secondAccuracyDelta"]>0),
      "venuesNoHitRegression":sum(1 for v in venues if v["holdout"]["hitRateDelta"]>=0),
    }
    out={
      "schema":"boat-command-racer-period-shadow-backtest-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,
      "featureBoundary":{
        "featuresAdded":["periodAvgST","periodFCountDerived","periodLCountDerived","currentAbility","period3RateDerived"],
        "courseSpecificStatsUsed":False,
        "resultUsedForFeatureConstruction":False,
        "payoutUsedForFeatureConstruction":False,
        "resultAndPayoutUse":"EVALUATION_AFTER_PICKS_ONLY",
        "joinPolicy":"RACE_DATE_HALF_YEAR + REGISTRATION + CLASS_MATCH",
      },
      "selectionPolicy":"profile chosen on first 70% dates; final comparison on untouched last 30% dates",
      "summary":summary,"venuesData":venues,
      "promotionEligible":False,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RACER_PERIOD_SHADOW_BACKTEST",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__":main()
