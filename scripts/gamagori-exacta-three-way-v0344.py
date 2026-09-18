#!/usr/bin/env python3
# BOAT COMMAND GAMAGORI EXACTA THREE-WAY ISOLATION v0.34.4
# Exploratory historical research only. Selection uses TRAIN+VALIDATION; TEST is attached afterward.
import json, math
from itertools import combinations, product
from pathlib import Path
from datetime import datetime, timezone, timedelta

PRED=Path("gamagori-replay-predictions-v0333.json")
RESULT=Path("gamagori-replay-results-v0333.json")
COMBO=Path("gamagori-win-pattern-combo-v0339.json")
PAYOUT=Path("gamagori-exacta-payouts-v0343.json")
OUT=Path("gamagori-exacta-three-way-v0344.json")
JST=timezone(timedelta(hours=9))

pred=json.loads(PRED.read_text(encoding="utf-8"))
result=json.loads(RESULT.read_text(encoding="utf-8"))
combo=json.loads(COMBO.read_text(encoding="utf-8"))
payout=json.loads(PAYOUT.read_text(encoding="utf-8"))

if pred.get("resultsIncluded") is not False or pred.get("payoutsIncluded") is not False or pred.get("exhibitionIncluded") is not False or pred.get("futureDataIncluded") is not False:
    raise SystemExit("PRED_BOUNDARY_INVALID")
if result.get("predictionInputsIncluded") is not False:
    raise SystemExit("RESULT_BOUNDARY_INVALID")
if payout.get("predictionInputsIncluded") is not False or payout.get("resultOnly") is not True:
    raise SystemExit("PAYOUT_BOUNDARY_INVALID")

train=set(combo["split"]["trainDates"]); validation=set(combo["split"]["validationDates"]); test=set(combo["split"]["testDates"])

def split_of(d):
    return "train" if d in train else "validation" if d in validation else "test" if d in test else None

def ordered_unique(vals):
    seen=set(); out=[]
    for v in vals:
        if v not in seen:
            seen.add(v); out.append(v)
    return out

def feat(x):
    race=int(x.get("r",0)); classes=[str(c).upper() for c in (x.get("c") or [])]
    picks3=[str(p) for p in (x.get("f") or [])]
    heads=ordered_unique([p.split("-")[0] for p in picks3 if len(p.split("-"))==3])
    pairs=ordered_unique(["-".join(p.split("-")[:2]) for p in picks3 if len(p.split("-"))==3])
    return {
        "race":str(race),
        "title":str(x.get("t") or "UNKNOWN"),
        "lane1Class":classes[0] if classes else "UNKNOWN",
        "a1Count":str(sum(c=="A1" for c in classes)),
        "aClassCount":str(sum(c in {"A1","A2"} for c in classes)),
        "headCount":str(len(heads)),
        "exactaPickCount":str(len(pairs)),
    }, pairs

payout_by={r["id"]:int(r["exactaPayout100"]) for r in payout.get("races",[]) if r.get("id") and isinstance(r.get("exactaPayout100"),int)}
result_by={f"{x.get('d')}|{x.get('r')}":str(x.get("o") or "") for x in result.get("races",[])}

# PRE features/pick order locked before payout/result are joined.
locked=[]
for x in pred.get("races",[]):
    d=str(x.get("d") or ""); race=int(x.get("r",0)); sp=split_of(d)
    if not sp: continue
    f,pairs=feat(x)
    locked.append({"id":f"{d}|{race}","date":d,"race":race,"split":sp,"features":f,"pairs":pairs})

rows=[]
for x in locked:
    tri=result_by.get(x["id"],""); z=tri.split("-"); p=payout_by.get(x["id"])
    if len(z)!=3 or p is None: continue
    rows.append({**x,"outcome":"-".join(z[:2]),"payout100":p})

if len(rows)!=4071:
    raise SystemExit(f"ROW_COUNT_CHANGED:{len(rows)}")

split_rows={s:[x for x in rows if x["split"]==s] for s in ("train","validation","test")}
variants={
    "TOP1":lambda ps:ps[:1],
    "TOP2":lambda ps:ps[:2],
    "TOP3":lambda ps:ps[:3],
    "ALL":lambda ps:ps,
}

def stats(rs,variant,total):
    vp=variants[variant]
    tickets=0; hits=[]; returns=[]
    for x in rs:
        picks=vp(x["pairs"]); tickets+=len(picks)
        if x["outcome"] in picks:
            hits.append(x); returns.append(x["payout100"])
    stake=tickets*100; ret=sum(returns)
    sorted_ret=sorted(returns,reverse=True)
    return {
        "races":len(rs),"coverage":len(rs)/total if total else 0,
        "tickets":tickets,"averagePicksPerRace":tickets/len(rs) if rs else 0,
        "hits":len(hits),"hitRate":len(hits)/len(rs) if rs else 0,
        "stakeYen":stake,"returnYen":ret,"profitYen":ret-stake,"roi":ret/stake if stake else 0,
        "maxHitPayout100":sorted_ret[0] if sorted_ret else 0,
        "top1ReturnShare":sorted_ret[0]/ret if ret and sorted_ret else 0,
    }

baseline={s:{v:stats(split_rows[s],v,len(split_rows[s])) for v in variants} for s in split_rows}

names=["race","title","lane1Class","a1Count","aClassCount","headCount","exactaPickCount"]
values={n:sorted({x["features"][n] for x in split_rows["train"] if x["features"][n]!="UNKNOWN"}) for n in names}

defs=[]
for k in (1,2,3):
    for ns in combinations(names,k):
        for vals in product(*(values[n] for n in ns)):
            parts=[{"name":n,"value":v} for n,v in zip(ns,vals)]
            defs.append({"kind":f"{k}way","parts":parts,"label":" & ".join(f"{p['name']}={p['value']}" for p in parts)})

def match(d,x):
    return all(x["features"].get(p["name"])==p["value"] for p in d["parts"])

def evaluate(d,variant,with_test=False):
    tr=[x for x in split_rows["train"] if match(d,x)]
    va=[x for x in split_rows["validation"] if match(d,x)]
    out={"kind":d["kind"],"label":d["label"],"parts":d["parts"],"variant":variant,
         "train":stats(tr,variant,len(split_rows["train"])),
         "validation":stats(va,variant,len(split_rows["validation"]))}
    out["meanDesignRoi"]=(out["train"]["roi"]+out["validation"]["roi"])/2
    out["minDesignRoi"]=min(out["train"]["roi"],out["validation"]["roi"])
    out["selectionScore"]=out["minDesignRoi"] + .15*(out["meanDesignRoi"]-1) + .015*math.log1p(min(out["train"]["races"],out["validation"]["races"]))
    if with_test:
        te=[x for x in split_rows["test"] if match(d,x)]
        out["test"]=stats(te,variant,len(split_rows["test"]))
    return out

eligible=[]
for d in defs:
    # Feature frequency gate can be checked without payout and prevents tiny historical niches.
    trn=sum(match(d,x) for x in split_rows["train"])
    van=sum(match(d,x) for x in split_rows["validation"])
    if trn<50 or van<25: continue
    for v in variants:
        o=evaluate(d,v,False)
        # Require enough actual hits so ROI is not a one-hit artifact.
        if o["train"]["hits"]<12 or o["validation"]["hits"]<6: continue
        eligible.append(o)

# Frozen selection using TRAIN+VALIDATION only.
robust=[x for x in eligible
        if x["train"]["roi"]>=1.0 and x["validation"]["roi"]>=1.0
        and x["train"]["top1ReturnShare"]<=.35 and x["validation"]["top1ReturnShare"]<=.35]
robust.sort(key=lambda x:(x["selectionScore"],x["minDesignRoi"],x["train"]["races"]+x["validation"]["races"]),reverse=True)
selected=robust[:50]

# Diagnostic list is also frozen pre-TEST.
diagnostic=sorted(eligible,key=lambda x:(x["selectionScore"],x["minDesignRoi"]),reverse=True)[:50]

def attach(items):
    out=[]
    for x in items:
        d={"kind":x["kind"],"label":x["label"],"parts":x["parts"]}
        out.append(evaluate(d,x["variant"],True))
    return out

selected_test=attach(selected)
diagnostic_test=attach(diagnostic)
test_positive=sum(1 for x in selected_test if x["test"]["races"]>=15 and x["test"]["roi"]>=1.0)

report={
    "schema":"boat-command-gamagori-exacta-three-way-v0344",
    "generatedAt":datetime.now(JST).isoformat(),
    "analysisOnly":True,"liveImported":False,"decision":"SHADOW_ONLY",
    "boundary":"Feature definitions and exacta pick order are PRE-only. Candidate/variant selection uses TRAIN+VALIDATION only; TEST is attached after order freezes.",
    "rows":len(rows),
    "baseline":baseline,
    "selectionRule":{
        "featureDepth":"1-way + 2-way + 3-way",
        "variants":["TOP1","TOP2","TOP3","ALL"],
        "minTrainRaces":50,"minValidationRaces":25,
        "minTrainHits":12,"minValidationHits":6,
        "robustPositive":"TRAIN ROI>=100% AND VALIDATION ROI>=100%",
        "maxTop1ReturnShareEachDesignSplit":0.35,
        "testUsedForSelection":False
    },
    "eligibleCount":len(eligible),
    "robustPositiveCount":len(robust),
    "selectedBeforeTest":selected_test,
    "selectedWithTestRoiAtLeast100Count":test_positive,
    "diagnosticLeadersBeforeTest":diagnostic_test,
    "promotionRule":"No historical candidate is promoted to LIVE. Multiple-testing risk is material; only fresh forward evidence can promote a gate or staking rule."
}
OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps({
    "eligibleCount":len(eligible),
    "robustPositiveCount":len(robust),
    "selectedWithTestRoiAtLeast100Count":test_positive,
    "topSelected":selected_test[:15],
    "topDiagnostic":diagnostic_test[:10]
},ensure_ascii=False,indent=2))
