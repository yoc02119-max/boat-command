#!/usr/bin/env python3
from __future__ import annotations
import argparse,json,re,importlib.util,sys,math
from pathlib import Path
# Reuse the existing real-archive venue extractor, including named venue sections.
_spec=importlib.util.spec_from_file_location('bc_program_history_v131',Path(__file__).resolve().parents[1]/'program-history-builder-v131.py')
_base=importlib.util.module_from_spec(_spec)
sys.modules[_spec.name]=_base
_spec.loader.exec_module(_base)

FW=str.maketrans("０１２３４５６７８９ＲｒＨｈ：ｍ", "0123456789RrHh:m")
VALID={"A1","A2","B1","B2"}
ENTRY=re.compile(
 r"^\s*([1-6])\s*(\d{4}).*?(A1|A2|B1|B2)\s+"
 r"([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+"
 r"([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+"
 r"(\d+)\s+([0-9]+(?:\.[0-9]+)?)\s+(\d+)\s+([0-9]+(?:\.[0-9]+)?)(.*)$"
)
RACE_HEAD=re.compile(r"^\s*(\d{1,2})\s*R\s+(.*?)\s+H\s*\d+",re.I)
TRIFECTA=re.compile(r"(?:３|3)連単\s+([1-6])-([1-6])-([1-6])\s+([0-9,]+)円?",re.I)
RESULT_HEAD=re.compile(r"^\s*(\d{1,2})\s*R\s+",re.I)

def read(path:Path)->str:
 raw=path.read_bytes()
 for enc in ("cp932","shift_jis","utf-8-sig","utf-8"):
  try:return raw.decode(enc)
  except UnicodeDecodeError:pass
 raise ValueError(f"decode failed {path}")

def norm(s:str)->str:
 return s.translate(FW).replace("　"," ")

def block(text:str,code:str,kind:str)->str:
 return _base.venue_blocks(text,kind).get(code,"")

def parse_program(text:str):
 out={};cur=None;typ="";boats={}
 def flush():
  nonlocal cur,typ,boats
  if cur and set(boats)==set(range(1,7)):
   out[cur]={"r":cur,"t":typ,"boats":[boats[i] for i in range(1,7)]}
 for raw in text.splitlines():
  line=norm(raw)
  h=RACE_HEAD.search(line)
  if h:
   flush();cur=int(h.group(1));typ=re.sub(r"\s+","",h.group(2)).strip();boats={};continue
  if cur is None:continue
  m=ENTRY.search(line)
  if not m:continue
  lane=int(m.group(1));reg=int(m.group(2));cls=m.group(3)
  if cls not in VALID:continue
  boats[lane]={
   "lane":lane,"registration":reg,"class":cls,
   "nationalWinRate":float(m.group(4)),
   "national2Rate":round(float(m.group(5))/100,4),
   "localWinRate":float(m.group(6)),
   "local2Rate":round(float(m.group(7))/100,4),
   "motor":int(m.group(8)),
   "motor2Rate":round(float(m.group(9))/100,4),
   "boat":int(m.group(10)),
   "boat2Rate":round(float(m.group(11))/100,4),
   "avgST":None,
   "avgSTAvailable":False
  }
 flush()
 return out

def parse_results(text:str):
 out={};cur=None
 for raw in text.splitlines():
  line=norm(raw)
  h=RESULT_HEAD.search(line)
  if h:cur=int(h.group(1))
  summary=re.match(r"^\s*(\d{1,2})\s*R\s+([1-6]-[1-6]-[1-6])\s+([0-9,]+)(?:\s|$)",line)
  if summary:
   race=int(summary.group(1));order=summary.group(2);payout=int(summary.group(3).replace(',',''))
   if 1<=race<=12 and len(set(order.split('-')))==3 and payout>0:out.setdefault(race,(order,payout))
   continue
  m=TRIFECTA.search(line)
  if m and cur and 1<=cur<=12:
   order=f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
   payout=int(m.group(4).replace(",",""))
   if len(set(order.split("-")))==3 and payout>0:out.setdefault(cur,(order,payout))
 return out

def date_from(path:Path)->str:
 m=re.search(r"(20\d{2})(\d{2})(\d{2})",path.name)
 if not m:
  m=re.search(r"(\d{2})(\d{2})(\d{2})",path.name)
  if not m:raise ValueError("date missing")
  return f"20{m.group(1)}-{m.group(2)}-{m.group(3)}"
 return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

def build(b:Path,k:Path,code="03"):
 d=date_from(b)
 if date_from(k)!=d:raise ValueError("B_K_DATE_MISMATCH")
 pb=block(read(b),code,"B");kb=block(read(k),code,"K")
 if not pb or not kb:return []
 programs=parse_program(pb);results=parse_results(kb);rows=[]
 for race in sorted(set(programs)&set(results)):
  pr=programs[race];o,p=results[race];boats=pr["boats"]
  rows.append({
   "id":f"{d}-{code}-{race:02d}","d":d,"r":race,"t":pr["t"],
   "c":[x["class"] for x in boats],
   "boats":boats,"o":o,"p":p
  })
 return rows

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--b",type=Path);ap.add_argument("--k",type=Path);ap.add_argument("--out",type=Path)
 ap.add_argument("--self-test",action="store_true")
 args=ap.parse_args()
 if args.self_test:
  line="1 3812山崎聖司50東京52B1 4.09 14.86 4.85 26.83 25 46.43 40 38.89 2 334        5"
  m=ENTRY.search(line);assert m
  assert int(m.group(1))==1 and m.group(3)=="B1"
  assert float(m.group(4))==4.09 and float(m.group(6))==4.85
  assert int(m.group(8))==25 and int(m.group(10))==40
  k="1R 予選 H1800m\n [払戻金] ３連単 1-2-3 8,820円"
  kr=parse_results(k)
  assert kr[1]==("1-2-3",8820)
  kn=norm(k)
  assert TRIFECTA.search(kn)
  # Named multi-venue archives, compact lane+registration, spaced race numbers.
  boats='\n'.join(line.replace('1 3812',str(i)+'3812',1) for i in range(1,7))
  b='戸 田［番組］\n 1R 予選 H1800m\n'+boats+'\n江 戸 川［番組］\n １ Ｒ 予選 H1800m\n'+boats+'\n平和島［番組］\n'
  section=block(b,'03','B');assert '戸 田' not in section and '平和島' not in section
  programs=parse_program(section);assert len(programs[1]['boats'])==6
  assert programs[1]['boats'][0]['motor2Rate']==.4643
  assert programs[1]['boats'][0]['avgST'] is None
  assert parse_results(' 1R 1-2-3 8,820 1-2-3 500')[1]==('1-2-3',8820)
  assert block('戸田［番組］\n','03','B')==''
  print("EDOGAWA_RICH_PARSER_SELF_TEST_PASS");return
 rows=build(args.b,args.k)
 payload={
  "schema":"boat-command-edogawa-rich-day-v1","venueCode":"03",
  "date":date_from(args.b),"races":rows,
  "resultUse":"HISTORICAL_LABEL_ONLY"
 }
 args.out.parent.mkdir(parents=True,exist_ok=True)
 args.out.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
 print(json.dumps({"date":payload["date"],"races":len(rows)},ensure_ascii=False))
if __name__=="__main__":main()

