"""Venue-isolated, preregistered hypothesis/search/untouched-future test/next-day TRY rules.
No LLM calls, no external requests, no edits to PRE forecasts, funds or fixed TRY.
"""
import argparse, datetime as dt, hashlib, importlib.util, json, math, random, statistics, subprocess
from pathlib import Path
S=importlib.util.spec_from_file_location('review',Path(__file__).with_name('b-over-a-review-v1.py'))
review=importlib.util.module_from_spec(S);S.loader.exec_module(review)
JST=dt.timezone(dt.timedelta(hours=9)); BASE={'minMargin':0.0,'minCoverage':0.0,'ranking':'margin'}

def dump(path,x,once=False):
    path.parent.mkdir(parents=True,exist_ok=True)
    if once:return review.write_once(path,x)
    path.write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')

def read(path,default=None):
    return json.loads(path.read_text()) if path.exists() else default

def digest(x):return hashlib.sha256(json.dumps(x,sort_keys=True,separators=(',',':')).encode()).hexdigest()

def tomorrow(day):return (dt.date.fromisoformat(day)+dt.timedelta(days=1)).isoformat()

def accepted(row,rule):
    return row['bScore']>row['aScore'] and row['bScore']-row['aScore']>=rule['minMargin'] and row['coverage']>=rule['minCoverage']

def picks(rows,rule):
    return sorted((r for r in rows if accepted(r,rule)),key=lambda r:(-(r['coverage'] if rule['ranking']=='coverage' else r['bScore']-r['aScore']),r['id']))

def morning_pool(row):
    decision=review.clock(row['date']+'T07:30:00+09:00')
    return review.clock(row['recordedAt'])<=decision and review.clock(row['deadlineAt'])>decision+dt.timedelta(minutes=5)

def compare(rows,trial,incumbent,limit=3):
    days={}
    for r in rows:
        if r['bScore']>r['aScore'] and morning_pool(r):days.setdefault(r['date'],[]).append(r)
    pairs=[];blocked=[]
    for date,rr in sorted(days.items()):
        if any(r['status'] not in ['SETTLED','CANCELLED'] for r in rr):blocked.append(date);continue
        rr=[r for r in rr if r['status']=='SETTLED']
        a,b=picks(rr,trial),picks(rr,incumbent);k=min(limit,len(a),len(b))
        for x,y in zip(a[:k],b[:k]):
            pairs.append(dict(date=date,trialId=x['id'],baseId=y['id'],trialReturn=x['bReturn'],baseReturn=y['bReturn'],stake=400))
    return pairs,blocked

def metrics(pairs):
    daily={}
    for p in pairs:
        day=daily.setdefault(p['date'],dict(trial=0,baseline=0,stake=0));day['trial']+=p['trialReturn'];day['baseline']+=p['baseReturn'];day['stake']+=400
    stake=400*len(pairs);ret=sum(p['trialReturn'] for p in pairs);base=sum(p['baseReturn'] for p in pairs)
    return dict(pairedRaces=len(pairs),days=len(daily),stakeEach=stake,trialReturn=ret,baselineReturn=base,trialProfit=ret-stake,baselineProfit=base-stake,trialRoi=ret/stake if stake else None,daily=daily)

def gate(pairs,policy,round_id,seed):
    m=metrics(pairs);g=policy['validation']
    if m['pairedRaces']<g['minimumPairedRaces'] or m['days']<g['minimumDays']:
        return dict(decision='WAIT',reason='NEED_MORE_UNSEEN_RACES_AND_DAYS',metrics=m,remainingRaces=max(0,g['minimumPairedRaces']-m['pairedRaces']),remainingDays=max(0,g['minimumDays']-m['days']))
    ds=list(m['daily'].values());diff=[x['trial']-x['baseline'] for x in ds]
    alpha=g['familyAlpha']/(24*2*(round_id+1)**2)
    rng=random.Random(seed);draws=sorted(statistics.mean(rng.choices(diff,k=len(diff))) for _ in range(g['bootstrapSamples']))
    lower=draws[max(0,math.floor(alpha*len(draws))-1)]
    without_best=m['trialProfit']-max(x['trial']-x['stake'] for x in ds)
    passed=m['trialRoi']>=g['minimumCandidateRoi'] and lower>0 and without_best>0
    return dict(decision='ADOPT' if passed else 'REJECT',reason='FIXED_GATE_PASS' if passed else 'FIXED_GATE_NOT_MET',metrics=m,bootstrapLowerDailyDifference=lower,alpha=alpha,profitWithoutBestDay=without_best)

def recipes(rows,policy):
    def q(values,p):
        values=sorted(values)
        return values[min(len(values)-1,int((len(values)-1)*p))] if values else 0
    margins=[0 if p==0 else q([r['bScore']-r['aScore'] for r in rows],p) for p in policy['search']['marginQuantiles']]
    coverage=[0 if p==0 else q([r['coverage'] for r in rows],p) for p in policy['search']['coverageQuantiles']]
    out={}
    for a in margins:
        for b in coverage:
            for ranking in policy['search']['rankings']:
                r=dict(minMargin=round(max(0,a),6),minCoverage=round(max(0,b),6),ranking=ranking);out[digest(r)]=r
    return list(out.values())[:policy['search']['maximumVariantsPerRound']]

def cancellation(root,row):
    for path in [root/'live'/row['venue']/row['date']/'post'/f"race-{row['race']}-status.json",root/'live'/row['venue']/row['date']/'post/day-status.json']:
        x=read(path)
        if not x:continue
        if x.get('venueCode')!=row['venueCode'] or x.get('date')!=row['date'] or x.get('status')!='CANCELLED':continue
        if 'race' in x and x['race']!=row['race']:continue
        if x.get('immutableAfterFirstWrite') is True and x.get('selectionMutation') is False and x.get('preRaceDataIncluded') is False and x.get('resultEndpointsIncluded') is True:return True
    return False

def load_rows(root,now):
    rows=[];excluded={};invalid=[];venues={a['slug']:a['venueCode'] for a in read(root/'shared-try-config-v1.json')['activeAdapters']}
    for f in sorted((root/'research/b-over-a-forward-v1').glob('*/*/race-*.json')):
        try:
            row=json.loads(f.read_text());review.validate(row,now)
            if venues.get(row['venue'])!=row['venueCode']:raise ValueError('venue_registry_mismatch')
            if f.relative_to(root/'research/b-over-a-forward-v1').as_posix()!=f"{row['date']}/{row['venue']}/race-{row['race']}.json":raise ValueError('record_path_identity')
            raw=(root/row['source']).read_bytes();pre=json.loads(raw)
            if hashlib.sha256(raw).hexdigest()!=row['predictionSha256']:raise ValueError('prediction_hash_changed')
            if pre.get('resultInput') is not False or pre.get('payoutInput') is not False or pre.get('immutableAfterFirstWrite') is not True:raise ValueError('unsafe_pre')
            if any(str(pre.get(k))!=str(row[k]) for k in ['date','race','venueCode','generatedAt']):raise ValueError('prediction_identity')
            if review.clock(row['deadlineAt']).strftime('%H:%M')!=pre['deadline']:raise ValueError('prediction_deadline')
            ranked=pre.get('pointExpansion',{}).get('ranked',[])
            expected={f'{i}-{j}-{k}' for i in range(1,7) for j in range(1,7) for k in range(1,7) if len({i,j,k})==3}
            if len(ranked)!=120 or {x['order'] for x in ranked}!=expected:raise ValueError('distribution_incomplete')
            if any(type(x['probability']) not in (int,float) or not math.isfinite(x['probability']) or not 0<=x['probability']<=1 for x in ranked):raise ValueError('invalid_probability')
            if abs(sum(x['probability'] for x in ranked)-1)>1e-5:raise ValueError('invalid_mass')
            weights={i:sum(x['probability'] for x in ranked if int(x['order'][0])==i) for i in range(1,7)}
            if abs(weights[row['bLane']]-row['bScore'])>1e-8 or abs(weights[row['aLane']]-row['aScore'])>1e-8:raise ValueError('record_score_changed')
            features=pre.get('preRaceFeatures',{})
            boats=features.get('boats',[])
            if features.get('resultInput') is not False or features.get('payoutInput') is not False or len(boats)!=6 or {b['lane'] for b in boats}!=set(range(1,7)) or any(b.get('class') not in ['A1','A2','B1','B2'] for b in boats):raise ValueError('frozen_classes_missing')
            aa=[b for b in boats if b['class'].startswith('A')];bb=[b for b in boats if b['class'].startswith('B')]
            if not aa or not bb:raise ValueError('not_mixed')
            best=lambda xs:max(xs,key=lambda x:(weights[x['lane']],-x['lane']))
            if best(bb)['lane']!=row['bLane'] or best(aa)['lane']!=row['aLane']:raise ValueError('winner_lane_changed')
            expected_picks=[x['order'] for x in sorted(ranked,key=lambda x:(-x['probability'],x['order'])) if int(x['order'][0])==row['bLane']][:4]
            if expected_picks!=row['bPicks']:raise ValueError('four_picks_changed')
            covered=sum(x['probability'] for x in ranked if x['order'] in row['bPicks'])
            result=read(root/'live'/row['venue']/row['date']/'post'/f"race-{row['race']}-result.json")
            try:
                if not result and cancellation(root,row):settled={'status':'CANCELLED'}
                else:settled=review.result_review(row,result,now)
            except (ValueError,KeyError,TypeError) as e:
                settled={'status':'RESULT_UNUSABLE','reason':str(e)}
            rows.append(dict(row,**settled,coverage=covered,id=f"{row['date']}/{row['venueCode']}/{row['race']}",recordSha256=hashlib.sha256(f.read_bytes()).hexdigest()))
        except (ValueError,KeyError,TypeError,FileNotFoundError) as e:
            reason=type(e).__name__+':'+str(e);excluded[reason]=excluded.get(reason,0)+1
            invalid.append(dict(venueCode=venues.get(f.parent.name),date=f.parent.parent.name,reason=reason))
    return rows,excluded,invalid

def advance(code,rr,state,policy,today,now,root,invalidDates=()):
    s=state.setdefault(code,dict(round=0,phase='COLLECTING',rules=[],trial=None,lastDecisionDate=None))
    closed=[r for r in rr if r['date']<today and r['bScore']>r['aScore'] and morning_pool(r)]
    settled=[r for r in closed if r['status']=='SETTLED'];days=len({r['date'] for r in settled})
    training=policy['training'];v=dict(venueCode=code,phase=s['phase'],recorded=len(rr),availableAtMorningDecision=sum(morning_pool(r) for r in rr),closedResults=len(settled),resultMissing=sum(r['status'] not in ['SETTLED','CANCELLED'] for r in closed),trainingRemainingRaces=max(0,training['minimumRaces']-len(settled)),trainingRemainingDays=max(0,training['minimumDays']-days))
    incumbent=next((x['rule'] for x in reversed(s['rules']) if x['effectiveDate']<=today),BASE)
    trial=s['trial']
    bad=[d for d in invalidDates if d<today and (not trial or d>=trial['validationStartDate'])]
    if bad:
        s['phase']='WAITING_DATA_REPAIR';v.update(phase=s['phase'],integrityBlockedDates=sorted(set(bad)),activeRule=incumbent,nextRule=None);return v
    if trial:
        future=[r for r in closed if r['date']>=trial['validationStartDate']]
        pairs,blocked=compare(future,trial['rule'],trial['incumbent'],policy['comparison']['maximumRacesPerVenueDay'])
        outcome=gate(pairs,policy,trial['round'],trial['id']);v.update(experimentId=trial['id'],hypothesis=trial['rule'],validation=outcome,blockedDates=blocked)
        if outcome['decision']!='WAIT' and s['lastDecisionDate']!=today:
            result=dict(schema='b-over-a-auto-decision-v1',venueCode=code,experimentId=trial['id'],evaluatedAt=now.isoformat(),trial=trial,outcome=outcome,sourceIds=pairs,independentStartDate=trial['validationStartDate'],realMoney=False,modelChanged=False)
            dump(root/'research/b-over-a-auto-history-v1'/code/(trial['id']+'-decision.json'),result,True)
            if outcome['decision']=='ADOPT':
                s['rules'].append(dict(effectiveDate=max(tomorrow(today),policy['effectiveDate']),rule=trial['rule'],experimentId=trial['id'],decisionPath=f"research/b-over-a-auto-history-v1/{code}/{trial['id']}-decision.json",decisionSha256=hashlib.sha256((root/'research/b-over-a-auto-history-v1'/code/(trial['id']+'-decision.json')).read_bytes()).hexdigest(),gatePass=True))
            s.update(trial=None,phase=outcome['decision'],lastDecisionDate=today)
        else:s['phase']='VALIDATING'
    elif len(settled)>=training['minimumRaces'] and days>=training['minimumDays'] and s['lastDecisionDate']!=today:
        tried=[]
        for rule in recipes(settled,policy):
            pairs,_=compare(closed,rule,incumbent,policy['comparison']['maximumRacesPerVenueDay']);m=metrics(pairs)
            if m['pairedRaces']>=10:tried.append(dict(rule=rule,metrics=m))
        available=[x for x in tried if x['rule']!=incumbent]
        if available:
            chosen=max(available,key=lambda x:((x['metrics']['trialProfit']-x['metrics']['baselineProfit'])/x['metrics']['pairedRaces'],x['metrics']['trialRoi'],digest(x['rule'])))
            s['round']+=1;eid=f"{today}-{s['round']}-{digest(chosen['rule'])[:12]}"
            trial=dict(analysisCodeSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),id=eid,round=s['round'],venueCode=code,createdAt=now.isoformat(),explorationEndDate=(dt.date.fromisoformat(today)-dt.timedelta(days=1)).isoformat(),validationStartDate=tomorrow(today),rule=chosen['rule'],incumbent=incumbent,policySha256=digest(policy),origin='Owner requested B-over-A auto-research on 2026-11-07; deterministic margin/coverage/ranking search',trainingSourceIds=[dict(id=r['id'],sha256=r['recordSha256']) for r in settled],allTrials=tried,trialCount=len(tried),hypothesisReason='Highest exploration profit difference per equal-budget pair; not independent validation',successCriteria=policy['validation'])
            dump(root/'research/b-over-a-auto-history-v1'/code/(eid+'-proposal.json'),trial,True)
            s.update(trial=trial,phase='VALIDATING',lastDecisionDate=today);v.update(experimentId=eid,hypothesis=trial['rule'])
        else:s['phase']='NEED_COMPARABLE_TRAINING'
    v['phase']=s['phase'];v['activeRule']=incumbent;v['nextRule']=s['rules'][-1] if s['rules'] and s['rules'][-1]['effectiveDate']>today else None
    return v

def run(root,now=None):
    now=now or dt.datetime.now(dt.timezone.utc);today=now.astimezone(JST).date().isoformat();research=root/'research'
    policy=read(research/'b-over-a-auto-policy-v1.json')
    if policy.get('schema')!='b-over-a-auto-research-policy-v1' or policy.get('enabled') is not True:raise ValueError('auto_policy_not_enabled')
    state=read(research/'b-over-a-auto-state-v1.json',{'schema':'b-over-a-auto-state-v1','venues':{}})
    if state.get('schema')!='b-over-a-auto-state-v1':raise ValueError('state_schema')
    if state.get('policySha256') and state['policySha256']!=digest(policy):raise ValueError('policy_changed_during_registered_experiments')
    if state.get('lastRunAt') and review.clock(state['lastRunAt'])>now:raise ValueError('clock_rollback')
    rows,excluded,invalid=load_rows(root,now);venues=[]
    for n in range(1,25):
        code=f'{n:02}';venues.append(advance(code,[r for r in rows if r['venueCode']==code],state['venues'],policy,today,now,root,[r['date'] for r in invalid if r['venueCode']==code]))
    report=dict(sourceHead=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),analysisCodeSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),schema='b-over-a-auto-report-v1',generatedAt=now.isoformat(),date=today,policy=policy,policySha256=digest(policy),venues=venues,excluded=excluded,recorded=len(rows),profitability='NOT_PROVEN',productionModelsChanged=False,ruleSearch='PREDECLARED_MARGIN_COVERAGE_RANKING_ONLY',dailyHypotheses=[dict(venueCode=v['venueCode'],ideas=recipes([r for r in rows if r['venueCode']==v['venueCode'] and r['date']<today and r['status']=='SETTLED' and morning_pool(r)],policy)) for v in venues],summary={phase:sum(v['phase']==phase for v in venues) for phase in sorted({v['phase'] for v in venues})})
    state['lastRunAt']=now.isoformat();state['policySha256']=digest(policy)
    active=dict(schema='b-over-a-active-rules-v1',generatedAt=now.isoformat(),policySha256=digest(policy),enabled=True,venues={code:s['rules'] for code,s in state['venues'].items()})
    dump(research/'b-over-a-auto-state-v1.json',state);dump(research/'b-over-a-active-rules-v1.json',active);dump(research/'b-over-a-auto-report-v1.json',report);dump(research/'b-over-a-auto-daily-v1'/f'{today}.json',report)
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',type=Path,default=Path('.'));a=p.parse_args();r=run(a.repo)
    print(json.dumps({k:r[k] for k in ['date','recorded','summary','excluded']},ensure_ascii=False))
