#!/usr/bin/env python3
"""Incremental research-only historical beforeinfo backfill for all 24 venues.

Design:
- source rows are the already-audited rich-history rows
- one official racelist identity check per venue-day
- then official beforeinfo is fetched for each rich race on that verified day
- only PRE-RACE exhibition/start-display/weather-water fields are stored
- outputs are immutable per venue-day, so retries never rewrite completed days
- no result/payout endpoint is requested
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import importlib.util
import json
import pathlib
import re
import sys
import time
import urllib.request
from collections import defaultdict

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT_ROOT=ROOT/"historical-beforeinfo-24"
STATUS=ROOT/"research/historical-beforeinfo-backfill-status-v1.json"

VENUES={
 "01":"kiryu","02":"toda","03":"edogawa","04":"heiwajima","05":"tamagawa","06":"hamanako",
 "07":"gamagori","08":"tokoname","09":"tsu","10":"mikuni","11":"biwako","12":"suminoe",
 "13":"amagasaki","14":"naruto","15":"marugame","16":"kojima","17":"miyajima","18":"tokuyama",
 "19":"shimonoseki","20":"wakamatsu","21":"ashiya","22":"fukuoka","23":"karatsu","24":"omura",
}

def import_module(name,path):
    spec=importlib.util.spec_from_file_location(name,path)
    mod=importlib.util.module_from_spec(spec);sys.modules[name]=mod;spec.loader.exec_module(mod)
    return mod

PROGRAM=import_module("venue_program_collector_v1",ROOT/"scripts/venue-program-collector-v1.py")
PRE=import_module("venue_pre_race_rich_collector_v1",ROOT/"scripts/venue-pre-race-rich-collector-v1.py")

def load(p):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))

def fetch(url,tag):
    req=urllib.request.Request(url,headers={"User-Agent":f"BOAT-COMMAND-HISTORICAL-BEFOREINFO-BACKFILL/{tag}"})
    t=time.monotonic()
    with urllib.request.urlopen(req,timeout=20) as resp:
        raw=resp.read()
    text=None
    for enc in ("utf-8","cp932","shift_jis","euc_jp"):
        try:
            text=raw.decode(enc);break
        except UnicodeDecodeError:
            pass
    if text is None:text=raw.decode("utf-8","replace")
    return text,round(time.monotonic()-t,3),len(raw)

def identity_ok(stored,pack):
    sb=sorted(stored.get("boats",[]),key=lambda x:int(x["lane"]))
    pb=sorted(pack.get("boats",[]),key=lambda x:int(x["lane"]))
    return len(sb)==6 and len(pb)==6 and all(
        int(sb[i]["registration"])==int(pb[i]["registration"])
        and str(sb[i]["class"])==str(pb[i]["class"])
        and int(pb[i]["lane"])==i+1
        for i in range(6)
    )

def rich_groups():
    groups=[]
    for code,slug in VENUES.items():
        p=ROOT/f"rich-history-24/{slug}-rich-history-v1.json"
        x=load(p)
        by=defaultdict(list)
        for r in x.get("races",[]):by[r["d"]].append(r)
        for date,rows in by.items():
            rows.sort(key=lambda r:int(r["r"]))
            groups.append({
              "code":code,"slug":slug,"venue":str(x.get("venue") or slug.upper()),
              "date":date,"rows":rows,
              "out":OUT_ROOT/slug/f"{date}.json"
            })
    groups.sort(key=lambda g:(g["date"],g["code"]))
    return groups

def verify_group(g):
    row=g["rows"][0];race=int(row["r"]);hd=g["date"].replace("-","")
    url=f"https://www.boatrace.jp/owpc/pc/race/racelist?hd={hd}&jcd={g['code']}&rno={race}"
    try:
        raw,elapsed,size=fetch(url,f"VERIFY-{g['code']}")
        pack=PROGRAM.parse_race(raw,g["date"],race,g["venue"],g["code"])
        ok=bool(pack and identity_ok(row,pack))
        return {**g,"verified":ok,"verifyUrl":url,"verifyElapsedSec":elapsed,"verifyBytes":size,
                "verifyError":None if ok else "IDENTITY_MISMATCH"}
    except Exception as e:
        return {**g,"verified":False,"verifyUrl":url,"verifyElapsedSec":None,"verifyBytes":None,
                "verifyError":type(e).__name__}

def compact_beforeinfo(g,row):
    race=int(row["r"]);hd=g["date"].replace("-","")
    url=f"https://www.boatrace.jp/owpc/pc/race/beforeinfo?hd={hd}&jcd={g['code']}&rno={race}"
    try:
        raw,elapsed,size=fetch(url,f"{g['code']}-{race}")
        tables=PRE.table_rows(raw)
        ex=PRE.parse_exhibition(tables)
        # Historical beforeinfo HTML uses an older table shape at several venues.
        # The live parser can therefore see the table but miss the exhibition
        # column. Fill only missing values using the conservative parser already
        # validated by historical-beforeinfo-field-probe-v1.
        for table in tables:
            joined=" ".join(" ".join(row) for row in table[:8])
            if "展示" not in joined or "タイム" not in joined or "体重" not in joined:
                continue
            for row_cells in table:
                if not row_cells or str(row_cells[0]).strip() not in set("123456"):
                    continue
                lane=int(str(row_cells[0]).strip())
                item=dict(ex.get(lane,{}) or {})
                if item.get("exhibitionTime") is None:
                    for cell in row_cells:
                        v=str(cell).strip()
                        if re.fullmatch(r"6\.\d{2}",v):
                            item["exhibitionTime"]=float(v);break
                if item.get("tilt") is None and len(row_cells)>5:
                    v=str(row_cells[5]).strip()
                    if re.fullmatch(r"-?\d+(?:\.\d+)?",v):
                        item["tilt"]=float(v)
                ex[lane]=item
            break
        starts=PRE.parse_start_exhibition(tables)
        water=PRE.parse_weather(raw)
        boats=[]
        for lane in range(1,7):
            x=ex.get(lane,{})
            boats.append({
              "lane":lane,
              "exhibitionTime":x.get("exhibitionTime"),
              "tilt":x.get("tilt"),
              "lapTime":x.get("lapTime"),
              "turnTime":x.get("turnTime"),
              "straightTime":x.get("straightTime"),
            })
        status={
          "exhibitionTimeCount":sum(1 for b in boats if b["exhibitionTime"] is not None),
          "tiltCount":sum(1 for b in boats if b["tilt"] is not None),
          "startExhibitionSTCount":len(starts),
          "weatherCoreCount":sum(1 for k in ("airTempC","windSpeedMps","waterTempC","waveHeightCm") if water.get(k) is not None),
          "lapTimeCount":sum(1 for b in boats if b["lapTime"] is not None),
          "turnTimeCount":sum(1 for b in boats if b["turnTime"] is not None),
          "straightTimeCount":sum(1 for b in boats if b["straightTime"] is not None),
        }
        return {
          "ok":True,
          "race":{
            "id":row["id"],"d":row["d"],"r":race,"t":row.get("t"),
            "sourceUrl":url,"fetchElapsedSec":elapsed,"sourceBytes":size,
            "boats":boats,
            "startExhibitionRaw":starts,
            "startExhibitionInterpretation":"DISPLAY_TOKENS_ONLY_NOT_ASSERTED_AS_ACTUAL_ENTRY_COURSES",
            "water":water,"fieldStatus":status,
            "captureComplete":status["startExhibitionSTCount"]>=6 and status["weatherCoreCount"]==4,
          }
        }
    except Exception as e:
        return {"ok":False,"race":race,"error":type(e).__name__}

def backfill_group(g,max_workers):
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as ex:
        vals=list(ex.map(lambda row:compact_beforeinfo(g,row),g["rows"]))
    good=[x["race"] for x in vals if x["ok"]]
    bad=[{"race":x["race"],"error":x["error"]} for x in vals if not x["ok"]]
    if not good:
        return {"written":False,"code":g["code"],"slug":g["slug"],"date":g["date"],"errors":bad}
    payload={
      "schema":"boat-command-historical-beforeinfo-day-v1",
      "researchOnly":True,"productionEnabled":False,"predictionInputEnabled":False,
      "resultEndpointsIncluded":False,"payoutEndpointsIncluded":False,
      "venue":g["venue"],"venueCode":g["code"],"slug":g["slug"],"date":g["date"],
      "identityVerification":{
        "method":"OFFICIAL_RACELIST_SAME_VENUE_DAY_FIRST_RICH_RACE",
        "verified":True,"racelistUrl":g["verifyUrl"],
        "verifyElapsedSec":g["verifyElapsedSec"],"verifyBytes":g["verifyBytes"]
      },
      "expectedRichRaces":len(g["rows"]),"capturedRaces":len(good),"errors":bad,
      "races":sorted(good,key=lambda x:int(x["r"]))
    }
    g["out"].parent.mkdir(parents=True,exist_ok=True)
    g["out"].write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    return {"written":True,"code":g["code"],"slug":g["slug"],"date":g["date"],
            "capturedRaces":len(good),"expectedRichRaces":len(g["rows"]),"errors":bad}

def scan_status(groups,last_run):
    total_days=len(groups);done_days=0;rich_races=sum(len(g["rows"]) for g in groups)
    captured=ex6=st6=wx4=partial=0
    venue=defaultdict(lambda:{
      "venueDaysTotal":0,"venueDaysDone":0,"richRaces":0,"capturedRaces":0,
      "exhibitionAnyRaces":0,"exhibition6of6Races":0,"tilt6of6Races":0,
      "startExhibitionST6of6Races":0,"weather4of4Races":0,
      "windDirectionPresentRaces":0,"weatherCodePresentRaces":0,
      "lapTimeAnyRaces":0,"turnTimeAnyRaces":0,"straightTimeAnyRaces":0,
      "partialCaptureRaces":0
    })
    for g in groups:
        v=venue[g["slug"]];v["venueDaysTotal"]+=1;v["richRaces"]+=len(g["rows"])
        if not g["out"].exists():continue
        done_days+=1;v["venueDaysDone"]+=1
        try:x=load(g["out"])
        except Exception:continue
        rs=x.get("races",[]);captured+=len(rs);v["capturedRaces"]+=len(rs)
        for r in rs:
            fs=r.get("fieldStatus",{});water=r.get("water",{})
            has_ex=fs.get("exhibitionTimeCount",0)>0
            full_ex=fs.get("exhibitionTimeCount")==6
            full_tilt=fs.get("tiltCount")==6
            full_st=fs.get("startExhibitionSTCount",0)>=6
            full_wx=fs.get("weatherCoreCount")==4
            is_partial=not bool(r.get("captureComplete"))
            ex6+=full_ex;st6+=full_st;wx4+=full_wx;partial+=is_partial
            v["exhibitionAnyRaces"]+=has_ex
            v["exhibition6of6Races"]+=full_ex
            v["tilt6of6Races"]+=full_tilt
            v["startExhibitionST6of6Races"]+=full_st
            v["weather4of4Races"]+=full_wx
            v["windDirectionPresentRaces"]+=bool(water.get("windDirectionCode"))
            v["weatherCodePresentRaces"]+=bool(water.get("weatherCode"))
            v["lapTimeAnyRaces"]+=fs.get("lapTimeCount",0)>0
            v["turnTimeAnyRaces"]+=fs.get("turnTimeCount",0)>0
            v["straightTimeAnyRaces"]+=fs.get("straightTimeCount",0)>0
            v["partialCaptureRaces"]+=is_partial
    for v in venue.values():
        v["venueDaysRemaining"]=v["venueDaysTotal"]-v["venueDaysDone"]
        v["richRacesRemaining"]=v["richRaces"]-v["capturedRaces"]
    return {
      "schema":"boat-command-historical-beforeinfo-backfill-status-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "resultEndpointsIncluded":False,"payoutEndpointsIncluded":False,
      "strategy":"IMMUTABLE_VENUE_DAY_FILES + ONE_RACELIST_IDENTITY_CHECK_PER_DAY",
      "totals":{
        "venueDaysTotal":total_days,"venueDaysDone":done_days,
        "richRaces":rich_races,"capturedRaces":captured,
        "exhibition6of6Races":ex6,"startExhibitionST6of6Races":st6,
        "weather4of4Races":wx4,"partialCaptureRaces":partial
      },
      "venues":dict(sorted(venue.items())),
      "lastRun":last_run
    }

def self_test():
    groups=rich_groups()
    assert len(groups)>1000
    assert all(g["out"].name.endswith(".json") for g in groups)
    assert all(g["rows"]==sorted(g["rows"],key=lambda r:int(r["r"])) for g in groups)
    assert not any("post" in str(g["out"]).lower() for g in groups)
    print("HISTORICAL_BEFOREINFO_BACKFILL_SELF_TEST_PASS",len(groups))

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--max-groups",type=int,default=8)
    ap.add_argument("--verify-candidates",type=int,default=16)
    ap.add_argument("--workers",type=int,default=4)
    ap.add_argument("--one-per-venue",action="store_true")
    ap.add_argument("--balanced",action="store_true")
    ap.add_argument("--self-test",action="store_true")
    args=ap.parse_args()
    if args.self_test:self_test();return
    groups=rich_groups()
    missing=[g for g in groups if not g["out"].exists()]
    if args.one_per_venue or args.balanced:
        first={}
        done=defaultdict(int)
        for g in groups:
            if g["out"].exists(): done[g["slug"]]+=1
        for g in missing:
            first.setdefault(g["slug"],g)
        if args.balanced:
            missing=sorted(first.values(),key=lambda g:(done[g["slug"]],g["slug"]))
        else:
            missing=[first[k] for k in sorted(first)]
    candidates=missing[:max(args.max_groups,args.verify_candidates)]
    verified=[]
    if candidates:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as ex:
            vals=list(ex.map(verify_group,candidates))
        verified=[g for g in vals if g["verified"]][:args.max_groups]
    results=[]
    for g in verified:
        results.append(backfill_group(g,args.workers))
    run={
      "ranAt":dt.datetime.now(dt.timezone.utc).isoformat(),
      "maxGroups":args.max_groups,"verifyCandidates":len(candidates),
      "verifiedCandidates":sum(1 for g in (vals if candidates else []) if g["verified"]),
      "selectedGroups":[{"code":g["code"],"slug":g["slug"],"date":g["date"]} for g in verified],
      "results":results,
      "verificationFailures":[
        {"code":g["code"],"slug":g["slug"],"date":g["date"],"error":g["verifyError"]}
        for g in (vals if candidates else []) if not g["verified"]
      ]
    }
    status=scan_status(groups,run)
    STATUS.parent.mkdir(parents=True,exist_ok=True)
    STATUS.write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("HISTORICAL_BEFOREINFO_BACKFILL",json.dumps(status["totals"],ensure_ascii=False))
    print("LAST_RUN",json.dumps(run,ensure_ascii=False))

if __name__=="__main__":main()
