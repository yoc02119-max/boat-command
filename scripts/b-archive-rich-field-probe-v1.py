#!/usr/bin/env python3
"""Probe official daily B archives for recoverable PRE-RACE fields.

Research-only diagnostic. It never reads K/result files and never changes
prediction inputs. Output is structural/redacted: no racer names are retained.
"""
from __future__ import annotations
import argparse, json, re, importlib.util, sys
from pathlib import Path
from collections import Counter,defaultdict

ROOT=Path(__file__).resolve().parents[1]
PARSER_PATH=ROOT/"program-history-builder-v131.py"
spec=importlib.util.spec_from_file_location("base_parser",PARSER_PATH)
B=importlib.util.module_from_spec(spec);sys.modules[spec.name]=B;spec.loader.exec_module(B)

LABELS=[
 "平均ST","ST","F","L","全国","当地","モーター","ボート","展示","勝率","2連率","３連率","3連率",
 "今節","事故率","能力","進入","コース"
]
ENTRY_HEAD=re.compile(r"^\s*([1-6])\s*(\d{4}).*?(A1|A2|B1|B2)",re.I)
NUM=re.compile(r"(?<![A-Za-z])[-+]?\d+(?:\.\d+)?")

def read(p):
    raw=p.read_bytes()
    for enc in ("cp932","shift_jis","utf-8-sig","utf-8"):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode("cp932","replace")

def compact(s):return re.sub(r"[\s　]+"," ",s).strip()

def redact_entry(line):
    n=B._norm_line(line)
    m=ENTRY_HEAD.search(n)
    if not m:return None
    lane,reg,grade=m.groups()
    # Keep only structural numeric tokens after grade. Names/prefecture text is discarded.
    tail=n[m.end():]
    nums=NUM.findall(tail)
    return {"lane":int(lane),"registrationDigits":len(reg),"class":grade.upper(),
            "numericTokens":nums[:20],"numericTokenCount":len(nums)}

def structural_line(line):
    x=B._norm_line(line)
    x=x.replace("進入","[ENTRY_COURSE]").replace("平均ST","[AVG_ST]")
    x=x.replace("全国","[NATIONAL]").replace("当地","[LOCAL]")
    x=x.replace("モーター","[MOTOR]").replace("ボート","[BOAT]")
    x=x.replace("今節","[CURRENT_SERIES]").replace("勝率","[WIN_RATE]")
    # Preserve grades/ASCII/numbers and the explicit placeholders above;
    # redact all remaining Japanese/name text.
    x=re.sub(r'[^\x00-\x7F]', 'X', x)
    x=re.sub(r'X+', 'X', x)
    return x[:240]

def label_contexts(section):
    lines=section.splitlines()
    out=[]
    for i,line in enumerate(lines):
        if "進入" not in line and not re.search(r'(^|[^A-Za-z])F([^A-Za-z]|$)',B._norm_line(line)):
            continue
        a=max(0,i-2);z=min(len(lines),i+4)
        out.append({"line":i+1,"context":[structural_line(lines[j]) for j in range(a,z)]})
        if len(out)>=8:break
    return out

def venue_sections(text):
    out={}
    for code in B.VENUE_NAMES:
        sec=B.venue_blocks(text,"B").get(code)
        if sec:out[code]=sec
    return out

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--root",type=Path,required=True)
    ap.add_argument("--out",type=Path,default=Path("research/b-archive-rich-field-probe-v1.json"))
    args=ap.parse_args()

    report={"schema":"boat-command-b-archive-rich-field-probe-v1",
            "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
            "resultFilesRead":False,"files":[],"aggregate":{}}
    agg_labels=Counter();token_shapes=Counter();venue_seen=Counter();entry_rows=0

    for p in sorted(args.root.rglob("*")):
        if not p.is_file():continue
        try:text=read(p)
        except Exception:continue
        sections=venue_sections(text)
        item={"file":p.name,"venues":[]}
        for code,sec in sorted(sections.items()):
            venue_seen[code]+=1
            labels=[lab for lab in LABELS if lab in sec]
            for x in labels:agg_labels[x]+=1
            entries=[]
            for line in sec.splitlines():
                r=redact_entry(line)
                if r:
                    entries.append(r);entry_rows+=1
                    token_shapes[r["numericTokenCount"]]+=1
            if not entries and not labels:continue
            item["venues"].append({
                "code":code,"name":B.VENUE_NAMES[code],
                "labelsFound":labels,
                "entryRows":len(entries),
                "numericTokenCountDistribution":dict(Counter(x["numericTokenCount"] for x in entries)),
                "entrySkeletonExamples":entries[:3],
                "labelContexts":label_contexts(sec) if ("進入" in labels or "F" in labels) else [],
            })
        report["files"].append(item)

    report["aggregate"]={
      "files":len(report["files"]),
      "venueSections":sum(venue_seen.values()),
      "venuesSeen":dict(sorted(venue_seen.items())),
      "entryRows":entry_rows,
      "labelsFoundInSections":dict(agg_labels),
      "entryNumericTokenCountDistribution":dict(sorted(token_shapes.items())),
      "interpretation":{
        "avgSTRecoverableOnlyIfExplicitlyPresentOrStructurallyDecoded":None,
        "fLRecoverableOnlyIfExplicitlyPresentOrStructurallyDecoded":None,
        "noGuessing":True
      }
    }
    args.out.parent.mkdir(parents=True,exist_ok=True)
    args.out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("B_ARCHIVE_FIELD_PROBE",json.dumps(report["aggregate"],ensure_ascii=False))

if __name__=="__main__":main()
