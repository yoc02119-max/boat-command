#!/usr/bin/env python3
"""Small latency/control probe for official beforeinfo access from GitHub Actions.

Compares one current-day page with one recent historical and one oldest historical
page at the same venue. No result/payout endpoints are requested.
"""
from __future__ import annotations
import glob,json,pathlib,time,urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
SLUG="tokoname"; CODE="08"
OUT=ROOT/"research/beforeinfo-latency-control-v1.json"

def load(p):return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))

def rich_edges():
    x=load(ROOT/f"rich-history-24/{SLUG}-rich-history-v1.json")
    rows=sorted(x.get("races",[]),key=lambda r:(r["d"],int(r["r"])))
    return rows[0],rows[-1]

def current_program():
    ps=sorted(glob.glob(str(ROOT/f"live/{SLUG}/*/program/race-1.json")))
    if not ps:return None
    x=load(ps[-1]);return {"d":x["date"],"r":int(x["race"])}

def probe(label,d,r):
    hd=d.replace("-","")
    url=f"https://www.boatrace.jp/owpc/pc/race/beforeinfo?hd={hd}&jcd={CODE}&rno={r}"
    req=urllib.request.Request(url,headers={"User-Agent":"BOAT-COMMAND-BEFOREINFO-LATENCY-CONTROL/1.0"})
    t=time.monotonic()
    item={"label":label,"date":d,"race":r,"url":url}
    try:
        with urllib.request.urlopen(req,timeout=25) as resp:
            raw=resp.read();item["httpStatus"]=getattr(resp,"status",None)
        item.update({
          "status":"OK","elapsedSec":round(time.monotonic()-t,3),"bytes":len(raw),
          "hasExhibitionMarker":("展示".encode("utf-8") in raw or b"weather1" in raw),
          "hasWeatherMarkup":b"weather1" in raw,
        })
    except Exception as e:
        item.update({"status":"ERROR","elapsedSec":round(time.monotonic()-t,3),"error":type(e).__name__})
    return item

def main():
    old,recent=rich_edges();cur=current_program()
    samples=[
      probe("oldest-rich",old["d"],int(old["r"])),
      probe("recent-rich",recent["d"],int(recent["r"]))
    ]
    if cur:samples.append(probe("current-program",cur["d"],cur["r"]))
    out={
      "schema":"boat-command-beforeinfo-latency-control-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "venue":SLUG,"venueCode":CODE,"timeoutSec":25,
      "samples":samples
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("BEFOREINFO_LATENCY_CONTROL",json.dumps(samples,ensure_ascii=False))

if __name__=="__main__":main()
