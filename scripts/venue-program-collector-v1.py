#!/usr/bin/env python3
import argparse, datetime, html, json, pathlib, re, urllib.request
from html.parser import HTMLParser
from zoneinfo import ZoneInfo

JST=ZoneInfo('Asia/Tokyo')

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.depth=0; self.in_cell=False
        self.cell=[]; self.row=[]; self.table=[]; self.tables=[]
    def handle_starttag(self,tag,attrs):
        if tag=='table':
            if self.depth==0:self.table=[]
            self.depth+=1
        elif tag in ('td','th') and self.depth:
            self.in_cell=True; self.cell=[]
        elif tag=='tr' and self.depth:
            self.row=[]
        elif tag=='br' and self.in_cell:
            self.cell.append(' / ')
    def handle_data(self,data):
        if self.in_cell:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.in_cell:
            self.row.append(re.sub(r'\s+',' ',html.unescape(''.join(self.cell))).strip())
            self.in_cell=False; self.cell=[]
        elif tag=='tr' and self.depth:
            if self.row and any(self.row):self.table.append(self.row)
            self.row=[]
        elif tag=='table' and self.depth:
            self.depth-=1
            if self.depth==0 and self.table:
                self.tables.append(self.table); self.table=[]

def fetch(url,ua):
    req=urllib.request.Request(url,headers={'User-Agent':ua})
    with urllib.request.urlopen(req,timeout=45) as r:raw=r.read()
    for enc in ('utf-8','cp932','shift_jis','euc_jp'):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode('utf-8','replace')

def parse_race(text,date_s,race,key,code):
    p=Tables();p.feed(text)
    plain=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',text)))
    times=re.findall(r'(?<!\d)([0-2]?\d:[0-5]\d)(?!\d)',plain)
    deadline=times[race-1] if len(times)>=12 else (times[-1] if times else None)
    racer=None
    for t in p.tables:
        joined=' '.join(' '.join(r) for r in t[:8])
        if all(k in joined for k in ('級別','モーター','ボート')):
            racer=t;break
    if racer is None:return None
    lane_map={'１':1,'２':2,'３':3,'４':4,'５':5,'６':6}
    boats={}
    for row in racer:
        if not row:continue
        raw_lane=row[0].strip()
        if raw_lane not in set(lane_map)|set('123456'):continue
        lane=lane_map.get(raw_lane,int(raw_lane) if raw_lane.isdigit() else None)
        joined=' | '.join(row)
        m=re.search(r'(\d{4})\s*/\s*(A1|A2|B1|B2)',joined)
        if not m:continue
        reg=int(m.group(1));cls=m.group(2)
        name=''
        mm=re.search(r'\d{4}\s*/\s*(?:A1|A2|B1|B2)\s+([^|/]+)',joined)
        if mm:name=re.sub(r'\s+',' ',mm.group(1)).strip()
        motor=boat=None;motor2_rate=boat2_rate=None
        f_count=l_count=None;avg_st=None
        national_win=national2=national3=None
        local_win=local2=local3=None
        if len(row)>3:
            fls=re.match(r'\s*F(\d+)\s*/\s*L(\d+)\s*/\s*([0-9]+(?:\.[0-9]+)?)',row[3])
            if fls:f_count=int(fls.group(1));l_count=int(fls.group(2));avg_st=float(fls.group(3))
        def rates(cell):
            nums=re.findall(r'([0-9]+(?:\.[0-9]+)?)',cell or '')
            if len(nums)>=3:return float(nums[0]),round(float(nums[1])/100,4),round(float(nums[2])/100,4)
            return None,None,None
        if len(row)>4:national_win,national2,national3=rates(row[4])
        if len(row)>5:local_win,local2,local3=rates(row[5])
        if len(row)>7:
            mo=re.match(r'\s*(\d+)\s*/',row[6]);bo=re.match(r'\s*(\d+)\s*/',row[7])
            motor=int(mo.group(1)) if mo else None;boat=int(bo.group(1)) if bo else None
            mr=re.search(r'/\s*([0-9]+(?:\.[0-9]+)?)',row[6]);br=re.search(r'/\s*([0-9]+(?:\.[0-9]+)?)',row[7])
            motor2_rate=round(float(mr.group(1))/100,4) if mr else None
            boat2_rate=round(float(br.group(1))/100,4) if br else None
        boats[lane]={'lane':lane,'registration':reg,'name':name,'class':cls,'fCount':f_count,'lCount':l_count,'avgST':avg_st,
                     'nationalWinRate':national_win,'national2Rate':national2,'national3Rate':national3,
                     'localWinRate':local_win,'local2Rate':local2,'local3Rate':local3,
                     'motor':motor,'boat':boat,'motor2Rate':motor2_rate,'boat2Rate':boat2_rate}
    if len(boats)!=6 or set(boats)!={1,2,3,4,5,6}:return None
    types=['ドリーム戦','準優勝戦','準優進出戦','優勝戦','予選特選','一般特選','一般特賞','選抜戦','予選','一般戦','一般','特選']
    race_type=next((x for x in types if x in plain),'')
    return {'schema':'boat-command-program-pack-v1','venue':key,'venueCode':code,'date':date_s,'race':race,
            'fetchedAt':datetime.datetime.now(JST).isoformat(),'deadline':deadline,'raceType':race_type,
            'boats':[boats[i] for i in range(1,7)],'programReady':True,'exhibitionIncluded':False,
            'resultEndpointsIncluded':False,'resultIncluded':False,'source':'BOAT RACE official racelist'}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--code',required=True);ap.add_argument('--key',required=True);ap.add_argument('--slug',required=True)
    ap.add_argument('--date',default=datetime.datetime.now(JST).date().isoformat())
    ap.add_argument('--out-root',default='live')
    a=ap.parse_args()
    assert re.fullmatch(r'\d{2}',a.code)
    date_s=a.date;hd=date_s.replace('-','');packs=[]
    for race in range(1,13):
        url=f'https://www.boatrace.jp/owpc/pc/race/racelist?hd={hd}&jcd={a.code}&rno={race}'
        try:pack=parse_race(fetch(url,f'BOAT-COMMAND-{a.key}-PROGRAM/1.0'),date_s,race,a.key,a.code)
        except Exception as e:
            print(f'PROGRAM_FETCH_ERROR code={a.code} race={race} error={e}');pack=None
        if not pack:
            print(f'PROGRAM_WAIT code={a.code} date={date_s} race={race}')
            return 0
        packs.append(pack)
    base=pathlib.Path(a.out_root)/a.slug/date_s/'program';base.mkdir(parents=True,exist_ok=True)
    for pack in packs:(base/f'race-{pack["race"]}.json').write_text(json.dumps(pack,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    manifest={'schema':'boat-command-program-manifest-v1','venue':a.key,'venueCode':a.code,'date':date_s,
              'fetchedAt':datetime.datetime.now(JST).isoformat(),'races':12,'allProgramReady':True,
              'exhibitionIncluded':False,'resultEndpointsIncluded':False,'resultIncluded':False}
    (base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'PROGRAM_READY_12_OF_12 code={a.code} slug={a.slug} date={date_s}')
    return 0
if __name__=='__main__':raise SystemExit(main())
