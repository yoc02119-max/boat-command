#!/usr/bin/env python3
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta

PRED=Path("gamagori-replay-predictions-v0333.json")
RES=Path("gamagori-replay-results-v0333.json")
COMBO=Path("gamagori-win-pattern-combo-v0339.json")
EXACTA=Path("gamagori-exacta-payouts-v0343.json")
OUT=Path("gamagori-any-race-gate-audit-v0348.json")
JST=timezone(timedelta(hours=9))

pred=json.loads(PRED.read_text(encoding="utf-8"))
res=json.loads(RES.read_text(encoding="utf-8"))
combo=json.loads(COMBO.read_text(encoding="utf-8"))
exacta=json.loads(EXACTA.read_text(encoding="utf-8"))

if pred.get("resultsIncluded") is not False or pred.get("payoutsIncluded") is not False or pred.get("exhibitionIncluded") is not False:
    raise SystemExit("PRED_BOUNDARY_INVALID")
if res.get("predictionInputsIncluded") is not False:
    raise SystemExit("RESULT_BOUNDARY_INVALID")
if exacta.get("predictionInputsIncluded") is not False or exacta.get("resultOnly") is not True:
    raise SystemExit("EXACTA_BOUNDARY_INVALID")

train=set(combo["split"]["trainDates"]); val=set(combo["split"]["validationDates"]); test=set(combo["split"]["testDates"])
def split(d):
    return "train" if d in train else "validation" if d in val else "test" if d in test else None

rmap={f"{x['d']}|{x['r']}":x for x in res["races"]}
emap={x["id"]:x for x in exacta["races"]}

rows=[]
for x in pred["races"]:
    sp=split(x["d"])
    if not sp: continue
    key=f"{x['d']}|{x['r']}"
    y=rmap.get(key); e=emap.get(key)
    if not y or not e: continue
    picks=[str(p) for p in x.get("f",[])]
    if len(picks)!=4: continue
    exacta_top1="-".join(picks[0].split("-")[:2])
    classes=[str(c).upper() for c in x.get("c",[])]
    rows.append({
        "d":x["d"],"r":int(x["r"]),"t":str(x.get("t") or ""),"sp":sp,
        "aClassCount":sum(c in {"A1","A2"} for c in classes),
        "triPicks":picks,
        "exactaTop1":exacta_top1,
        "actualTri":str(y["o"]),
        "triPayout100":round(float(y["x"])*100),
        "actualExacta":"-".join(str(y["o"]).split("-")[:2]),
        "exactaPayout100":int(e["exactaPayout100"])
    })

if len(rows)!=4071: raise SystemExit(f"ROW_COUNT:{len(rows)}")

def metrics(rs,kind):
    if kind=="EXACTA":
        stake=len(rs)*100
        hits=[x for x in rs if x["exactaTop1"]==x["actualExacta"]]
        ret=sum(x["exactaPayout100"] for x in hits)
    else:
        stake=len(rs)*400
        hits=[x for x in rs if x["actualTri"] in x["triPicks"]]
        ret=sum(x["triPayout100"] for x in hits)
    return {"races":len(rs),"tickets":len(rs) if kind=="EXACTA" else len(rs)*4,
            "hits":len(hits),"hitRate":len(hits)/len(rs) if rs else 0,
            "stakeYen":stake,"returnYen":ret,"profitYen":ret-stake,"roi":ret/stake if stake else 0}

def evaluate(kind,gate):
    out={}
    for sp in ("train","validation","test"):
        rs=[x for x in rows if x["sp"]==sp and gate(x)]
        out[sp]=metrics(rs,kind)
        out[sp]["byRace"]={str(r):metrics([x for x in rs if x["r"]==r],kind) for r in range(1,13)}
    allrs=[x for x in rows if gate(x)]
    out["overall"]=metrics(allrs,kind)
    out["overall"]["byRace"]={str(r):metrics([x for x in allrs if x["r"]==r],kind) for r in range(1,13)}
    return out

report={
 "schema":"boat-command-gamagori-any-race-gate-audit-v0348",
 "generatedAt":datetime.now(JST).isoformat(),
 "analysisOnly":True,"liveImported":False,"decision":"SHADOW_ONLY",
 "boundary":"Gate definitions are PRE-only. Result/payout data are joined only after gate and frozen picks are defined.",
 "rows":len(rows),
 "gates":{
   "exactaAnyRaceYosenTop1":{
     "label":"1-12R & title=予選 & 2連単TOP1",
     "betType":"2連単","variant":"TOP1",
     "metrics":evaluate("EXACTA",lambda x:x["t"]=="予選")
   },
   "trifectaAnyRaceAClass3Fixed4":{
     "label":"1-12R & aClassCount=3 & 3連単4点",
     "betType":"3連単","variant":"FIXED4",
     "metrics":evaluate("TRIFECTA",lambda x:x["aClassCount"]==3)
   }
 },
 "policy":"Historical audit only. Forward TRY remains SHADOW and does not change LIVE stakes or locks."
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({k:v["metrics"] for k,v in report["gates"].items()},ensure_ascii=False,indent=2))
