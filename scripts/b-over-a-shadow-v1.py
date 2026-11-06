"""B over A exploratory selector. Reads a pinned git tree, never writes production data."""
import subprocess,json,hashlib,datetime,re,argparse
from pathlib import Path
ap=argparse.ArgumentParser();ap.add_argument('--repo',default='.');ap.add_argument('--ref',default='HEAD');ap.add_argument('--date',required=True);ap.add_argument('--output',required=True);ap.add_argument('--forward-dir');args=ap.parse_args()
repo=args.repo;head=subprocess.check_output(['git','rev-parse',args.ref],cwd=repo,text=True).strip();now=datetime.datetime.now(datetime.timezone.utc)
proc=subprocess.Popen(['git','cat-file','--batch'],cwd=repo,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
def read(path):
 proc.stdin.write((head+':'+path+'\n').encode());proc.stdin.flush();h=proc.stdout.readline().decode().split()
 if h[-1]=='missing':return None,None
 raw=proc.stdout.read(int(h[-1]));proc.stdout.read(1)
 return json.loads(raw),hashlib.sha256(raw).hexdigest()
def select(program,pre,program_hash):
 if pre.get('resultInput') is not False or pre.get('payoutInput') is not False or pre.get('immutableAfterFirstWrite') is not True:return None,'unsafe_snapshot'
 if program.get('resultIncluded') is not False or program.get('resultEndpointsIncluded') is not False:return None,'unsafe_program'
 for k in ['date','race','venueCode']:
  if str(program.get(k))!=str(pre.get(k)):return None,'identity'
 if pre.get('sources',{}).get('programSha256')!=program_hash:return None,'program_hash_changed'
 try:
  deadline=datetime.datetime.fromisoformat(pre['date']+'T'+pre['deadline']+':00+09:00');generated=datetime.datetime.fromisoformat(pre['generatedAt'].replace('Z','+00:00'));fetched=datetime.datetime.fromisoformat(program['fetchedAt'].replace('Z','+00:00'))
  if generated.tzinfo is None or fetched.tzinfo is None or fetched>generated or (deadline-generated).total_seconds()<180:return None,'late_or_invalid_pre'
 except (ValueError,KeyError,TypeError):return None,'invalid_clock'
 boats=program.get('boats',[])
 if len(boats)!=6 or {b.get('lane') for b in boats}!=set(range(1,7)) or any(b.get('class') not in ['A1','A2','B1','B2'] for b in boats):return None,'boat_classes'
 aa=[b for b in boats if b['class'].startswith('A')];bb=[b for b in boats if b['class'].startswith('B')]
 if not aa or not bb:return None,'not_mixed'
 ranked=pre.get('pointExpansion',{}).get('ranked',[])
 orders=['-'.join(map(str,(i,j,k))) for i in range(1,7) for j in range(1,7) for k in range(1,7) if len({i,j,k})==3]
 if len(ranked)!=120 or {v.get('order') for v in ranked}!=set(orders):return None,'missing_120_orders'
 weights={i:0 for i in range(1,7)}
 for v in ranked:
  p=v.get('probability')
  if not isinstance(p,(int,float)) or isinstance(p,bool) or not 0<=p<=1:return None,'probability'
  weights[int(v['order'][0])]+=p
 if abs(sum(weights.values())-1)>1e-5:return None,'probability_sum'
 b=max(bb,key=lambda x:(weights[x['lane']],-x['lane']));a=max(aa,key=lambda x:(weights[x['lane']],-x['lane']))
 # Predeclared initial rule: best individual B winner mass strictly exceeds best A.
 chosen=weights[b['lane']]>weights[a['lane']]
 def picks(lane):return [v['order'] for v in sorted(ranked,key=lambda v:(-v['probability'],v['order'])) if int(v['order'][0])==lane][:4]
 return dict(selected=chosen,bLane=b['lane'],bClass=b['class'],bName=b.get('name',''),bScore=weights[b['lane']],aLane=a['lane'],aClass=a['class'],aScore=weights[a['lane']],bPicks=picks(b['lane']),aPicks=picks(a['lane']),deadline=pre['deadline'],deadlineAt=deadline.isoformat(),generatedAt=pre['generatedAt'],scoreMeaning='モデル内の1着点数。実的中率の校正は未検証。',oddsStatus='未取得・高配当や正の期待値は未確認'),None
config,_=read('shared-try-config-v1.json');rows=[];excluded={}
for adapter in config['activeAdapters']:
 for race in range(1,13):
  base=f"live/{adapter['slug']}/{args.date}";program,ph=read(f'{base}/program/race-{race}.json');pre,sh=read(f"{base}/shadow/{adapter.get('predictionDir','program-only')}/race-{race}.json")
  if not program or not pre:excluded['missing_program_or_pre']=excluded.get('missing_program_or_pre',0)+1;continue
  row,reason=select(program,pre,ph)
  if reason:excluded[reason]=excluded.get(reason,0)+1;continue
  row.update(venueCode=adapter['venueCode'],venue=adapter['slug'],race=race,date=args.date,predictionSha256=sh,source=f"{base}/shadow/{adapter.get('predictionDir','program-only')}/race-{race}.json",availableBeforeCutoff=now<datetime.datetime.fromisoformat(row['deadlineAt'])-datetime.timedelta(minutes=3))
  rows.append(row)
if args.forward_dir:
 for row in rows:
  if not row['availableBeforeCutoff']:continue
  file=Path(args.forward_dir)/args.date/row['venue']/('race-'+str(row['race'])+'.json');file.parent.mkdir(parents=True,exist_ok=True)
  if not file.exists():
   with file.open('x') as f:json.dump(dict(row,recordedAt=now.isoformat(),sourceHead=head,researchOnly=True,realMoney=False),f,ensure_ascii=False,indent=2)
rows.sort(key=lambda r:-(r['bScore']-r['aScore']))
report=dict(schema='b-over-a-shadow-v1',hypothesis='B級を1着にしたモデル点数が最も高いA級を上回る混合レース',sourceHead=head,date=args.date,generatedAt=now.isoformat(),mode='EXPLORATORY_READ_ONLY',realMoney=False,productionChanged=False,ranking='B個艇の1着点数-A個艇の最大1着点数。同点は見送り。',examined=288,eligibleMixed=len(rows),selected=sum(r['selected'] for r in rows),excluded=excluded,rows=rows,next='オッズと未使用期間の同資金比較が必要。既存モデルの級別依存・B2の標本数も別途監査。')
out=Path(args.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='rows'},ensure_ascii=False))
