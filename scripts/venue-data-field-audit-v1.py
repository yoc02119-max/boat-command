#!/usr/bin/env python3
"""Audit what BOAT COMMAND actually knows per race, by venue.

Research/reporting only. This script does not alter predictions, TRY, bankroll,
SHADOW/FORWARD, or any production model input.
"""
from __future__ import annotations

import glob
import json
from collections import Counter
from pathlib import Path

AUDIT = Path("rich-history-24/venue-rich-history-audit-v1.json")
OUT = Path("research/venue-data-field-audit-v1.json")

VENUES = {
    "01":"kiryu","02":"toda","03":"edogawa","04":"heiwajima","05":"tamagawa","06":"hamanako",
    "07":"gamagori","08":"tokoname","09":"tsu","10":"mikuni","11":"biwako","12":"suminoe",
    "13":"amagasaki","14":"naruto","15":"marugame","16":"kojima","17":"miyajima","18":"tokuyama",
    "19":"shimonoseki","20":"wakamatsu","21":"ashiya","22":"fukuoka","23":"karatsu","24":"omura",
}
BOAT_FIELDS = [
    "lane","registration","name","class","fCount","lCount","avgST",
    "nationalWinRate","national2Rate","national3Rate",
    "localWinRate","local2Rate","local3Rate",
    "motor","motor2Rate","boat","boat2Rate",
]
RACE_FIELDS = ["d","r","t"]
NOT_IN_RICH_SCHEMA = [
    "entryCourse","actualCourse","exhibitionTime","exhibitionST","turnTime","straightTime",
    "windSpeedMps","windDirection","waveHeightCm","weather","preRaceOdds",
]

def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))

def pct(n,d):
    return round(n/d,6) if d else None

def field_counts(rows, boat_fields=True):
    total=0
    counts=Counter()
    if boat_fields:
        for race in rows:
            for boat in race.get("boats",[]):
                total+=1
                for f in BOAT_FIELDS:
                    if f in boat and boat[f] is not None and boat[f] != "":
                        counts[f]+=1
    else:
        total=len(rows)
        for race in rows:
            for f in RACE_FIELDS:
                if f in race and race[f] is not None and race[f] != "":
                    counts[f]+=1
    return total,{f:{"present":counts[f],"total":total,"coverage":pct(counts[f],total)}
                  for f in (BOAT_FIELDS if boat_fields else RACE_FIELDS)}

def current_live(slug):
    rows=[]
    for p in sorted(glob.glob(f"live/{slug}/*/program/race-*.json")):
        try:
            x=load(p)
        except Exception:
            continue
        if x.get("schema")=="boat-command-program-pack-v1":
            rows.append({
                "date":x.get("date"),"race":x.get("race"),"boats":x.get("boats",[]),
                "deadline":x.get("deadline"),"raceType":x.get("raceType"),
                "exhibitionIncluded":x.get("exhibitionIncluded"),
            })
    total,fields=field_counts(rows,True)
    dates=sorted({r["date"] for r in rows if r.get("date")})
    return {
        "races":len(rows),"boatRows":total,"dateCount":len(dates),
        "firstDate":dates[0] if dates else None,"lastDate":dates[-1] if dates else None,
        "boatFieldCoverage":fields,
        "deadlinePresent":sum(1 for r in rows if r.get("deadline")) ,
        "exhibitionIncludedTrue":sum(1 for r in rows if r.get("exhibitionIncluded") is True),
    }

def main():
    base=load(AUDIT)
    by_slug={x["slug"]:x for x in base["venues"]}
    venues=[]
    global_hist=Counter(); global_live=Counter()
    hist_boats=live_boats=0
    for code,slug in VENUES.items():
        meta=by_slug[slug]
        path=Path(f"rich-history-24/{slug}-rich-history-v1.json")
        rich=load(path)
        rows=rich.get("races",[])
        btotal,bfields=field_counts(rows,True)
        rtotal,rfields=field_counts(rows,False)
        for f,x in bfields.items(): global_hist[f]+=x["present"]
        hist_boats+=btotal
        live=current_live(slug)
        for f,x in live["boatFieldCoverage"].items(): global_live[f]+=x["present"]
        live_boats+=live["boatRows"]
        venues.append({
            "code":code,"slug":slug,
            "history":{
                "baseRaces":meta["baseRaces"],"richRaces":meta["richRaces"],
                "missing":meta["missing"],"rejected":meta["rejected"],
                "raceFieldCoverage":rfields,"boatRows":btotal,"boatFieldCoverage":bfields,
                "explicitlyNotInRichSchema":NOT_IN_RICH_SCHEMA,
                "avgSTAvailableFlag":rich.get("avgSTAvailable"),
                "exhibitionIncludedFlag":rich.get("exhibitionIncluded"),
                "resultUse":rich.get("resultUse"),
            },
            "currentLiveProgram":live,
        })
    out={
        "schema":"boat-command-venue-data-field-audit-v1",
        "researchOnly":True,
        "productionChanged":False,
        "predictionInputChanged":False,
        "sourceHistoryAudit":str(AUDIT),
        "meaning":{
            "historyRich":"Official daily B/K-derived research rows. Result/payout are historical labels, not PRE-RACE inputs.",
            "currentLiveProgram":"Recently captured official racelist program packs; shows fields BOAT COMMAND can collect prospectively.",
            "coverage":"Non-null values actually present in stored data; not an estimate.",
        },
        "totals":{
            "baseRaces":base["baseRaces"],"richRaces":base["richRaces"],
            "missing":sum(x["missing"] for x in base["venues"]),
            "rejected":sum(x["rejected"] for x in base["venues"]),
            "historicalBoatRows":hist_boats,"liveBoatRows":live_boats,
            "historicalBoatFieldCoverage":{f:{"present":global_hist[f],"total":hist_boats,"coverage":pct(global_hist[f],hist_boats)} for f in BOAT_FIELDS},
            "liveBoatFieldCoverage":{f:{"present":global_live[f],"total":live_boats,"coverage":pct(global_live[f],live_boats)} for f in BOAT_FIELDS},
        },
        "venues":venues,
    }
    assert len(venues)==24
    assert out["productionChanged"] is False and out["predictionInputChanged"] is False
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("DATA_FIELD_AUDIT_PASS",out["totals"]["richRaces"],"races",hist_boats,"historical boat rows",live_boats,"live boat rows")

if __name__=="__main__":
    main()
