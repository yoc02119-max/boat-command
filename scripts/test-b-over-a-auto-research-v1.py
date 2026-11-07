import copy,datetime as dt,importlib.util,json,tempfile,unittest
from pathlib import Path
s=importlib.util.spec_from_file_location('auto',Path(__file__).with_name('b-over-a-auto-research-v1.py'));a=importlib.util.module_from_spec(s);s.loader.exec_module(a)
POLICY=json.loads(Path(__file__).resolve().parents[1].joinpath('research/b-over-a-auto-policy-v1.json').read_text());POLICY['effectiveDate']='2026-01-01'

def row(day,i=1,ret=900):
    return dict(id=f'{day}/01/{i}',date=day,venueCode='01',bLane=1,bScore=.5 if i%2 else .35,aScore=.2,coverage=.2 if i%2 else .1,status='SETTLED',bReturn=ret,recordSha256='a'*64,recordedAt=day+'T07:00:00+09:00',deadlineAt=day+'T12:00:00+09:00')

def population(days=35):
    out=[]
    for n in range(days):
        day=(dt.date(2026,1,1)+dt.timedelta(days=n)).isoformat()
        for i in range(1,7):out.append(row(day,i,900 if i%2 else 0))
    return out

class Test(unittest.TestCase):
    def test_equal_money_despite_filtered_race_count(self):
        rows=[row('2026-01-01',i) for i in range(1,7)]
        p,_=a.compare(rows,dict(minMargin=.25,minCoverage=.15,ranking='coverage'),a.BASE)
        m=a.metrics(p);self.assertEqual(m['pairedRaces'],3);self.assertEqual(m['stakeEach'],1200)
        self.assertEqual(len({r['trialId'] for r in p}),3)

    def test_missing_result_blocks_whole_day_not_loss(self):
        rows=[row('2026-01-01',i) for i in range(1,7)];rows[-1]['status']='WAITING_RESULT'
        p,blocked=a.compare(rows,a.BASE,a.BASE);self.assertFalse(p);self.assertEqual(blocked,['2026-01-01'])

    def test_insufficient_sample_cannot_promote(self):
        pairs=[dict(date='2026-01-01',trialReturn=1000000,baseReturn=0) for _ in range(3)]
        self.assertEqual(a.gate(pairs,POLICY,1,'fixed')['decision'],'WAIT')

    def test_one_jackpot_not_stable_improvement(self):
        pp=[]
        for d in range(20):
            for i in range(5):pp.append(dict(date=str(d),trialReturn=200000 if d==0 else 0,baseReturn=0))
        self.assertEqual(a.gate(pp,POLICY,1,'fixed')['decision'],'REJECT')

    def test_stable_improvement_passes_fixed_gate(self):
        pp=[dict(date=str(d),trialReturn=900,baseReturn=0) for d in range(20) for i in range(5)]
        r=a.gate(pp,POLICY,1,'fixed');self.assertEqual(r['decision'],'ADOPT');self.assertGreater(r['bootstrapLowerDailyDifference'],0)
        self.assertEqual(r,a.gate(pp,POLICY,1,'fixed'))
        self.assertLess(a.gate(pp,POLICY,2,'fixed')['alpha'],r['alpha'])

    def test_new_hypothesis_records_all_trials_and_starts_tomorrow(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);state={};rr=population(9);today='2026-02-01';now=a.review.clock(today+'T00:00:00Z')
            v=a.advance('01',rr,state,POLICY,today,now,root);trial=copy.deepcopy(state['01']['trial'])
            self.assertEqual(trial['validationStartDate'],'2026-02-02');self.assertGreater(trial['trialCount'],1)
            self.assertTrue(all(x['id'][:10]<today for x in trial['trainingSourceIds']))
            a.advance('01',rr,state,POLICY,today,now,root);self.assertEqual(state['01']['trial'],trial)
            self.assertEqual(len(list(root.rglob('*proposal.json'))),1)

    def test_future_results_do_not_select_hypothesis(self):
        with tempfile.TemporaryDirectory() as x,tempfile.TemporaryDirectory() as y:
            state1={};state2={};now=a.review.clock('2026-02-01T00:00:00Z');rr=population(9)
            a.advance('01',rr,state1,POLICY,'2026-02-01',now,Path(x))
            a.advance('01',rr+[row('2026-02-01',1,999999)],state2,POLICY,'2026-02-01',now,Path(y))
            self.assertEqual(state1['01']['trial'],state2['01']['trial'])

    def test_holdout_never_reuses_exploration_dates(self):
        with tempfile.TemporaryDirectory() as tmp:
            state={};now=a.review.clock('2026-02-01T00:00:00Z');rr=population(9);root=Path(tmp)
            a.advance('01',rr,state,POLICY,'2026-02-01',now,root)
            v=a.advance('01',rr,state,POLICY,'2026-02-03',a.review.clock('2026-02-03T00:00:00Z'),root)
            self.assertEqual(v['validation']['metrics']['pairedRaces'],0)

    def test_venue_isolation(self):
        with tempfile.TemporaryDirectory() as tmp:
            state={};now=a.review.clock('2026-02-01T00:00:00Z');root=Path(tmp)
            a.advance('01',population(9),state,POLICY,'2026-02-01',now,root)
            v=a.advance('02',[],state,POLICY,'2026-02-01',now,root)
            self.assertIsNone(state['02']['trial']);self.assertEqual(v['closedResults'],0)

    def test_adoption_only_next_day(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);today='2026-04-01';now=a.review.clock(today+'T00:00:00Z');rr=population(35)
            # Trial ranks the higher-return odd boats above even boats. Incumbent ranks all equal.
            for r in rr:r['bScore']=.4;r['aScore']=.2;r['coverage']=.3 if int(r['id'].split('/')[-1])%2 else .1
            rule=dict(minMargin=0,minCoverage=.2,ranking='coverage')
            trial=dict(id='fixed',round=1,validationStartDate='2026-01-01',rule=rule,incumbent=a.BASE)
            state={'01':dict(round=1,phase='VALIDATING',rules=[],trial=trial,lastDecisionDate=None)}
            v=a.advance('01',rr,state,POLICY,today,now,root)
            self.assertEqual(state['01']['phase'],'ADOPT');self.assertEqual(v['activeRule'],a.BASE)
            self.assertEqual(v['nextRule']['effectiveDate'],'2026-04-02');self.assertTrue(list(root.rglob('*decision.json')))

    def test_policy_change_cannot_rejudge_trial(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);a.dump(root/'research/b-over-a-auto-policy-v1.json',POLICY)
            a.dump(root/'research/b-over-a-auto-state-v1.json',dict(schema='b-over-a-auto-state-v1',venues={},policySha256='wrong'))
            with self.assertRaisesRegex(ValueError,'policy_changed'):a.run(root)


    def test_later_input_cannot_rank_an_earlier_race(self):
        rr=[row('2026-01-01',i) for i in range(1,7)]
        rr[0]['recordedAt']='2026-01-01T09:00:00+09:00';rr[0]['bReturn']=999999
        pairs,_=a.compare(rr,a.BASE,a.BASE)
        self.assertTrue(all(p['trialId']!=rr[0]['id'] and p['baseId']!=rr[0]['id'] for p in pairs))

    def test_one_venue_bad_input_does_not_use_future_or_promote(self):
        with tempfile.TemporaryDirectory() as tmp:
            state={};v=a.advance('01',population(9),state,POLICY,'2026-02-01',a.review.clock('2026-02-01T00:00:00Z'),Path(tmp),['2026-01-02'])
            self.assertEqual(v['phase'],'WAITING_DATA_REPAIR');self.assertIsNone(state['01']['trial'])

unittest.main()
