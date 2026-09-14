#!/usr/bin/env python3
import argparse, datetime, html, json, pathlib, re, time, unicodedata, urllib.request
from html.parser import HTMLParser

class Tables(HTMLParser):
    def __init__(self):
        super().__init__(); self.depth=0; self.in_cell=False; self.cell=[]; self.row=[]; self.table=[]; self.tables=[]
    def handle_starttag(self,tag,attrs):
        if tag=='table':
            if self.depth==0:self.table=[]
            self.depth+=1
        elif tag in ('td','th') and self.depth:self.in_cell=True;self.cell=[]
        elif tag=='tr' and self.depth:self.row=[]
        elif tag=='br' and self.in_cell:self.cell.append(' ')
    def handle_data(self,data):
        if self.in_cell:self.cell.append(data)
    def handle_endtag(self,tag):
        if tag in ('td','th') and self.in_cell:
            self.row.append(re.sub(r'\s+',' ',' '.join(self.cell)).strip());self.in_cell=False
        elif tag=='tr' and self.depth and self.row:self.table.append(self.row);self.row=[]
        elif tag=='table' and self.depth:
            self.depth-=1
            if self.depth==0:self.tables.append(self.table);self.table=[]

def fetch(url):
    error=None
    for attempt in range(3):
        try:
            request=urllib.request.Request(url,headers={'User-Agent':'BOAT-COMMAND-SHADOW-ENRICHMENT/0.33.0'})
            with urllib.request.urlopen(request,timeout=30) as response:raw=response.read()
            for encoding in ('utf-8','cp932','shift_jis','euc_jp'):
                try:return raw.decode(encoding)
                except UnicodeDecodeError:pass
            return raw.decode('utf-8','replace')
        except Exception as exc:
            error=exc;time.sleep(attempt+1)
    raise error

def rates(cell):return [float(x) for x in re.findall(r'(?<!\d)(\d+(?:\.\d+)?)(?!\d)',cell)]
def equipment(cell):
    nums=rates(cell)
    if len(nums)<2:return None,None,None
    return int(nums[0]),round(nums[1]/100,4),round(nums[2]/100,4) if len(nums)>2 else None
def event_day(plain,date_s):
    target=datetime.date.fromisoformat(date_s);found=[]
    for month,day,label in re.findall(r'(\d{1,2})月(\d{1,2})日\s*(初日|[０-９0-9]+日目|最終日)',plain):
        key=(int(month),int(day),label)
        if key not in found:found.append(key)
    for index,(month,day,label) in enumerate(found,1):
        if (month,day)!=(target.month,target.day):continue
        label=unicodedata.normalize('NFKC',label)
        if label=='初日':return 1
        match=re.match(r'(\d+)日目',label)
        if match:return int(match.group(1))
        if label=='最終日':return index
    return None
def parse(text,date_s,expected_classes):
    parser=Tables();parser.feed(text)
    plain=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',text)))
    table=next((t for t in parser.tables if all(k in ' '.join(' '.join(row) for row in t[:8]) for k in ('級別','全国','当地','モーター','ボート','平均ST'))),None)
    if table is None:raise RuntimeError('RACER_TABLE_NOT_FOUND')
    boats={}
    for row in table:
        if not row:continue
        raw_lane=unicodedata.normalize('NFKC',row[0].strip())
        if raw_lane not in '123456' or len(raw_lane)!=1:continue
        lane=int(raw_lane);joined=' | '.join(row)
        match=re.search(r'(\d{4})\s*/\s*(A1|A2|B1|B2)',joined)
        if not match:continue
        registration=int(match.group(1));cls=match.group(2)
        avg_match=re.search(r'(?<!\d)(0\.\d{2})(?!\d)',row[3] if len(row)>3 else joined)
        national=rates(row[4]) if len(row)>4 else [];local=rates(row[5]) if len(row)>5 else []
        motor,motor2,motor3=equipment(row[6] if len(row)>6 else '');boat,boat2,boat3=equipment(row[7] if len(row)>7 else '')
        if not avg_match or len(national)<3 or len(local)<3 or motor is None:raise RuntimeError(f'PROFILE_FIELDS_MISSING lane={lane} cells={len(row)}')
        name_match=re.search(r'\d{4}\s*/\s*(?:A1|A2|B1|B2)\s+([^|/]+)',joined)
        boats[lane]={
            'lane':lane,'registration':registration,'name':re.sub(r'\s+',' ',name_match.group(1)).strip() if name_match else '',
            'class':cls,'averageST':float(avg_match.group(1)),
            'nationalWinRate':national[0],'national2Rate':round(national[1]/100,4),'national3Rate':round(national[2]/100,4),
            'localWinRate':local[0],'local2Rate':round(local[1]/100,4),'local3Rate':round(local[2]/100,4),
            'motor':motor,'motor2Rate':motor2,'motor3Rate':motor3,'boat':boat,'boat2Rate':boat2,'boat3Rate':boat3}
    if set(boats)!={1,2,3,4,5,6}:raise RuntimeError(f'BOAT_MAPPING_INCOMPLETE lanes={sorted(boats)}')
    classes=[boats[i]['class'] for i in range(1,7)]
    if classes!=expected_classes:raise RuntimeError(f'CLASS_MAPPING_MISMATCH expected={expected_classes} actual={classes}')
    day=event_day(plain,date_s)
    if day is None:raise RuntimeError('EVENT_DAY_NOT_FOUND')
    return day,[boats[i] for i in range(1,7)]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--shard',type=int,required=True);parser.add_argument('--shards',type=int,default=6);parser.add_argument('--output',required=True);args=parser.parse_args()
    history=json.loads(pathlib.Path('gamagori-main-history-v0320.json').read_text(encoding='utf-8'))
    all_dates=sorted({row['d'] for row in history['races']})[-30:];dates=all_dates[args.shard::args.shards]
    targets=[row for row in history['races'] if row['d'] in dates];output=[];failures=[]
    for index,row in enumerate(targets,1):
        url=f"https://www.boatrace.jp/owpc/pc/race/racelist?hd={row['d'].replace('-','')}&jcd=07&rno={row['r']}"
        try:
            day,boats=parse(fetch(url),row['d'],row['c'])
            output.append({'id':row['id'],'date':row['d'],'race':int(row['r']),'raceType':row.get('t',''),'eventDay':day,'boats':boats,'sourceUrl':url,'sourceTiming':'OFFICIAL_RACELIST_PRE_RACE'})
        except Exception as exc:failures.append({'id':row['id'],'error':str(exc)})
        if index%12==0:print(f'SHARD {args.shard} COLLECTED {index}/{len(targets)} failures={len(failures)}',flush=True)
        time.sleep(.08)
    payload={'schema':'boat-command-shadow-pre-race-shard-v1','shard':args.shard,'shards':args.shards,'dates':dates,'expected':len(targets),'races':output,'failures':failures}
    pathlib.Path(args.output).write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    if failures or len(output)!=len(targets):raise SystemExit(f'SHARD_INCOMPLETE {args.shard} valid={len(output)} failures={len(failures)}')
    print(f'SHARD_PASS {args.shard} races={len(output)}',flush=True)
if __name__=='__main__':main()
