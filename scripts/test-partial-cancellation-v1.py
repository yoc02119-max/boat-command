"""Offline regression: race-level cancellation never voids completed neighbours."""
import datetime, importlib.util, json, os, pathlib, shutil, subprocess, sys, tempfile
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('collector',ROOT/'scripts/venue-post-result-v1.py')
c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
DATE='2026-10-28'
def write(p,x):
 p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x))
class Response:
 def __init__(self,url):
  race=int(parse_qs(urlparse(url).query)['rno'][0]);self.url=url
  self.text='<table><tr><td>3連単</td><td>1-2-3</td><td>1,000円</td></tr></table>' if race==1 else '<h3>レース中止</h3>' if race in (6,8) else '<nav>レース中止</nav><h3>結果準備中</h3>'
  if race==8:self.url=url.replace('rno=8','rno=9')
  self.content=self.text.encode()
 def raise_for_status(self):pass
with tempfile.TemporaryDirectory() as tmp:
 root=pathlib.Path(tmp);day=root/'live/edogawa'/DATE
 cfg=json.load(open(ROOT/'shared-try-config-v1.json'));write(root/'shared-try-config-v1.json',cfg)
 (root/'scripts').mkdir();shutil.copy(ROOT/'scripts/shared-try-portfolio-v1.js',root/'scripts')
 rows=[]
 for race in (1,6,7,8):
  write(day/f'program/race-{race}.json',dict(schema='boat-command-program-pack-v1',venue='EDOGAWA',venueCode='03',date=DATE,race=race,deadline='13:00',resultEndpointsIncluded=False,resultIncluded=False,exhibitionIncluded=False))
  rows.append(dict(date=DATE,slug='edogawa',venue='EDOGAWA',venueCode='03',race=race,deadline='13:00',picks=['1-2-3','1-2-4','1-3-2','1-3-4'],stakePerPickYen=200,stakeYen=800))
 sel=root/'live/portfolio'/DATE/'try-selection-v1.json';write(sel,dict(immutableAfterFirstWrite=True,selected=rows,selectedCount=4,status='TRY_FROZEN'));frozen=sel.read_bytes()
 old=os.getcwd()
 try:
  os.chdir(root)
  args=['collector','--slug','edogawa','--venue','EDOGAWA','--code','03','--date',DATE,'--recover-pending']
  with patch.object(sys,'argv',args),patch.object(c,'now_jst',return_value=datetime.datetime(2026,10,29,17,tzinfo=c.JST)),patch.object(c.requests,'get',side_effect=lambda url,**kw:Response(url)):
   c.main();saved=(day/'post/race-6-status.json').read_bytes();c.main();assert saved==(day/'post/race-6-status.json').read_bytes()
  assert not (day/'post/day-status.json').exists()
  assert not (day/'post/race-7-status.json').exists(),'navigation is not cancellation evidence'
  assert not (day/'post/race-8-status.json').exists(),'redirected race cannot cancel requested race'
  assert not (day/'shadow').exists(),'POST recovery cannot generate predictions'
  run=lambda:subprocess.run(['node','scripts/shared-try-portfolio-v1.js',DATE],env={**os.environ,'BOAT_COMMAND_NOW_ISO':DATE+'T20:00:00+09:00'},check=True,capture_output=True)
  run();p=json.load(open('shared-try-portfolio-v1.json'))
  assert p['settledTries']==1 and p['hits']==1 and p['voidedTries']==1 and p['pendingTries']==2
  assert p['confirmedBankrollYen']==101200 and p['availableBankrollYen']==99600
  assert p['voidedStakeYen']==800 and p['roi']==2.5 and p['settledStakeYen']==800
  assert sel.read_bytes()==frozen
  bad=json.loads(saved);bad['race']=7;write(day/'post/race-6-status.json',bad);run()
  assert json.load(open('shared-try-portfolio-v1.json'))['voidedTries']==0,'wrong race cannot release reservation'
  (day/'post/race-6-status.json').write_bytes(saved)
  result=json.load(open(day/'post/race-1-result.json'));result['race']=6;write(day/'post/race-6-result.json',result)
  try:run();raise AssertionError('conflicting result must stop settlement')
  except subprocess.CalledProcessError:pass
 finally:os.chdir(old)
print('PARTIAL_CANCELLATION_PASS: exact source, exact heading, immutable POST, no PRE, per-race refund, completed race retained, capital identity, mismatches and conflicts rejected')
