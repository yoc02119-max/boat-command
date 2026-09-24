#!/usr/bin/env python3
"""Probe recent historical beforeinfo recoverability for all 24 venues.

Uses the latest accepted rich-history race per venue. Identity is verified on
the official racelist before beforeinfo is inspected. No result/payout endpoint.
"""
from __future__ import annotations
import importlib.util,json,pathlib,sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=ROOT/"scripts/historical-beforeinfo-field-probe-v1.py"
spec=importlib.util.spec_from_file_location("historical_beforeinfo_field_probe_v1",BASE)
P=importlib.util.module_from_spec(spec);sys.modules[spec.name]=P;spec.loader.exec_module(P)
OUT=ROOT/"research/historical-beforeinfo-recent-probe-v1.json"

def latest_row(slug):
    x=P.load(ROOT/f"rich-history-24/{slug}-rich-history-v1.json")
    rows=sorted(x.get("races",[]),key=lambda r:(r["d"],int(r["r"])))
    return rows[-1] if rows else None

def main():
    report={
      "schema":"boat-command-historical-beforeinfo-recent-probe-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "sampleStrategy":"latest accepted rich-history race per venue",
      "source":"BOAT RACE official racelist + beforeinfo; no result/payout endpoints",
      "venues":[],
    }
    for code,slug in P.VENUES.items():
        row=latest_row(slug)
        item={"code":code,"slug":slug,"status":"NO_SAMPLE","verifiedRacelistIdentity":False}
        if row:
            d=row["d"];race=int(row["r"]);hd=d.replace("-","")
            rl=f"https://www.boatrace.jp/owpc/pc/race/racelist?hd={hd}&jcd={code}&rno={race}"
            bi=f"https://www.boatrace.jp/owpc/pc/race/beforeinfo?hd={hd}&jcd={code}&rno={race}"
            item.update({"date":d,"race":race,"racelistUrl":rl,"beforeinfoUrl":bi})
            try:
                raw=P.fetch(rl,code);pack=P.C.parse_race(raw,d,race,slug.upper(),code)
                if not pack or not P.identity_ok(row,pack):
                    item["status"]="RACELIST_IDENTITY_MISMATCH"
                else:
                    item["verifiedRacelistIdentity"]=True
                    parsed=P.parse_beforeinfo(P.fetch(bi,code))
                    item.update(parsed);item["status"]="VERIFIED_BEFOREINFO"
            except Exception as e:
                item["status"]="FETCH_OR_PARSE_ERROR";item["error"]=type(e).__name__
        report["venues"].append(item)
        print(code,slug,item["date"] if "date" in item else None,item["status"],flush=True)
    ok=[x for x in report["venues"] if x["status"]=="VERIFIED_BEFOREINFO"]
    report["summary"]={
      "venuesProbed":24,"verifiedBeforeinfoPages":len(ok),
      "exhibition6of6":sum(1 for x in ok if x.get("exhibitionTimeCount")==6),
      "startExhibitionST6of6":sum(1 for x in ok if x.get("startExhibitionSTCount")==6),
      "weather4of4":sum(1 for x in ok if all(x.get("weather",{}).get(k) is not None for k in ("airTempC","windSpeedMps","waterTempC","waveHeightCm"))),
      "windDirectionCodePresent":sum(1 for x in ok if x.get("weather",{}).get("windDirectionCode")),
      "weatherCodePresent":sum(1 for x in ok if x.get("weather",{}).get("weatherCode")),
      "lapTimeMarkerPresent":sum(1 for x in ok if x.get("pageMarkers",{}).get("lapTime")),
      "turnTimeMarkerPresent":sum(1 for x in ok if x.get("pageMarkers",{}).get("turnTime")),
      "straightTimeMarkerPresent":sum(1 for x in ok if x.get("pageMarkers",{}).get("straightTime")),
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("HISTORICAL_BEFOREINFO_RECENT_PROBE_DONE",report["summary"])

if __name__=="__main__":main()
