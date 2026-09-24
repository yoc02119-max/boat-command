#!/usr/bin/env python3
"""Transparent BOAT COMMAND data-coverage ledger.

Purpose: answer, per venue, exactly what data is already stored and how many
races/boat rows it covers. This is reporting only; it never feeds predictions.

Sources:
- rich-history-24/*-rich-history-v1.json
- racer-period-24/audit-v1.json
- historical-beforeinfo-24/<slug>/*.json
- live/<slug>/*/program/race-*.json
- live/<slug>/*/pre/race-*-pack.json
- live/<slug>/*/pre-rich/race-*.json
"""
from __future__ import annotations

import glob
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT_JSON=ROOT/"research/venue-data-coverage-ledger-v1.json"
OUT_MD=ROOT/"research/venue-data-coverage-ledger-v1.md"

VENUES={
 "01":"kiryu","02":"toda","03":"edogawa","04":"heiwajima","05":"tamagawa","06":"hamanako",
 "07":"gamagori","08":"tokoname","09":"tsu","10":"mikuni","11":"biwako","12":"suminoe",
 "13":"amagasaki","14":"naruto","15":"marugame","16":"kojima","17":"miyajima","18":"tokuyama",
 "19":"shimonoseki","20":"wakamatsu","21":"ashiya","22":"fukuoka","23":"karatsu","24":"omura",
}

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def count_present(rows,field):
    return sum(1 for x in rows if x.get(field) is not None and x.get(field)!="")

def historical_beforeinfo(slug):
    files=sorted(glob.glob(str(ROOT/f"historical-beforeinfo-24/{slug}/*.json")))
    races=ex6=st6=wx4=lap6=turn6=straight6=partial=0
    date_first=date_last=None
    for p in files:
        try:x=load(p)
        except Exception:continue
        if x.get("schema")!="boat-command-historical-beforeinfo-day-v1":continue
        d=x.get("date")
        if d:
            date_first=min(date_first,d) if date_first else d
            date_last=max(date_last,d) if date_last else d
        for r in x.get("races",[]):
            races+=1
            s=r.get("fieldStatus",{})
            ex6+=int(s.get("exhibitionTimeCount")==6)
            st6+=int(s.get("startExhibitionSTCount",0)>=6)
            wx4+=int(s.get("weatherCoreCount")==4)
            lap6+=int(s.get("lapTimeCount")==6)
            turn6+=int(s.get("turnTimeCount")==6)
            straight6+=int(s.get("straightTimeCount")==6)
            partial+=int(not bool(r.get("captureComplete")))
    return {
      "venueDayFiles":len(files),"capturedRaces":races,
      "firstDate":date_first,"lastDate":date_last,
      "exhibitionTime6of6Races":ex6,
      "startExhibitionST6of6Races":st6,
      "weatherCore4of4Races":wx4,
      "lapTime6of6Races":lap6,
      "turnTime6of6Races":turn6,
      "straightTime6of6Races":straight6,
      "partialCaptureRaces":partial,
    }

def current_program(slug):
    files=sorted(glob.glob(str(ROOT/f"live/{slug}/*/program/race-*.json")))
    races=0;boat_rows=0;fields=Counter();dates=set()
    names=("registration","name","class","fCount","lCount","avgST",
           "nationalWinRate","national2Rate","national3Rate",
           "localWinRate","local2Rate","local3Rate",
           "motor","motor2Rate","boat","boat2Rate")
    for p in files:
        try:x=load(p)
        except Exception:continue
        if x.get("schema")!="boat-command-program-pack-v1":continue
        if x.get("resultEndpointsIncluded") is not False:continue
        races+=1
        if x.get("date"):dates.add(x["date"])
        boats=x.get("boats",[])
        boat_rows+=len(boats)
        for b in boats:
            for k in names:
                if b.get(k) is not None and b.get(k)!="":fields[k]+=1
    return {
      "races":races,"boatRows":boat_rows,"dateCount":len(dates),
      "firstDate":min(dates) if dates else None,"lastDate":max(dates) if dates else None,
      "boatFieldRows":{k:fields[k] for k in names},
    }

def pre_race_packs(slug):
    paths=sorted(set(
      glob.glob(str(ROOT/f"live/{slug}/*/pre/race-*-pack.json"))+
      glob.glob(str(ROOT/f"live/{slug}/*/pre-rich/race-*.json"))
    ))
    valid=ex6=st6=wx4=lap6=turn6=straight6=0;dates=set();schemas=Counter()
    for p in paths:
        try:x=load(p)
        except Exception:continue
        if x.get("resultEndpointsIncluded") is not False:continue
        if x.get("predictionEnabled") not in (False,None):continue
        boats=x.get("boats",[])
        if len(boats)!=6:continue
        valid+=1;schemas[x.get("schema") or "UNKNOWN"]+=1
        if x.get("date"):dates.add(x["date"])
        ex6+=int(sum(1 for b in boats if b.get("exhibitionTime") is not None)==6)
        start=x.get("startExhibition") or x.get("startExhibitionRaw") or []
        st6+=int(len(start)>=6)
        water=x.get("water") or x.get("weather") or {}
        wx4+=int(all(water.get(k) is not None for k in ("airTempC","windSpeedMps","waterTempC","waveHeightCm")))
        lap6+=int(sum(1 for b in boats if b.get("lapTime") is not None)==6)
        turn6+=int(sum(1 for b in boats if b.get("turnTime") is not None)==6)
        straight6+=int(sum(1 for b in boats if b.get("straightTime") is not None)==6)
    return {
      "validResultBlindPacks":valid,"dateCount":len(dates),
      "firstDate":min(dates) if dates else None,"lastDate":max(dates) if dates else None,
      "schemas":dict(schemas),
      "exhibitionTime6of6Races":ex6,
      "startExhibitionST6of6Races":st6,
      "weatherCore4of4Races":wx4,
      "lapTime6of6Races":lap6,
      "turnTime6of6Races":turn6,
      "straightTime6of6Races":straight6,
    }

def main():
    period=load(ROOT/"racer-period-24/audit-v1.json")
    period_by={x["slug"]:x for x in period.get("venuesData",[])}
    rich_audit=load(ROOT/"rich-history-24/venue-rich-history-audit-v1.json")
    rich_by={x["slug"]:x for x in rich_audit.get("venues",[])}
    venues=[]
    for code,slug in VENUES.items():
        rich=load(ROOT/f"rich-history-24/{slug}-rich-history-v1.json")
        rows=rich.get("races",[])
        boat_rows=sum(len(r.get("boats",[])) for r in rows)
        p=period_by.get(slug,{})
        venues.append({
          "code":code,"slug":slug,
          "historyRich":{
            "races":len(rows),"boatRows":boat_rows,
            "baseRaces":rich_by.get(slug,{}).get("baseRaces"),
            "missing":rich_by.get(slug,{}).get("missing"),
            "rejected":rich_by.get(slug,{}).get("rejected"),
            "fieldsActuallyStored":[
              "lane","registration","class","nationalWinRate","national2Rate",
              "localWinRate","local2Rate","motor","motor2Rate","boat","boat2Rate",
              "raceType","historicalResultLabel","historicalPayoutLabel"
            ],
          },
          "racerPeriodSafeJoin":{
            "boatRows":p.get("boatRows",0),
            "safeJoinedBoatRows":p.get("classMatchRows",0),
            "safeJoinCoverage":p.get("safeJoinCoverage"),
            "periodAvgSTCoverage":p.get("fieldCoverage",{}).get("periodAvgST"),
            "period3RateCoverage":p.get("fieldCoverage",{}).get("period3RateDerived"),
            "periodFLCoverage":min(
                p.get("fieldCoverage",{}).get("periodFCountDerived") or 0,
                p.get("fieldCoverage",{}).get("periodLCountDerived") or 0),
            "courseProfileCoverage":p.get("fieldCoverage",{}).get("courses"),
            "fields":[
              "periodAvgST","periodFCountDerived","periodLCountDerived","period3RateDerived",
              "currentAbility","previousAbility","course1-6 entries/twoRate/avgST/avgStartRank/finishCounts"
            ],
            "joinPolicy":"race-date half-year + registration + class match"
          },
          "historicalBeforeinfo":historical_beforeinfo(slug),
          "currentProgram":current_program(slug),
          "currentPreRaceDetailed":pre_race_packs(slug),
          "stillNotReliablyCovered":[
            "actualEntryCourse",
            "actualCourseChange",
            "historicalPreRaceOdds",
            "historicalLapTime",
            "historicalTurnTime",
            "historicalStraightTime"
          ],
        })
    out={
      "schema":"boat-command-venue-data-coverage-ledger-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "principle":"Report exact stored counts by venue and data family; never substitute a percentage for missing field detail.",
      "preRaceSafety":{
        "racerPeriod":"period statistics are selected only from the half-year record whose calculation window ends before the target race period",
        "historicalBeforeinfo":"official historical beforeinfo; no result/payout endpoint is fetched",
        "currentProgram":"resultEndpointsIncluded=false",
      },
      "venues":venues,
      "totals":{
        "historyRichRaces":sum(v["historyRich"]["races"] for v in venues),
        "historyRichBoatRows":sum(v["historyRich"]["boatRows"] for v in venues),
        "racerPeriodSafeJoinedBoatRows":sum(v["racerPeriodSafeJoin"]["safeJoinedBoatRows"] for v in venues),
        "historicalBeforeinfoRaces":sum(v["historicalBeforeinfo"]["capturedRaces"] for v in venues),
        "historicalExhibition6of6Races":sum(v["historicalBeforeinfo"]["exhibitionTime6of6Races"] for v in venues),
        "historicalStartST6of6Races":sum(v["historicalBeforeinfo"]["startExhibitionST6of6Races"] for v in venues),
        "historicalWeather4of4Races":sum(v["historicalBeforeinfo"]["weatherCore4of4Races"] for v in venues),
        "currentDetailedPreRacePacks":sum(v["currentPreRaceDetailed"]["validResultBlindPacks"] for v in venues),
      }
    }
    assert len(venues)==24
    assert out["productionChanged"] is False and out["predictionInputChanged"] is False
    OUT_JSON.parent.mkdir(parents=True,exist_ok=True)
    OUT_JSON.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")

    lines=[
      "# BOAT COMMAND Data Coverage Ledger v1","",
      "Percentages are secondary. This table reports exact stored counts.","",
      "| code | venue | rich races | period safe boat rows | hist beforeinfo races | hist EX 6/6 | hist ST 6/6 | hist weather 4/4 | current detailed PRE |",
      "|---:|---|---:|---:|---:|---:|---:|---:|---:|"
    ]
    for v in venues:
        lines.append(
          f"| {v['code']} | {v['slug']} | {v['historyRich']['races']} | "
          f"{v['racerPeriodSafeJoin']['safeJoinedBoatRows']} | "
          f"{v['historicalBeforeinfo']['capturedRaces']} | "
          f"{v['historicalBeforeinfo']['exhibitionTime6of6Races']} | "
          f"{v['historicalBeforeinfo']['startExhibitionST6of6Races']} | "
          f"{v['historicalBeforeinfo']['weatherCore4of4Races']} | "
          f"{v['currentPreRaceDetailed']['validResultBlindPacks']} |"
        )
    lines += ["","## Known gaps","",
      "- Actual entry course / course changes are not yet reliably covered.",
      "- Historical pre-race odds are not yet reliably covered.",
      "- Historical lap / turn / straight timing is not reliably available from the current archive parser.",
      "",
      "This ledger is research-only and is not a prediction input."
    ]
    OUT_MD.write_text("\n".join(lines)+"\n",encoding="utf-8")
    print("VENUE_DATA_COVERAGE_LEDGER_PASS",json.dumps(out["totals"],ensure_ascii=False))

if __name__=="__main__":main()
