#!/usr/bin/env python3
"""SHADOW ONLY — build historical Gamagori PRE rows from BOAT RACE official racelist HTML.
Uses only racelist (PRE) pages. Never opens result/odds/exhibition endpoints. Missing/ambiguous fields fail closed.
"""
import argparse,json,re,urllib.request
from html import unescape
from html.parser import HTMLParser
URL='https://www.boatrace.jp/owpc/pc/race/racelist?hd={date}&jcd=07&rno={race}'
FIELDS=['class','nationalWinRate','localWinRate','motor2Rate','averageST']
class TableParser(HTMLParser):
 def __init__(self): super().__init__(); self.rows=[]; self.row=None; self.cell=None
 def handle_starttag(self,tag,attrs):
  if tag=='tr': self.row=[]
  elif tag in ('td','th') and self.row is not None: self.cell=[]
  elif tag=='br' and self.cell is not None: self.cell.append('\n')
 def handle_data(self,data):
  if self.cell is not None:self.cell.append(data)
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.cell is not None:
   self.row.append(re.sub(r'\s+',' ',unescape(''.join(self.cell))).strip()); self.cell=None
  elif tag=='tr' and self.row is not None:
   if self.row:self.rows.append(self.row)
   self.row=None

def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'BOAT-COMMAND-SHADOW-PRE/0.33.8'})
 with urllib.request.urlopen(req,timeout=30) as r:return r.read().decode('utf-8','replace')
def flat(html):
 s=re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>',' ',html,flags=re.I)
 s=re.sub(r'<[^>]+>',' ',s);return re.sub(r'\s+',' ',unescape(s)).strip()
def nums(cell): return [float(x) for x in re.findall(r'(?<!\d)(\d+(?:\.\d+)?)(?!\d)',cell)]
def parse_boat_row(cells,lane):
 joined=' | '.join(cells)
 regm=re.search(r'(?<!\d)([3-5]\d{3})(?!\d)',joined); clsm=re.search(r'\b(A1|A2|B1|B2)\b',joined)
 stm=re.search(r'(?<!\d)(0\.\d{2})(?!\d)',joined)
 if not(regm and clsm and stm):return None
 # Racelist table order is racer, F/L/ST, national, local, motor, boat. Keep groups intact; never substitute local 2-rate for local win rate.
 start=next((i for i,c in enumerate(cells) if regm.group(1) in c),None)
 if start is None:return None
 tail=cells[start:]
 groups=[]
 for c in tail:
  ns=nums(c)
  if ns:groups.append((c,ns))
 stidx=next((i for i,(c,ns) in enumerate(groups) if any(abs(x-float(stm.group(1)))<1e-9 for x in ns)),None)
 if stidx is None or len(groups)<stidx+5:return None
 nat=groups[stidx+1][1]; loc=groups[stidx+2][1]; mot=groups[stidx+3][1]
 # Required first statistic in national/local is win rate. Motor group contains motor number then 2-rate, so use second numeric value.
 if not nat or not loc or len(mot)<2:return None
 b={'lane':lane,'registration':regm.group(1),'class':clsm.group(1),'averageST':float(stm.group(1)),'nationalWinRate':nat[0],'localWinRate':loc[0],'motor2Rate':mot[1]}
 if not(0<=b['averageST']<1 and 0<=b['nationalWinRate']<=10 and 0<=b['localWinRate']<=10 and 0<=b['motor2Rate']<=100):raise RuntimeError(f'FIELD_RANGE_INVALID:{b}')
 return b
def parse_page(date,race):
 url=URL.format(date=date,race=race); raw=fetch(url); t=flat(raw)
 if '蒲郡' not in t:raise RuntimeError(f'NOT_GAMAGORI:{date}:{race}')
 p=TableParser();p.feed(raw); boats=[]
 for cells in p.rows:
  if len(boats)>=6:break
  b=parse_boat_row(cells,len(boats)+1)
  if b and b['registration'] not in {x['registration'] for x in boats}:boats.append(b)
 if len(boats)!=6:raise RuntimeError(f'FAIL_CLOSED_BOAT_COUNT:{date}:{race}:{len(boats)}')
 return {'id':f'{date}|{race}','date':date,'race':race,'sourceUrl':url,'sourceTiming':'OFFICIAL_RACELIST_PRE_RACE','boats':boats}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--date',default='20251215');ap.add_argument('--races',type=int,default=12);a=ap.parse_args()
 races=[parse_page(a.date,r) for r in range(1,a.races+1)]
 out={'version':'GAMAGORI-OFFICIAL-RACELIST-PRE-BUILDER-V0.33.8','venue':'GAMAGORI','venueCode':'07','outcomeFieldsIncluded':False,'resultOddsIncluded':False,'exhibitionIncluded':False,'requiredFields':FIELDS,'races':races,'raceCount':len(races),'boatCount':sum(len(r['boats']) for r in races),'resultEndpointOpened':False,'oddsEndpointOpened':False,'exhibitionEndpointOpened':False,'decision':'PRE_ROWS_FROZEN'}
 print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
