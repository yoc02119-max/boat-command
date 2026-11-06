"""POST-only review of immutable B/A research records; never changes predictions."""
import argparse
import datetime as dt
import hashlib
import json
import math
import re
from pathlib import Path

UTC = dt.timezone.utc


def clock(value):
    value = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if value.tzinfo is None:
        raise ValueError('missing_timezone')
    return value


def order(value):
    return isinstance(value, str) and bool(re.fullmatch(r'[1-6]-[1-6]-[1-6]', value)) and len(set(value.split('-'))) == 3


def validate(row, now):
    deadline = clock(row['deadlineAt'])
    generated, recorded = clock(row['generatedAt']), clock(row['recordedAt'])
    if not generated <= recorded <= min(now, deadline - dt.timedelta(minutes=3)):
        raise ValueError('not_recorded_before_cutoff')
    if row.get('researchOnly') is not True or row.get('realMoney') is not False:
        raise ValueError('not_research_record')
    if not re.fullmatch(r'[a-z]+', row['venue']) or row['venueCode'] not in [f'{n:02}' for n in range(1,25)]:
        raise ValueError('invalid_venue')
    if type(row['race']) is not int or not 1 <= row['race'] <= 12:
        raise ValueError('invalid_race')
    if deadline.astimezone(dt.timezone(dt.timedelta(hours=9))).date().isoformat() != row['date']:
        raise ValueError('invalid_date')
    if row['source'] != f"live/{row['venue']}/{row['date']}/shadow/program-only/race-{row['race']}.json":
        raise ValueError('invalid_source_path')
    if not re.fullmatch(r'[a-f0-9]{64}', row['predictionSha256']):
        raise ValueError('missing_prediction_hash')
    for side in ['a', 'b']:
        picks = row[side+'Picks']
        if len(picks) != 4 or len(set(picks)) != 4 or any(not order(p) or int(p[0]) != row[side+'Lane'] for p in picks):
            raise ValueError('invalid_four_picks')
        score = row[side+'Score']
        if isinstance(score, bool) or not isinstance(score, (int,float)) or not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError('invalid_score')
    if type(row['selected']) is not bool or row['selected'] != (row['bScore'] > row['aScore']):
        raise ValueError('changed_selection_rule')
    return deadline


def result_review(row, result, now):
    deadline = validate(row, now)
    if result is None:
        return {'status': 'WAITING_START' if now < deadline else 'WAITING_RESULT'}
    if now < deadline or clock(result['fetchedAt']) < deadline or clock(result['fetchedAt']) > now:
        raise ValueError('result_before_deadline_or_future')
    if (result.get('schema'), result.get('venueCode'), result.get('date'), result.get('race')) != ('boat-command-live-result-v1', row['venueCode'], row['date'], row['race']):
        raise ValueError('result_identity')
    if result.get('resultEndpointsIncluded') is not True or result.get('preRaceDataIncluded') is not False:
        raise ValueError('result_boundary')
    outcome, payout = result.get('trifecta'), result.get('payout100')
    if not order(outcome) or type(payout) is not int or payout <= 0:
        raise ValueError('result_or_payout_missing')
    return dict(status='SETTLED', outcome=outcome, payout100=payout,
                bWon=int(outcome[0])==row['bLane'],
                bHit=outcome in row['bPicks'], aHit=outcome in row['aPicks'],
                stake=400, bReturn=payout if outcome in row['bPicks'] else 0,
                aReturn=payout if outcome in row['aPicks'] else 0,
                resultFetchedAt=result['fetchedAt'])


def accept_odds(row, observation, race, now):
    deadline = validate(row, now)
    if observation.get('version') != 'TRY-ODDS-OBSERVER-V1' or observation.get('resultEndpointsRequested') is not False or observation.get('payoutEndpointsRequested') is not False:
        raise ValueError('observation_boundary')
    if observation.get('date') != row['date'] or race.get('race') != row['race']:
        raise ValueError('odds_identity')
    if race.get('status') != 'CAPTURED' or race.get('predictionSha256') != row['predictionSha256']:
        raise ValueError('odds_missing_or_changed_prediction')
    start, received = clock(race['requestStartedAt']), clock(race['receivedAt'])
    if not clock(row['recordedAt']) <= start <= received <= now:
        raise ValueError('odds_clock')
    if not 180 <= (deadline-start).total_seconds() <= 480 or not 180 <= (deadline-received).total_seconds() <= 480:
        raise ValueError('odds_outside_safe_window')
    expected = f"https://www.boatrace.jp/owpc/pc/race/odds3t?rno={row['race']}&jcd={row['venueCode']}&hd={row['date'].replace('-','')}"
    if race.get('sourceUrl') != expected:
        raise ValueError('odds_source_identity')
    odds = race['odds']
    expected_orders = {f'{i}-{j}-{k}' for i in range(1,7) for j in range(1,7) for k in range(1,7) if len({i,j,k})==3}
    if set(odds) != expected_orders or any(isinstance(v,bool) or not isinstance(v,(int,float)) or not math.isfinite(v) or v<=0 for v in odds.values()):
        raise ValueError('incomplete_odds')
    return dict(schema='b-over-a-odds-v1', date=row['date'], venue=row['venue'], venueCode=row['venueCode'], race=row['race'],
                predictionSha256=row['predictionSha256'], receivedAt=race['receivedAt'], requestStartedAt=race['requestStartedAt'],
                sourceUrl=expected, oddsPageSha256=race.get('oddsPageSha256'),
                observationRunId=observation.get('_runId'), resultInput=False,
                bOdds={p:odds[p] for p in row['bPicks']}, aOdds={p:odds[p] for p in row['aPicks']})


def write_once(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with path.open('x') as f:
            json.dump(value, f, ensure_ascii=False, indent=2)
            f.write('\n')
        return True
    except FileExistsError:
        return False


def run(root, output, artifact_dir=None, run_id=None, now=None):
    now = now or dt.datetime.now(UTC)
    research = root / 'research'
    records, excluded, observations = [], {}, []
    if artifact_dir:
        for file in sorted(artifact_dir.rglob('observation.json')):
            x=json.loads(file.read_text()); x['_runId']=run_id; observations.append(x)
        if not observations:
            raise ValueError('observer_artifact_missing')
    odds_imported=0
    for file in sorted((research/'b-over-a-forward-v1').glob('*/*/race-*.json')):
        try:
            raw=file.read_bytes(); row=json.loads(raw); validate(row, now)
            if file.relative_to(research/'b-over-a-forward-v1').as_posix() != f"{row['date']}/{row['venue']}/race-{row['race']}.json":
                raise ValueError('record_path_identity')
        except (ValueError,KeyError,TypeError) as e:
            excluded[str(e)] = excluded.get(str(e),0)+1; continue
        odds_path=research/'b-over-a-odds-v1'/row['date']/row['venue']/f"race-{row['race']}.json"
        for obs in observations:
            for venue in obs.get('venues',[]):
                if venue.get('venueCode')!=row['venueCode'] or venue.get('slug')!=row['venue']: continue
                for race in venue.get('races',[]):
                    if race.get('race')!=row['race'] or race.get('status')!='CAPTURED': continue
                    try:
                        value=accept_odds(row,obs,race,now)
                        value['recordSha256']=hashlib.sha256(raw).hexdigest()
                        odds_imported+=write_once(odds_path,value)
                    except (ValueError,KeyError,TypeError) as e:
                        key='odds:'+str(e); excluded[key]=excluded.get(key,0)+1
        result_path=root/'live'/row['venue']/row['date']/'post'/f"race-{row['race']}-result.json"
        try:
            result=json.loads(result_path.read_text()) if result_path.exists() else None
            settled=result_review(row,result,now)
        except (ValueError,KeyError,TypeError) as e:
            settled={'status':'RESULT_UNUSABLE','reason':str(e)}
        rec=dict(date=row['date'],venue=row['venue'],race=row['race'],selected=row['selected'],
                 bLane=row['bLane'],deadlineAt=row['deadlineAt'],recordedAt=row['recordedAt'],
                 predictionSha256=row['predictionSha256'],**settled)
        if odds_path.exists():
            odds=json.loads(odds_path.read_text())
            if odds.get('recordSha256')==hashlib.sha256(raw).hexdigest() and odds.get('predictionSha256')==row['predictionSha256']:
                rec.update(oddsReceivedAt=odds['receivedAt'],bOdds=odds['bOdds'])
        records.append(rec)
    selected=[r for r in records if r['selected']]
    settled=[r for r in selected if r['status']=='SETTLED']
    report=dict(schema='b-over-a-review-v1',generatedAt=now.isoformat(),researchOnly=True,realMoney=False,
                rule='B/Aとも4点×100円。事前記録を変更せず、結果だけを別に照合。条件変更なし。',
                recordedMixed=len(records),selected=len(selected),settled=len(settled),
                bWins=sum(r['bWon'] for r in settled),bHits=sum(r['bHit'] for r in settled),
                stake=400*len(settled),bReturn=sum(r['bReturn'] for r in settled),aReturn=sum(r['aReturn'] for r in settled),
                bProfit=sum(r['bReturn']-400 for r in settled),aProfit=sum(r['aReturn']-400 for r in settled),
                selectedWithOdds=sum('bOdds' in r for r in selected),excluded=excluded,rows=records,
                oddsSource=dict(runId=run_id,observations=len(observations),imported=odds_imported,
                                captured=sum(o.get('capturedCount',0) for o in observations)),
                profitability='NOT_VALIDATED')
    if observations:
        stamp=dict(report['oddsSource'],receivedAt=now.isoformat())
        # Latest receipt is operational metadata, never a prediction.
        (research/'b-over-a-odds-receipt-v1.json').write_text(json.dumps(stamp,ensure_ascii=False,indent=2)+'\n')
    elif (research/'b-over-a-odds-receipt-v1.json').exists():
        report['oddsSource']=json.loads((research/'b-over-a-odds-receipt-v1.json').read_text())
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--repo',type=Path,default=Path('.'));parser.add_argument('--output',type=Path,required=True);parser.add_argument('--artifacts',type=Path);parser.add_argument('--run-id')
    args=parser.parse_args()
    report=run(args.repo,args.output,args.artifacts,args.run_id)
    print(json.dumps({k:v for k,v in report.items() if k!='rows'},ensure_ascii=False))
