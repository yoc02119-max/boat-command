#!/usr/bin/env python3
"""Accept duplicate official results while preserving the first immutable file."""
import json,sys

def equivalent(a,b):
    if a.get('schema')=='boat-command-race-status-v1' or b.get('schema')=='boat-command-race-status-v1':
        keys=('schema','venue','venueCode','date','race','status','immutableAfterFirstWrite','selectionMutation','preRaceDataIncluded','resultEndpointsIncluded')
        return all(k in a and k in b and a[k]==b[k] for k in keys)
    required=('schema','venue','venueCode','date','race','trifecta','payout100')
    if any(k not in a or k not in b or a[k]!=b[k] for k in required):return False
    for k in ('exacta','exactaPayout100','win','winPayout100','winningMethod','finishOrder'):
        if a.get(k) and b.get(k) and a[k]!=b[k]:return False
    return True

if __name__=='__main__':
    a,b=(json.load(open(p,encoding='utf-8')) for p in sys.argv[1:3])
    if not equivalent(a,b):raise SystemExit('RESULT_VALUE_CONFLICT:'+sys.argv[2])
    print('RESULT_DUPLICATE_PRESERVE_FIRST',sys.argv[2])
