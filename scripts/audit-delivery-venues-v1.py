import subprocess,json,datetime,re
from pathlib import Path
repo=str(Path(__file__).resolve().parents[1])
head=subprocess.check_output(['git','rev-parse','origin/main'],cwd=repo,text=True).strip()
proc=subprocess.Popen(['git','cat-file','--batch'],cwd=repo,stdin=subprocess.PIPE,stdout=subprocess.PIPE)
def read(path):
 proc.stdin.write((head+':'+path+'\n').encode());proc.stdin.flush();h=proc.stdout.readline().decode().strip().split()
 if h[-1]=='missing':return None
 b=proc.stdout.read(int(h[-1]));proc.stdout.read(1)
 return json.loads(b)
cal=read('venue-calendar-v1.json');config=read('shared-try-config-v1.json');port=read('shared-try-portfolio-v1.json');day=cal['today'];sel=read(f'live/portfolio/{day}/try-selection-v1.json')
now=datetime.datetime.now(datetime.timezone.utc);rows=[]
for a in config['activeAdapters']:
 code=a['venueCode'];slug=a['slug'];v=cal['venues'][code];npre=npost=nprogram=before=0;missing=[];late=[];due=[]
 for r in range(1,13):
  base=f'live/{slug}/{day}';program=read(f'{base}/program/race-{r}.json');pre=read(f'{base}/shadow/{a.get("predictionDir","program-only")}/race-{r}.json');post=read(f'{base}/post/race-{r}-result.json')
  nprogram+=bool(program);npost+=bool(post)
  if pre:
   npre+=1
   try:
    g=datetime.datetime.fromisoformat(pre['generatedAt'].replace('Z','+00:00'));dl=datetime.datetime.fromisoformat(day+'T'+pre['deadline']+':00+09:00')
    if (dl-g).total_seconds()>=180:before+=1
    else:late.append(r)
   except Exception:missing.append(r)
  elif v['todayScheduled']:missing.append(r)
 selected=[x for x in (sel or {}).get('selected',[]) if x.get('venueCode')==code]
 ledger=[x for x in port.get('ledger',[]) if str(x.get('venueCode'))==code and x.get('date')==day]
 evidence=f'https://github.com/yoc02119-max/boat-command/tree/{head}/live/{slug}/{day}'
 if not v['todayScheduled']:
  status='非開催・当日の実運用確認は対象外';reason='開催カレンダーで非開催。取得失敗とは判定しない。';next='次回開催日に取得から精算までを確認';eta='次回開催予定 '+str(v.get('nextRaceDate') or '未確認')+'。確認完了日は未確定。'
 elif missing or late:
  status='事前予想に欠損・時刻の要確認あり';reason='不足R '+str(missing)+'／締切3分前条件を満たさないR '+str(late)+'。原因は未調査。';next='該当Rの取得Actions・元データ・保存時刻を照合';eta='原因未特定のため改善日は未確定。原因調査→修正→次回開催の再検証が必要。'
 else:
  status='当日12Rの事前保存を確認';reason='出走表・予想・結果のファイル数を確認。全入力品質、選抜時点の候補充足、精算照合は未確認。';next='日次選抜時点の候補と、TRY結果・資金の照合';eta='確認期限は未設定。未確認項目の照合後に完了判定。'
 rows.append(dict(code=code,name=v['venueName'],slug=slug,scheduled=v['todayScheduled'],program=nprogram,pre=npre,preBefore3m=before,post=npost,selected=len(selected),status=status,reason=reason,next=next,eta=eta,evidence=evidence,missingPre=missing,latePre=late))
obj=dict(date=day,checkedAt=now.isoformat(),sourceHead=head,calendarGeneratedAt=cal['generatedAt'],portfolioGeneratedAt=port['generatedAt'],selectionGeneratedAt=(sel or {}).get('generatedAt'),scope='最新保存データの読み取り監査。POST件数は検証時点の保存数。全データ品質・公開画面・全24場一連動作の完成を示さない。',rows=rows)

print(json.dumps(obj,ensure_ascii=False))
