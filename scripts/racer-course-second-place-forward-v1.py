#!/usr/bin/env python3
"""Freeze forward SHADOW snapshots for course-specific second-place policy.

Policy source:
  research/racer-course-second-place-gated-v1.json
Only calibration-selected profile + validation gate are read. Final test
outcomes in that report are deliberately ignored.

No LIVE prediction, TRY, bankroll, HARD LOCK, existing SHADOW or FORWARD output
is modified.
"""
from __future__ import annotations
import argparse,datetime as dt,hashlib,importlib.util,json
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT=Path(__file__).resolve().parents[1]
POLICY_SOURCE=ROOT/"research/racer-course-second-place-gated-v1.json"
BASE=ROOT/"scripts/racer-course-second-place-gated-v1.py"
JST=ZoneInfo("Asia/Tokyo")
VENUES={
 "01":("kiryu","KIRYU"),"02":("toda","TODA"),"03":("edogawa","EDOGAWA"),
 "04":("heiwajima","HEIWAJIMA"),"05":("tamagawa","TAMAGAWA"),"06":("hamanako","HAMANAKO"),
 "07":("gamagori","GAMAGORI"),"08":("tokoname","TOKONAME"),"09":("tsu","TSU"),
 "10":("mikuni","MIKUNI"),"11":("biwako","BIWAKO"),"12":("suminoe","SUMINOE"),
 "13":("amagasaki","AMAGASAKI"),"14":("naruto","NARUTO"),"15":("marugame","MARUGAME"),
 "16":("kojima","KOJIMA"),"17":("miyajima","MIYAJIMA"),"18":("tokuyama","TOKUYAMA"),
 "19":("shimonoseki","SHIMONOSEKI"),"20":("wakamatsu","WAKAMATSU"),"21":("ashiya","ASHIYA"),
 "22":("fukuoka","FUKUOKA"),"23":("karatsu","KARATSU"),"24":("omura","OMURA")
}

spec=importlib.util.spec_from_file_location("course_gated",BASE)
C=importlib.util.module_from_spec(spec);spec.loader.exec_module(C)
R=C.R

def load(p):return json.loads(Path(p).read_text(encoding="utf-8"))
def sha256(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()

def now_jst():return dt.datetime.now(JST)
def deadline_dt(date_s,hm):
    try:
        h,m=map(int,str(hm).split(":"))
        d=dt.date.fromisoformat(date_s)
        return dt.datetime(d.year,d.month,d.day,h,m,tzinfo=JST)
    except Exception:return None

def policy():
    x=load(POLICY_SOURCE)
    assert x["schema"]=="boat-command-racer-course-second-place-gated-v1"
    assert x["researchOnly"] is True and x["productionChanged"] is False
    out={}
    for v in x["venuesData"]:
        slug=v["slug"]
        out[slug]={
          "enabled":bool(v["validation"]["candidateEnabled"]),
          "profile":v["selectedProfile"],
          "validationDecision":v["validation"]["decision"],
          "selectionUsesFinalTest":False
        }
    assert len(out)==24
    return out

def valid_program(x,code,key,race,date):
    if not isinstance(x,dict):return False
    if x.get("venue")!=key or str(x.get("venueCode"))!=code:return False
    if str(x.get("date"))!=date or int(x.get("race") or 0)!=race:return False
    if x.get("resultEndpointsIncluded") is not False:return False
    if x.get("resultIncluded") is not False:return False
    if x.get("exhibitionIncluded") is not False:return False
    boats=sorted(x.get("boats") or [],key=lambda b:int(b.get("lane") or 0))
    return len(boats)==6 and [int(b.get("lane") or 0) for b in boats]==[1,2,3,4,5,6]

def compute(program,slug,pol):
    boats=sorted(program["boats"],key=lambda b:int(b["lane"]))
    base=[R.base_score(b) for b in boats]
    if any(x is None for x in base):raise ValueError("BASE_SCORE_MISSING")
    first=max(range(6),key=lambda i:(base[i],-i))

    base_second=[i for i in range(6) if i!=first]
    base_second.sort(key=lambda i:(base[i],-i),reverse=True)

    enabled=bool(pol["enabled"])
    safe=0;miss={};cand=[]
    for i,b in enumerate(boats):
        if i==first:continue
        if enabled:
            s,ok,status=C.candidate_score(program["date"],b,pol["profile"])
        else:
            s,ok,status=base[i],False,"VENUE_GATE_OFF"
        cand.append((s,-i,i))
        if ok:safe+=1
        elif status:miss[status]=miss.get(status,0)+1
    cand.sort(reverse=True)
    cand_second=[i for _,__,i in cand]

    return {
      "predictedFirst":first+1,
      "baselineSecondRanking":[i+1 for i in base_second],
      "candidateSecondRanking":[i+1 for i in cand_second],
      "baselinePair":f"{first+1}-{base_second[0]+1}",
      "candidatePair":f"{first+1}-{cand_second[0]+1}",
      "baselineSecondTop2":[i+1 for i in base_second[:2]],
      "candidateSecondTop2":[i+1 for i in cand_second[:2]],
      "changed":base_second!=cand_second,
      "venueGateEnabled":enabled,
      "safeCourseJoinedCandidates":safe,
      "joinMiss":miss,
    }

def freeze(date,now,min_margin=3):
    pol=policy();writes=kept=skips=0
    for code,(slug,key) in VENUES.items():
        pinfo=pol[slug]
        for race in range(1,13):
            pp=ROOT/f"live/{slug}/{date}/program/race-{race}.json"
            if not pp.exists():continue
            program=load(pp)
            if not valid_program(program,code,key,race,date):
                skips+=1;continue
            deadline=deadline_dt(date,program.get("deadline"))
            if deadline is None:skips+=1;continue
            margin=(deadline-now).total_seconds()/60
            if margin<min_margin:continue
            src=dt.datetime.fromisoformat(str(program.get("fetchedAt") or "").replace("Z","+00:00"))
            if src.tzinfo is None:src=src.replace(tzinfo=dt.timezone.utc)
            if src.astimezone(JST)>deadline-dt.timedelta(minutes=min_margin):
                skips+=1;continue

            outp=ROOT/f"live/{slug}/{date}/shadow/course-second-place-v1/race-{race}.json"
            if outp.exists():
                kept+=1;continue
            comp=compute(program,slug,pinfo)
            payload={
              "schema":"boat-command-course-second-place-forward-v1",
              "version":"COURSE-SECOND-PLACE-FORWARD-V1",
              "venue":key,"venueCode":code,"slug":slug,"date":date,"race":race,
              "generatedAt":now.astimezone(dt.timezone.utc).isoformat().replace("+00:00","Z"),
              "deadline":program.get("deadline"),"freezeMarginMinutes":min_margin,
              "programFetchedAt":program.get("fetchedAt"),
              "programPath":str(pp.relative_to(ROOT)),
              "programSha256":sha256(pp),
              "policySource":str(POLICY_SOURCE.relative_to(ROOT)),
              "policySourceSha256":sha256(POLICY_SOURCE),
              "policySelectionUsesFinalTest":False,
              "selectedProfile":pinfo["profile"],
              "validationDecision":pinfo["validationDecision"],
              **comp,
              "resultInput":False,"payoutInput":False,"postRaceRead":False,
              "exhibitionInput":False,"researchOnly":True,"shadowOnly":True,
              "productionEnabled":False,"tryEnabled":False,"cashNeutral":True,
              "realMoney":False,"immutableAfterFirstWrite":True
            }
            outp.parent.mkdir(parents=True,exist_ok=True)
            outp.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            writes+=1
            print("COURSE_SECOND_FORWARD_WRITE",slug,race,comp["venueGateEnabled"],comp["changed"],comp["candidatePair"])
    print(json.dumps({"date":date,"writes":writes,"kept":kept,"skips":skips},ensure_ascii=False))

def self_test():
    x=load(POLICY_SOURCE)
    assert x["schema"]=="boat-command-racer-course-second-place-gated-v1"
    p=policy();assert len(p)==24
    assert all(v["selectionUsesFinalTest"] is False for v in p.values())
    print("COURSE_SECOND_FORWARD_SELF_TEST_PASS",sum(1 for v in p.values() if v["enabled"]))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--self-test",action="store_true")
    args=ap.parse_args()
    if args.self_test:self_test();return
    now=now_jst();date=args.date or now.date().isoformat()
    freeze(date,now)

if __name__=="__main__":main()
