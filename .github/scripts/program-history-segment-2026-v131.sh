#!/usr/bin/env bash
set -euo pipefail
test -f gamagori-2026-schedule-manifest.json
test -f program-history-builder-v131.py
python3 program-history-builder-v131.py --self-test
rm -rf segment-work segment-out
mkdir -p segment-work/days segment-out
python3 - <<'PY' > segment-work/dates.txt
import json, os
from pathlib import Path
d=json.loads(Path("gamagori-2026-schedule-manifest.json").read_text())["dates"]
s=int(os.environ["START"]); c=int(os.environ["COUNT"])
x=d[s:s+c]
if len(x)!=c: raise SystemExit("PLAN FAIL")
print("\n".join(x))
PY
: > segment-work/exceptions.txt
i=0
while IFS= read -r d; do
  i=$((i+1)); ymd="${d//-/}"; yyyy="${ymd:0:4}"; mm="${ymd:4:2}"; yy="${ymd:2:2}"; dd="${ymd:6:2}"; ym="${yyyy}${mm}"
  b="b${yy}${mm}${dd}.lzh"; k="k${yy}${mm}${dd}.lzh"
  rm -rf segment-work/one; mkdir -p segment-work/one/raw segment-work/one/b segment-work/one/k segment-work/one/out
  echo "DATE $i/$COUNT · $d"
  bc="$(curl -sS -L --connect-timeout 20 --max-time 60 -o segment-work/one/raw/$b -w '%{http_code}' https://www1.mbrace.or.jp/od2/B/${ym}/${b} || true)"
  sleep "$REQUEST_DELAY"
  kc="$(curl -sS -L --connect-timeout 20 --max-time 60 -o segment-work/one/raw/$k -w '%{http_code}' https://www1.mbrace.or.jp/od2/K/${ym}/${k} || true)"
  sleep "$REQUEST_DELAY"
  if [[ "$bc" != "200" || "$kc" != "200" ]]; then echo "$d HTTP B=$bc K=$kc" >> segment-work/exceptions.txt; continue; fi
  lha xw=segment-work/one/b segment-work/one/raw/$b >/dev/null 2>&1 || { echo "$d B_EXTRACT_FAIL" >> segment-work/exceptions.txt; continue; }
  lha xw=segment-work/one/k segment-work/one/raw/$k >/dev/null 2>&1 || { echo "$d K_EXTRACT_FAIL" >> segment-work/exceptions.txt; continue; }
  python3 program-history-builder-v131.py --b-dir segment-work/one/b --k-dir segment-work/one/k --out segment-work/one/out --venue 07 >/dev/null 2>&1 || { echo "$d BUILDER_FAIL" >> segment-work/exceptions.txt; continue; }
  python3 - "$d" <<'PY' || { echo "$d NOT_12R_COMPLETE" >> segment-work/exceptions.txt; continue; }
import json,sys
from pathlib import Path
d=sys.argv[1]
p=Path("segment-work/one/out/07/2026.json")
x=json.loads(p.read_text())
day=[r for r in x["races"] if r["d"]==d]
if len(day)!=12 or sorted(int(r["r"]) for r in day)!=list(range(1,13)): raise SystemExit(1)
Path(f"segment-work/days/{d}.json").write_text(json.dumps(day,ensure_ascii=False,separators=(",",":")))
PY
  if (( i % 8 == 0 )); then sleep "$CHUNK_PAUSE"; fi
done < segment-work/dates.txt
python3 - <<'PY'
import json,os
from pathlib import Path
rows=[]
for p in sorted(Path("segment-work/days").glob("*.json")): rows += json.loads(p.read_text())
exceptions=[x for x in Path("segment-work/exceptions.txt").read_text().splitlines() if x.strip()]
Path("segment-out/segment.json").write_text(json.dumps({"races":rows},ensure_ascii=False,separators=(",",":")))
Path("segment-out/report.json").write_text(json.dumps({"start":int(os.environ["START"]),"count":int(os.environ["COUNT"]),"exceptions":exceptions},ensure_ascii=False,indent=2))
print(f"SEGMENT DONE · start={os.environ['START']} · dates={len(rows)//12} · races={len(rows)} · exceptions={len(exceptions)}")
PY
