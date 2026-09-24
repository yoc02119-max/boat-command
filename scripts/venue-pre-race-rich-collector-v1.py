#!/usr/bin/env python3
"""BOAT COMMAND · generic PRE-RACE rich research collector v1.

Reads already-published result-free program packs, selects races that are close
to deadline, fetches ONLY the official BOAT RACE beforeinfo page, and stores a
research-only enrichment pack.

Safety:
- no result/resultlist/payout endpoint is requested
- no prediction, HARD LOCK, TRY, bankroll, SHADOW or FORWARD file is changed
- partial data is allowed, but only a better pre-race snapshot replaces it
- start-exhibition numeric tokens are preserved as displayed; they are NOT
  asserted to be actual entry courses
"""
from __future__ import annotations

import argparse
import datetime as dt
import glob
import html
import json
import pathlib
import re
import unicodedata
import urllib.request
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

JST=ZoneInfo("Asia/Tokyo")
ROOT=pathlib.Path(__file__).resolve().parents[1]
VENUES={
 "01":("KIRYU","kiryu"),"02":("TODA","toda"),"03":("EDOGAWA","edogawa"),
 "04":("HEIWAJIMA","heiwajima"),"05":("TAMAGAWA","tamagawa"),"06":("HAMANAKO","hamanako"),
 "07":("GAMAGORI","gamagori"),"08":("TOKONAME","tokoname"),"09":("TSU","tsu"),
 "10":("MIKUNI","mikuni"),"11":("BIWAKO","biwako"),"12":("SUMINOE","suminoe"),
 "13":("AMAGASAKI","amagasaki"),"14":("NARUTO","naruto"),"15":("MARUGAME","marugame"),
 "16":("KOJIMA","kojima"),"17":("MIYAJIMA","miyajima"),"18":("TOKUYAMA","tokuyama"),
 "19":("SHIMONOSEKI","shimonoseki"),"20":("WAKAMATSU","wakamatsu"),"21":("ASHIYA","ashiya"),
 "22":("FUKUOKA","fukuoka"),"23":("KARATSU","karatsu"),"24":("OMURA","omura"),
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
            v=re.sub(r"\s+"," ",html.unescape("".join(self.cell))).strip()
            self.row.append(v);self.in_cell=False;self.cell=[]
        elif tag=="tr" and self.depth:
            if self.row and any(self.row):self.table.append(self.row)
            self.row=[]
        elif tag=="table" and self.depth:
            self.depth-=1
            if self.depth==0 and self.table:self.tables.append(self.table);self.table=[]

def norm(v):
    return unicodedata.normalize("NFKC",str(v or "")).strip()

def load(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))

def parse_num(v):
    s=norm(v).replace("℃","").replace("cm","").replace("m","")
    m=re.search(r"-?\d+(?:\.\d+)?",s)
    return float(m.group(0)) if m else None

def fetch(url,code):
    req=urllib.request.Request(url,headers={"User-Agent":f"BOAT-COMMAND-PRE-RACE-RICH/{code}"})
    with urllib.request.urlopen(req,timeout=12) as resp:raw=resp.read()
    for enc in ("utf-8","cp932","shift_jis","euc_jp"):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode("utf-8","replace")

def table_rows(raw):
    p=Tables();p.feed(raw);return p.tables

def header_map(table):
    aliases={
      "exhibitionTime":("展示タイム",),
      "tilt":("チルト",),
      "lapTime":("一周タイム","周回タイム"),
      "turnTime":("まわり足タイム","回り足タイム"),
      "straightTime":("直線タイム",),
    }
    for ri,row in enumerate(table[:5]):
        joined="|".join(norm(x) for x in row)
        if "展示" not in joined or "タイム" not in joined:continue
        out={}
        for key,names in aliases.items():
            for ci,cell in enumerate(row):
                c=norm(cell).replace(" ","")
                if any(name in c for name in names):
                    out[key]=ci;break
        if "exhibitionTime" in out:return ri,out
    return None,{}

def parse_exhibition(tables):
    out={}
    for table in tables:
        hrow,cols=header_map(table)
        if hrow is None:continue
        for row in table[hrow+1:]:
            if not row:continue
            lane=norm(row[0])
            if lane not in set("123456"):continue
            i=int(lane);values={}
            for key,ci in cols.items():
                values[key]=parse_num(row[ci]) if ci<len(row) else None
            # Conservative fallback used by the proven venue-specific collectors.
            if values.get("exhibitionTime") is None:
                for cell in row:
                    s=norm(cell)
                    if re.fullmatch(r"6\.\d{2}",s):
                        values["exhibitionTime"]=float(s);break
            out[i]=values
        if out:break
    return out

def parse_start_exhibition(tables):
    seen=[]
    for table in tables:
        if "スタート展示" not in " ".join(" ".join(r) for r in table):continue
        for row in table:
            s=norm(" ".join(row))
            for m in re.finditer(r"(?<!\d)([1-6])\s+(F)?\.?([0-9]{2})(?!\d)",s):
                token=int(m.group(1))
                raw=("F." if m.group(2) else ".")+m.group(3)
                key=(token,raw)
                if key not in [(x["displayToken"],x["stRaw"]) for x in seen]:
                    seen.append({
                      "sequence":len(seen)+1,
                      "displayToken":token,
                      "stRaw":raw,
                      "isFlying":bool(m.group(2)),
                    })
        if seen:break
    return seen

def weather_value(raw,label,unit):
    # Bind value to the official label, not to positional assumptions.
    m=re.search(
      rf'<span[^>]*>\s*{re.escape(label)}\s*</span>\s*'
      rf'<span[^>]*>\s*([0-9]+(?:\.[0-9]+)?)\s*{re.escape(unit)}\s*</span>',
      raw,re.S)
    return float(m.group(1)) if m else None

def parse_weather(raw):
    title=re.search(r'<p class="weather1_title">([^<]+)</p>',raw)
    dm=re.search(r'weather1_bodyUnitImage\s+(is-wind[0-9]{1,2})',raw)
    wm=re.search(r'weather1_bodyUnitImage\s+(is-weather[0-9]{1,2})',raw)
    return {
      "reference":html.unescape(title.group(1)).strip() if title else None,
      "airTempC":weather_value(raw,"気温","℃"),
      "windSpeedMps":weather_value(raw,"風速","m"),
      "waterTempC":weather_value(raw,"水温","℃"),
      "waveHeightCm":weather_value(raw,"波高","cm"),
      "windDirectionCode":dm.group(1) if dm else None,
      "weatherCode":wm.group(1) if wm else None,
    }

def completeness(pack):
    boats=pack.get("boats",[])
    ex=sum(1 for b in boats if b.get("exhibitionTime") is not None)
    st=len(pack.get("startExhibitionRaw",[]))
    w=pack.get("water",{})
    wx=sum(1 for k in ("airTempC","windSpeedMps","waterTempC","waveHeightCm") if w.get(k) is not None)
    return ex+st+wx

def parse_beforeinfo(raw,program,source_url,now,margin):
    tables=table_rows(raw)
    ex=parse_exhibition(tables)
    starts=parse_start_exhibition(tables)
    water=parse_weather(raw)
    boats=[]
    for b in program.get("boats",[]):
        row={k:b.get(k) for k in (
          "lane","registration","name","class","fCount","lCount","avgST",
          "nationalWinRate","national2Rate","national3Rate",
          "localWinRate","local2Rate","local3Rate",
          "motor","motor2Rate","boat","boat2Rate")}
        row.update(ex.get(int(b.get("lane") or 0),{}))
        boats.append(row)
    ex_count=sum(1 for b in boats if b.get("exhibitionTime") is not None)
    wx_count=sum(1 for k in ("airTempC","windSpeedMps","waterTempC","waveHeightCm") if water.get(k) is not None)
    return {
      "schema":"boat-command-pre-race-rich-research-v1",
      "venue":program.get("venue"),"venueCode":program.get("venueCode"),
      "date":program.get("date"),"race":program.get("race"),
      "deadline":program.get("deadline"),
      "fetchedAt":now.isoformat(),"minutesBeforeDeadline":round(margin,2),
      "researchOnly":True,"predictionEnabled":False,"hardLockEnabled":False,
      "resultEndpointsIncluded":False,"payoutEndpointsIncluded":False,
      "source":{"program":"stored result-free program pack","beforeinfoUrl":source_url},
      "boats":boats,
      "startExhibitionRaw":starts,
      "startExhibitionInterpretation":"DISPLAY_TOKENS_ONLY_NOT_ASSERTED_AS_ACTUAL_ENTRY_COURSES",
      "water":water,
      "fieldStatus":{
        "exhibitionTimeCount":ex_count,
        "startExhibitionSTCount":len(starts),
        "weatherCoreCount":wx_count,
        "lapTimeCount":sum(1 for b in boats if b.get("lapTime") is not None),
        "turnTimeCount":sum(1 for b in boats if b.get("turnTime") is not None),
        "straightTimeCount":sum(1 for b in boats if b.get("straightTime") is not None),
      },
      "captureComplete":ex_count==6 and len(starts)>=6 and wx_count==4,
    }

def deadline_dt(date_s,deadline):
    if not deadline:return None
    try:
        h,m=map(int,deadline.split(":"))
        return dt.datetime.fromisoformat(date_s).replace(hour=h,minute=m,tzinfo=JST)
    except Exception:return None

def candidates(date_s,now,min_margin,max_margin):
    out=[]
    for code,(key,slug) in VENUES.items():
        for p in glob.glob(str(ROOT/f"live/{slug}/{date_s}/program/race-*.json")):
            try:x=load(p)
            except Exception:continue
            if x.get("schema")!="boat-command-program-pack-v1":continue
            if x.get("venueCode")!=code or x.get("resultEndpointsIncluded") is not False:continue
            dline=deadline_dt(date_s,x.get("deadline"))
            if not dline:continue
            margin=(dline-now).total_seconds()/60
            if min_margin<=margin<=max_margin:
                outpath=ROOT/f"live/{slug}/{date_s}/pre-rich/race-{int(x['race'])}.json"
                if outpath.exists():
                    try:
                        old=load(outpath)
                        if old.get("captureComplete") is True:continue
                    except Exception:pass
                out.append((margin,code,key,slug,x,outpath))
    return sorted(out,key=lambda z:z[0])

def collect(date_s,now,min_margin,max_margin,max_fetch):
    selected=candidates(date_s,now,min_margin,max_margin)[:max_fetch]
    report={"selected":len(selected),"written":0,"unchanged":0,"errors":[]}
    hd=date_s.replace("-","")
    for margin,code,key,slug,program,outpath in selected:
        race=int(program["race"])
        url=f"https://www.boatrace.jp/owpc/pc/race/beforeinfo?hd={hd}&jcd={code}&rno={race}"
        try:
            raw=fetch(url,code)
            pack=parse_beforeinfo(raw,program,url,now,margin)
            # Avoid freezing a totally empty early page; let the next scheduled run retry.
            if completeness(pack)==0:
                report["unchanged"]+=1;continue
            old=None
            if outpath.exists():
                try:old=load(outpath)
                except Exception:old=None
            if old and completeness(old)>=completeness(pack):
                report["unchanged"]+=1;continue
            outpath.parent.mkdir(parents=True,exist_ok=True)
            outpath.write_text(json.dumps(pack,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
            report["written"]+=1
            print("PRE_RACE_RICH_WRITE",code,slug,race,pack["fieldStatus"],pack["captureComplete"],flush=True)
        except Exception as e:
            report["errors"].append({"code":code,"slug":slug,"race":race,"error":type(e).__name__})
            print("PRE_RACE_RICH_ERROR",code,slug,race,type(e).__name__,flush=True)
    print(json.dumps(report,ensure_ascii=False))
    return report

def self_test():
    raw="""<html><p class="weather1_title">水面気象情報 1R時点</p>
    <div class="weather1_bodyUnit is-direction"><span>気温</span><span>20.0℃</span></div>
    <div class="weather1_bodyUnit is-wind"><div class="weather1_bodyUnitImage is-wind12"></div><span>風速</span><span>3m</span></div>
    <div class="weather1_bodyUnit is-waterTemperature"><span>水温</span><span>25℃</span></div>
    <div class="weather1_bodyUnit is-wave"><span>波高</span><span>5cm</span></div>
    <div class="weather1_bodyUnitImage is-weather3"></div>
    <table><tr><th>艇番</th><th>体重</th><th>調整重量</th><th>展示タイム</th><th>チルト</th><th>一周タイム</th><th>まわり足タイム</th><th>直線タイム</th></tr>
    <tr><td>1</td><td>52.0</td><td>0</td><td>6.66</td><td>0.5</td><td>36.50</td><td>5.80</td><td>7.20</td></tr>
    <tr><td>2</td><td>52.0</td><td>0</td><td>6.67</td><td>0.0</td><td>36.60</td><td>5.90</td><td>7.30</td></tr>
    <tr><td>3</td><td>52.0</td><td>0</td><td>6.68</td><td>0.0</td><td>36.70</td><td>6.00</td><td>7.40</td></tr>
    <tr><td>4</td><td>52.0</td><td>0</td><td>6.69</td><td>0.0</td><td>36.80</td><td>6.10</td><td>7.50</td></tr>
    <tr><td>5</td><td>52.0</td><td>0</td><td>6.70</td><td>0.0</td><td>36.90</td><td>6.20</td><td>7.60</td></tr>
    <tr><td>6</td><td>52.0</td><td>0</td><td>6.71</td><td>0.0</td><td>37.00</td><td>6.30</td><td>7.70</td></tr></table>
    <table><tr><th>スタート展示</th></tr><tr><td>1 .12 2 F.01 3 .08 4 .15 5 .09 6 .20</td></tr></table></html>"""
    program={"venue":"TEST","venueCode":"99","date":"2026-09-25","race":1,"deadline":"10:00",
             "boats":[{"lane":i,"registration":4000+i,"name":f"B{i}","class":"B1"} for i in range(1,7)]}
    now=dt.datetime(2026,9,25,9,50,tzinfo=JST)
    p=parse_beforeinfo(raw,program,"https://example.invalid/beforeinfo",now,10)
    assert p["fieldStatus"]["exhibitionTimeCount"]==6
    assert p["fieldStatus"]["startExhibitionSTCount"]==6
    assert p["fieldStatus"]["weatherCoreCount"]==4
    assert p["fieldStatus"]["lapTimeCount"]==6
    assert p["fieldStatus"]["turnTimeCount"]==6
    assert p["fieldStatus"]["straightTimeCount"]==6
    assert p["captureComplete"] is True
    assert p["startExhibitionRaw"][1]["stRaw"]=="F.01"
    assert p["water"]["windDirectionCode"]=="is-wind12"
    assert p["predictionEnabled"] is False and p["resultEndpointsIncluded"] is False
    print("VENUE_PRE_RACE_RICH_SELF_TEST_PASS")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--date")
    ap.add_argument("--min-margin",type=float,default=3)
    ap.add_argument("--max-margin",type=float,default=20)
    ap.add_argument("--max-fetch",type=int,default=12)
    ap.add_argument("--self-test",action="store_true")
    args=ap.parse_args()
    if args.self_test:
        self_test();return
    now=dt.datetime.now(JST)
    date_s=args.date or now.date().isoformat()
    collect(date_s,now,args.min_margin,args.max_margin,args.max_fetch)

if __name__=="__main__":main()
