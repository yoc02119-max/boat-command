#!/usr/bin/env python3
"""SHADOW ONLY: audit official BOAT RACE B archives for frozen V2.1 PRE fields.
Never downloads K/result archives. Never guesses missing fields.
"""
import argparse, json, re, urllib.request, os, subprocess, tempfile

NEEDED = ['class','nationalWinRate','localWinRate','motor2Rate','averageST']
TOKENS = {
 'class': re.compile(r'\b(?:A1|A2|B1|B2)\b'),
 'percent': re.compile(r'\b\d{1,2}\.\d{1,2}\b'),
 'registration': re.compile(r'\b\d{4}\b'),
}

def download(url):
    req=urllib.request.Request(url,headers={'User-Agent':'BOAT-COMMAND-SHADOW-PRE-AUDIT/0.33.8'})
    with urllib.request.urlopen(req, timeout=30) as r: return r.read()

def unpack_lzh(data):
    with tempfile.TemporaryDirectory() as td:
        arc=os.path.join(td,'b.lzh'); open(arc,'wb').write(data)
        for cmd in (['7z','x','-y',arc,f'-o{td}'], ['unar','-o',td,arc]):
            try:
                p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False)
                if p.returncode==0:
                    files=[os.path.join(td,x) for x in os.listdir(td) if x!='b.lzh']
                    if files: return open(files[0],'rb').read()
            except FileNotFoundError: pass
    raise RuntimeError('NO_LZH_EXTRACTOR')

def decode(raw):
    for enc in ('cp932','shift_jis','utf-8'):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode('cp932','replace')

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--date',default='20250917'); a=ap.parse_args()
    yy=a.date[2:4]; mm=a.date[4:6]; dd=a.date[6:8]; ym=a.date[:6]
    # Official archive layout is /od2/B/YYYYMM/bYYMMDD.lzh (no slash between YYYY and MM).
    url=f'https://www1.mbrace.or.jp/od2/B/{ym}/b{yy}{mm}{dd}.lzh'
    data=download(url); text=decode(unpack_lzh(data))
    lines=text.splitlines()
    gamagori=[x for x in lines if '蒲郡' in x]
    class_lines=[x for x in lines if TOKENS['class'].search(x)]
    sample=class_lines[:30]
    report={
      'version':'GAMAGORI-HISTORY-PRE-SOURCE-AUDIT-V0.33.8',
      'sourceKind':'OFFICIAL_B_PROGRAM_ONLY','resultArchiveOpened':False,
      'url':url,'date':a.date,'lineCount':len(lines),'gamagoriMarkers':len(gamagori),
      'classEntryLines':len(class_lines),'sampleLines':sample,
      'requiredFrozenV21Fields':NEEDED,
      'decision':'INSPECT_RAW_LAYOUT_BEFORE_BUILDER'
    }
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
