#!/usr/bin/env python3
"""Evaluate course-specific racer-period features for second-place ranking.

Research question:
  With the first-place prediction frozen, can official half-year course stats
  improve the ranking of second-place candidates?

Important limitation:
  Historical rich rows have frame/lane but not verified actual entry course.
  Therefore the candidate uses SAME-NUMBER COURSE AS A LANE PROXY only.
  It never claims that frame == actual course.

Safety:
- racer period is selected by target race half-year
- registration + class match required
- profile selection uses first 70% of dates only
- last 30% is untouched holdout
- result is used only after predictions for evaluation
- no LIVE/TRY/HARD LOCK/production model is changed
"""
from __future__ import annotations
import json, math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/racer-period-course-second-audit-v1.json"
CLASS={"A1":3,"A2":2,"B1":1,"B2":0}
VENUES=[
 "amagasaki","ashiya","biwako","edogawa","fukuoka","gamagori","hamanako","heiwajima",
 "karatsu","kiryu","kojima","marugame","mikuni","miyajima","naruto","omura",
 "shimonoseki","suminoe","tamagawa","toda","tokoname","tokuyama","tsu","wakamatsu",
]
PROFILES=[
 {"name":"COURSE_2RATE","twoW":0.80,"threeW":0.00,"stW":0.0,"rankW":0.00,"fW":0.00,"lW":0.00,"periodStW":0.0},
 {"name":"COURSE_ST","twoW":0.00,"threeW":0.00,"stW":4.0,"rankW":0.00,"fW":0.00,"lW":0.00,"periodStW":0.0},
 {"name":"COURSE_START_RANK","twoW":0.00,"threeW":0.00,"stW":0.0,"rankW":0.18,"fW":0.00,"lW":0.00,"periodStW":0.0},
 {"name":"COURSE_2_ST","twoW":0.65,"threeW":0.00,"stW":3.5,"rankW":0.00,"fW":0.00,"lW":0.00,"periodStW":0.0},
 {"name":"COURSE_2_3_ST","twoW":0.55,"threeW":0.35,"stW":3.5,"rankW":0.00,"fW":0.00,"lW":0.00,"periodStW":0.0},
 {"name":"COURSE_BALANCED","twoW":0.60,"threeW":0.35,"stW":3.5,"rankW":0.12,"fW":0.08,"lW":0.14,"periodStW":0.0},
 {"name":"COURSE_PLUS_PERIOD_ST","twoW":0.55,"threeW":0.30,"stW":3.0,"rankW":0.10,"fW":0.06,"lW":0.12,"periodStW":2.0},
 {"name":"COURSE_STRONG","twoW":0.90,"threeW":0.50,"stW":5.0,"rankW":0.18,"fW":0.10,"lW":0.18,"periodStW":2.0},
]

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def finite(v):
    try:
        x=float(v); return x if math.isfinite(x) else None
    except Exception: return None

def period_key(d):
    y=int(d[:4]);m=int(d[5:7]);return (y,1 if m<=6 else 2)

PERIODS={}
for p in sorted((ROOT/"racer-period-24").glob("20??-[12].json")):
    x=load(p)
    PERIODS[(int(x["year"]),int(x["term"]))]={int(r["registration"]):r for r in x["racers"]}

def valid_order(v):
    p=str(v or "").split("-")
    return len(p)==3 and len(set(p))==3 and all(x in {"1","2","3","4","5","6"} for x in p)

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

def shrink(v,default,n,k=12):
    if v is None:return default
    w=max(0,min(1,n/(n+k))) if n is not None else 0
    return default+w*(v-default)

def course_features(rec,lane):
    courses=rec.get("courses") or []
    c=next((x for x in courses if int(x.get("course") or 0)==lane),None)
    if not c:return None
    entries=int(c.get("entries") or 0)
    two=finite(c.get("twoRate"))
    st=finite(c.get("avgST"))
    sr=finite(c.get("avgStartRank"))
    fc=c.get("finishCounts") or []
    third=None
    if entries>0 and len(fc)>=3:
        third=min(1.0,max(0.0,(int(fc[0] or 0)+int(fc[1] or 0)+int(fc[2] or 0))/entries))
    f=int(c.get("fCount") or 0)
    l=int(c.get("l0Count") or 0)+int(c.get("l1Count") or 0)
    return {
      "entries":entries,
      "two":shrink(two,.30,entries),
      "three":shrink(third,.50,entries),
      "st":shrink(st,finite(rec.get("periodAvgST")) or .18,entries),
      "startRank":shrink(sr,3.5,entries),
      "fRate":f/max(entries,1),
      "lRate":l/max(entries,1),
    }

def candidate_score(date_s,b,profile):
    s=base_score(b)
    if s is None:return None,False,None,False
    rec,status=safe_rec(date_s,b)
    if not rec:return s,False,status,False
    lane=int(b.get("lane") or 0)
    cf=course_features(rec,lane)
    if not cf:return s,True,"SAFE_NO_COURSE",False
    s+=profile["twoW"]*(cf["two"]-.30)
    s+=profile["threeW"]*(cf["three"]-.50)
    s+=profile["stW"]*(.18-cf["st"])
    s+=profile["rankW"]*(3.5-cf["startRank"])
    s-=profile["fW"]*cf["fRate"]
    s-=profile["lW"]*cf["lRate"]
    pst=finite(rec.get("periodAvgST"))
    if pst is not None:s+=profile["periodStW"]*(.18-pst)
    return s,True,"SAFE",True

def predict(row,profile=None):
    boats=sorted(row.get("boats",[]),key=lambda x:int(x.get("lane") or 0))
    if len(boats)!=6 or [int(b.get("lane") or 0) for b in boats]!=list(range(1,7)) or not valid_order(row.get("o")):
        return None
    base=[base_score(b) for b in boats]
    if any(x is None for x in base):return None
    first=max(range(6),key=lambda i:(base[i],-i))
    ranks=[];safe=course=0;miss={}
    for i,b in enumerate(boats):
        if i==first:continue
        if profile is None:
            score=base[i];ok=False;status=None;has_course=False
        else:
            score,ok,status,has_course=candidate_score(row["d"],b,profile)
        ranks.append((score,-i,i))
        if ok:safe+=1
        if has_course:course+=1
        if status and status not in {"SAFE"}:miss[status]=miss.get(status,0)+1
    ranks.sort(reverse=True)
    second=[i for _,__,i in ranks]
    actual=[int(x)-1 for x in row["o"].split("-")]
    return {
      "d":row["d"],"r":row["r"],"predFirst":first,
      "actualFirst":actual[0],"actualSecond":actual[1],
      "secondRank":second,"safeCandidates":safe,"courseCandidates":course,"joinMiss":miss,
    }

def metrics(rows):
    n=len(rows)
    hc=[x for x in rows if x["predFirst"]==x["actualFirst"]]
    top1=sum(1 for x in hc if x["secondRank"] and x["secondRank"][0]==x["actualSecond"])
    top2=sum(1 for x in hc if x["actualSecond"] in x["secondRank"][:2])
    top3=sum(1 for x in hc if x["actualSecond"] in x["secondRank"][:3])
    return {
      "races":n,
      "headCorrect":len(hc),
      "headAccuracy":len(hc)/n if n else None,
      "secondTop1Hits":top1,
      "secondTop1Accuracy":top1/len(hc) if hc else None,
      "secondTop2Hits":top2,
      "secondTop2Coverage":top2/len(hc) if hc else None,
      "secondTop3Hits":top3,
      "secondTop3Coverage":top3/len(hc) if hc else None,
      "pairAccuracy":top1/n if n else None,
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
      x["metrics"]["secondTop1Accuracy"] or 0,
      x["metrics"]["secondTop2Coverage"] or 0,
      x["metrics"]["pairAccuracy"] or 0
    ),reverse=True)
    return tested[0],tested

def venue_report(slug):
    db=load(ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json")
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({x["d"] for x in rows})
    cut=max(1,int(len(dates)*.70))
    cald=set(dates[:cut]);holdd=set(dates[cut:])
    cal=[x for x in rows if x["d"] in cald];hold=[x for x in rows if x["d"] in holdd]
    best,tested=choose(cal)
    b=eval_rows(hold,None);c=eval_rows(hold,best["profile"])
    bm=metrics(b);cm=metrics(c)
    safe=sum(x["safeCandidates"] for x in c);course=sum(x["courseCandidates"] for x in c)
    den=sum(len(x["secondRank"]) for x in c)
    miss={}
    for x in c:
        for k,v in x["joinMiss"].items():miss[k]=miss.get(k,0)+v
    return {
      "slug":slug,"venueCode":db.get("venueCode"),
      "calibrationLastDate":dates[cut-1] if dates else None,
      "holdoutFirstDate":dates[cut] if len(dates)>cut else None,
      "selectedProfile":best["profile"],"calibrationTopProfiles":tested[:4],
      "holdout":{
        "baseline":bm,"courseCandidate":cm,
        "headAccuracyDelta":cm["headAccuracy"]-bm["headAccuracy"],
        "secondTop1Delta":cm["secondTop1Accuracy"]-bm["secondTop1Accuracy"],
        "secondTop2Delta":cm["secondTop2Coverage"]-bm["secondTop2Coverage"],
        "secondTop3Delta":cm["secondTop3Coverage"]-bm["secondTop3Coverage"],
        "pairAccuracyDelta":cm["pairAccuracy"]-bm["pairAccuracy"],
        "safeJoinCoverage":safe/den if den else None,
        "sameNumberCourseFeatureCoverage":course/den if den else None,
        "joinMiss":miss,
      },
      "laneAsCourseProxy":True,
      "actualEntryCourseUsed":False,
      "promotionEligible":False,
    },b,c

def merge_metrics(groups):return metrics([x for g in groups for x in g])

def main():
    reports=[];bg=[];cg=[]
    for slug in VENUES:
        v,b,c=venue_report(slug);reports.append(v);bg.append(b);cg.append(c)
        print(slug,json.dumps({
          "top1Delta":v["holdout"]["secondTop1Delta"],
          "top2Delta":v["holdout"]["secondTop2Delta"],
          "courseCoverage":v["holdout"]["sameNumberCourseFeatureCoverage"],
          "profile":v["selectedProfile"]["name"],
        },ensure_ascii=False))
    bm=merge_metrics(bg);cm=merge_metrics(cg)
    summary={
      "venues":24,"holdoutRaces":bm["races"],
      "baseline":bm,"courseCandidate":cm,
      "headAccuracyDelta":cm["headAccuracy"]-bm["headAccuracy"],
      "secondTop1Delta":cm["secondTop1Accuracy"]-bm["secondTop1Accuracy"],
      "secondTop2Delta":cm["secondTop2Coverage"]-bm["secondTop2Coverage"],
      "secondTop3Delta":cm["secondTop3Coverage"]-bm["secondTop3Coverage"],
      "pairAccuracyDelta":cm["pairAccuracy"]-bm["pairAccuracy"],
      "venuesTop1Improved":sum(1 for v in reports if v["holdout"]["secondTop1Delta"]>0),
      "venuesTop2Improved":sum(1 for v in reports if v["holdout"]["secondTop2Delta"]>0),
      "venuesBothImproved":sum(1 for v in reports if v["holdout"]["secondTop1Delta"]>0 and v["holdout"]["secondTop2Delta"]>0),
      "venuesNoTop1Regression":sum(1 for v in reports if v["holdout"]["secondTop1Delta"]>=0),
    }
    out={
      "schema":"boat-command-racer-period-course-second-audit-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "question":"With first place frozen, do same-number historical course features improve second-place ranking?",
      "featureBoundary":{
        "firstPredictionFrozen":True,
        "officialSource":"BOAT RACE racer half-year archives",
        "courseSpecificStatsUsed":True,
        "laneAsCourseProxy":True,
        "actualEntryCourseUsed":False,
        "proxyWarning":"Frame/lane number is used only to select the same-number historical course profile. It is not asserted to equal actual entry course.",
        "joinPolicy":"RACE_DATE_HALF_YEAR + REGISTRATION + CLASS_MATCH",
        "resultsUsedForProfileSelection":"CALIBRATION_70_PERCENT_ONLY",
        "resultsUsedForHoldoutFeatureConstruction":False,
        "holdoutResultsUsedForEvaluationOnly":True,
      },
      "selectionPolicy":"Per venue profile selected on first 70% dates; compared on untouched last 30% dates.",
      "summary":summary,"venuesData":reports,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("COURSE_SECOND_AUDIT",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__":main()
