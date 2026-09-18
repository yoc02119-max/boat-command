#!/usr/bin/env python3
# BOAT COMMAND GAMAGORI EXACTA WIN-PATTERN SEARCH v0.34.3
# Research/shadow only. PRE-derived features/picks are frozen before any official payout page is read.
import json, math, re, time
from pathlib import Path
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
from bs4 import BeautifulSoup

PRED = Path("gamagori-replay-predictions-v0333.json")
COMBO = Path("gamagori-win-pattern-combo-v0339.json")
RESULT = Path("gamagori-replay-results-v0333.json")
CACHE = Path("gamagori-exacta-payouts-v0343.json")
OUT = Path("gamagori-exacta-win-pattern-v0343.json")
JST = timezone(timedelta(hours=9))

pred = json.loads(PRED.read_text(encoding="utf-8"))
combo = json.loads(COMBO.read_text(encoding="utf-8"))
result = json.loads(RESULT.read_text(encoding="utf-8"))

if pred.get("resultsIncluded") is not False or pred.get("payoutsIncluded") is not False or pred.get("exhibitionIncluded") is not False or pred.get("futureDataIncluded") is not False:
    raise SystemExit("PRED_BOUNDARY_INVALID")
if combo.get("decision") != "SHADOW_ONLY" or combo.get("liveImported") is not False:
    raise SystemExit("COMBO_BOUNDARY_INVALID")
if result.get("predictionInputsIncluded") is not False:
    raise SystemExit("RESULT_BOUNDARY_INVALID")

train_dates = set(combo.get("split", {}).get("trainDates", []))
validation_dates = set(combo.get("split", {}).get("validationDates", []))
test_dates = set(combo.get("split", {}).get("testDates", []))
if not train_dates or not validation_dates or not test_dates:
    raise SystemExit("SPLIT_MISSING")

def split_of(date):
    if date in train_dates: return "train"
    if date in validation_dates: return "validation"
    if date in test_dates: return "test"
    return None

def ordered_unique(values):
    seen=set(); out=[]
    for v in values:
        if v not in seen:
            seen.add(v); out.append(v)
    return out

def features(x):
    race=int(x.get("r",0) or 0)
    classes=[str(c).upper() for c in (x.get("c") or [])]
    picks3=[str(p) for p in (x.get("f") or [])]
    heads=ordered_unique([p.split("-")[0] for p in picks3 if len(p.split("-"))==3])
    pairs=ordered_unique(["-".join(p.split("-")[:2]) for p in picks3 if len(p.split("-"))==3])
    return {
        "race": str(race),
        "raceBand": "EARLY_1_4" if race<=4 else "MID_5_8" if race<=8 else "LATE_9_12",
        "title": str(x.get("t") or "UNKNOWN"),
        "lane1Class": classes[0] if classes else "UNKNOWN",
        "a1Count": str(sum(c=="A1" for c in classes)),
        "aClassCount": str(sum(c in {"A1","A2"} for c in classes)),
        "headCount": str(len(heads)),
        "exactaPickCount": str(len(pairs)),
    }, pairs

# Freeze PRE-only rows first.
locked=[]
for x in pred.get("races", []):
    date=str(x.get("d") or "")
    split=split_of(date)
    if split is None: continue
    race=int(x.get("r",0) or 0)
    f,pairs=features(x)
    if race<1 or race>12 or not pairs: continue
    locked.append({
        "id":f"{date}|{race}","date":date,"race":race,"split":split,
        "features":f,"exactaPicks":pairs
    })

by_result={f"{x.get('d')}|{x.get('r')}":x for x in result.get("races", [])}
for x in locked:
    y=by_result.get(x["id"])
    if not y: continue
    tri=str(y.get("o") or "")
    z=tri.split("-")
    if len(z)==3:
        x["exactaOutcome"]="-".join(z[:2])

locked=[x for x in locked if re.fullmatch(r"[1-6]-[1-6]",x.get("exactaOutcome",""))]
if len(locked) < 4000:
    raise SystemExit(f"LOCKED_RACE_COUNT_TOO_SMALL:{len(locked)}")

# Load immutable-ish research cache if present. It contains result/payout only, never PRE features.
cache={}
if CACHE.exists():
    cx=json.loads(CACHE.read_text(encoding="utf-8"))
    if cx.get("schema")=="boat-command-gamagori-exacta-payout-cache-v0343":
        for r in cx.get("races",[]):
            if r.get("id") and isinstance(r.get("exactaPayout100"),int):
                cache[r["id"]]=r

headers={"User-Agent":"Mozilla/5.0 BOAT-COMMAND/0.34.3"}
missing=[x for x in locked if x["id"] not in cache]
print("EXACTA_CACHE",len(cache),"MISSING",len(missing))

def parse_exacta_payout(html):
    soup=BeautifulSoup(html,"html.parser")
    for tr in soup.find_all("tr"):
        cells=[" ".join(td.stripped_strings) for td in tr.find_all(["th","td"])]
        if len(cells)<3 or re.sub(r"\s+","",cells[0])!="2連単":
            continue
        pm=re.search(r"([\d,]+)",cells[2].replace("¥","").replace("￥",""))
        if pm:
            return int(pm.group(1).replace(",",""))
    return None

def fetch_one(x):
    date=x["date"]; race=x["race"]; hd=date.replace("-","")
    url=f"https://www.boatrace.jp/owpc/pc/race/raceresult?hd={hd}&jcd=07&rno={race}"
    last=None
    for attempt in range(3):
        try:
            r=requests.get(url,headers=headers,timeout=20)
            r.raise_for_status()
            p=parse_exacta_payout(r.text)
            if p is not None:
                return {"id":x["id"],"date":date,"race":race,"exactaPayout100":p,"officialSource":url}
            last="EXACTA_PAYOUT_NOT_FOUND"
        except Exception as e:
            last=str(e)
        time.sleep(.6+attempt*.7)
    return {"id":x["id"],"date":date,"race":race,"error":last or "FETCH_FAILED"}

if missing:
    failures=[]
    with ThreadPoolExecutor(max_workers=10) as ex:
        futs={ex.submit(fetch_one,x):x for x in missing}
        done=0
        for fut in as_completed(futs):
            done+=1
            r=fut.result()
            if isinstance(r.get("exactaPayout100"),int):
                cache[r["id"]]=r
            else:
                failures.append(r)
            if done%250==0 or done==len(missing):
                print("FETCH_PROGRESS",done,"/",len(missing),"FAIL",len(failures))
    if failures:
        print("FETCH_FAILURES",len(failures))
else:
    failures=[]

cache_report={
    "schema":"boat-command-gamagori-exacta-payout-cache-v0343",
    "generatedAt":datetime.now(JST).isoformat(),
    "resultOnly":True,
    "predictionInputsIncluded":False,
    "races":[cache[k] for k in sorted(cache)],
    "failures":failures[:100],
}
CACHE.write_text(json.dumps(cache_report,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")

rows=[]
for x in locked:
    p=cache.get(x["id"])
    if not p: continue
    rows.append({**x,"exactaPayout100":int(p["exactaPayout100"])})

def money_stats(rs,total):
    tickets=sum(len(x["exactaPicks"]) for x in rs)
    hits=[x for x in rs if x["exactaOutcome"] in x["exactaPicks"]]
    stake=tickets*100
    ret=sum(x["exactaPayout100"] for x in hits)
    return {
        "races":len(rs),
        "coverage":len(rs)/total if total else 0,
        "tickets":tickets,
        "averagePicksPerRace":tickets/len(rs) if rs else 0,
        "hits":len(hits),
        "hitRate":len(hits)/len(rs) if rs else 0,
        "stakeYen":stake,
        "returnYen":ret,
        "profitYen":ret-stake,
        "roi":ret/stake if stake else 0,
        "averagePayout100OnHit":ret/len(hits) if hits else 0,
    }

split_rows={s:[x for x in rows if x["split"]==s] for s in ("train","validation","test")}
baseline={s:money_stats(split_rows[s],len(split_rows[s])) for s in split_rows}

feature_names=["race","raceBand","title","lane1Class","a1Count","aClassCount","headCount","exactaPickCount"]
values={}
for name in feature_names:
    values[name]=sorted({x["features"].get(name,"UNKNOWN") for x in split_rows["train"] if x["features"].get(name,"UNKNOWN")!="UNKNOWN"})

defs=[]
for name in feature_names:
    for value in values[name]:
        defs.append({"kind":"single","parts":[{"name":name,"value":value}],"label":f"{name}={value}"})
for i,a in enumerate(feature_names):
    for b in feature_names[i+1:]:
        for av in values[a]:
            for bv in values[b]:
                # Skip tautological race/raceBand pairs.
                if a=="race" and b=="raceBand":
                    continue
                defs.append({"kind":"pair","parts":[{"name":a,"value":av},{"name":b,"value":bv}],"label":f"{a}={av} & {b}={bv}"})

def matches(d,x):
    return all(str(x["features"].get(p["name"]))==str(p["value"]) for p in d["parts"])

def eval_def(d, include_test=False):
    tr=[x for x in split_rows["train"] if matches(d,x)]
    va=[x for x in split_rows["validation"] if matches(d,x)]
    out={"kind":d["kind"],"label":d["label"],"parts":d["parts"],
         "train":money_stats(tr,len(split_rows["train"])),
         "validation":money_stats(va,len(split_rows["validation"]))}
    out["trainRoiUplift"]=out["train"]["roi"]-baseline["train"]["roi"]
    out["validationRoiUplift"]=out["validation"]["roi"]-baseline["validation"]["roi"]
    out["trainHitUplift"]=out["train"]["hitRate"]-baseline["train"]["hitRate"]
    out["validationHitUplift"]=out["validation"]["hitRate"]-baseline["validation"]["hitRate"]
    out["meanDesignRoi"]=(out["train"]["roi"]+out["validation"]["roi"])/2
    out["minDesignRoi"]=min(out["train"]["roi"],out["validation"]["roi"])
    out["selectionScore"]=out["minDesignRoi"] + .20*(out["meanDesignRoi"]-1)
    if include_test:
        te=[x for x in split_rows["test"] if matches(d,x)]
        out["test"]=money_stats(te,len(split_rows["test"]))
        out["testRoiUplift"]=out["test"]["roi"]-baseline["test"]["roi"]
        out["testHitUplift"]=out["test"]["hitRate"]-baseline["test"]["hitRate"]
    return out

evaluated=[]
for d in defs:
    o=eval_def(d,False)
    # Selection eligibility uses TRAIN + VALIDATION only.
    if o["train"]["races"]>=80 and o["validation"]["races"]>=40:
        evaluated.append(o)

# Robust-positive tier is fixed without consulting TEST.
robust=[x for x in evaluated if x["train"]["roi"]>=1.0 and x["validation"]["roi"]>=1.0]
robust.sort(key=lambda x:(x["selectionScore"],x["train"]["races"]+x["validation"]["races"]),reverse=True)
selected=robust[:25]

# If robust-positive is empty, retain diagnostic leaders without calling them winners.
diagnostic=sorted(evaluated,key=lambda x:(x["selectionScore"],x["train"]["races"]+x["validation"]["races"]),reverse=True)[:40]

# Attach TEST only after selected/diagnostic ordering is frozen.
def attach_test(items):
    out=[]
    for x in items:
        d={"kind":x["kind"],"label":x["label"],"parts":x["parts"]}
        full=eval_def(d,True)
        out.append(full)
    return out

selected_test=attach_test(selected)
diagnostic_test=attach_test(diagnostic)

report={
    "schema":"boat-command-gamagori-exacta-win-pattern-v0343",
    "generatedAt":datetime.now(JST).isoformat(),
    "analysisOnly":True,
    "liveImported":False,
    "decision":"SHADOW_ONLY",
    "boundary":"PRE-only features and exacta picks are frozen before official exacta payout pages are read. Candidate selection/order uses TRAIN+VALIDATION only. TEST is attached after selection freezes.",
    "sourceCounts":{"locked":len(locked),"payoutRows":len(rows),"cacheRows":len(cache),"fetchFailures":len(failures)},
    "baseline":baseline,
    "selectionRule":{
        "candidateFamily":"single + pair over predefined PRE-only features",
        "minTrainRaces":80,
        "minValidationRaces":40,
        "robustPositive":"TRAIN ROI >= 100% AND VALIDATION ROI >= 100%",
        "testUsedForSelection":False,
    },
    "robustPositiveCount":len(robust),
    "selectedBeforeTest":selected_test,
    "diagnosticLeadersBeforeTest":diagnostic_test,
    "promotionRule":"Historical selection cannot change LIVE betting. Fresh forward matched races are required before promotion.",
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({
    "sourceCounts":report["sourceCounts"],
    "baseline":baseline,
    "robustPositiveCount":len(robust),
    "selectedBeforeTest":selected_test[:10],
    "diagnosticLeadersBeforeTest":diagnostic_test[:10],
},ensure_ascii=False,indent=2))
