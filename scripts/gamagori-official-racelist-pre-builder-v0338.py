#!/usr/bin/env python3
"""SHADOW ONLY — build historical Gamagori PRE rows from BOAT RACE official racelist HTML.
Uses only racelist (PRE) pages. Never opens result/odds/exhibition endpoints. Missing/ambiguous fields fail closed.
"""
import argparse,json,re,urllib.request
from html import unescape
URL='https://www.boatrace.jp/owpc/pc/race/racelist?hd={date}&jcd=07&rno={race}'
FIELDS=['class','nationalWinRate','localWinRate','motor2Rate','averageST']
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'BOAT-COMMAND-SHADOW-PRE/0.33.8'})
 with urllib.request.urlopen(req,timeout=30) as r:return r.read().decode('utf-8','replace')
def text(html):
 s=re.sub(r'<script[\s\S]*?</script>|<style[\s\S]*?</style>',' ',html,flags=re.I)
 s=re.sub(r'<[^>]+>',' ',s);return re.sub(r'\s+',' ',unescape(s)).strip()
def audit_page(date,race):
 url=URL.format(date=date,race=race); raw=fetch(url); t=text(raw)
 if '蒲郡' not in t: raise RuntimeError(f'NOT_GAMAGORI:{date}:{race}')
 # Official page labels prove the PRE schema. Exact row parsing is deliberately fail-closed until DOM layout is frozen.
 labels={
  'averageST': '平均ST' in t,
  'nationalWinRate': '全国' in t and '勝率' in t,
  'localWinRate': '当地' in t and '勝率' in t,
  'motor2Rate': 'モーター' in t and '2連率' in t,
  'class': '級別' in t,
 }
 missing=[k for k in FIELDS if not labels[k]]
 return {'id':f'{date}|{race}','sourceUrl':url,'sourceTiming':'OFFICIAL_RACELIST_PRE_RACE','resultEndpointOpened':False,'oddsEndpointOpened':False,'exhibitionEndpointOpened':False,'schemaLabels':labels,'missingSchemaLabels':missing,'status':'SCHEMA_READY_ROW_PARSER_REQUIRED' if not missing else 'FAIL_CLOSED_SCHEMA_MISSING'}
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--date',default='20251215');ap.add_argument('--races',type=int,default=12);a=ap.parse_args()
 pages=[audit_page(a.date,r) for r in range(1,a.races+1)]
 out={'version':'GAMAGORI-OFFICIAL-RACELIST-PRE-BUILDER-V0.33.8','venue':'GAMAGORI','venueCode':'07','outcomeFieldsIncluded':False,'resultOddsIncluded':False,'exhibitionIncluded':False,'requiredFields':FIELDS,'pages':pages,'allSchemaReady':all(not p['missingSchemaLabels'] for p in pages),'decision':'FREEZE_DOM_ROW_PARSER_NEXT'}
 print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
