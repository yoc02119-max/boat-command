#!/usr/bin/env python3
"""Audit already-stored PRE-RACE rich packs by venue and field.

Counts only files that are explicitly result-free and prediction-disabled.
This is a transparency report; it does not feed production prediction.
"""
from __future__ import annotations
import glob,json
from collections import Counter
from pathlib import Path

OUT=Path("research/pre-race-rich-existing-audit-v1.json")
FIELDS_BOAT=("registration","name","class","motor","boat","exhibitionTime","tilt")
WX=("airTempC","windSpeedMps","waterTempC","waveHeightCm","windDirectionCode","weatherCode")

def load(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))

def valid(x):
    return (
      isinstance(x,dict)
      and x.get("resultEndpointsIncluded") is False
      and x.get("predictionEnabled") is False
      and isinstance(x.get("boats"),list)
      and len(x["boats"])==6
    )

def one_venue(slug,paths):
    field=Counter(); wx=Counter(); total_boats=0; valid_packs=0; complete_ex=complete_st=complete_wx=0
    dates=set(); schemas=Counter(); timing=Counter()
    examples=[]
    for p in sorted(paths):
        try:x=load(p)
        except Exception:continue
        if not valid(x):continue
        valid_packs+=1
        schemas[x.get("schema") or "UNKNOWN"]+=1
        timing[x.get("timingStatus") or "UNSPECIFIED"]+=1
        if x.get("date"):dates.add(x["date"])
        boats=x["boats"]; total_boats+=len(boats)
        for b in boats:
            for f in FIELDS_BOAT:
                if b.get(f) is not None and b.get(f)!="":field[f]+=1
        ex=sum(1 for b in boats if b.get("exhibitionTime") is not None)
        if ex==6:complete_ex+=1
        start=x.get("startExhibition") or x.get("startExhibitionRaw") or []
        if len(start)>=6:complete_st+=1
        water=x.get("water") or x.get("weather") or {}
        for f in WX:
            if water.get(f) is not None and water.get(f)!="":wx[f]+=1
        if all(water.get(f) is not None for f in WX[:4]):complete_wx+=1
        if len(examples)<2:examples.append(p)
    return {
      "slug":slug,
      "filesSeen":len(paths),
      "validResultBlindPacks":valid_packs,
      "dateCount":len(dates),
      "firstDate":min(dates) if dates else None,
      "lastDate":max(dates) if dates else None,
      "schemas":dict(schemas),
      "timingStatus":dict(timing),
      "boatRows":total_boats,
      "boatFieldCoverage":{f:{
          "present":field[f],"total":total_boats,
          "coverage":round(field[f]/total_boats,6) if total_boats else None
      } for f in FIELDS_BOAT},
      "weatherFieldRaceCoverage":{f:{
          "presentRaces":wx[f],"totalRaces":valid_packs,
          "coverage":round(wx[f]/valid_packs,6) if valid_packs else None
      } for f in WX},
      "completeRaceCounts":{
          "exhibitionTime6of6":complete_ex,
          "startExhibitionAtLeast6":complete_st,
          "weatherCore4of4":complete_wx,
      },
      "examples":examples,
    }

def main():
    by={}
    for p in glob.glob("live/*/*/pre/race-*-pack.json"):
        parts=Path(p).parts
        if len(parts)<5:continue
        by.setdefault(parts[1],[]).append(p)
    venues=[one_venue(slug,paths) for slug,paths in sorted(by.items())]
    total=sum(v["validResultBlindPacks"] for v in venues)
    out={
      "schema":"boat-command-pre-race-rich-existing-audit-v1",
      "researchOnly":True,
      "productionChanged":False,
      "predictionInputChanged":False,
      "meaning":"Counts already-stored PRE-RACE packs only when resultEndpointsIncluded=false and predictionEnabled=false.",
      "totals":{
        "venuesWithAnyPack":len(venues),
        "validResultBlindPacks":total,
        "venuesWithValidPack":sum(1 for v in venues if v["validResultBlindPacks"]>0),
        "completeExhibitionRaces":sum(v["completeRaceCounts"]["exhibitionTime6of6"] for v in venues),
        "completeStartExhibitionRaces":sum(v["completeRaceCounts"]["startExhibitionAtLeast6"] for v in venues),
        "completeWeatherCoreRaces":sum(v["completeRaceCounts"]["weatherCore4of4"] for v in venues),
      },
      "venues":venues,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    assert out["productionChanged"] is False and out["predictionInputChanged"] is False
    print("PRE_RACE_EXISTING_AUDIT_PASS",json.dumps(out["totals"],ensure_ascii=False))
    for v in venues:
        print(v["slug"],v["validResultBlindPacks"],v["completeRaceCounts"])

if __name__=="__main__":main()
