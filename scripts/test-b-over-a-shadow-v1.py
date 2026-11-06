import ast,datetime,copy,unittest
from pathlib import Path
source=Path(__file__).with_name('b-over-a-shadow-v1.py').read_text();tree=ast.parse(source);node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='select');scope={'datetime':datetime};exec(compile(ast.Module(body=[node],type_ignores=[]),'selector','exec'),scope);select=scope['select']
def fixture():
 program={'date':'2026-11-07','race':1,'venueCode':'01','fetchedAt':'2026-11-07T00:00:00Z','resultIncluded':False,'resultEndpointsIncluded':False,'boats':[{'lane':i,'class':'B1' if i==1 else 'A1'} for i in range(1,7)]}
 weights=[.4,.3,.1,.08,.07,.05];ranked=[{'order':f'{i}-{j}-{k}','probability':weights[i-1]/20} for i in range(1,7) for j in range(1,7) for k in range(1,7) if len({i,j,k})==3]
 pre={'date':'2026-11-07','race':1,'venueCode':'01','generatedAt':'2026-11-07T00:01:00Z','deadline':'10:00','resultInput':False,'payoutInput':False,'immutableAfterFirstWrite':True,'sources':{'programSha256':'abc'},'pointExpansion':{'ranked':ranked}}
 return program,pre
class Test(unittest.TestCase):
 def test_candidate(self):
  p,s=fixture();r,e=select(p,s,'abc');self.assertIsNone(e);self.assertTrue(r['selected']);self.assertEqual(r['bLane'],1);self.assertEqual(len(r['bPicks']),4);self.assertTrue(all(x.startswith('1-') for x in r['bPicks']))
 def test_identity(self):
  p,s=fixture();s['race']=2;self.assertEqual(select(p,s,'abc')[1],'identity')
 def test_hash(self):
  p,s=fixture();self.assertEqual(select(p,s,'changed')[1],'program_hash_changed')
 def test_result_contamination(self):
  p,s=fixture();s['resultInput']=True;self.assertEqual(select(p,s,'abc')[1],'unsafe_snapshot')
 def test_late(self):
  p,s=fixture();s['generatedAt']='2026-11-07T00:58:00Z';self.assertEqual(select(p,s,'abc')[1],'late_or_invalid_pre')
 def test_full_distribution(self):
  p,s=fixture();s['pointExpansion']['ranked'].pop();self.assertEqual(select(p,s,'abc')[1],'missing_120_orders')
 def test_not_mixed(self):
  p,s=fixture();p['boats'][0]['class']='A2';self.assertEqual(select(p,s,'abc')[1],'not_mixed')
unittest.main()
