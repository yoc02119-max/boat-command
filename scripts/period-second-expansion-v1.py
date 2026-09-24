#!/usr/bin/env python3
"""Test whether period features are best used as extra second-place tickets.

Baseline four tickets are immutable. Candidate variants only append one or two
tickets under the baseline primary head, choosing previously unrepresented
second-place lanes. This directly tests the earlier finding that period features
slightly improve second-place TOP2 coverage while harming single-second picks.

Research only; no live model, TRY, bankroll, HARD LOCK, SHADOW or FORWARD files
are changed.
"""
from __future__ import annotations
import itertools,json,math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"research/period-second-expansion-v1.json"
CLASS={"A1":3,"A2":2,"B1":1,"B2":0}
ORDERS=[o for o in itertools.permutations(range(6),3)]
VENUES=[
 "amagasaki","ashiya","biwako","edogawa","fukuoka","gamagori","hamanako","heiwajima",
 "karatsu","kiryu","kojima","marugame","mikuni","miyajima","naruto","omura",
 "shimonoseki","suminoe","tamagawa","toda","tokoname","tokuyama","tsu","wakamatsu",
]
PROFILES=[
 {"name":"ST_LIGHT","stW":2.0,"fW":0.02,"lW":0.05,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_MED","stW":4.0,"fW":0.03,"lW":0.08,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_FL","stW":4.0,"fW":0.06,"lW":0.14,"abilityW":0.00,"threeW":0.00},
 {"name":"ST_ABILITY","stW":4.0,"fW":0.04,"lW":0.10,"abilityW":0.05,"threeW":0.00},
 {"name":"ST_3RATE","stW":4.0,"fW":0.04,"lW":0.10,"abilityW":0.00,"threeW":0.50},
 {"name":"BALANCED","stW":4.5,"fW":0.05,"lW":0.12,"abilityW":0.04,"threeW":0.35},
 {"name":"BALANCED_STRONG","stW":6.0,"fW":0.07,"lW":0.16,"abilityW":0.06,"threeW":0.50},
]

def load(p): return json.loads(Path(p).read_text(encoding="utf-8"))

def finite(v):
    try:
        x=float(v);return x if math.isfinite(x) else None
    except Exception:return None

def period_key(d):
    y=int(d[:4]);m=int(d[5:7]);return (y,1 if m<=6 else 2)

PERIODS={}
for p in sorted((ROOT/"racer-period-24").glob("20??-[12].json")):
    x=load(p)
    PERIODS[(int(x["year"]),int(x["term"]))]={int(r["registration"]):r for r in x["racers"]}

def valid_order(v):
    p=str(v or "").split("-")
    return len(p)==3 and len(set(p))==3 and all(x in {"1","2","3","4","5","6"} for x in p)

def base_score(b):
    c=str(b.get("class"))
    if c not in CLASS:return None
    s=.36*CLASS[c]
    nw=finite(b.get("nationalWinRate"));n2=finite(b.get("national2Rate"))
    lw=finite(b.get("localWinRate"));l2=finite(b.get("local2Rate"))
    m2=finite(b.get("motor2Rate"));bt=finite(b.get("boat2Rate"))
    if nw is not None:s+=.12*(nw-5)
    if n2 is not None:s+=.42*(n2-.30)
    if lw is not None:s+=.17*(lw-5)
    if l2 is not None:s+=.58*(l2-.30)
    if nw is not None and lw is not None:s+=.08*max(-3,min(3,lw-nw))
    if m2 is not None:s+=.42*(m2-.35)
    if bt is not None:s+=.18*(bt-.35)
    return s

def safe_rec(date_s,b):
    rec=PERIODS.get(period_key(date_s),{}).get(int(b.get("registration") or 0))
    if not rec:return None
    return rec if str(rec.get("class"))==str(b.get("class")) else None

def second_score(date_s,b,profile):
    s=base_score(b)
    if s is None:return None
    rec=safe_rec(date_s,b)
    if not rec:return s
    st=finite(rec.get("periodAvgST"));f=finite(rec.get("periodFCountDerived"))
    l=finite(rec.get("periodLCountDerived"));ab=finite(rec.get("currentAbility"))
    r3=finite(rec.get("period3RateDerived"))
    if st is not None:s+=profile["stW"]*(.18-st)
    if f is not None:s-=profile["fW"]*f
    if l is not None:s-=profile["lW"]*l
    if ab is not None:s+=profile["abilityW"]*((ab-50)/10)
    if r3 is not None:s+=profile["threeW"]*(r3-.40)
    return s

def ranked_orders(scores):
    ex=[math.exp(max(-12,min(12,x))) for x in scores]
    rows=[]
    total1=sum(ex)
    for a,b,c in ORDERS:
        p=ex[a]/total1
        d2=total1-ex[a];p*=ex[b]/d2
        d3=d2-ex[b];p*=ex[c]/d3
        rows.append((p,f"{a+1}-{b+1}-{c+1}"))
    rows.sort(reverse=True)
    return rows

def build_variant(row,profile):
    boats=sorted(row.get("boats",[]),key=lambda x:int(x.get("lane") or 0))
    if len(boats)!=6 or not valid_order(row.get("o")):return None
    bs=[base_score(b) for b in boats]
    if any(x is None for x in bs):return None
    ranked=ranked_orders(bs)
    base4=[o for _,o in ranked[:4]]
    rank6=[o for _,o in ranked[:6]]
    pmap={o:p for p,o in ranked}
    head=int(base4[0].split("-")[0])-1
    represented={int(o.split("-")[1])-1 for o in base4 if int(o.split("-")[0])-1==head}

    def alt_tickets(second_rank):
        extras=[]
        used=set(represented)
        for sec in second_rank:
            if sec==head or sec in used:continue
            candidates=[]
            for third in range(6):
                if third in (head,sec):continue
                order=f"{head+1}-{sec+1}-{third+1}"
                candidates.append((pmap.get(order,0),order))
            candidates.sort(reverse=True)
            if candidates:
                extras.append(candidates[0][1]);used.add(sec)
            if len(extras)>=2:break
        return extras

    base_second_rank=sorted([i for i in range(6) if i!=head],key=lambda i:(bs[i],-i),reverse=True)
    period_second_rank=sorted([i for i in range(6) if i!=head],
        key=lambda i:(second_score(row["d"],boats[i],profile),-i),reverse=True)

    base_extra=alt_tickets(base_second_rank)
    period_extra=alt_tickets(period_second_rank)
    return {
      "id":row["id"],"d":row["d"],"r":row["r"],"actual":str(row["o"]),"payout":int(row.get("p") or 0),
      "base4":base4,"rank6":rank6,
      "baseSecond6":base4+base_extra[:2],
      "periodSecond5":base4+period_extra[:1],
      "periodSecond6":base4+period_extra[:2],
    }

def classify_base_miss(x):
    actual=x["actual"]
    if actual in x["base4"]:return "HIT"
    a=actual.split("-")
    if not any(o.split("-")[0]==a[0] for o in x["base4"]):return "HEAD"
    if not any(o.split("-")[:2]==a[:2] for o in x["base4"]):return "SECOND"
    return "THIRD"

def metrics(rows,key):
    valid=[x for x in rows if x and x.get(key)]
    hits=ret=added=second_rescue=0
    stake=0;fixed_return=0
    for x in valid:
        picks=x[key];stake+=len(picks)*100
        hit=x["actual"] in picks
        if hit:
            hits+=1;ret+=x["payout"];fixed_return+=x["payout"]*24/len(picks)
        base_hit=x["actual"] in x["base4"]
        if hit and not base_hit:
            added+=1
            if classify_base_miss(x)=="SECOND":second_rescue+=1
    n=len(valid)
    return {
      "races":n,"hits":hits,"hitRate":hits/n if n else None,
      "stake":stake,"returns":ret,"roi":ret/stake if stake else None,
      "fixedBudgetStake":n*2400,"fixedBudgetReturns":fixed_return,
      "fixedBudgetRoi":fixed_return/(n*2400) if n else None,
      "addedHitsVsBase4":added,"rescuedSecondMisses":second_rescue,
      "avgPoints":stake/(100*n) if n else None,
    }

def eval_profile(rows,profile):
    return [build_variant(r,profile) for r in rows]

def choose(cal):
    tested=[]
    for p in PROFILES:
        rec=eval_profile(cal,p)
        m=metrics(rec,"periodSecond6")
        base=metrics(rec,"base4")
        second_misses=sum(1 for x in rec if x and classify_base_miss(x)=="SECOND")
        rescue=m["rescuedSecondMisses"]/second_misses if second_misses else 0
        tested.append({"profile":p,"periodSecond6":m,"base4":base,"secondMissRescueRate":rescue})
    tested.sort(key=lambda x:(
      x["secondMissRescueRate"],
      x["periodSecond6"]["addedHitsVsBase4"],
      x["periodSecond6"]["fixedBudgetRoi"] or 0
    ),reverse=True)
    return tested[0],tested

def venue(slug):
    db=load(ROOT/"rich-history-24"/f"{slug}-rich-history-v1.json")
    rows=sorted(db.get("races",[]),key=lambda x:(x["d"],int(x["r"])))
    dates=sorted({r["d"] for r in rows});cut=max(1,int(len(dates)*.70))
    cald=set(dates[:cut]);holdd=set(dates[cut:])
    cal=[r for r in rows if r["d"] in cald];hold=[r for r in rows if r["d"] in holdd]
    best,tested=choose(cal)
    rec=eval_profile(hold,best["profile"])
    keys=["base4","rank6","baseSecond6","periodSecond5","periodSecond6"]
    mm={k:metrics(rec,k) for k in keys}
    second_misses=sum(1 for x in rec if x and classify_base_miss(x)=="SECOND")
    mm["periodSecond6"]["secondMissRescueRate"]=mm["periodSecond6"]["rescuedSecondMisses"]/second_misses if second_misses else None
    mm["baseSecond6"]["secondMissRescueRate"]=mm["baseSecond6"]["rescuedSecondMisses"]/second_misses if second_misses else None
    return {
      "slug":slug,"venueCode":db.get("venueCode"),
      "selectedProfile":best["profile"],"calibrationTopProfiles":tested[:4],
      "holdoutFirstDate":dates[cut] if len(dates)>cut else None,
      "holdout":{
        **mm,
        "secondMisses":second_misses,
        "periodVsBaseSecond6":{
          "hitRateDelta":mm["periodSecond6"]["hitRate"]-mm["baseSecond6"]["hitRate"],
          "roiDelta":mm["periodSecond6"]["roi"]-mm["baseSecond6"]["roi"],
          "fixedBudgetRoiDelta":mm["periodSecond6"]["fixedBudgetRoi"]-mm["baseSecond6"]["fixedBudgetRoi"],
          "secondMissRescueDelta":mm["periodSecond6"]["rescuedSecondMisses"]-mm["baseSecond6"]["rescuedSecondMisses"],
        },
        "periodVsRank6":{
          "hitRateDelta":mm["periodSecond6"]["hitRate"]-mm["rank6"]["hitRate"],
          "roiDelta":mm["periodSecond6"]["roi"]-mm["rank6"]["roi"],
          "fixedBudgetRoiDelta":mm["periodSecond6"]["fixedBudgetRoi"]-mm["rank6"]["fixedBudgetRoi"],
        }
      },
      "baseline4Preserved":True,"promotionEligible":False,"productionChanged":False,
    },rec

def aggregate(groups,key):
    return metrics([x for g in groups for x in g],key)

def main():
    reports=[];groups=[]
    for slug in VENUES:
        v,g=venue(slug);reports.append(v);groups.append(g)
        h=v["holdout"]
        print(slug,json.dumps({
          "profile":v["selectedProfile"]["name"],
          "base4":h["base4"]["hitRate"],
          "rank6":h["rank6"]["hitRate"],
          "baseSecond6":h["baseSecond6"]["hitRate"],
          "periodSecond6":h["periodSecond6"]["hitRate"],
          "periodAddedHits":h["periodSecond6"]["addedHitsVsBase4"],
          "periodSecondRescues":h["periodSecond6"]["rescuedSecondMisses"],
          "fixedBudgetRoi":h["periodSecond6"]["fixedBudgetRoi"],
        },ensure_ascii=False))
    keys=["base4","rank6","baseSecond6","periodSecond5","periodSecond6"]
    agg={k:aggregate(groups,k) for k in keys}
    summary={
      "venues":24,"holdoutRaces":agg["base4"]["races"],"variants":agg,
      "period6VsBase4":{
        "hitRateDelta":agg["periodSecond6"]["hitRate"]-agg["base4"]["hitRate"],
        "roiDelta":agg["periodSecond6"]["roi"]-agg["base4"]["roi"],
        "fixedBudgetRoiDelta":agg["periodSecond6"]["fixedBudgetRoi"]-agg["base4"]["fixedBudgetRoi"],
        "addedHits":agg["periodSecond6"]["addedHitsVsBase4"],
        "rescuedSecondMisses":agg["periodSecond6"]["rescuedSecondMisses"],
      },
      "period6VsBaseSecond6":{
        "hitRateDelta":agg["periodSecond6"]["hitRate"]-agg["baseSecond6"]["hitRate"],
        "roiDelta":agg["periodSecond6"]["roi"]-agg["baseSecond6"]["roi"],
        "fixedBudgetRoiDelta":agg["periodSecond6"]["fixedBudgetRoi"]-agg["baseSecond6"]["fixedBudgetRoi"],
        "addedHitsDelta":agg["periodSecond6"]["addedHitsVsBase4"]-agg["baseSecond6"]["addedHitsVsBase4"],
        "secondRescueDelta":agg["periodSecond6"]["rescuedSecondMisses"]-agg["baseSecond6"]["rescuedSecondMisses"],
      },
      "period6VsRank6":{
        "hitRateDelta":agg["periodSecond6"]["hitRate"]-agg["rank6"]["hitRate"],
        "roiDelta":agg["periodSecond6"]["roi"]-agg["rank6"]["roi"],
        "fixedBudgetRoiDelta":agg["periodSecond6"]["fixedBudgetRoi"]-agg["rank6"]["fixedBudgetRoi"],
      },
      "venuesPeriodBeatsBaseSecondOnHit":sum(1 for v in reports if v["holdout"]["periodVsBaseSecond6"]["hitRateDelta"]>0),
      "venuesPeriodBeatsRank6OnHit":sum(1 for v in reports if v["holdout"]["periodVsRank6"]["hitRateDelta"]>0),
    }
    out={
      "schema":"boat-command-period-second-expansion-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "tryChanged":False,"hardLockChanged":False,"promotionEligible":False,
      "baselineRule":"BASE4 immutable; candidate only appends alternate-second tickets under baseline primary head",
      "featureBoundary":{
        "periodFeatures":["periodAvgST","periodFCountDerived","periodLCountDerived","currentAbility","period3RateDerived"],
        "joinPolicy":"RACE_DATE_HALF_YEAR + REGISTRATION + CLASS_MATCH",
        "resultUsedForTicketConstruction":False,
        "payoutUsedForTicketConstruction":False,
        "resultAndPayoutUse":"EVALUATION_AFTER_TICKETS_ONLY",
      },
      "summary":summary,"venuesData":reports,
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("PERIOD_SECOND_EXPANSION",json.dumps(summary,ensure_ascii=False))

if __name__=="__main__":main()
