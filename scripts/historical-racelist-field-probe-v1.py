#!/usr/bin/env python3
"""Probe whether official BOAT RACE historical racelist pages can restore richer PRE-RACE fields.

Only samples already present in the audited rich history are used. A page is
accepted only when all six registration numbers and grades match the stored
historical row. No result endpoint is fetched and no production data is changed.
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys
import time

ROOT=pathlib.Path(__file__).resolve().parents[1]
COLLECTOR=ROOT/"scripts/venue-program-collector-v1.py"
spec=importlib.util.spec_from_file_location("venue_program_collector_v1",COLLECTOR)
C=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=C
spec.loader.exec_module(C)

VENUES = {
    "01":"kiryu","02":"toda","03":"edogawa","04":"heiwajima","05":"tamagawa","06":"hamanako",
    "07":"gamagori","08":"tokoname","09":"tsu","10":"mikuni","11":"biwako","12":"suminoe",
    "13":"amagasaki","14":"naruto","15":"marugame","16":"kojima","17":"miyajima","18":"tokuyama",
    "19":"shimonoseki","20":"wakamatsu","21":"ashiya","22":"fukuoka","23":"karatsu","24":"omura",
}
FIELDS=[
    "name","fCount","lCount","avgST","nationalWinRate","national2Rate","national3Rate",
    "localWinRate","local2Rate","local3Rate","motor","motor2Rate","boat","boat2Rate",
]

def load(p):
    return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))

def sample_rows(rows):
    rows=sorted(rows,key=lambda r:(r["d"],int(r["r"])))
    if not rows:return []
    picks=[rows[0],rows[-1]]
    out=[]
    seen=set()
    for r in picks:
        key=(r["d"],r["r"])
        if key not in seen:
            out.append(r);seen.add(key)
    return out

def field_presence(pack):
    boats=pack.get("boats",[])
    return {f:sum(1 for b in boats if b.get(f) is not None and b.get(f)!="") for f in FIELDS}

def verified_match(stored,pack):
    sb=stored.get("boats",[])
    pb=pack.get("boats",[])
    if len(sb)!=6 or len(pb)!=6:return False
    return all(
        int(sb[i].get("registration"))==int(pb[i].get("registration"))
        and sb[i].get("class")==pb[i].get("class")
        and int(sb[i].get("lane"))==int(pb[i].get("lane"))
        for i in range(6)
    )

def main():
    report={
        "schema":"boat-command-historical-racelist-field-probe-v1",
        "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
        "source":"BOAT RACE official racelist only; no result endpoints",
        "acceptanceRule":"six lane+registration+grade tuples must exactly match audited rich-history row",
        "venues":[],
    }
    for code,slug in VENUES.items():
        rich=load(ROOT/f"rich-history-24/{slug}-rich-history-v1.json")
        samples=[]
        for row in sample_rows(rich.get("races",[])):
            d=row["d"];race=int(row["r"]);hd=d.replace("-","")
            url=f"https://www.boatrace.jp/owpc/pc/race/racelist?hd={hd}&jcd={code}&rno={race}"
            item={"date":d,"race":race,"url":url,"status":"ERROR","verifiedHistoricalPage":False}
            try:
                html=C.fetch(url,f"BOAT-COMMAND-HISTORY-FIELD-PROBE/{code}")
                pack=C.parse_race(html,d,race,slug.upper(),code)
                if not pack:
                    item["status"]="PARSE_MISS"
                elif not verified_match(row,pack):
                    item["status"]="IDENTITY_MISMATCH"
                else:
                    item["status"]="VERIFIED"
                    item["verifiedHistoricalPage"]=True
                    item["fieldPresenceOf6"]=field_presence(pack)
                    item["deadlinePresent"]=bool(pack.get("deadline"))
                    item["exhibitionIncluded"]=pack.get("exhibitionIncluded")
            except Exception as e:
                item["status"]="FETCH_OR_PARSE_ERROR"
                item["error"]=type(e).__name__
            samples.append(item)
            time.sleep(.15)
        report["venues"].append({"code":code,"slug":slug,"samples":samples})
        print(code,slug,[(x["date"],x["race"],x["status"]) for x in samples],flush=True)

    verified=[s for v in report["venues"] for s in v["samples"] if s["verifiedHistoricalPage"]]
    totals={f:sum(s.get("fieldPresenceOf6",{}).get(f,0) for s in verified) for f in FIELDS}
    denom=len(verified)*6
    report["summary"]={
        "samplePages":sum(len(v["samples"]) for v in report["venues"]),
        "verifiedPages":len(verified),
        "verifiedBoatRows":denom,
        "fieldCoverageOnVerifiedSamples":{f:{"present":totals[f],"total":denom,"coverage":round(totals[f]/denom,6) if denom else None} for f in FIELDS},
    }
    out=ROOT/"research/historical-racelist-field-probe-v1.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    assert report["productionChanged"] is False and report["predictionInputChanged"] is False
    print("HISTORICAL_RACELIST_PROBE_DONE",report["summary"])

if __name__=="__main__":
    main()
