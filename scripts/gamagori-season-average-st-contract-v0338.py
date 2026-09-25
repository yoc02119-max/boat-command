#!/usr/bin/env python3
"""SHADOW ONLY: contract for reconstructing V2.1 averageST from official racer season data.
No result/K archive may be used. Values must be keyed by racer registration and the season
whose published statistics were available for the race's PRE-RACE context.
"""
import json

CONTRACT = {
  'version': 'GAMAGORI-SEASON-AVERAGE-ST-CONTRACT-V0.33.8',
  'purpose': 'HISTORICAL_PRE_RECONSTRUCTION_ONLY',
  'officialSource': 'BOAT_RACE_RACER_SEASON_DOWNLOAD',
  'officialIndex': 'https://www.boatrace.jp/owpc/pc/extra/data/download.html',
  'joinKey': 'registration',
  'field': 'averageST',
  'requiredPolicy': {
    'resultArchiveOpened': False,
    'resultDerivedValuesForbidden': True,
    'futureSeasonLeakageForbidden': True,
    'missingValueImputationForbidden': True,
    'raceDateMustResolveToHistoricallyAvailableSeasonValue': True,
    'failClosedOnAmbiguousSeason': True
  },
  'frozenV21RequiredFields': [
    'class','nationalWinRate','localWinRate','motor2Rate','averageST'
  ],
  'next': 'parse official season-download layout, map registration->averageST, then cross-check against PRE snapshots before bulk build'
}
print(json.dumps(CONTRACT, ensure_ascii=False, indent=2))
