#!/usr/bin/env python3
import argparse, datetime, json, pathlib, re
from zoneinfo import ZoneInfo
import requests
from bs4 import BeautifulSoup

JST=ZoneInfo('Asia/Tokyo')
VALID_METHODS={'逃げ','差し','まくり','まくり差し','抜き','恵まれ'}

def now_jst():
    return datetime.datetime.now(JST)

def minutes(hm):
    m=re.fullmatch(r'(\d{1,2}):(\d{2})',str(hm or ''))
    return int(m.group(1))*60+int(m.group(2)) if m else None

def read(path):
    try:return json.loads(path.read_text(encoding='utf-8'))
    except Exception:return None

def validate_shadow(x,venue,code,slug,date,race,mode):
    if not x or x.get('schema')!='boat-command-venue-shadow-research-v1':return False
    if x.get('venue')!=venue or x.get('venueCode')!=code or x.get('slug')!=slug:return False
    if x.get('date')!=date or int(x.get('race',0))!=race or x.get('mode')!=mode:return False
    if x.get('resultInput') is not False or x.get('payoutInput') is not False:return False
    if x.get('researchOnly') is not True or x.get('productionEnabled') is not False or x.get('tryEnabled') is not False:return False
    if x.get('cashNeutral') is not True or x.get('immutableAfterFirstWrite') is not True:return False
    picks=x.get('picks')
    return isinstance(picks,list) and len(picks)==4 and len(set(picks))==4 and all(re.fullmatch(r'[1-6]-[1-6]-[1-6]',str(v)) for v in picks)

def timely_shadow(x,date,deadline):
    if not x:return False
    try:
        generated=datetime.datetime.fromisoformat(x.get('generatedAt','').replace('Z','+00:00'))
        cutoff=datetime.datetime.fromisoformat(date).replace(tzinfo=JST)+datetime.timedelta(minutes=deadline-3)
        return generated.tzinfo is not None and generated<=cutoff
    except (ValueError,TypeError):return False

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--slug',required=True)
    ap.add_argument('--venue',required=True)
    ap.add_argument('--code',required=True)
    ap.add_argument('--date',default=None)
    args=ap.parse_args()
    if not re.fullmatch(r'[a-z0-9-]+',args.slug) or not re.fullmatch(r'[A-Z0-9_]+',args.venue) or not re.fullmatch(r'\d{2}',args.code):
        raise SystemExit('VENUE_ARGS_INVALID')

    now=now_jst()
    date=args.date or now.date().isoformat()
    if date!=now.date().isoformat():
        print('VENUE_RESULT_DATE_NOT_TODAY',args.slug,date,now.date().isoformat());return 0
    hd=date.replace('-','')
    base=pathlib.Path('live')/args.slug/date
    program_dir=base/'program'
    shadow_dir=base/'shadow'
    if not program_dir.exists():
        print('VENUE_RESULT_WAIT_PROGRAM',args.slug,date);return 0
    outdir=base/'post';outdir.mkdir(parents=True,exist_ok=True)
    made=[]
    headers={'User-Agent':f'Mozilla/5.0 BOAT-COMMAND-{args.venue}-SHADOW/1.0'}

    for race in range(1,13):
        pp=program_dir/f'race-{race}.json'
        cp=shadow_dir/'class-baseline'/f'race-{race}.json'
        apath=shadow_dir/'program-only'/f'race-{race}.json'
        if not pp.exists():
            continue
        program=read(pp);c=read(cp);a=read(apath)
        if not program or program.get('schema')!='boat-command-program-pack-v1':continue
        if program.get('venue')!=args.venue or program.get('venueCode')!=args.code or program.get('date')!=date or int(program.get('race',0))!=race:continue
        if program.get('resultEndpointsIncluded') is not False or program.get('resultIncluded') is not False or program.get('exhibitionIncluded') is not False:
            raise RuntimeError('VENUE_RESULT_PROGRAM_BOUNDARY')
        if cp.exists() and not validate_shadow(c,args.venue,args.code,args.slug,date,race,'CLASS_BASELINE'):
            raise RuntimeError('VENUE_RESULT_CLASS_SHADOW_INVALID')
        if apath.exists() and not validate_shadow(a,args.venue,args.code,args.slug,date,race,'PROGRAM_ONLY'):
            raise RuntimeError('VENUE_RESULT_PROGRAM_SHADOW_INVALID')
        deadline=minutes(program.get('deadline'))
        if deadline is None or now.hour*60+now.minute < deadline:
            continue

        evidence_ready=timely_shadow(c,date,deadline) and timely_shadow(a,date,deadline)
        path=outdir/f'race-{race}-result.json'
        if path.exists():
            x=read(path)
            if not x or x.get('schema')!='boat-command-live-result-v1' or x.get('venue')!=args.venue or x.get('venueCode')!=args.code:
                raise RuntimeError('VENUE_RESULT_EXISTING_INVALID')
            if x.get('preRaceDataIncluded') is not False or x.get('resultEndpointsIncluded') is not True or x.get('immutableAfterFirstWrite') is not True:
                raise RuntimeError('VENUE_RESULT_EXISTING_BOUNDARY')
            continue

        url=f'https://www.boatrace.jp/owpc/pc/race/raceresult?hd={hd}&jcd={args.code}&rno={race}'
        try:
            res=requests.get(url,headers=headers,timeout=20);res.raise_for_status()
        except Exception as e:
            print('VENUE_RESULT_WAIT_FETCH',args.slug,race,type(e).__name__);continue
        soup=BeautifulSoup(res.text,'html.parser')
        trifecta=payout=exacta=exacta_payout=win=win_payout=None
        for tr in soup.find_all('tr'):
            cells=[' '.join(td.stripped_strings) for td in tr.find_all(['th','td'])]
            if len(cells)<3:continue
            label=cells[0].replace(' ','');raw_pick=cells[1]
            pm=re.search(r'([\d,]+)',cells[2].replace('¥','').replace('￥',''))
            if label=='3連単':
                m=re.search(r'([1-6])\s*[-–—]\s*([1-6])\s*[-–—]\s*([1-6])',raw_pick)
                if m and pm:trifecta='-'.join(m.groups());payout=int(pm.group(1).replace(',',''))
            elif label=='2連単':
                m=re.search(r'([1-6])\s*[-–—]\s*([1-6])',raw_pick)
                if m and pm:exacta='-'.join(m.groups());exacta_payout=int(pm.group(1).replace(',',''))
            elif label=='単勝':
                m=re.search(r'([1-6])',raw_pick)
                if m and pm:win=m.group(1);win_payout=int(pm.group(1).replace(',',''))
        if not trifecta or payout is None:
            print('VENUE_RESULT_WAIT_RESULT',args.slug,race);continue

        finish=[]
        for tr in soup.find_all('tr'):
            cells=[' '.join(td.stripped_strings) for td in tr.find_all(['th','td'])]
            if len(cells)>=2 and cells[0] in {'１','２','３','４','５','６','1','2','3','4','5','6'} and re.fullmatch(r'[1-6]',cells[1].strip()):
                finish.append(int(cells[1].strip()))
        plain=' '.join(soup.stripped_strings)
        mm=re.search(r'決まり手\s*(まくり差し|まくり|逃げ|差し|抜き|恵まれ)(?:\s|$)',plain)
        method=mm.group(1) if mm else None

        payload={
            'schema':'boat-command-live-result-v1','version':'VENUE-BATCH-A-RESULT-V1',
            'venue':args.venue,'venueCode':args.code,'slug':args.slug,'date':date,'race':race,
            'fetchedAt':now_jst().isoformat(),'officialSource':url,
            'trifecta':trifecta,'payout100':payout,'finishOrder':finish[:6],
            'exacta':exacta,'exactaPayout100':exacta_payout,'win':win,'winPayout100':win_payout,
            'winningMethod':method if method in VALID_METHODS else None,
            'preRaceDataIncluded':False,'resultEndpointsIncluded':True,
            'predictionEnabled':False,'hardLockEnabled':False,'tryEnabled':False,
            'immutableAfterFirstWrite':True,'preRaceEvidenceRequired':False,
            'evaluationEligible':evidence_ready,
            'preRaceEvidenceType':'PAIRED_RESULT_BLIND_SHADOW' if evidence_ready else 'NONE_DISPLAY_ONLY',
            'preRaceEvidencePaths':[
                str(cp).replace('\\','/'),str(apath).replace('\\','/')
            ] if evidence_ready else [],
            'preRaceEvidenceGeneratedAt':{
                'classBaseline':c.get('generatedAt'),'programOnly':a.get('generatedAt')
            } if evidence_ready else {}
        }
        path.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
        made.append(race)
    print('VENUE_RESULT_FILES_CREATED',args.slug,made)
    return 0

if __name__=='__main__':
    raise SystemExit(main())
