#!/usr/bin/env python3
"""Probe recoverable historical PRE-RACE beforeinfo fields for all 24 venues.

Research only. For each venue we use the oldest accepted rich-history race,
verify its official historical racelist identity first, then inspect only the
official beforeinfo page. No result or payout endpoint is requested.
"""
from __future__ import annotations

import html
import importlib.util
import json
import pathlib
import re
import sys
import urllib.request
from html.parser import HTMLParser

ROOT=pathlib.Path(__file__).resolve().parents[1]
COLLECTOR=ROOT/"scripts/venue-program-collector-v1.py"
spec=importlib.util.spec_from_file_location("venue_program_collector_v1",COLLECTOR)
C=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=C
spec.loader.exec_module(C)

VENUES={
 "01":"kiryu","02":"toda","03":"edogawa","04":"heiwajima","05":"tamagawa","06":"hamanako",
 "07":"gamagori","08":"tokoname","09":"tsu","10":"mikuni","11":"biwako","12":"suminoe",
 "13":"amagasaki","14":"naruto","15":"marugame","16":"kojima","17":"miyajima","18":"tokuyama",
 "19":"shimonoseki","20":"wakamatsu","21":"ashiya","22":"fukuoka","23":"karatsu","24":"omura",
}

class Tables(HTMLParser):
    def __init__(self):
        super().__init__();self.depth=0;self.in_cell=False
        self.cell=[];self.row=[];self.table=[];self.tables=[]
    def handle_starttag(self,tag,attrs):
        if tag=="table":
            if self.depth==0:self.table=[]
            self.depth+=1
        elif tag in ("td","th") and self.depth:
            self.in_cell=True;self.cell=[]
        elif tag=="tr" and self.depth:self.row=[]
        elif tag=="br" and self.in_cell:self.cell.append(" / ")
    def handle_data(self,data):
        if self.in_cell:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ("td","th") and self.in_cell:
            self.row.append(re.sub(r"\s+"," ",html.unescape("".join(self.cell))).strip())
            self.in_cell=False;self.cell=[]
        elif tag=="tr" and self.depth:
            if self.row and any(self.row):self.table.append(self.row)
            self.row=[]
        elif tag=="table" and self.depth:
            self.depth-=1
            if self.depth==0 and self.table:self.tables.append(self.table);self.table=[]

def fetch(url,code):
    req=urllib.request.Request(url,headers={"User-Agent":f"BOAT-COMMAND-HISTORICAL-BEFOREINFO-PROBE/{code}"})
    with urllib.request.urlopen(req,timeout=20) as resp:raw=resp.read()
    for enc in ("utf-8","cp932","shift_jis","euc_jp"):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode("utf-8","replace")

def load(p):return json.loads(pathlib.Path(p).read_text(encoding="utf-8"))

def oldest_row(slug):
    x=load(ROOT/f"rich-history-24/{slug}-rich-history-v1.json")
    rows=sorted(x.get("races",[]),key=lambda r:(r["d"],int(r["r"])))
    return rows[0] if rows else None

def identity_ok(stored,pack):
    sb=stored.get("boats",[]);pb=pack.get("boats",[])
    return len(sb)==6 and len(pb)==6 and all(
        int(sb[i]["registration"])==int(pb[i]["registration"])
        and sb[i]["class"]==pb[i]["class"] and int(pb[i]["lane"])==i+1
        for i in range(6)
    )

def weather_value(raw,kind,label,unit):
    block=re.search(rf'<div class="weather1_bodyUnit {re.escape(kind)}">(.*?)</div>\s*</div>',raw,re.S)
    source=block.group(1) if block else raw
    m=re.search(
      rf'<span class="weather1_bodyUnitLabelTitle">\s*{label}\s*</span>\s*'
      rf'<span class="weather1_bodyUnitLabelData">\s*([0-9]+(?:\.[0-9]+)?)\s*{unit}\s*</span>',
      source,re.S)
    return float(m.group(1)) if m else None

def parse_beforeinfo(raw):
    p=Tables();p.feed(raw)
    ex={};st={}
    for t in p.tables:
        joined=" ".join(" ".join(r) for r in t[:8])
        if "展示" in joined and "タイム" in joined and "体重" in joined:
            for row in t:
                if not row or row[0].strip() not in set("123456"):continue
                lane=int(row[0].strip());et=tilt=None
                for cell in row:
                    v=cell.strip()
                    if et is None and re.fullmatch(r"6\.\d{2}",v):et=float(v)
                if len(row)>5 and re.fullmatch(r"-?\d+(?:\.\d+)?",row[5].strip()):
                    tilt=float(row[5].strip())
                ex[lane]={"exhibitionTime":et,"tilt":tilt}
            if ex:break
    for t in p.tables:
        joined=" ".join(" ".join(r) for r in t)
        if "スタート展示" not in joined:continue
        for row in t:
            s=" ".join(row)
            for m in re.finditer(r"([1-6])\s+(F)?\.?([0-9]{2})",s):
                token=int(m.group(1));st[token]=("F." if m.group(2) else ".")+m.group(3)
        if st:break
    air=weather_value(raw,"is-direction","気温","℃")
    wind=weather_value(raw,"is-wind","風速","m")
    water=weather_value(raw,"is-waterTemperature","水温","℃")
    wave=weather_value(raw,"is-wave","波高","cm")
    dm=re.search(r'weather1_bodyUnitImage\s+(is-wind[0-9]{1,2})',raw)
    wm=re.search(r'weather1_bodyUnitImage\s+(is-weather[0-9]{1,2})',raw)
    labels={
      "exhibitionTime":"展示タイム" in raw,
      "startExhibition":"スタート展示" in raw,
      "lapTime":("一周タイム" in raw or "周回タイム" in raw),
      "turnTime":("まわり足タイム" in raw or "回り足タイム" in raw),
      "straightTime":"直線タイム" in raw,
      "airTemperature":"気温" in raw,
      "waterTemperature":"水温" in raw,
      "windSpeed":"風速" in raw,
      "waveHeight":"波高" in raw,
    }
    return {
      "exhibitionRows":len(ex),
      "exhibitionTimeCount":sum(1 for x in ex.values() if x["exhibitionTime"] is not None),
      "tiltCount":sum(1 for x in ex.values() if x["tilt"] is not None),
      "startExhibitionSTCount":len(st),
      "weather":{
        "airTempC":air,"windSpeedMps":wind,"waterTempC":water,"waveHeightCm":wave,
        "windDirectionCode":dm.group(1) if dm else None,
        "weatherCode":wm.group(1) if wm else None,
      },
      "pageMarkers":labels,
    }

def probe_one(code,slug):
    row=oldest_row(slug)
    item={"code":code,"slug":slug,"status":"NO_SAMPLE","verifiedRacelistIdentity":False}
    if not row:return item
    d=row["d"];race=int(row["r"]);hd=d.replace("-","")
    rl=f"https://www.boatrace.jp/owpc/pc/race/racelist?hd={hd}&jcd={code}&rno={race}"
    bi=f"https://www.boatrace.jp/owpc/pc/race/beforeinfo?hd={hd}&jcd={code}&rno={race}"
    item.update({"date":d,"race":race,"racelistUrl":rl,"beforeinfoUrl":bi})
    try:
        rlraw=fetch(rl,code);pack=C.parse_race(rlraw,d,race,slug.upper(),code)
        if not pack or not identity_ok(row,pack):
            item["status"]="RACELIST_IDENTITY_MISMATCH"
        else:
            item["verifiedRacelistIdentity"]=True
            item.update(parse_beforeinfo(fetch(bi,code)))
            item["status"]="VERIFIED_BEFOREINFO"
    except Exception as e:
        item["status"]="FETCH_OR_PARSE_ERROR";item["error"]=type(e).__name__
    return item

def main():
    import concurrent.futures
    report={
      "schema":"boat-command-historical-beforeinfo-field-probe-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "sampleStrategy":"oldest accepted rich-history race per venue",
      "source":"BOAT RACE official racelist + beforeinfo; no result/payout endpoints",
      "fetchTimeoutSec":20,"maxWorkers":6,
      "venues":[],
    }
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        fut=[ex.submit(probe_one,code,slug) for code,slug in VENUES.items()]
        rows=[f.result() for f in concurrent.futures.as_completed(fut)]
    rows.sort(key=lambda x:x["code"])
    report["venues"]=rows
    for item in rows:
        print(item["code"],item["slug"],item["status"],flush=True)
    ok=[x for x in rows if x["status"]=="VERIFIED_BEFOREINFO"]
    report["summary"]={
      "venuesProbed":24,
      "verifiedBeforeinfoPages":len(ok),
      "exhibition6of6":sum(1 for x in ok if x.get("exhibitionTimeCount")==6),
      "startExhibitionST6of6":sum(1 for x in ok if x.get("startExhibitionSTCount")==6),
      "weather4of4":sum(1 for x in ok if all(x.get("weather",{}).get(k) is not None for k in ("airTempC","windSpeedMps","waterTempC","waveHeightCm"))),
      "windDirectionCodePresent":sum(1 for x in ok if x.get("weather",{}).get("windDirectionCode")),
      "weatherCodePresent":sum(1 for x in ok if x.get("weather",{}).get("weatherCode")),
      "lapTimeMarkerPresent":sum(1 for x in ok if x.get("pageMarkers",{}).get("lapTime")),
      "turnTimeMarkerPresent":sum(1 for x in ok if x.get("pageMarkers",{}).get("turnTime")),
      "straightTimeMarkerPresent":sum(1 for x in ok if x.get("pageMarkers",{}).get("straightTime")),
    }
    out=ROOT/"research/historical-beforeinfo-field-probe-v1.json"
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    assert report["productionChanged"] is False and report["predictionInputChanged"] is False
    print("HISTORICAL_BEFOREINFO_PROBE_DONE",report["summary"])

if __name__=="__main__":main()
