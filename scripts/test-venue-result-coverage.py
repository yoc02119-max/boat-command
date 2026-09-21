#!/usr/bin/env python3
"""Offline collector/evaluator regression test; never fetches official results."""
import datetime, importlib.util, json, os, pathlib, shutil, subprocess, sys, tempfile
from unittest.mock import patch

SCRIPTS = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('collector', SCRIPTS / 'venue-post-result-v1.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)
DATE = '2026-09-21'
NOW = datetime.datetime(2026, 9, 21, 18, tzinfo=collector.JST)

def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding='utf-8')

class Response:
    text = '<table><tr><td>3連単</td><td>1-2-3</td><td>1,000円</td></tr></table>'
    def raise_for_status(self): pass

with tempfile.TemporaryDirectory() as tmp:
    root = pathlib.Path(tmp)
    (root / 'scripts').mkdir()
    shutil.copy(SCRIPTS / 'venue-shadow-evaluation-v1.js', root / 'scripts')
    day = root / 'live/kojima' / DATE
    program = dict(schema='boat-command-program-pack-v1', venue='KOJIMA', venueCode='16', date=DATE,
                   deadline='13:00', resultEndpointsIncluded=False, resultIncluded=False, exhibitionIncluded=False)
    shadow = dict(schema='boat-command-venue-shadow-research-v1', venue='KOJIMA', venueCode='16', slug='kojima',
                  date=DATE, deadline='13:00', generatedAt='2026-09-21T03:00:00Z', resultInput=False, payoutInput=False,
                  researchOnly=True, productionEnabled=False, tryEnabled=False, cashNeutral=True,
                  immutableAfterFirstWrite=True, picks=['1-2-3','1-2-4','1-3-2','1-3-4'])
    for race in (1, 2, 3, 4, 5):
        write(day / f'program/race-{race}.json', dict(program, race=race))
    # Race 1 has no predictions; race 2 has a valid pair; race 3 has late predictions.
    # Race 4 has only one prediction; race 5 is not due yet.
    write(day / 'program/race-5.json', dict(program, race=5, deadline='19:00'))
    for race in (2, 3, 4):
        for mode, directory in [('CLASS_BASELINE','class-baseline'), ('PROGRAM_ONLY','program-only')]:
            if race == 4 and mode == 'PROGRAM_ONLY': continue
            value = dict(shadow, race=race, mode=mode)
            if race == 3: value['generatedAt'] = '2026-09-21T04:01:00Z'
            write(day / f'shadow/{directory}/race-{race}.json', value)
    old_cwd = os.getcwd()
    try:
        os.chdir(root)
        args = ['collector', '--slug','kojima','--venue','KOJIMA','--code','16','--date',DATE]
        with patch.object(sys, 'argv', args), patch.object(collector, 'now_jst', return_value=NOW), patch.object(collector.requests, 'get', return_value=Response()) as get:
            collector.main()
            assert get.call_count == 4
            original = (day / 'post/race-1-result.json').read_bytes()
            collector.main()
            assert get.call_count == 4, 'Existing results must not be fetched or overwritten'
            assert (day / 'post/race-1-result.json').read_bytes() == original
    finally:
        os.chdir(old_cwd)
    result = json.loads((day / 'post/race-1-result.json').read_text())
    assert result['trifecta'] == '1-2-3' and result['evaluationEligible'] is False
    assert result['preRaceEvidencePaths'] == []
    assert not (day / 'shadow/program-only/race-1.json').exists()
    assert not (day / 'post/race-5-result.json').exists()
    late_path = day / 'post/race-3-result.json'
    late = json.loads(late_path.read_text())
    assert late['evaluationEligible'] is False
    # Legacy records without the new flag must still reject late predictions.
    del late['evaluationEligible']
    write(late_path, late)
    command = ['node', str(root / 'scripts/venue-shadow-evaluation-v1.js'), 'kojima','KOJIMA','16',DATE]
    subprocess.run(command, check=True, capture_output=True)
    evaluated = json.loads((day / 'research-evaluation-v1.json').read_text())
    assert [r['race'] for r in evaluated['rows']] == [2], 'Missing/late predictions must not enter evaluation'
    assert evaluated['summary']['programOnly']['stake'] == 400
    # Removing eligibility must clear a previously populated daily evaluation and its aggregate.
    result_path = day / 'post/race-2-result.json'
    value = json.loads(result_path.read_text()); value['evaluationEligible'] = False
    write(result_path, value)
    subprocess.run(command, check=True, capture_output=True)
    assert json.loads((day / 'research-evaluation-v1.json').read_text())['rows'] == []
    assert json.loads((root / 'kojima-shadow-evaluation-v1.json').read_text())['pairedRaces'] == 0
print('PASS: result coverage, immutable results, no prediction backfill, deadline, paired evaluation, stale count clearing')
