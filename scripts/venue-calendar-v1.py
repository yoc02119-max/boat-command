#!/usr/bin/env python3
import datetime, html as html_lib, json, re, urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from zoneinfo import ZoneInfo

JST=ZoneInfo('Asia/Tokyo')
TODAY=datetime.datetime.now(JST).date()
CODES=[f'{i:02d}' for i in range(1,25)]
NAMES={
 '01':'桐生','02':'戸田','03':'江戸川','04':'平和島','05':'多摩川','06':'浜名湖',
 '07':'蒲郡','08':'常滑','09':'津','10':'三国','11':'びわこ','12':'住之江',
 '13':'尼崎','14':'鳴門','15':'丸亀','16':'児島','17':'宮島','18':'徳山',
 '19':'下関','20':'若松','21':'芦屋','22':'福岡','23':'唐津','24':'大村'
}

def fetch(day):
    hd=day.strftime('%Y%m%d')
    url=f'https://www.boatrace.jp/owpc/pc/race/index?hd={hd}'
    req=urllib.request.Request(url,headers={'User-Agent':'BOAT-COMMAND-VENUE-CALENDAR/1.0'})
    with urllib.request.urlopen(req,timeout=45) as r:
        raw=r.read()
    for enc in ('utf-8','cp932','shift_jis','euc_jp'):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode('utf-8','replace')

def fetch_venue_today(code):
    hd=TODAY.strftime('%Y%m%d')
    url=f'https://www.boatrace.jp/owpc/pc/race/raceindex?hd={hd}&jcd={code}'
    req=urllib.request.Request(url,headers={'User-Agent':'BOAT-COMMAND-VENUE-CALENDAR/1.0'})
    with urllib.request.urlopen(req,timeout=45) as r:
        raw=r.read()
    for enc in ('utf-8','cp932','shift_jis','euc_jp'):
        try:return raw.decode(enc)
        except UnicodeDecodeError:pass
    return raw.decode('utf-8','replace')

def plain_text(raw):
    s=re.sub(r'(?is)<script.*?</script>|<style.*?</style>',' ',raw or '')
    s=re.sub(r'(?s)<[^>]+>',' ',s)
    s=html_lib.unescape(s)
    return re.sub(r'\s+',' ',s).strip()

def classify_today_status(code):
    try:
        txt=plain_text(fetch_venue_today(code))
    except Exception as e:
        return {'status':'UNKNOWN','cancelled':False,'error':str(e)}
    md=rf'{TODAY.month}\s*月\s*{TODAY.day}\s*日'
    if re.search(md+r'.{0,24}(?:順延|中止)',txt) or '中止順延' in txt or '中止・順延' in txt:
        return {'status':'CANCELLED','cancelled':True}
    return {'status':'ACTIVE','cancelled':False}

next_date={c:None for c in CODES}
today_active=set()
checked=0
errors=[]
days=[TODAY+datetime.timedelta(days=i) for i in range(0,61)]
pages={}
present_by_day={}
today_status={}

# Fetch the horizon in parallel so this stays fast even when one official page is slow.
with ThreadPoolExecutor(max_workers=8) as ex:
    futs={ex.submit(fetch,day):day for day in days}
    for fut in as_completed(futs):
        day=futs[fut]
        try:
            pages[day]=fut.result()
        except Exception as e:
            errors.append({'date':day.isoformat(),'error':str(e)})

for offset,day in enumerate(days):
    text=pages.get(day)
    if not text:
        continue
    checked+=1
    # Official race index contains venue-specific links with jcd=XX.
    present=set(re.findall(r'(?:[?&]|&amp;)jcd=(\d{2})(?:&|&amp;|"|\')',text))
    if not present:
        present=set(re.findall(r'jcd=(\d{2})',text))
    present={c for c in present if c in next_date}
    present_by_day[day]=present
    if offset==0:
        today_active=present
    for code in present:
        if next_date[code] is None:
            next_date[code]=day.isoformat()

# A venue can remain linked on the official index even when the day is cancelled/postponed.
# Resolve today's venue-specific page so "scheduled" and "actually active" are not conflated.
today_scheduled=set(today_active)
with ThreadPoolExecutor(max_workers=8) as ex:
    futs={ex.submit(classify_today_status,code):code for code in sorted(today_scheduled)}
    for fut in as_completed(futs):
        code=futs[fut]
        try:today_status[code]=fut.result()
        except Exception as e:today_status[code]={'status':'UNKNOWN','cancelled':False,'error':str(e)}

today_cancelled={c for c,s in today_status.items() if s.get('cancelled') is True}
today_active=today_scheduled-today_cancelled
for code in today_cancelled:
    next_date[code]=None
    for day in days[1:]:
        if code in present_by_day.get(day,set()):
            next_date[code]=day.isoformat()
            break

out={
 'schema':'boat-command-venue-calendar-v1',
 'version':'VENUE-CALENDAR-V1',
 'generatedAt':datetime.datetime.now(JST).isoformat(),
 'source':'BOAT RACE official race index',
 'sourcePattern':'https://www.boatrace.jp/owpc/pc/race/index?hd=YYYYMMDD',
 'today':TODAY.isoformat(),
 'horizonDays':60,
 'daysChecked':checked,
 'venues':{}
}
for code in CODES:
    nxt=next_date[code]
    out['venues'][code]={
        'venueCode':code,
        'venueName':NAMES[code],
        'todayScheduled':code in today_scheduled,
        'todayActive':code in today_active,
        'todayCancelled':code in today_cancelled,
        'todayStatus':today_status.get(code,{}).get('status','NOT_SCHEDULED' if code not in today_scheduled else 'UNKNOWN'),
        'nextRaceDate':nxt,
        'nextRaceDateKnown':nxt is not None
    }
if errors:
    out['fetchErrors']=errors[:10]

with open('venue-calendar-v1.json','w',encoding='utf-8') as f:
    json.dump(out,f,ensure_ascii=False,indent=2)
    f.write('\n')
print(json.dumps({'today':out['today'],'daysChecked':checked,'known':sum(1 for x in next_date.values() if x),'todayActive':len(today_active)},ensure_ascii=False))
