#!/usr/bin/env python3
"""BOAT COMMAND · PROGRAM HISTORY BUILDER v1.2.1

Converts extracted BOAT RACE B (program) + K (result) daily text files into
compact venue-isolated JSON consumed by program-history.js.

Important design rules:
- Only pre-race program facts used for matching: six lane grades + race type.
- Results are joined only as historical labels: trifecta result + payout.
- No racer names, motor data, weather, odds, or post-race details are exported.
- Output stays venue/year isolated (e.g. history/07/2025.json).
- Missing/irregular/cancelled races are skipped, never guessed.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable

VERSION = "PROGRAM-HISTORY-BUILDER-V1.2.1"
VALID_CLASSES = {"A1", "A2", "B1", "B2"}
BLOCK_B = re.compile(r"(?ms)^\s*(\d{2})BBGN\s*$.*?(?=^\s*\d{2}B(?:BGN|END)\s*$|\Z)")
BLOCK_K = re.compile(r"(?ms)^\s*(\d{2})KBGN\s*$.*?(?=^\s*\d{2}K(?:BGN|END)\s*$|\Z)")
RACE_HEAD = re.compile(r"^\s*(\d{1,2})\s*R\s*(.*?)\s+H\s*1800", re.I)
ENTRY = re.compile(r"^\s*([1-6])\s*\d{4}.*?(A1|A2|B1|B2)(?=\s|\d|$)", re.I)
PAYOUT = re.compile(r"^\s*(\d{1,2})\s*R\s+([1-6]-[1-6]-[1-6])\s+([0-9,]+)(?:\s|$)", re.I)
TRIFECTA = re.compile(r"３連単\s+([1-6])-([1-6])-([1-6])\s+([0-9,]+)円?", re.I)
FW_TRANS = str.maketrans("０１２３４５６７８９ＲｒＨｈ", "0123456789RrHh")
VENUE_NAMES = {
    "01":"桐生","02":"戸田","03":"江戸川","04":"平和島","05":"多摩川","06":"浜名湖",
    "07":"蒲郡","08":"常滑","09":"津","10":"三国","11":"びわこ","12":"住之江",
    "13":"尼崎","14":"鳴門","15":"丸亀","16":"児島","17":"宮島","18":"徳山",
    "19":"下関","20":"若松","21":"芦屋","22":"福岡","23":"唐津","24":"大村",
}
DATE8 = re.compile(r"(20\d{2})(\d{2})(\d{2})")
DATE6 = re.compile(r"(?:^|[^0-9])(\d{2})(\d{2})(\d{2})(?:[^0-9]|$)")


OFFICIAL_GOLDEN_20251215 = {
    "venueCode":"07","date":"2025-12-15","races":[
        {"r":1,"c":["B1","B2","B1","B1","B1","B2"],"o":"1-2-3","p":880,"t":"一般戦"},
        {"r":2,"c":["B1","B1","A2","B1","B1","B1"],"o":"1-4-2","p":4430,"t":"一般戦"},
        {"r":3,"c":["B1","A2","B1","B1","B2","B1"],"o":"3-1-4","p":21970,"t":"一般戦"},
        {"r":4,"c":["B1","A1","A2","B1","B1","B2"],"o":"1-2-4","p":920,"t":"一般戦"},
        {"r":5,"c":["A1","B1","B1","B2","B1","A2"],"o":"1-3-2","p":500,"t":"一般戦"},
        {"r":6,"c":["A2","B1","B1","B1","A1","B1"],"o":"1-5-2","p":1090,"t":"一般戦"},
        {"r":7,"c":["A2","B1","A1","A2","B1","B2"],"o":"1-3-2","p":1030,"t":"一般戦"},
        {"r":8,"c":["A1","B1","A2","B1","B2","A2"],"o":"1-6-4","p":2750,"t":"一般戦"},
        {"r":9,"c":["A2","B1","A2","B2","B1","A1"],"o":"1-4-3","p":1560,"t":"一般特選"},
        {"r":10,"c":["A1","B1","B1","B1","A1","A2"],"o":"1-2-6","p":2010,"t":"選抜戦"},
        {"r":11,"c":["A1","A2","A1","B1","A2","B1"],"o":"1-2-3","p":600,"t":"選抜戦"},
        {"r":12,"c":["A1","A2","B1","A1","A1","A2"],"o":"1-2-4","p":1060,"t":"優勝戦"}
    ]
}


@dataclass(frozen=True)
class ProgramRace:
    race: int
    classes: tuple[str, ...]
    race_type: str


def read_cp932(path: Path) -> str:
    raw = path.read_bytes()
    for enc in ("cp932", "shift_jis", "utf-8-sig", "utf-8"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            pass
    raise ValueError(f"decode failed: {path}")


def date_from_path(path: Path) -> str:
    name = path.stem
    m = DATE8.search(name)
    if m:
        y, mo, d = map(int, m.groups())
    else:
        m = DATE6.search(name)
        if not m:
            raise ValueError(f"date not found in filename: {path.name}")
        yy, mo, d = map(int, m.groups())
        y = 2000 + yy
    return datetime(y, mo, d).date().isoformat()


def normalize_type(s: str) -> str:
    return re.sub(r"[\s　]+", "", s).strip("-－")[:40]


def _norm_line(s: str) -> str:
    return s.translate(FW_TRANS).replace("　", " ")


def _compact(s: str) -> str:
    return re.sub(r"[\s　]+", "", s)


def _named_venue_section(text: str, venue_code: str, kind: str) -> str | None:
    """Extract a venue section from real B/K text when BBGN/KBGN markers are absent."""
    target = VENUE_NAMES.get(venue_code)
    if not target:
        return None
    lines = text.replace("\r\n", "\n").replace("\r", "\n").splitlines()
    tag = "［番組］" if kind == "B" else "［成績］"
    ascii_tag = "[番組]" if kind == "B" else "[成績]"
    starts = []
    for i, line in enumerate(lines):
        c = _compact(line)
        if (tag in line or ascii_tag in line) and any(name in c for name in VENUE_NAMES.values()):
            starts.append(i)
    for pos, start in enumerate(starts):
        if target in _compact(lines[start]):
            end = starts[pos + 1] if pos + 1 < len(starts) else len(lines)
            return "\n".join(lines[start:end])
    # Some B archives are already one-venue-per-file and have no bracket tag.
    # Accept the whole file only when the target venue name is explicitly present.
    if any(target in _compact(line) for line in lines[:40]):
        return "\n".join(lines)
    return None


def venue_blocks(text: str, kind: str) -> dict[str, str]:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    rx = BLOCK_B if kind == "B" else BLOCK_K
    out: dict[str, str] = {}
    for m in rx.finditer(normalized):
        out[m.group(1)] = m.group(0)
    # Real official files do not rely on our synthetic BBGN/KBGN fixture markers.
    for code in VENUE_NAMES:
        if code not in out:
            section = _named_venue_section(normalized, code, kind)
            if section:
                out[code] = section
    return out


def parse_program_block(block: str) -> dict[int, ProgramRace]:
    races: dict[int, ProgramRace] = {}
    current: int | None = None
    race_type = ""
    classes: dict[int, str] = {}

    def flush() -> None:
        nonlocal current, race_type, classes
        if current and set(classes) == set(range(1, 7)):
            ordered = tuple(classes[i] for i in range(1, 7))
            if all(x in VALID_CLASSES for x in ordered):
                races[current] = ProgramRace(current, ordered, race_type)

    for line in block.splitlines():
        nline = _norm_line(line)
        h = RACE_HEAD.search(nline)
        if h:
            flush()
            current = int(h.group(1))
            raw_type = normalize_type(h.group(2))
            tm = re.search(r"予選特選|予選|準優勝戦|優勝戦|一般特選|一般戦|特選|選抜戦|選抜", raw_type)
            race_type = tm.group(0) if tm else raw_type
            classes = {}
            continue
        if current is None:
            continue
        e = ENTRY.search(nline)
        if e:
            lane, grade = int(e.group(1)), e.group(2).upper()
            if lane not in classes:
                classes[lane] = grade
    flush()
    return races


def parse_result_block(block: str) -> dict[int, tuple[str, int]]:
    out: dict[int, tuple[str, int]] = {}
    current: int | None = None
    for line in block.splitlines():
        nline = _norm_line(line)
        # Real K format: each race begins with e.g. "1R ..." and payout is later "３連単 1-2-3 880".
        rh = re.search(r"^\s*(\d{1,2})R\s+", nline)
        if rh:
            current = int(rh.group(1))
        legacy = PAYOUT.search(nline)
        if legacy:
            race = int(legacy.group(1))
            result = legacy.group(2)
            payout = int(legacy.group(3).replace(",", ""))
        else:
            m = TRIFECTA.search(line)
            if not (m and current):
                continue
            race = current
            result = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            payout = int(m.group(4).replace(",", ""))
        if 1 <= race <= 12 and len(set(result.split("-"))) == 3 and payout > 0:
            out.setdefault(race, (result, payout))
    return out


def build_day(b_path: Path, k_path: Path, venue_code: str) -> list[dict]:
    date = date_from_path(b_path)
    if date_from_path(k_path) != date:
        raise ValueError(f"B/K date mismatch: {b_path.name} / {k_path.name}")
    b_blocks = venue_blocks(read_cp932(b_path), "B")
    k_blocks = venue_blocks(read_cp932(k_path), "K")
    if venue_code not in b_blocks or venue_code not in k_blocks:
        return []
    programs = parse_program_block(b_blocks[venue_code])
    results = parse_result_block(k_blocks[venue_code])
    rows = []
    for race in sorted(set(programs) & set(results)):
        p = programs[race]
        result, payout = results[race]
        rows.append({
            "d": date,
            "r": race,
            "c": list(p.classes),
            "o": result,
            "p": payout,
            "t": p.race_type,
            "id": f"{date}-{venue_code}-{race:02d}",
        })
    return rows



def validate_golden_payload(rows: list[dict], golden: dict) -> None:
    """Fail closed unless generated rows exactly match an independently verified day."""
    venue = str(golden.get("venueCode", "")).zfill(2)
    date = golden.get("date")
    expected = {int(r["r"]): r for r in golden.get("races", [])}
    actual = {int(r["r"]): r for r in rows if r.get("d") == date}
    errors = []
    if len(expected) != 12:
        errors.append(f"golden race count={len(expected)} (expected 12)")
    if set(actual) != set(expected):
        errors.append(f"race set actual={sorted(actual)} expected={sorted(expected)}")
    for race in sorted(set(actual) & set(expected)):
        a, e = actual[race], expected[race]
        for key in ("c", "o", "p", "t"):
            if a.get(key) != e.get(key):
                errors.append(f"{race}R {key}: actual={a.get(key)!r} expected={e.get(key)!r}")
    if any(r.get("id") != f"{date}-{venue}-{int(r['r']):02d}" for r in actual.values()):
        errors.append("reference id mismatch")
    if errors:
        raise ValueError("GOLDEN VALIDATION FAILED · " + " / ".join(errors[:20]))
    print(f"GOLDEN VALIDATION PASS · {date} · {len(actual)}/12")


def validate_golden(rows: list[dict], golden_path: Path) -> None:
    validate_golden_payload(rows, json.loads(golden_path.read_text(encoding="utf-8")))

def pair_files(b_dir: Path, k_dir: Path) -> Iterable[tuple[Path, Path]]:
    k_by_date: dict[str, Path] = {}
    for p in sorted(k_dir.glob("*")):
        if p.is_file():
            try:
                k_by_date[date_from_path(p)] = p
            except Exception:
                pass
    for b in sorted(b_dir.glob("*")):
        if not b.is_file():
            continue
        try:
            d = date_from_path(b)
        except Exception:
            continue
        k = k_by_date.get(d)
        if k:
            yield b, k


def write_years(rows: list[dict], out_root: Path, venue_code: str) -> list[Path]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    seen = set()
    for row in sorted(rows, key=lambda x: (x["d"], x["r"])):
        key = row["id"]
        if key in seen:
            continue
        seen.add(key)
        grouped[row["d"][:4]].append(row)
    target = out_root / venue_code
    target.mkdir(parents=True, exist_ok=True)
    written = []
    for year, year_rows in grouped.items():
        payload = {
            "schema": "boat-command-program-history-v1",
            "builder": VERSION,
            "venueCode": venue_code,
            "year": int(year),
            "races": year_rows,
        }
        path = target / f"{year}.json"
        path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        written.append(path)
    return written


def self_test() -> None:
    b = """STARTB\n07BBGN\nボートレース蒲 郡\n 1Ｒ 予 選 H1800m 電話投票締切予定15:21\n1 4171榎 幸司37長崎51A2 6.36 46.67\n2 3305小野信樹52岡山53B1 4.06 20.73\n3 4874池田奈津26福岡51B1 4.75 32.14\n4 3507藤井 徹49大阪52B1 4.08 15.07\n5 5146野田彩加17山口49B2 1.28 0.00\n6 4034西原明生41香川54A1 4.55 26.60\n07BEND\n"""
    k = """STARTK\n07KBGN\n蒲 郡［成績］\n [払戻金] ３連単 ３連複 ２連単 ２連複\n 1R  6-1-2    9820    1-2-6 500\n07KEND\n"""
    pb = venue_blocks(b, "B")["07"]
    kb = venue_blocks(k, "K")["07"]
    p = parse_program_block(pb)
    r = parse_result_block(kb)
    assert p[1].classes == ("A2", "B1", "B1", "B1", "B2", "A1")
    assert p[1].race_type == "予選"
    assert r[1] == ("6-1-2", 9820)

    # Real-format regression: no BBGN/KBGN markers, full-width race header, K payout section.
    real_b = """蒲　郡［番組］ 2025/12/15\n １Ｒ 一般戦 Ｈ1800m 電話投票締切予定15:21\n1 4171榎 幸司37長崎51A2 6.36\n2 3305小野信樹52岡山53B1 4.06\n3 4874池田奈津26福岡51B1 4.75\n4 3507藤井 徹49大阪52B1 4.08\n5 5146野田彩加17山口49B2 1.28\n6 4034西原明生41香川54A1 4.55\n"""
    real_k = """蒲　郡［成績］ 2025/12/15\n1R 一般戦 H1800m\n ３連単 6-1-2 9,820円 30番人気\n"""
    rb = venue_blocks(real_b, "B")["07"]
    rk = venue_blocks(real_k, "K")["07"]
    rp = parse_program_block(rb)
    rr = parse_result_block(rk)
    assert rp[1].classes == ("A2", "B1", "B1", "B1", "B2", "A1")
    assert rp[1].race_type == "一般戦"
    assert rr[1] == ("6-1-2", 9820)
    print("SELF-TEST PASS · legacy + real-format program/result parser")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--b-dir", type=Path, help="directory containing extracted B*.TXT files")
    ap.add_argument("--k-dir", type=Path, help="directory containing extracted K*.TXT files")
    ap.add_argument("--out", type=Path, default=Path("history"))
    ap.add_argument("--venue", default="07", help="two-digit venue code; Gamagori=07")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--golden", type=Path, help="independently verified JSON fixture; exact-match validation")
    ap.add_argument("--official-audit-20251215", action="store_true", help="validate exact 12R against BOAT RACE official Gamagori 2025-12-15 fixture")
    args = ap.parse_args()
    if args.self_test:
        self_test()
        return 0
    if not args.b_dir or not args.k_dir:
        ap.error("--b-dir and --k-dir are required unless --self-test is used")
    venue = str(args.venue).zfill(2)
    all_rows: list[dict] = []
    paired = 0
    errors = []
    for b, k in pair_files(args.b_dir, args.k_dir):
        paired += 1
        try:
            all_rows.extend(build_day(b, k, venue))
        except Exception as e:
            errors.append(f"{b.name}: {e}")
    if args.golden:
        validate_golden(all_rows, args.golden)
    if args.official_audit_20251215:
        validate_golden_payload(all_rows, OFFICIAL_GOLDEN_20251215)
    paths = write_years(all_rows, args.out, venue)
    print(f"{VERSION} · venue={venue} · paired_days={paired} · races={len(all_rows)} · files={len(paths)}")
    for p in paths:
        print(p)
    if errors:
        print(f"WARN · {len(errors)} day(s) skipped", file=sys.stderr)
        for x in errors[:20]:
            print(x, file=sys.stderr)
    return 0 if paths else 2


if __name__ == "__main__":
    raise SystemExit(main())
