#!/usr/bin/env python3
"""SHADOW ONLY. Contract for historical PRE reconstruction from BOAT RACE official syussou PDF.
No result/K archive, exhibition, odds, or post-race values may be used.
"""
import json
CONTRACT={
 'version':'GAMAGORI-OFFICIAL-PDF-PRE-CONTRACT-V0.33.9',
 'sourcePattern':'https://www.boatrace.jp/syussoupdf/YYYY/pb07MMDD.pdf',
 'venue':'GAMAGORI','venueCode':'07',
 'preRaceOnly':True,'resultArchiveOpened':False,'exhibitionIncluded':False,'oddsIncluded':False,
 'fields':{
   'lane':'艇','registration':'登番','class':'全国期別 級別','averageST':'全国期別 平均ST',
   'nationalWinRate':'全国期別 勝率','localWinRate':'当地 勝率','motor2Rate':'モーター 2連率'
 },
 'policy':{
   'guessingForbidden':True,'missingImputationForbidden':True,'resultDerivedValuesForbidden':True,
   'freezePredictionsBeforeResult':True,'failClosedOnParseAmbiguity':True
 },
 'note':'Prefer exact official race-day PRE PDF because it preserves the values actually displayed before the race.'
}
print(json.dumps(CONTRACT,ensure_ascii=False,indent=2))
