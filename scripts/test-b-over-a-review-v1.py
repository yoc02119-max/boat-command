import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec=importlib.util.spec_from_file_location('review',Path(__file__).with_name('b-over-a-review-v1.py'))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=m.clock('2026-11-07T03:00:00Z')


def fixture():
    row=dict(date='2026-11-07',venue='toda',venueCode='02',race=1,deadlineAt='2026-11-07T10:00:00+09:00',
             generatedAt='2026-11-07T00:00:00Z',recordedAt='2026-11-07T00:01:00Z',researchOnly=True,realMoney=False,
             bLane=1,aLane=2,bScore=.4,aScore=.3,selected=True,predictionSha256='a'*64,
             source='live/toda/2026-11-07/shadow/program-only/race-1.json',
             bPicks=['1-2-3','1-2-4','1-2-5','1-2-6'],aPicks=['2-1-3','2-1-4','2-1-5','2-1-6'])
    result=dict(schema='boat-command-live-result-v1',venueCode='02',race=1,date='2026-11-07',fetchedAt='2026-11-07T01:20:00Z',
                resultEndpointsIncluded=True,preRaceDataIncluded=False,trifecta='1-2-3',payout100=2500)
    obs=dict(version='TRY-ODDS-OBSERVER-V1',date='2026-11-07',resultEndpointsRequested=False,payoutEndpointsRequested=False)
    odds=dict(race=1,status='CAPTURED',predictionSha256='a'*64,requestStartedAt='2026-11-07T00:55:00Z',receivedAt='2026-11-07T00:55:01Z',
              sourceUrl='https://www.boatrace.jp/owpc/pc/race/odds3t?rno=1&jcd=02&hd=20261107',
              odds={f'{i}-{j}-{k}':25.0 for i in range(1,7) for j in range(1,7) for k in range(1,7) if len({i,j,k})==3})
    return row,result,obs,odds


class Test(unittest.TestCase):
    def test_equal_budget_hit_and_loss(self):
        row,result,_,_=fixture();r=m.result_review(row,result,NOW)
        self.assertEqual((r['stake'],r['bReturn'],r['aReturn']),(400,2500,0))
        result['trifecta']='3-1-2';r=m.result_review(row,result,NOW)
        self.assertEqual((r['bReturn'],r['aReturn'],r['bWon']),(0,0,False))

    def test_recorded_after_cutoff(self):
        row,result,_,_=fixture();row['recordedAt']='2026-11-07T00:58:00Z'
        with self.assertRaises(ValueError):m.result_review(row,result,NOW)

    def test_future_or_early_result(self):
        row,result,_,_=fixture()
        for date in ['2026-11-07T00:59:00Z','2026-11-07T04:00:00Z']:
            result['fetchedAt']=date
            with self.assertRaises(ValueError):m.result_review(row,result,NOW)

    def test_wrong_result_identity(self):
        row,result,_,_=fixture();result['venueCode']='03'
        with self.assertRaises(ValueError):m.result_review(row,result,NOW)

    def test_missing_payout_not_counted_as_loss(self):
        row,result,_,_=fixture();result['payout100']=None
        with self.assertRaises(ValueError):m.result_review(row,result,NOW)

    def test_odds_boundary_and_hash(self):
        row,_,obs,odds=fixture();self.assertEqual(len(m.accept_odds(row,obs,odds,NOW)['bOdds']),4)
        odds['predictionSha256']='b'*64
        with self.assertRaises(ValueError):m.accept_odds(row,obs,odds,NOW)

    def test_late_odds(self):
        row,_,obs,odds=fixture();odds['receivedAt']='2026-11-07T00:58:00Z'
        with self.assertRaises(ValueError):m.accept_odds(row,obs,odds,NOW)

    def test_incomplete_and_post_odds(self):
        row,_,obs,odds=fixture();odds['odds'].pop('1-2-3')
        with self.assertRaises(ValueError):m.accept_odds(row,obs,odds,NOW)
        row,_,obs,odds=fixture();obs['resultEndpointsRequested']=True
        with self.assertRaises(ValueError):m.accept_odds(row,obs,odds,NOW)

    def test_first_odds_record_is_immutable(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'race.json';self.assertTrue(m.write_once(p,{'value':1}));self.assertFalse(m.write_once(p,{'value':2}));self.assertEqual(json.loads(p.read_text()),{'value':1})

    def test_full_flow_preserves_inputs_and_denominator(self):
        row,result,obs,odds=fixture()
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp); f=root/'research/b-over-a-forward-v1/2026-11-07/toda/race-1.json';f.parent.mkdir(parents=True);f.write_text(json.dumps(row));raw=f.read_bytes()
            p=root/'live/toda/2026-11-07/post/race-1-result.json';p.parent.mkdir(parents=True);p.write_text(json.dumps(result))
            obs.update(capturedCount=1,venues=[dict(venueCode='02',slug='toda',races=[odds])]);artifact=root/'artifact';artifact.mkdir();(artifact/'observation.json').write_text(json.dumps(obs))
            r=m.run(root,root/'research/review.json',artifact,'123',NOW)
            self.assertEqual((r['settled'],r['bProfit'],r['aProfit'],r['selectedWithOdds']),(1,2100,-400,1));self.assertEqual(raw,f.read_bytes())
            p.unlink();r=m.run(root,root/'research/review.json',now=NOW)
            self.assertEqual((r['settled'],r['stake'],r['bProfit']),(0,0,0));self.assertEqual(r['rows'][0]['status'],'WAITING_RESULT')


unittest.main()
