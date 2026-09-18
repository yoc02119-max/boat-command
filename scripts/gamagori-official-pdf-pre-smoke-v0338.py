#!/usr/bin/env python3
"""SHADOW ONLY smoke check for frozen V2.1 fields from official BOAT RACE entry-sheet PDF text.
Fixture values are transcribed from official 2025-12-15 Gamagori pb071215.pdf search extraction.
No results, exhibition, odds, or post-race data are present.
"""
import json
rows=[
 {'race':1,'lane':1,'registration':'3542','class':'B1','averageST':0.18,'nationalWinRate':3.91,'localWinRate':21.2,'motor2Rate':26.6},
 {'race':1,'lane':2,'registration':'3445','class':'B2','averageST':0.22,'nationalWinRate':4.91,'localWinRate':23.0,'motor2Rate':33.3},
 {'race':1,'lane':3,'registration':'4211','class':'B1','averageST':0.15,'nationalWinRate':4.30,'localWinRate':20.8,'motor2Rate':34.6},
 {'race':1,'lane':4,'registration':'3346','class':'B1','averageST':0.17,'nationalWinRate':4.01,'localWinRate':15.3,'motor2Rate':27.9},
 {'race':1,'lane':5,'registration':'5006','class':'B1','averageST':0.16,'nationalWinRate':4.35,'localWinRate':21.0,'motor2Rate':20.4},
 {'race':1,'lane':6,'registration':'5371','class':'B2','averageST':0.19,'nationalWinRate':1.30,'localWinRate':0.0,'motor2Rate':21.2},
]
# Note: PDF column labelled 当地 2連率 is not localWinRate. Keep this smoke fixture diagnostic only.
required=['class','averageST','nationalWinRate','motor2Rate']
assert len(rows)==6 and [x['lane'] for x in rows]==list(range(1,7))
assert all(all(k in x for k in required) for x in rows)
out={'version':'GAMAGORI-OFFICIAL-PDF-PRE-SMOKE-V0.33.8','date':'2025-12-15','venue':'GAMAGORI','officialPdf':'https://www.boatrace.jp/syussoupdf/2025/pb071215.pdf','resultDataIncluded':False,'exhibitionIncluded':False,'oddsIncluded':False,'race1Rows':rows,'criticalFinding':'PDF exposes class, averageST, nationalWinRate and motor2Rate directly; displayed 当地 field is 2-rate, so frozen V2.1 localWinRate still requires a true local win-rate source and must not be substituted.'}
print(json.dumps(out,ensure_ascii=False,indent=2))
