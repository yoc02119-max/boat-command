#!/usr/bin/env python3
"""Audit recoverable historical PRE-RACE fields from BoatraceCSV.

This is a research-only coverage audit against BOAT COMMAND's already accepted
27k rich-history rows. It does NOT mutate rich history or any prediction input.

Source provenance:
- Dataset repository: BoatraceCSV/boatracecsv.github.io (MIT repository)
- Upstream documented by that project: race.boatcast.jp / BOAT RACE data
- JOIN key: YYYYMMDD + venue code + race number
- Hard identity gate: all six registration numbers in race_cards must match the
  accepted BOAT COMMAND rich-history row before any preview row is counted.

No result or payout dataset is requested by this script.
"""
from __future__ import annotations

import csv
import datetime as dt
import glob
import hashlib
import io
import json
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/boatracecsv-core-backfill-audit-v1.json"
BASE="https://boatracecsv.github.io/data"
SOURCES={
    "race_cards":"programs/race_cards",
    "tkz":"previews/tkz",
    "stt":"previews/stt",
    "sui":"previews/sui",
    "original_exhibition":"previews/original_exhibition",
}
VENUES={
 "01":"kiryu","02":"toda","03":"edogawa","04":"heiwajima","05":"tamagawa","06":"hamanako",
 "07":"gamagori","08":"tokoname","09":"tsu","10":"mikuni","11":"biwako","12":"suminoe",
 "13":"amagasaki","14":"naruto","15":"marugame","16":"kojima","17":"miyajima","18":"tokuyama",
 "19":"shimonoseki","20":"wakamatsu","21":"ashiya","22":"fukuoka","23":"karatsu","24":"omura",
}
RACE_CARD_FIELDS={
 "name":"選手名","period":"期別","branch":"支部","birthplace":"出身地","age":"年齢","class":"級別",
 "prizeExclusion":"賞除","fCount":"F本数","lCount":"L本数","avgST":"全国平均ST",
 "nationalWinRate":"全国勝率","national2Rate":"全国2連対率","national3Rate":"全国3連対率",
 "localWinRate":"当地勝率","local2Rate":"当地2連対率","local3Rate":"当地3連対率",
 "motor":"モーター番号","motor2Rate":"モーター2連対率","motor3Rate":"モーター3連対率",
 "boat":"ボート番号","boat2Rate":"ボート2連対率","boat3Rate":"ボート3連対率","quickRace":"早見",
}
TKZ_FIELDS={"weightKg":"体重(kg)","adjustWeightKg":"体重調整(kg)","exhibitionTime":"展示タイム","tilt":"チルト"}
STT_FIELDS={"exhibitionCourse":"コース","exhibitionST":"スタート展示"}
SUI_FIELDS={
 "weatherObservationTime":"気象観測時刻","windSpeedMps":"風速(m)","windDirection":"風向",
 "waveHeightCm":"波の高さ(cm)","weather":"天候","airTempC":"気温(℃)","waterTempC":"水温(℃)",
}

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def nonblank(v):
    return v is not None and str(v).strip()!=""

def intish(v):
    s=str(v or "").strip()
    if not s:return None
    try:return int(float(s))
    except Exception:return None

def race_code(date_s,code,race):
    return date_s.replace("-","")+str(code).zfill(2)+f"{int(race):02d}"

def build_targets():
    by_date=defaultdict(dict);venue_counts=Counter()
    total=0
    for p in sorted((ROOT/"rich-history-24").glob("*-rich-history-v1.json")):
        if p.name=="venue-rich-history-audit-v1.json":continue
        x=load(p); code=str(x["venueCode"]).zfill(2)
        slug=p.name.removesuffix("-rich-history-v1.json")
        assert VENUES[code]==slug
        for r in x.get("races",[]):
            boats=sorted(r.get("boats",[]),key=lambda b:int(b.get("lane") or 0))
            if len(boats)!=6:continue
            regs=[int(b["registration"]) for b in boats]
            rc=race_code(r["d"],code,r["r"])
            by_date[r["d"]][rc]={
              "raceCode":rc,"date":r["d"],"code":code,"slug":slug,"race":int(r["r"]),
              "registrations":regs,"classes":[str(b.get("class") or "") for b in boats],
            }
            venue_counts[slug]+=1;total+=1
    return by_date,venue_counts,total

def url_for(source,date_s):
    y,m,d=date_s.split("-")
    return f"{BASE}/{SOURCES[source]}/{y}/{m}/{d}.csv"

def fetch_text(url,tries=3):
    last=None
    for attempt in range(tries):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"BOAT-COMMAND-BACKFILL-AUDIT/1.0"})
            with urllib.request.urlopen(req,timeout=30) as resp:
                raw=resp.read()
            return raw.decode("utf-8-sig"),hashlib.sha256(raw).hexdigest(),None
        except urllib.error.HTTPError as e:
            if e.code==404:return None,None,"HTTP_404"
            last=f"HTTP_{e.code}"
        except Exception as e:
            last=type(e).__name__
        time.sleep(.4*(attempt+1))
    return None,None,last or "FETCH_ERROR"

def detect_race_code(row):
    v=str(row.get("レースコード") or "").strip()
    return v if len(v)==12 and v.isdigit() else None

def fetch_relevant(source,date_s,target_codes):
    url=url_for(source,date_s)
    text,sha,error=fetch_text(url)
    if text is None:
        return source,date_s,{},{"url":url,"status":error,"sha256":None,"rows":0}
    rows={}
    try:
        for row in csv.DictReader(io.StringIO(text)):
            rc=detect_race_code(row)
            if rc in target_codes: rows[rc]=row
        return source,date_s,rows,{"url":url,"status":"OK","sha256":sha,"rows":len(rows)}
    except Exception as e:
        return source,date_s,{},{"url":url,"status":"PARSE_"+type(e).__name__,"sha256":sha,"rows":0}

def registrations_from_race_card(row):
    return [intish(row.get(f"艇{i}_登録番号")) for i in range(1,7)]

def class_from_race_card(row):
    return [str(row.get(f"艇{i}_級別") or "").strip() for i in range(1,7)]

def add_boat_fields(counter,row,defs):
    for i in range(1,7):
        for key,suffix in defs.items():
            if nonblank(row.get(f"艇{i}_{suffix}")):counter[key]+=1

def full6(row,defs):
    return {key:all(nonblank(row.get(f"艇{i}_{suffix}")) for i in range(1,7)) for key,suffix in defs.items()}

def current_meet_stats(row):
    slots=0; entry=0; st=0; finish=0
    boats_any=0
    for i in range(1,7):
        any_boat=False
        for d in range(1,8):
            for s in range(1,3):
                pre=f"艇{i}_節D{d}走{s}_"
                if nonblank(row.get(pre+"R番号")):
                    slots+=1;any_boat=True
                    if nonblank(row.get(pre+"進入")):entry+=1
                    if nonblank(row.get(pre+"ST")):st+=1
                    if nonblank(row.get(pre+"着順")):finish+=1
        if any_boat:boats_any+=1
    return {"slots":slots,"entry":entry,"st":st,"finish":finish,"boatsWithAny":boats_any}

def original_stats(row):
    measure_count=intish(row.get("計測数")) or 0
    labels=[str(row.get(f"計測項目{i}") or "").strip() for i in range(1,4)]
    counts=[]
    for j in range(1,4):
        counts.append(sum(1 for i in range(1,7) if nonblank(row.get(f"艇{i}_値{j}"))))
    names=sum(1 for i in range(1,7) if nonblank(row.get(f"艇{i}_選手名")))
    return {"measureCount":measure_count,"labels":labels,"valueCounts":counts,"nameCount":names}

def pct(n,d):
    return round(n/d,6) if d else None

def fresh_venue(slug,code,target):
    return {
      "slug":slug,"code":code,"targetRaces":target,
      "raceCards":{"rows":0,"identityMatched":0,"identityRejected":0,"classMismatchRaces":0,
                   "boatRows":0,"fieldPresent":Counter(),"fieldFull6":Counter(),
                   "racesWithAnyCurrentMeetHistory":0,"currentMeetSlots":0,
                   "currentMeetEntryValues":0,"currentMeetSTValues":0,"currentMeetFinishValues":0},
      "tkz":{"rows":0,"accepted":0,"fieldPresent":Counter(),"fieldFull6":Counter()},
      "stt":{"rows":0,"accepted":0,"fieldPresent":Counter(),"fieldFull6":Counter()},
      "sui":{"rows":0,"accepted":0,"fieldPresent":Counter()},
      "originalExhibition":{"rows":0,"accepted":0,"measureCount":Counter(),"full6ByValueIndex":Counter(),"labels":Counter()},
      "dateMin":None,"dateMax":None,
    }

def main():
    targets,venue_target,total_targets=build_targets()
    assert len(VENUES)==24 and total_targets>=27000
    results={}; fetch_meta=[]
    jobs=[]
    with ThreadPoolExecutor(max_workers=18) as ex:
        for date_s,td in sorted(targets.items()):
            codes=set(td)
            for source in SOURCES:
                jobs.append(ex.submit(fetch_relevant,source,date_s,codes))
        for fut in as_completed(jobs):
            source,date_s,rows,meta=fut.result()
            results[(source,date_s)]=rows
            fetch_meta.append({"source":source,"date":date_s,**meta})

    venues={slug:fresh_venue(slug,code,venue_target[slug]) for code,slug in VENUES.items()}
    overall_rejects=[]
    accepted_race_codes=set()

    # Identity gate using race_cards.
    for date_s,td in sorted(targets.items()):
        rcrows=results.get(("race_cards",date_s),{})
        for rc,t in td.items():
            v=venues[t["slug"]]
            row=rcrows.get(rc)
            if not row:continue
            v["raceCards"]["rows"]+=1
            regs=registrations_from_race_card(row)
            if regs!=t["registrations"]:
                v["raceCards"]["identityRejected"]+=1
                if len(overall_rejects)<100:
                    overall_rejects.append({"raceCode":rc,"reason":"REGISTRATION_MISMATCH","expected":t["registrations"],"actual":regs})
                continue
            v["raceCards"]["identityMatched"]+=1;v["raceCards"]["boatRows"]+=6
            accepted_race_codes.add(rc)
            classes=class_from_race_card(row)
            if classes!=t["classes"]:v["raceCards"]["classMismatchRaces"]+=1
            add_boat_fields(v["raceCards"]["fieldPresent"],row,RACE_CARD_FIELDS)
            for key,is_full in full6(row,RACE_CARD_FIELDS).items():
                if is_full:v["raceCards"]["fieldFull6"][key]+=1
            cm=current_meet_stats(row)
            if cm["slots"]>0:v["raceCards"]["racesWithAnyCurrentMeetHistory"]+=1
            v["raceCards"]["currentMeetSlots"]+=cm["slots"]
            v["raceCards"]["currentMeetEntryValues"]+=cm["entry"]
            v["raceCards"]["currentMeetSTValues"]+=cm["st"]
            v["raceCards"]["currentMeetFinishValues"]+=cm["finish"]
            v["dateMin"]=date_s if v["dateMin"] is None or date_s<v["dateMin"] else v["dateMin"]
            v["dateMax"]=date_s if v["dateMax"] is None or date_s>v["dateMax"] else v["dateMax"]

    # Preview sources count only behind the race-card identity gate.
    for date_s,td in sorted(targets.items()):
        for rc,t in td.items():
            v=venues[t["slug"]]
            for source,defs in (("tkz",TKZ_FIELDS),("stt",STT_FIELDS)):
                row=results.get((source,date_s),{}).get(rc)
                if row:v[source]["rows"]+=1
                if not row or rc not in accepted_race_codes:continue
                v[source]["accepted"]+=1
                add_boat_fields(v[source]["fieldPresent"],row,defs)
                for key,is_full in full6(row,defs).items():
                    if is_full:v[source]["fieldFull6"][key]+=1
            row=results.get(("sui",date_s),{}).get(rc)
            if row:v["sui"]["rows"]+=1
            if row and rc in accepted_race_codes:
                v["sui"]["accepted"]+=1
                for key,col in SUI_FIELDS.items():
                    if nonblank(row.get(col)):v["sui"]["fieldPresent"][key]+=1
            row=results.get(("original_exhibition",date_s),{}).get(rc)
            if row:v["originalExhibition"]["rows"]+=1
            if row and rc in accepted_race_codes:
                v["originalExhibition"]["accepted"]+=1
                st=original_stats(row)
                v["originalExhibition"]["measureCount"][str(st["measureCount"])]+=1
                for idx,n in enumerate(st["valueCounts"],1):
                    if n==6:v["originalExhibition"]["full6ByValueIndex"][str(idx)]+=1
                for label in st["labels"]:
                    if label:v["originalExhibition"]["labels"][label]+=1

    out_venues=[]
    total=Counter()
    for code,slug in VENUES.items():
        v=venues[slug];rc=v["raceCards"];boat_den=rc["identityMatched"]*6
        item={
          "code":code,"slug":slug,"targetRaces":v["targetRaces"],"dateMin":v["dateMin"],"dateMax":v["dateMax"],
          "raceCards":{
            "rows":rc["rows"],"identityMatched":rc["identityMatched"],"identityRejected":rc["identityRejected"],
            "identityCoverage":pct(rc["identityMatched"],v["targetRaces"]),
            "classMismatchRaces":rc["classMismatchRaces"],"boatRows":boat_den,
            "fieldCoverage":{k:{"present":rc["fieldPresent"][k],"total":boat_den,"coverage":pct(rc["fieldPresent"][k],boat_den),
                                 "full6Races":rc["fieldFull6"][k]} for k in RACE_CARD_FIELDS},
            "currentMeetHistory":{
              "racesWithAny":rc["racesWithAnyCurrentMeetHistory"],
              "raceCoverage":pct(rc["racesWithAnyCurrentMeetHistory"],rc["identityMatched"]),
              "slots":rc["currentMeetSlots"],"entryValues":rc["currentMeetEntryValues"],
              "stValues":rc["currentMeetSTValues"],"finishValues":rc["currentMeetFinishValues"],
            },
          },
          "tkz":{
            "rows":v["tkz"]["rows"],"accepted":v["tkz"]["accepted"],
            "raceCoverage":pct(v["tkz"]["accepted"],v["targetRaces"]),
            "fieldCoverage":{k:{"present":v["tkz"]["fieldPresent"][k],"total":v["tkz"]["accepted"]*6,
                                 "coverage":pct(v["tkz"]["fieldPresent"][k],v["tkz"]["accepted"]*6),
                                 "full6Races":v["tkz"]["fieldFull6"][k]} for k in TKZ_FIELDS},
          },
          "stt":{
            "rows":v["stt"]["rows"],"accepted":v["stt"]["accepted"],
            "raceCoverage":pct(v["stt"]["accepted"],v["targetRaces"]),
            "fieldCoverage":{k:{"present":v["stt"]["fieldPresent"][k],"total":v["stt"]["accepted"]*6,
                                 "coverage":pct(v["stt"]["fieldPresent"][k],v["stt"]["accepted"]*6),
                                 "full6Races":v["stt"]["fieldFull6"][k]} for k in STT_FIELDS},
          },
          "sui":{
            "rows":v["sui"]["rows"],"accepted":v["sui"]["accepted"],
            "raceCoverage":pct(v["sui"]["accepted"],v["targetRaces"]),
            "fieldRaceCoverage":{k:{"presentRaces":v["sui"]["fieldPresent"][k],"totalRaces":v["sui"]["accepted"],
                                     "coverage":pct(v["sui"]["fieldPresent"][k],v["sui"]["accepted"])} for k in SUI_FIELDS},
          },
          "originalExhibition":{
            "rows":v["originalExhibition"]["rows"],"accepted":v["originalExhibition"]["accepted"],
            "raceCoverage":pct(v["originalExhibition"]["accepted"],v["targetRaces"]),
            "measureCountDistribution":dict(v["originalExhibition"]["measureCount"]),
            "full6RacesByValueIndex":dict(v["originalExhibition"]["full6ByValueIndex"]),
            "labelCounts":dict(v["originalExhibition"]["labels"]),
          },
        }
        out_venues.append(item)
        total["targetRaces"]+=v["targetRaces"];total["raceCardMatched"]+=rc["identityMatched"];total["raceCardRejected"]+=rc["identityRejected"]
        total["tkz"]+=v["tkz"]["accepted"];total["stt"]+=v["stt"]["accepted"];total["sui"]+=v["sui"]["accepted"];total["original"]+=v["originalExhibition"]["accepted"]
        for k in RACE_CARD_FIELDS:total["rc_"+k]+=rc["fieldPresent"][k]
        for k in TKZ_FIELDS:total["tkz_"+k]+=v["tkz"]["fieldPresent"][k]
        for k in STT_FIELDS:total["stt_"+k]+=v["stt"]["fieldPresent"][k]
        for k in SUI_FIELDS:total["sui_"+k]+=v["sui"]["fieldPresent"][k]

    ok_meta=[x for x in fetch_meta if x["status"]=="OK"]
    errors=Counter(f"{x['source']}:{x['status']}" for x in fetch_meta if x["status"]!="OK")
    rc_boats=total["raceCardMatched"]*6
    report={
      "schema":"boat-command-boatracecsv-core-backfill-audit-v1",
      "generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,
      "source":{
        "repository":"BoatraceCSV/boatracecsv.github.io","licenseClaimFromReadme":"MIT License",
        "baseUrl":BASE,
        "upstreamAsDocumentedBySource":"race.boatcast.jp / BOAT RACE related feeds",
        "thirdPartyDataset":True,
      },
      "safety":{
        "resultsFetched":False,"payoutsFetched":False,
        "previewAcceptedOnlyAfterSixRegistrationIdentityMatch":True,
        "existingRichHistoryMutated":False,
      },
      "totals":{
        "targetRaces":total["targetRaces"],
        "raceCardIdentityMatched":total["raceCardMatched"],
        "raceCardIdentityRejected":total["raceCardRejected"],
        "raceCardIdentityCoverage":pct(total["raceCardMatched"],total["targetRaces"]),
        "raceCardBoatRows":rc_boats,
        "raceCardFieldCoverage":{k:{"present":total["rc_"+k],"total":rc_boats,"coverage":pct(total["rc_"+k],rc_boats)} for k in RACE_CARD_FIELDS},
        "tkzAcceptedRaces":total["tkz"],"tkzRaceCoverage":pct(total["tkz"],total["targetRaces"]),
        "sttAcceptedRaces":total["stt"],"sttRaceCoverage":pct(total["stt"],total["targetRaces"]),
        "suiAcceptedRaces":total["sui"],"suiRaceCoverage":pct(total["sui"],total["targetRaces"]),
        "originalExhibitionAcceptedRaces":total["original"],"originalExhibitionRaceCoverage":pct(total["original"],total["targetRaces"]),
        "tkzBoatFieldCoverage":{k:{"present":total["tkz_"+k],"total":total["tkz"]*6,"coverage":pct(total["tkz_"+k],total["tkz"]*6)} for k in TKZ_FIELDS},
        "sttBoatFieldCoverage":{k:{"present":total["stt_"+k],"total":total["stt"]*6,"coverage":pct(total["stt_"+k],total["stt"]*6)} for k in STT_FIELDS},
        "suiFieldRaceCoverage":{k:{"presentRaces":total["sui_"+k],"totalRaces":total["sui"],"coverage":pct(total["sui_"+k],total["sui"])} for k in SUI_FIELDS},
      },
      "fetch":{"filesRequested":len(fetch_meta),"filesOK":len(ok_meta),"errors":dict(errors)},
      "identityRejectExamples":overall_rejects,
      "venues":out_venues,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("BOATRACECSV_CORE_BACKFILL_AUDIT",json.dumps(report["totals"],ensure_ascii=False))
    print("FETCH",json.dumps(report["fetch"],ensure_ascii=False))
    for v in out_venues:
        print(v["slug"],json.dumps({
          "target":v["targetRaces"],"raceCards":v["raceCards"]["identityMatched"],
          "avgST":v["raceCards"]["fieldCoverage"]["avgST"]["present"],
          "nat3":v["raceCards"]["fieldCoverage"]["national3Rate"]["present"],
          "local3":v["raceCards"]["fieldCoverage"]["local3Rate"]["present"],
          "tkz":v["tkz"]["accepted"],"stt":v["stt"]["accepted"],"sui":v["sui"]["accepted"],
          "original":v["originalExhibition"]["accepted"],
        },ensure_ascii=False))

if __name__=="__main__":main()
