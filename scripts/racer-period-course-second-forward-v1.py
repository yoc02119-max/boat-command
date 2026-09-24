#!/usr/bin/env python3
"""Freeze immutable PRE-RACE course-second forward SHADOW predictions.

This is a forward validation of the course-specific second-place research result.
It does not alter BOAT COMMAND production predictions, TRY, bankroll or HARD LOCK.

Only result-blind stored program packs and official half-year racer-period packs
are read. Historical same-number course statistics are used as a LANE PROXY;
the script never asserts that the current frame equals actual entry course.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
JST=ZoneInfo("Asia/Tokyo")
REPORT=ROOT/"research/racer-period-course-second-audit-v1.json"
CLASS={"A1":3,"A2":2,"B1":1,"B2":0}
VENUES={
 "01":("KIRYU","kiryu"),"02":("TODA","toda"),"03":("EDOGAWA","edogawa"),
 "04":("HEIWAJIMA","heiwajima"),"05":("TAMAGAWA","tamagawa"),"06":("HAMANAKO","hamanako"),
 "07":("GAMAGORI","gamagori"),"08":("TOKONAME","tokoname"),"09":("TSU","tsu"),
 "10":("MIKUNI","mikuni"),"11":("BIWAKO","biwako"),"12":("SUMINOE","suminoe"),
 "13":("AMAGASAKI","amagasaki"),"14":("NARUTO","naruto"),"15":("MARUGAME","marugame"),
 "16":("KOJIMA","kojima"),"17":("MIYAJIMA","miyajima"),"18":("TOKUYAMA","tokuyama"),
 "19":("SHIMONOSEKI","shimonoseki"),"20":("WAKAMATSU","wakamatsu"),"21":("ASHIYA","ashiya"),
 "22":("FUKUOKA","fukuoka"),"23":("KARATSU","karatsu"),"24":("OMURA","omura"),
}

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def sha256(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def finite(v):
    try:
        x=float(v);return x if math.isfinite(x) else None
    except Exception:return None

def period_key(d):
    y=int(d[:4]);m=int(d[5:7]);return y,(1 if m<=6 else 2)

def period_index(d):
    y,t=period_key(d)
    p=ROOT/"racer-period-24"/f"{y}-{t}.json"
    if not p.exists(): return None,p
    x=load(p)
    if x.get("schema")!="boat-command-racer-period-pack-v1" or x.get("researchOnly") is not True:
        raise ValueError("RACER_PERIOD_PACK_INVALID")
    return {int(r["registration"]):r for r in x.get("racers",[])},p

def profiles():
    x=load(REPORT)
    if x.get("schema")!="boat-command-racer-period-course-second-audit-v1":
        raise ValueError("COURSE_SECOND_REPORT_INVALID")
    if not all(x.get(k) is False for k in ("productionChanged","predictionInputChanged","tryChanged","hardLockChanged")):
        raise ValueError("COURSE_SECOND_REPORT_BOUNDARY")
    return {v["slug"]:v["selectedProfile"] for v in x["venuesData"]}

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

def shrink(v,default,n,k=12):
    if v is None:return default
    w=max(0,min(1,n/(n+k))) if n is not None else 0
    return default+w*(v-default)

def safe_record(index,b):
    if index is None:return None,"PERIOD_PACK_MISSING"
    rec=index.get(int(b.get("registration") or 0))
    if not rec:return None,"REGISTRATION_MISSING"
    if str(rec.get("class"))!=str(b.get("class")):return None,"CLASS_MISMATCH"
    return rec,"SAFE"

def course_features(rec,lane):
    c=next((x for x in (rec.get("courses") or []) if int(x.get("course") or 0)==lane),None)
    if not c:return None
    n=int(c.get("entries") or 0)
    two=finite(c.get("twoRate"));st=finite(c.get("avgST"));rank=finite(c.get("avgStartRank"))
    fc=c.get("finishCounts") or []
    three=None
    if n>0 and len(fc)>=3:
        three=min(1,max(0,(int(fc[0] or 0)+int(fc[1] or 0)+int(fc[2] or 0))/n))
    return {
      "entries":n,
      "two":shrink(two,.30,n),
      "three":shrink(three,.50,n),
      "st":shrink(st,finite(rec.get("periodAvgST")) or .18,n),
      "startRank":shrink(rank,3.5,n),
      "fRate":int(c.get("fCount") or 0)/max(n,1),
      "lRate":(int(c.get("l0Count") or 0)+int(c.get("l1Count") or 0))/max(n,1),
    }

def candidate_score(date_s,b,profile,index):
    s=base_score(b)
    if s is None:return None,False,"BASE_MISSING"
    rec,status=safe_record(index,b)
    if not rec:return s,False,status
    cf=course_features(rec,int(b.get("lane") or 0))
    if not cf:return s,False,"COURSE_FEATURE_MISSING"
    s+=profile["twoW"]*(cf["two"]-.30)
    s+=profile["threeW"]*(cf["three"]-.50)
    s+=profile["stW"]*(.18-cf["st"])
    s+=profile["rankW"]*(3.5-cf["startRank"])
    s-=profile["fW"]*cf["fRate"]
    s-=profile["lW"]*cf["lRate"]
    pst=finite(rec.get("periodAvgST"))
    if pst is not None:s+=profile["periodStW"]*(.18-pst)
    return s,True,"SAFE"

def deadline_dt(date_s,hm):
    try:
        h,m=map(int,str(hm).split(":"))
        d=dt.date.fromisoformat(date_s)
        return dt.datetime(d.year,d.month,d.day,h,m,tzinfo=JST)
    except Exception:return None

def parse_source_time(v):
    if not v:return None
    try:
        return dt.datetime.fromisoformat(str(v).replace("Z","+00:00")).astimezone(JST)
    except Exception:return None

def validate_program(x,code,key,slug,date_s,race):
    if x.get("venue")!=key or str(x.get("venueCode"))!=code or x.get("date")!=date_s or int(x.get("race") or 0)!=race:
        raise ValueError("PROGRAM_IDENTITY_INVALID")
    if x.get("resultEndpointsIncluded") is not False or x.get("resultIncluded") is not False or x.get("exhibitionIncluded") is not False:
        raise ValueError("PROGRAM_PRE_BOUNDARY_INVALID")
    boats=sorted(x.get("boats") or [],key=lambda b:int(b.get("lane") or 0))
    if len(boats)!=6 or [int(b.get("lane") or 0) for b in boats]!=[1,2,3,4,5,6]:
        raise ValueError("PROGRAM_BOATS_INVALID")
    return boats

def freeze_one(program,program_path,code,key,slug,date_s,race,profile,index,period_path,now):
    boats=validate_program(program,code,key,slug,date_s,race)
    deadline=deadline_dt(date_s,program.get("deadline"))
    if deadline is None:return None,"DEADLINE_MISSING"
    cutoff=deadline-dt.timedelta(minutes=3)
    if now>cutoff:return None,"FREEZE_WINDOW_CLOSED"
    source_time=parse_source_time(program.get("fetchedAt"))
    if source_time is not None and source_time>cutoff:return None,"SOURCE_TOO_LATE"

    base=[base_score(b) for b in boats]
    if any(x is None for x in base):return None,"BASE_FEATURE_MISSING"
    head=max(range(6),key=lambda i:(base[i],-i))

    base_seconds=sorted((base[i],-i,i) for i in range(6) if i!=head)
    base_seconds=[i+1 for _,__,i in reversed(base_seconds)]

    cand=[];safe=0;miss={}
    for i,b in enumerate(boats):
        if i==head:continue
        s,ok,status=candidate_score(date_s,b,profile,index)
        cand.append((s,-i,i))
        if ok:safe+=1
        elif status:miss[status]=miss.get(status,0)+1
    cand.sort(reverse=True)
    cand_seconds=[i+1 for _,__,i in cand]

    payload={
      "schema":"boat-command-course-second-forward-v1",
      "version":"COURSE-SECOND-FORWARD-V1",
      "venue":key,"venueCode":code,"slug":slug,"date":date_s,"race":race,
      "generatedAt":now.isoformat(),"deadline":program.get("deadline"),
      "freezeCutoff":cutoff.isoformat(),"sourceFetchedAt":program.get("fetchedAt"),
      "selectedProfile":profile,
      "baseline":{"headLane":head+1,"secondRanking":base_seconds},
      "candidate":{"headLane":head+1,"secondRanking":cand_seconds},
      "safeJoinedSecondCandidates":safe,"joinMiss":miss,
      "laneAsCourseProxy":True,"actualEntryCourseUsed":False,
      "proxyWarning":"Same-number historical course profile is a lane proxy only; actual current entry course is not asserted.",
      "sources":{
        "programPath":str(program_path.relative_to(ROOT)).replace("\\","/"),
        "programSha256":sha256(program_path),
        "racerPeriodPath":str(period_path.relative_to(ROOT)).replace("\\","/"),
        "racerPeriodSha256":sha256(period_path),
        "auditPath":"research/racer-period-course-second-audit-v1.json",
        "auditSha256":sha256(REPORT),
      },
      "resultInput":False,"payoutInput":False,"postRaceRead":False,
      "researchOnly":True,"shadowOnly":True,
      "productionEnabled":False,"tryEnabled":False,"hardLockEnabled":False,"realMoney":False,
      "immutableAfterFirstWrite":True,
    }
    return payload,"OK"

def collect(date_s,now):
    pmap=profiles();index,period_path=period_index(date_s)
    summary={"date":date_s,"written":[],"existing":[],"skipped":[]}
    for code,(key,slug) in VENUES.items():
        profile=pmap.get(slug)
        if not profile:
            summary["skipped"].append({"slug":slug,"reason":"PROFILE_MISSING"});continue
        root=ROOT/"live"/slug/date_s/"program"
        if not root.exists():continue
        for pp in sorted(root.glob("race-*.json")):
            try:race=int(pp.stem.split("-")[-1])
            except Exception:continue
            dest=ROOT/"live"/slug/date_s/"shadow"/"course-second-v1"/f"race-{race}.json"
            if dest.exists():
                summary["existing"].append({"slug":slug,"race":race});continue
            try:
                program=load(pp)
                payload,status=freeze_one(program,pp,code,key,slug,date_s,race,profile,index,period_path,now)
                if payload is None:
                    summary["skipped"].append({"slug":slug,"race":race,"reason":status});continue
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
                summary["written"].append({"slug":slug,"race":race,"head":payload["baseline"]["headLane"],"baselineSecond":payload["baseline"]["secondRanking"][:2],"candidateSecond":payload["candidate"]["secondRanking"][:2]})
            except Exception as e:
                summary["skipped"].append({"slug":slug,"race":race,"reason":type(e).__name__+":"+str(e)})
    print("COURSE_SECOND_FORWARD",json.dumps(summary,ensure_ascii=False))
    return summary

def self_test():
    profile={"name":"TEST","twoW":.6,"threeW":.35,"stW":3.5,"rankW":.12,"fW":.08,"lW":.14,"periodStW":0}
    recs={}
    boats=[]
    for lane in range(1,7):
        reg=4000+lane
        boats.append({"lane":lane,"registration":reg,"class":"B1","nationalWinRate":5.0,"national2Rate":.30,"localWinRate":5.0,"local2Rate":.30,"motor2Rate":.35,"boat2Rate":.35})
        recs[reg]={"registration":reg,"class":"B1","periodAvgST":.18,"courses":[{"course":i,"entries":20,"twoRate":.30+(.01 if i==lane else 0),"avgST":.18,"avgStartRank":3.5,"finishCounts":[5,4,3,3,3,2],"fCount":0,"l0Count":0,"l1Count":0} for i in range(1,7)]}
    # Make lane 2 clearly strongest candidate for second.
    recs[4002]["courses"][1].update({"twoRate":.70,"avgST":.12,"avgStartRank":1.5})
    program={"venue":"KIRYU","venueCode":"01","date":"2026-09-25","race":1,"deadline":"10:00","fetchedAt":"2026-09-25T00:40:00Z","resultEndpointsIncluded":False,"resultIncluded":False,"exhibitionIncluded":False,"boats":boats}
    tmp=ROOT/"research"/"_course_second_selftest_program.json"
    tmp.parent.mkdir(parents=True,exist_ok=True);tmp.write_text(json.dumps(program),encoding="utf-8")
    period=ROOT/"racer-period-24"/"2026-2.json"
    now=dt.datetime(2026,9,25,9,50,tzinfo=JST)
    payload,status=freeze_one(program,tmp,"01","KIRYU","kiryu","2026-09-25",1,profile,recs,period,now)
    tmp.unlink(missing_ok=True)
    assert status=="OK" and payload
    assert payload["baseline"]["headLane"]==1
    assert payload["candidate"]["headLane"]==1
    assert payload["candidate"]["secondRanking"][0]==2
    assert payload["resultInput"] is False and payload["payoutInput"] is False and payload["postRaceRead"] is False
    assert payload["productionEnabled"] is False and payload["tryEnabled"] is False and payload["hardLockEnabled"] is False
    assert payload["laneAsCourseProxy"] is True and payload["actualEntryCourseUsed"] is False
    print("COURSE_SECOND_FORWARD_SELF_TEST_PASS")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--self-test",action="store_true")
    args=ap.parse_args()
    if args.self_test:self_test();return
    now=dt.datetime.now(JST)
    collect(args.date or now.date().isoformat(),now)

if __name__=="__main__":main()
