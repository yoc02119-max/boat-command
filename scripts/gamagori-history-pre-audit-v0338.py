#!/usr/bin/env python3
"""SHADOW ONLY: audit official BOAT RACE B archives for frozen V2.1 PRE fields.
Never downloads K/result archives. Never guesses missing fields.
"""
import argparse, json, re, urllib.request, os, subprocess, tempfile
NEEDED=['class','nationalWinRate','localWinRate','motor2Rate','averageST']
def download(url):
    req=urllib.request.Request(url,headers={'User-Agent':'BOAT-COMMAND-SHADOW-PRE-AUDIT/0.33.8'})
    with urllib.request.urlopen(req,timeout=30) as r:return r.read()
def unpack_lzh(data):
    with tempfile.TemporaryDirectory() as td:
        arc=os.path.join(td,'b.lzh');open(arc,'wb').write(data)
        for cmd in (['7z','x','-y',arc,f'-o{td}'],['unar','-o',td,arc]):
            try:
                p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,check=False)
                if p.returncode==0:
                    files=[os.path.join(td,x) for x in os.listdir(td) if x!='b.lzh']
                    if files:return open(files[0],'rb').read()
            except FileNotFoundError:pass
    raise RuntimeError('NO_LZH_EXTRACTOR')
def decode(raw):
    for enc in ('cp932','shift_jis','utf-8'):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode('cp932','replace')
def main():
    ap=argparse.ArgumentParser();ap.add_argument('--date',default='20251215');a=ap.parse_args()
    yy=a.date[2:4];mm=a.date[4:6];dd=a.date[6:8];ym=a.date[:6]
    url=f'https://www1.mbrace.or.jp/od2/B/{ym}/b{yy}{mm}{dd}.lzh'
    lines=decode(unpack_lzh(download(url))).splitlines()
    idx=[i for i,x in enumerate(lines) if '蒲郡' in x]
    windows=[]
    for i in idx:
        lo=max(0,i-12);hi=min(len(lines),i+90)
        windows.append({'markerLine':i+1,'startLine':lo+1,'endLine':hi,'lines':[{'n':j+1,'text':lines[j]} for j in range(lo,hi)]})
    # Structural token counts intentionally avoid assuming spacing/word-boundary conventions.
    class_lines=[x for x in lines if any(c in x for c in ('A1','A2','B1','B2'))]
    numeric_lines=[x for x in lines if re.search(r'\d+\.\d+',x)]
    report={'version':'GAMAGORI-HISTORY-PRE-SOURCE-AUDIT-V0.33.8','sourceKind':'OFFICIAL_B_PROGRAM_ONLY','resultArchiveOpened':False,'url':url,'date':a.date,'lineCount':len(lines),'gamagoriMarkers':len(idx),'classTokenLines':len(class_lines),'decimalLines':len(numeric_lines),'gamagoriWindows':windows,'requiredFrozenV21Fields':NEEDED,'decision':'PARSE_GAMAGORI_WINDOWS_NEXT'}
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
