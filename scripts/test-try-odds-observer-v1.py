import copy
import datetime as dt
import importlib.util
import json
import pathlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('observer', pathlib.Path(__file__).with_name('try-odds-observer-v1.py'))
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
NOW = dt.datetime.fromisoformat('2026-11-02T03:55:00+00:00')


def grid():
    rows = []
    for second_index in range(5):
        for third_index in range(4):
            cells = []
            for first in range(1,7):
                second = [x for x in range(1,7) if x != first][second_index]
                third = [x for x in range(1,7) if x not in (first, second)][third_index]
                if third_index == 0:
                    cells.append(f'<td rowspan="4">{second}</td>')
                cells.extend([f'<td>{third}</td>', '<td class="oddsPoint">10.0</td>'])
            rows.append('<tr>'+''.join(cells)+'</tr>')
    return ('3連単オッズ<tbody class="is-p3-0">'+''.join(rows)+'</tbody>').encode()


def page():
    return grid()+b'/owpc/pc/race/beforeinfo?rno=1&jcd=01&hd=20261102 /owpc/pc/race/racelist?rno=1&jcd=01&hd=20261102'


def prediction():
    return dict(venueCode='01',slug='v01',date='2026-11-02',race=1,deadline='13:00',
                generatedAt='2026-11-02T03:00:00Z', resultInput=False,payoutInput=False,
                immutableAfterFirstWrite=True,picks=['1-2-3','1-2-4','1-2-5','1-2-6'],
                probabilities=[dict(order=x,probability=.1) for x in ['1-2-3','1-2-4','1-2-5','1-2-6']])


class Contract(unittest.TestCase):
    def test_grid(self):
        odds=m.parse_odds(grid())
        self.assertEqual(len(odds),120); self.assertEqual(odds['6-5-4'],10)
        for bad in [grid().replace(b'10.0',b'---',1),grid().replace(b'rowspan="4"',b'rowspan="3"',1),b'no data']:
            with self.assertRaises(ValueError):m.parse_odds(bad)

    def run_capture(self, data=None, clock=None, mutate=None):
        with tempfile.TemporaryDirectory() as temp:
            root=pathlib.Path(temp)/'repo';root.mkdir()
            (root/'shared-try-config-v1.json').write_text(json.dumps({'activeAdapters':[dict(venueCode=f'{i:02}',slug=f'v{i:02}') for i in range(1,25)]}))
            p=root/'live/v01/2026-11-02/shadow/program-only/race-1.json';p.parent.mkdir(parents=True)
            x=prediction()
            if mutate:mutate(x)
            p.write_text(json.dumps(x))
            # POST is deliberately invalid: observer must never read it.
            post=root/'live/v01/2026-11-02/post/race-1-result.json';post.parent.mkdir();post.write_text('INVALID POST')
            before={str(p):p.read_bytes() for p in root.rglob('*') if p.is_file()}
            report=m.observe(root,pathlib.Path(temp)/'output',NOW,lambda u:(data or page(),u),clock or (lambda:NOW))
            self.assertEqual(before,{str(p):p.read_bytes() for p in root.rglob('*') if p.is_file()})
            self.assertEqual(len(report['venues']),24)
            self.assertFalse(report['promotionEligible'])
            self.assertTrue(all(r['decision']=='SKIP' for v in report['venues'] for r in v['races']))
            return report

    def test_capture_and_no_live_mutation(self):
        r=self.run_capture();self.assertEqual(r['capturedCount'],1)
        self.assertEqual(r['venues'][0]['races'][0]['uncalibratedExpectedGrossReturnPerYen'],1)
        self.assertEqual(r['venues'][1]['races'][0]['status'],'MISSING_PREDICTION')

    def test_reject_closed_wrong_identity_late_and_contamination(self):
        for bad in [page()+ '締切時オッズ'.encode(),page().replace(b'jcd=01',b'jcd=02'),b'no data']:
            self.assertEqual(self.run_capture(bad)['capturedCount'],0)
        times=iter([NOW,NOW+dt.timedelta(minutes=3)])
        self.assertEqual(self.run_capture(clock=lambda:next(times))['capturedCount'],0)
        self.assertEqual(self.run_capture(mutate=lambda x:x.update(resultInput=True))['capturedCount'],0)
        self.assertEqual(self.run_capture(mutate=lambda x:x.update(generatedAt='2026-11-02T13:00:00Z'))['capturedCount'],0)


if __name__=='__main__':unittest.main()
