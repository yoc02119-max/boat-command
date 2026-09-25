#!/usr/bin/env python3
"""SHADOW ONLY: audit an official BOAT RACE racer-season extracted text/CSV file.
The parser is intentionally fail-closed: it reports candidate layouts and never guesses columns.
No race results/K archives are read.
"""
import argparse,csv,json,re

def main():
    ap=argparse.ArgumentParser();ap.add_argument('path');ap.add_argument('--encoding',default='cp932');a=ap.parse_args()
    raw=open(a.path,'rb').read()
    text=raw.decode(a.encoding,'replace')
    lines=[x for x in text.splitlines() if x.strip()]
    samples=[]
    reg_like=0; st_like=0
    for n,line in enumerate(lines[:5000],1):
        # Registration numbers are four digits; average ST is normally represented as 0.xx.
        regs=re.findall(r'(?<!\d)(\d{4})(?!\d)',line)
        sts=re.findall(r'(?<!\d)(0\.\d{2})(?!\d)',line)
        if regs: reg_like+=1
        if sts: st_like+=1
        if regs and sts and len(samples)<20:
            samples.append({'line':n,'registrations':regs[:3],'stCandidates':sts[:8],'raw':line[:500]})
    out={
      'version':'GAMAGORI-SEASON-AVERAGE-ST-AUDIT-V0.33.8',
      'sourceKind':'OFFICIAL_BOAT_RACE_RACER_SEASON_ONLY',
      'resultArchiveOpened':False,
      'lineCount':len(lines),
      'registrationCandidateLines':reg_like,
      'stCandidateLines':st_like,
      'jointCandidateSamples':samples,
      'decision':'COLUMN_LAYOUT_REVIEW_REQUIRED' if samples else 'FAIL_CLOSED_NO_JOINABLE_LAYOUT_FOUND'
    }
    print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
