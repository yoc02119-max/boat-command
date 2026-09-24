#!/usr/bin/env python3
"""Build compact PRE-RACE-safe racer period features for historical BOAT COMMAND rows.

Official source:
  BOAT RACE racer half-year ("fan note book") archives.
The archive record is fixed-width 416 bytes as documented by BOAT RACE.

Leakage boundary:
- Jan-Jun races use that year's term 1 file (calculation ends Oct 31 prior year).
- Jul-Dec races use that year's term 2 file (calculation ends Apr 30 same year).
Thus the selected record is period-valid before the target race.
- Historical race result/payout is never used to select or calculate racer features.

This produces research data only. Production prediction inputs are unchanged.
"""
from __future__ import annotations

import argparse
import datetime as dt
import glob
import json
from collections import Counter,defaultdict
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT_ROOT=ROOT/"racer-period-24"

BASIC=[
 ("registration",4),("nameKanji",16),("nameKana",15),("branch",4),("class",2),
 ("era",1),("birth",6),("sex",1),("age",2),("heightCm",3),("weightKg",2),("bloodType",2),
 ("winRate",4),("twoRate",4),("firstCount",3),("secondCount",3),("starts",3),
 ("finalCount",2),("championCount",2),("avgST",3),
]
COURSE_SUMMARY_FIELDS=[("entries",3),("twoRate",4),("avgST",3),("avgStartRank",3)]
TERM_FIELDS=[
 ("previousClass",2),("previous2Class",2),("previous3Class",2),
 ("previousAbility",4),("currentAbility",4),("year",4),("term",1),
 ("calcFrom",8),("calcTo",8),("trainingTerm",3),
]
COURSE_RESULT_FIELDS=[
 ("finish1",3),("finish2",3),("finish3",3),("finish4",3),("finish5",3),("finish6",3),
 ("fCount",2),("l0Count",2),("l1Count",2),("k0Count",2),("k1Count",2),
 ("s0Count",2),("s1Count",2),("s2Count",2),
]
TAIL=[("noCourseL0",2),("noCourseL1",2),("noCourseK0",2),("noCourseK1",2),("birthplace",6)]

assert sum(w for _,w in BASIC)+6*sum(w for _,w in COURSE_SUMMARY_FIELDS)+sum(w for _,w in TERM_FIELDS)+6*sum(w for _,w in COURSE_RESULT_FIELDS)+sum(w for _,w in TAIL)==416

def dec(b:bytes)->str:
    return b.decode("cp932","replace").strip().replace("　"," ")

def digits(s,default=0):
    t="".join(ch for ch in str(s) if ch.isdigit())
    return int(t) if t else default

def parse_fixed(line:bytes):
    if len(line)!=416:return None
    pos=0
    def take(n):
        nonlocal pos
        b=line[pos:pos+n];pos+=n;return b
    raw={}
    for k,w in BASIC:raw[k]=dec(take(w))
    courses=[]
    for course in range(1,7):
        x={"course":course}
        for k,w in COURSE_SUMMARY_FIELDS:x[k]=dec(take(w))
        courses.append(x)
    term={}
    for k,w in TERM_FIELDS:term[k]=dec(take(w))
    results=[]
    for course in range(1,7):
        x={"course":course}
        for k,w in COURSE_RESULT_FIELDS:x[k]=dec(take(w))
        results.append(x)
    tail={}
    for k,w in TAIL:tail[k]=dec(take(w))
    assert pos==416

    reg=digits(raw["registration"])
    if not (2000<=reg<=9999):return None
    year=digits(term["year"]);term_no=digits(term["term"])
    if term_no not in (1,2):return None

    def rate100(s): return round(digits(s)/100,4)
    def ratio1(s): return round(digits(s)/1000,4)
    def st(s): return round(digits(s)/100,3)
    def rank(s): return round(digits(s)/100,2)
    def date8(s):
        v="".join(ch for ch in s if ch.isdigit())
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}" if len(v)==8 else None

    course_features=[]
    third_total=0;f_total=0;l_total=digits(tail["noCourseL0"])+digits(tail["noCourseL1"])
    for s,r in zip(courses,results):
        third=digits(r["finish3"]);third_total+=third
        f=digits(r["fCount"]);f_total+=f
        l=digits(r["l0Count"])+digits(r["l1Count"]);l_total+=l
        course_features.append({
          "course":s["course"],
          "entries":digits(s["entries"]),
          "twoRate":ratio1(s["twoRate"]),
          "avgST":st(s["avgST"]),
          "avgStartRank":rank(s["avgStartRank"]),
          "finishCounts":[digits(r[f"finish{i}"]) for i in range(1,7)],
          "fCount":f,"l0Count":digits(r["l0Count"]),"l1Count":digits(r["l1Count"]),
        })

    starts=digits(raw["starts"])
    first=digits(raw["firstCount"]);second=digits(raw["secondCount"])
    three_ratio=round((first+second+third_total)/starts,4) if starts else None
    return {
      "registration":reg,
      "name":raw["nameKanji"],
      "nameKana":raw["nameKana"],
      "branch":raw["branch"],
      "class":raw["class"],
      "sex":digits(raw["sex"]),
      "age":digits(raw["age"]),
      "heightCm":digits(raw["heightCm"]),
      "weightKg":digits(raw["weightKg"]),
      "bloodType":raw["bloodType"],
      "periodWinRate":rate100(raw["winRate"]),
      "period2Rate":ratio1(raw["twoRate"]),
      "period3RateDerived":three_ratio,
      "periodFirstCount":first,
      "periodSecondCount":second,
      "periodThirdCountDerived":third_total,
      "periodStarts":starts,
      "periodFinalCount":digits(raw["finalCount"]),
      "periodChampionCount":digits(raw["championCount"]),
      "periodAvgST":st(raw["avgST"]),
      "periodFCountDerived":f_total,
      "periodLCountDerived":l_total,
      "previousClasses":[term["previousClass"],term["previous2Class"],term["previous3Class"]],
      "previousAbility":rate100(term["previousAbility"]),
      "currentAbility":rate100(term["currentAbility"]),
      "year":year,"term":term_no,
      "calcFrom":date8(term["calcFrom"]),"calcTo":date8(term["calcTo"]),
      "trainingTerm":digits(term["trainingTerm"]),
      "birthplace":tail["birthplace"],
      "courses":course_features,
    }

def archive_name(year:int,term:int)->str:
    if term==1:return f"fan{(year-1)%100:02d}10"
    if term==2:return f"fan{year%100:02d}04"
    raise ValueError(term)

def target_period(date_s:str):
    d=dt.date.fromisoformat(date_s)
    return (d.year,1 if d.month<=6 else 2)

def effective_range(year,term):
    if term==1:return dt.date(year,1,1),dt.date(year,6,30)
    return dt.date(year,7,1),dt.date(year,12,31)

def iter_rich():
    for p in sorted((ROOT/"rich-history-24").glob("*-rich-history-v1.json")):
        if p.name=="venue-rich-history-audit-v1.json":continue
        x=json.loads(p.read_text(encoding="utf-8"))
        slug=p.name.removesuffix("-rich-history-v1.json")
        yield slug,x

def required_periods():
    out=set()
    for _,x in iter_rich():
        for r in x.get("races",[]):out.add(target_period(r["d"]))
    return sorted(out)

def find_archive_file(root:Path,year:int,term:int):
    stem=archive_name(year,term)
    candidates=list(root.rglob(stem+".txt"))+list(root.rglob(stem.upper()+".TXT"))
    if candidates:return candidates[0]
    # Extractors occasionally preserve an unexpected case/name. Verify via content term.
    for p in root.rglob("*"):
        if p.is_file() and p.suffix.lower()==".txt" and stem.lower() in p.stem.lower():return p
    return None

def parse_archive(path:Path,expected_year:int,expected_term:int):
    rows={}
    bad=0
    raw=path.read_bytes()
    for line in raw.splitlines():
        x=parse_fixed(line)
        if not x:
            bad+=1;continue
        if x["year"]!=expected_year or x["term"]!=expected_term:
            raise ValueError(f"TERM_MISMATCH {path} got={x['year']}-{x['term']} expected={expected_year}-{expected_term}")
        rows[x["registration"]]=x
    if len(rows)<1000:raise ValueError(f"TOO_FEW_RACERS {path} {len(rows)}")
    return rows,bad

def build(archive_root:Path,out_root:Path):
    periods={}
    period_meta=[]
    for year,term in required_periods():
        p=find_archive_file(archive_root,year,term)
        if not p:raise FileNotFoundError(f"MISSING_ARCHIVE {archive_name(year,term)}")
        rows,bad=parse_archive(p,year,term)
        periods[(year,term)]=rows
        start,end=effective_range(year,term)
        calc_to=max((x["calcTo"] for x in rows.values() if x.get("calcTo")),default=None)
        period_meta.append({
          "year":year,"term":term,"archive":archive_name(year,term),
          "racers":len(rows),"badLines":bad,"effectiveFrom":str(start),"effectiveTo":str(end),
          "maxCalcTo":calc_to,
        })

    venues=[];global_counts=Counter();referenced=defaultdict(set)
    for slug,x in iter_rich():
        races=x.get("races",[]);boat_rows=matched=class_match=0
        field=Counter();period_counts=Counter()
        for race in races:
            key=target_period(race["d"]);period_counts[f"{key[0]}-{key[1]}"]+=1
            start,end=effective_range(*key)
            d=dt.date.fromisoformat(race["d"])
            assert start<=d<=end
            index=periods[key]
            for b in race.get("boats",[]):
                boat_rows+=1;global_counts["boatRows"]+=1
                reg=int(b["registration"])
                rec=index.get(reg)
                if not rec:continue
                matched+=1;global_counts["matched"]+=1;referenced[key].add(reg)
                if rec["class"]==b.get("class"):
                    class_match+=1;global_counts["classMatch"]+=1
                for f in ("name","periodAvgST","period3RateDerived","periodFCountDerived","periodLCountDerived",
                          "currentAbility","previousAbility","courses"):
                    if rec.get(f) is not None and rec.get(f)!="":
                        field[f]+=1;global_counts[f]+=1
        venues.append({
          "slug":slug,"races":len(races),"boatRows":boat_rows,"matchedBoatRows":matched,
          "matchCoverage":round(matched/boat_rows,6) if boat_rows else None,
          "classMatchRows":class_match,
          "classMatchCoverageOfMatched":round(class_match/matched,6) if matched else None,
          "fieldCoverage":{f:round(field[f]/boat_rows,6) if boat_rows else None for f in (
             "name","periodAvgST","period3RateDerived","periodFCountDerived","periodLCountDerived",
             "currentAbility","previousAbility","courses")},
          "periodRaceCounts":dict(period_counts),
        })

    out_root.mkdir(parents=True,exist_ok=True)
    # Store only racers actually referenced by historical rows, once per half-year period.
    pack_files=[]
    for key,regs in sorted(referenced.items()):
        year,term=key
        rows=[periods[key][r] for r in sorted(regs)]
        payload={
          "schema":"boat-command-racer-period-pack-v1",
          "researchOnly":True,"predictionInputEnabled":False,
          "year":year,"term":term,"archive":archive_name(year,term),
          "effectiveFrom":str(effective_range(year,term)[0]),
          "effectiveTo":str(effective_range(year,term)[1]),
          "source":"BOAT_RACE_OFFICIAL_RACER_PERIOD_ARCHIVE",
          "racerCount":len(rows),"racers":rows,
        }
        fp=out_root/f"{year}-{term}.json"
        fp.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
        pack_files.append(str(fp.resolve().relative_to(ROOT.resolve())))

    total=global_counts["boatRows"];matched=global_counts["matched"]
    audit={
      "schema":"boat-command-racer-period-enrichment-audit-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "source":"BOAT RACE official racer half-year archives",
      "officialRecordBytes":416,
      "leakageRule":"term1 Jan-Jun uses prior-Oct-ending stats; term2 Jul-Dec uses Apr-ending stats",
      "periods":period_meta,
      "totals":{
        "venues":len(venues),"boatRows":total,"matchedBoatRows":matched,
        "matchCoverage":round(matched/total,6) if total else None,
        "classMatchCoverageOfMatched":round(global_counts["classMatch"]/matched,6) if matched else None,
        "periodAvgSTCoverage":round(global_counts["periodAvgST"]/total,6) if total else None,
        "period3RateDerivedCoverage":round(global_counts["period3RateDerived"]/total,6) if total else None,
        "periodFCountDerivedCoverage":round(global_counts["periodFCountDerived"]/total,6) if total else None,
        "periodLCountDerivedCoverage":round(global_counts["periodLCountDerived"]/total,6) if total else None,
        "courseFeatureCoverage":round(global_counts["courses"]/total,6) if total else None,
      },
      "packFiles":pack_files,"venuesData":venues,
    }
    (out_root/"audit-v1.json").write_text(json.dumps(audit,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("RACER_PERIOD_ENRICHMENT",json.dumps(audit["totals"],ensure_ascii=False))
    for v in venues:print(v["slug"],v["matchCoverage"],v["classMatchCoverageOfMatched"])
    return audit

def self_test():
    # Construct a valid 416-byte ASCII-safe record according to the official widths.
    vals={k:"" for k,_ in BASIC}
    vals.update({"registration":"3415","nameKanji":"TEST","nameKana":"TEST","branch":"大阪","class":"A1",
                 "sex":"1","age":"44","heightCm":"168","weightKg":"50","bloodType":"O",
                 "winRate":"0756","twoRate":"0459","firstCount":"037","secondCount":"019",
                 "starts":"122","finalCount":"05","championCount":"02","avgST":"016"})
    def encfit(s,n):
        b=str(s).encode("cp932","replace")
        return b[:n]+b" "*(n-len(b[:n]))
    b=b"".join(encfit(vals[k],w) for k,w in BASIC)
    for c in range(6):
        row={"entries":"020","twoRate":"0500","avgST":"015","avgStartRank":"250"}
        b+=b"".join(encfit(row[k],w) for k,w in COURSE_SUMMARY_FIELDS)
    term={"previousClass":"A1","previous2Class":"A1","previous3Class":"A1","previousAbility":"7400",
          "currentAbility":"7500","year":"2026","term":"1","calcFrom":"20250501","calcTo":"20251031","trainingTerm":"064"}
    b+=b"".join(encfit(term[k],w) for k,w in TERM_FIELDS)
    for c in range(6):
        row={f"finish{i}":"003" for i in range(1,7)}
        row.update({"fCount":"01","l0Count":"00","l1Count":"00","k0Count":"00","k1Count":"00",
                    "s0Count":"00","s1Count":"00","s2Count":"00"})
        b+=b"".join(encfit(row[k],w) for k,w in COURSE_RESULT_FIELDS)
    tail={"noCourseL0":"00","noCourseL1":"00","noCourseK0":"00","noCourseK1":"00","birthplace":"大阪"}
    b+=b"".join(encfit(tail[k],w) for k,w in TAIL)
    assert len(b)==416
    x=parse_fixed(b);assert x
    assert x["registration"]==3415 and x["periodAvgST"]==.16
    assert x["period2Rate"]==.459 and x["periodFCountDerived"]==6
    assert x["year"]==2026 and x["term"]==1 and len(x["courses"])==6
    assert archive_name(2026,1)=="fan2510" and archive_name(2026,2)=="fan2604"
    assert target_period("2026-06-30")== (2026,1)
    assert target_period("2026-07-01")== (2026,2)
    print("RACER_PERIOD_ENRICHMENT_SELF_TEST_PASS")

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--needed-files",action="store_true")
    ap.add_argument("--archive-root",type=Path)
    ap.add_argument("--out-root",type=Path,default=OUT_ROOT)
    ap.add_argument("--self-test",action="store_true")
    args=ap.parse_args()
    if args.self_test:self_test();return
    if args.needed_files:
        for y,t in required_periods():print(archive_name(y,t)+".lzh")
        return
    if not args.archive_root:ap.error("--archive-root required")
    build(args.archive_root,args.out_root)

if __name__=="__main__":main()
