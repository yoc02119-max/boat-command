#!/usr/bin/env python3
"""Discover official BOAT RACE racer half-year download links.

Research-only helper. It reads the official download page, records candidate
archive links and never changes prediction data.
"""
from __future__ import annotations
import html
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

URL="https://www.boatrace.jp/owpc/pc/extra/data/download.html"
OUT=Path("research/racer-period-download-discovery-v1.json")

class A(HTMLParser):
    def __init__(self):
        super().__init__();self.links=[];self.cur=None;self.text=[]
    def handle_starttag(self,tag,attrs):
        if tag=="a":
            d=dict(attrs);self.cur=d.get("href");self.text=[]
    def handle_data(self,data):
        if self.cur is not None:self.text.append(data)
    def handle_endtag(self,tag):
        if tag=="a" and self.cur is not None:
            self.links.append({"href":self.cur,"text":re.sub(r"\s+"," ",html.unescape("".join(self.text))).strip()})
            self.cur=None;self.text=[]

def main():
    req=urllib.request.Request(URL,headers={"User-Agent":"BOAT-COMMAND-RACER-PERIOD-DISCOVERY/1.0"})
    with urllib.request.urlopen(req,timeout=30) as resp:
        raw=resp.read()
    text=None;enc=None
    for e in ("utf-8","cp932","shift_jis","euc_jp"):
        try:text=raw.decode(e);enc=e;break
        except UnicodeDecodeError:pass
    if text is None:text=raw.decode("utf-8","replace");enc="unknown"
    p=A();p.feed(text)
    rows=[]
    for x in p.links:
        href=urllib.parse.urljoin(URL,x["href"])
        low=href.lower()
        if any(k in low for k in (".lzh",".zip",".csv",".txt","download","fan")):
            rows.append({"text":x["text"],"url":href})
    out={
      "schema":"boat-command-racer-period-download-discovery-v1",
      "researchOnly":True,"productionChanged":False,"predictionInputChanged":False,
      "sourceUrl":URL,"encoding":enc,"candidateLinks":rows
    }
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("DISCOVERY_LINKS",len(rows))
    for r in rows: print(r["text"],r["url"])
if __name__=="__main__":main()
