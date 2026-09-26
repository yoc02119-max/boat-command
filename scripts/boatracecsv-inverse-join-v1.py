#!/usr/bin/env python3
"""Date-scoped, research-only BoatraceCSV pre/post/payout join.

No production writes. The third-party source is provisionally authoritative for
research labels, *not* certified accurate. Results never enter pre-race features.
Use --date YYYY-MM-DD --output /tmp/report.json for an independent sample.
"""
from __future__ import annotations

import argparse
import csv
import datetime as dt
import hashlib
import io
import json
import re
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JST = dt.timezone(dt.timedelta(hours=9))
BASE = "https://boatracecsv.github.io/data"
SOURCES = {
    "card": "programs/race_cards",
    "tkz": "previews/tkz",
    "stt": "previews/stt",
    "sui": "previews/sui",
    "result": "results/realtime",
    "payout": "results/payouts",
}
VENUES = {
    "01": "kiryu", "02": "toda", "03": "edogawa", "04": "heiwajima",
    "05": "tamagawa", "06": "hamanako", "07": "gamagori",
    "08": "tokoname", "09": "tsu", "10": "mikuni", "11": "biwako",
    "12": "suminoe", "13": "amagasaki", "14": "naruto", "15": "marugame",
    "16": "kojima", "17": "miyajima", "18": "tokuyama",
    "19": "shimonoseki", "20": "wakamatsu", "21": "ashiya",
    "22": "fukuoka", "23": "karatsu", "24": "omura",
}
BOAT_CARD = {
    "class": "級別", "nationalWinRate": "全国勝率",
    "national2Rate": "全国2連対率", "national3Rate": "全国3連対率",
    "localWinRate": "当地勝率", "local2Rate": "当地2連対率",
    "local3Rate": "当地3連対率", "averageST": "全国平均ST",
    "motor": "モーター番号", "motor2Rate": "モーター2連対率",
    "motor3Rate": "モーター3連対率", "boat": "ボート番号",
    "boat2Rate": "ボート2連対率", "boat3Rate": "ボート3連対率",
}
BOAT_TKZ = {"weightKg": "体重(kg)", "adjustWeightKg": "体重調整(kg)",
            "exhibitionTime": "展示タイム", "tilt": "チルト"}
BOAT_STT = {"exhibitionCourse": "コース", "exhibitionST": "スタート展示"}
WATER = {"observationTime": "気象観測時刻", "windSpeedMps": "風速(m)",
         "windDirectionRaw": "風向", "waveHeightCm": "波の高さ(cm)",
         "weatherRaw": "天候", "airTempC": "気温(℃)", "waterTempC": "水温(℃)"}


def compact_code(date: str, code: str, race: int) -> str:
    return date.replace("-", "") + code + f"{race:02d}"


def valid_race_code(v: str, date: str) -> bool:
    return bool(re.fullmatch(re.escape(date.replace("-", "")) + r"\d{4}", v))


def normalize_order(v) -> str | None:
    if isinstance(v, (list, tuple)):
        v = "-".join(str(x) for x in v)
    raw = re.sub(r"\s+", "", str(v or ""))
    # Reject refunds/cancellations and duplicate lanes rather than forcing labels.
    if not re.fullmatch(r"[1-6]-[1-6]-[1-6]", raw):
        return None
    return raw if len(set(raw.split("-"))) == 3 else None


def normalize_money(v) -> int | None:
    raw = str(v if v is not None else "").replace(",", "").strip()
    if not raw or not re.fullmatch(r"\d+", raw):
        return None
    return int(raw)


def legacy_labels(r: dict) -> dict:
    """Legacy rich-history labels might have different versioned key names."""
    actual = next((normalize_order(r[k]) for k in ("o", "actual", "trifecta")
                   if k in r and normalize_order(r[k])), None)
    p = next((normalize_money(r[k]) for k in ("p", "payout100", "payout")
              if k in r and normalize_money(r[k]) is not None), None)
    return {"actual": actual, "payout100": p}


def load_target_day(root: Path, date: str) -> dict:
    targets = {}
    for path in sorted((root / "rich-history-24").glob("*-rich-history-v1.json")):
        slug = path.name.removesuffix("-rich-history-v1.json")
        doc = json.loads(path.read_text(encoding="utf-8"))
        code = str(doc["venueCode"]).zfill(2)
        if VENUES.get(code) != slug:
            raise ValueError(f"VENUE_FILE_IDENTITY: {path}")
        for race in doc.get("races", []):
            if race.get("d") != date:
                continue
            boats = sorted(race.get("boats", []), key=lambda b: int(b.get("lane") or 0))
            if len(boats) != 6 or [int(b.get("lane") or 0) for b in boats] != list(range(1, 7)):
                continue
            ids = [int(b.get("registration") or 0) for b in boats]
            if any(x <= 0 for x in ids):
                continue
            key = compact_code(date, code, int(race["r"]))
            if key in targets:
                raise ValueError(f"DUPLICATE_TARGET: {key}")
            targets[key] = {
                "date": date, "venue": slug, "venueCode": code,
                "race": int(race["r"]), "registrations": ids,
                "legacyLabels": legacy_labels(race),
            }
    return targets


def fetch_source(source: str, date: str, fetcher=None) -> tuple[dict, dict]:
    """Injected fetcher(url)->bytes is used by network-free unit tests."""
    y, m, d = date.split("-")
    url = f"{BASE}/{SOURCES[source]}/{y}/{m}/{d}.csv"
    if fetcher is None:
        def fetcher(url):
            req = urllib.request.Request(url, headers={"User-Agent": "BOAT-COMMAND-RESEARCH-ONLY/1.0"})
            with urllib.request.urlopen(req, timeout=35) as response:
                return response.read()
    try:
        raw = fetcher(url)
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise
        return {}, {"url": url, "status": "HTTP_404", "sha256": None, "rows": 0}
    except FileNotFoundError:
        return {}, {"url": url, "status": "NOT_FOUND", "sha256": None, "rows": 0}
    rows = {}
    try:
        for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
            key = str(row.get("レースコード") or "").strip()
            if not valid_race_code(key, date):
                continue
            if key in rows:
                raise ValueError(f"DUPLICATE_SOURCE_ROW: {source} {key}")
            rows[key] = row
    except UnicodeError as exc:
        raise ValueError(f"CSV_ENCODING: {source}") from exc
    return rows, {"url": url, "status": "OK",
                  "sha256": hashlib.sha256(raw).hexdigest(), "rows": len(rows)}


def registration_ids(card: dict) -> list:
    try:
        return [int(card[f"艇{i}_登録番号"]) for i in range(1, 7)]
    except (KeyError, TypeError, ValueError):
        return []


def boat_fields(row: dict, fields: dict) -> list:
    return [{name: row.get(f"艇{i}_{suffix}") or None for name, suffix in fields.items()}
            for i in range(1, 7)]


def timestamp_jst(raw: str) -> dt.datetime | None:
    try:
        parsed = dt.datetime.fromisoformat(str(raw))
        return parsed.astimezone(JST) if parsed.tzinfo else None
    except (TypeError, ValueError):
        return None


def parse_deadline(date: str, rows: list) -> dt.datetime | None:
    times = {str(row.get("締切時刻")).strip() for row in rows
             if row and row.get("締切時刻")}
    if len(times) != 1:
        return None
    hhmm = next(iter(times))
    if not re.fullmatch(r"\d{2}:\d{2}", hhmm):
        return None
    try:
        return dt.datetime.fromisoformat(date + "T" + hhmm).replace(tzinfo=JST)
    except ValueError:
        return None


def freeze_preview(row: dict, section: str, cutoff: dt.datetime | None) -> dict:
    if not row:
        return {"status": "MISSING", "acquiredAt": None, "value": None}
    stamp = timestamp_jst(row.get("取得日時", ""))
    if cutoff is None:
        status = "DEADLINE_UNKNOWN"
    elif stamp is None:
        status = "TIMESTAMP_UNKNOWN"
    elif stamp > cutoff:
        status = "AFTER_T_MINUS_3"
    else:
        status = "ELIGIBLE_T_MINUS_3"
    fields = BOAT_TKZ if section == "tkz" else BOAT_STT if section == "stt" else WATER
    payload = (boat_fields(row, fields) if section != "sui" else
               {name: row.get(suffix) or None for name, suffix in WATER.items()})
    # Preserve excluded payload ONLY in diagnostic branch; consumers may ONLY read value.
    return {"status": status, "acquiredAt": stamp.isoformat() if stamp else None,
            "value": payload if status == "ELIGIBLE_T_MINUS_3" else None}


def actual_course_start(row: dict) -> list:
    output = []
    for course in range(1, 7):
        raw = str(row.get(f"{course}コース_艇番") or "")
        if raw and raw not in ("1", "2", "3", "4", "5", "6"):
            return []
        output.append({
            "course": course, "boat": int(raw) if raw else None,
            "actualST": row.get(f"{course}コース_スタートタイミング") or None,
            "flyingRaw": row.get(f"{course}コース_F") or None,
        })
    valid = [r["boat"] for r in output if r["boat"] is not None]
    return output if len(valid) == 6 and set(valid) == set(range(1, 7)) else []


def join_race(target: dict, sources: dict) -> dict:
    key = compact_code(target["date"], target["venueCode"], target["race"])
    rows = {k: v.get(key) for k, v in sources.items()}
    card = rows["card"]
    if not card:
        return {"raceCode": key, "status": "NO_CARD"}
    if registration_ids(card) != target["registrations"]:
        return {"raceCode": key, "status": "SIX_RACER_IDENTITY_REJECTED"}
    if any(v and str(v.get("レース日") or "") != target["date"] for v in rows.values()):
        return {"raceCode": key, "status": "SOURCE_DATE_CONFLICT"}

    deadline = parse_deadline(target["date"], [rows[k] for k in ("tkz", "stt", "sui", "result", "payout")])
    cutoff = deadline - dt.timedelta(minutes=3) if deadline else None
    previews = {k: freeze_preview(rows[k], k, cutoff) for k in ("tkz", "stt", "sui")}
    actual_row, payout_row = rows["result"], rows["payout"]
    actual = (normalize_order([actual_row.get(f"{i}着_艇番") for i in (1, 2, 3)])
              if actual_row else None)
    payout_order = normalize_order(payout_row.get("3連単_組番")) if payout_row else None
    payout = normalize_money(payout_row.get("3連単_払戻金")) if payout_row else None
    legacy = target["legacyLabels"]
    conflicts = []
    if actual and payout_order and actual != payout_order:
        conflicts.append("THIRD_PARTY_RESULT_VS_PAYOUT_ORDER")
    if actual and legacy["actual"] and actual != legacy["actual"]:
        conflicts.append("ORIGINAL_VS_THIRD_PARTY_ORDER")
    if payout is not None and legacy["payout100"] is not None and payout != legacy["payout100"]:
        conflicts.append("ORIGINAL_VS_THIRD_PARTY_PAYOUT")
    valid_label = bool(actual and payout_order == actual and payout is not None and not conflicts)
    status = ("ACCEPTED" if valid_label else
              "LABEL_CONFLICT" if conflicts else "LABEL_INCOMPLETE")
    # Post-race labels and genuine actual entry/ST are kept outside all PRE sections.
    outcome = None
    if valid_label:
        outcome = {
            "actual": actual, "payout100": payout,
            "winningBoat": int(actual.split("-")[0]),
            "decisionRaw": (actual_row.get("決まり手") or "").strip() if actual_row else None,
            "actualCourseStart": actual_course_start(actual_row),
            "resultAcquiredAt": actual_row.get("取得日時"),
            "payoutAcquiredAt": payout_row.get("取得日時"),
        }
    return {
        "raceCode": key, "date": target["date"], "venue": target["venue"],
        "venueCode": target["venueCode"], "race": target["race"],
        "status": status, "identityMatch": True,
        "conflicts": conflicts,
        "deadlineJst": deadline.isoformat() if deadline else None,
        "predictionCutoffJst": cutoff.isoformat() if cutoff else None,
        "pre": {
            # Date-level card has no timestamp. Excludes all same-meet prior results.
            "cardTiming": "UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL",
            "boats": boat_fields(card, BOAT_CARD),
            "tkz": previews["tkz"], "stt": previews["stt"], "sui": previews["sui"],
        },
        "post": outcome,
        "legacyLabelAvailable": bool(legacy["actual"] and legacy["payout100"] is not None),
    }


def build_day(root: Path, date: str, fetcher=None) -> dict:
    dt.date.fromisoformat(date)
    targets = load_target_day(root, date)
    if not targets:
        return {"schema": "boat-command-inverse-join-v1", "date": date,
                "researchOnly": True, "productionChanged": False,
                "status": "NO_EXISTING_TARGETS", "sourceAudit": {},
                "summary": {"targetRaces": 0, "accepted": 0}, "races": []}
    sources, audits = {}, {}
    for key in SOURCES:
        sources[key], audits[key] = fetch_source(key, date, fetcher=fetcher)
    races = [join_race(targets[key], sources) for key in sorted(targets)]
    counter = Counter(r["status"] for r in races)
    pre_eligible = Counter()
    for race in races:
        if race.get("status") not in ("ACCEPTED", "LABEL_INCOMPLETE", "LABEL_CONFLICT"):
            continue
        for section in ("tkz", "stt", "sui"):
            if race["pre"][section]["status"] == "ELIGIBLE_T_MINUS_3":
                pre_eligible[section] += 1
    return {
        "schema": "boat-command-inverse-join-v1",
        "date": date, "researchOnly": True, "productionChanged": False,
        "predictionInputChanged": False, "tryChanged": False,
        "sourcePolicy": "THIRD_PARTY_PROVISIONAL_RESEARCH_AUTHORITY",
        "prePostSeparated": True, "strictCardTimeValid": False,
        "sourceAudit": audits,
        "summary": {
            "targetRaces": len(targets), "accepted": counter["ACCEPTED"],
            "status": dict(counter), "preTMinus3Eligible": dict(pre_eligible),
            "legacyLabelCrosschecked": sum(bool(x.get("legacyLabelAvailable")) for x in races),
            "sourceFileCountOK": sum(a["status"] == "OK" for a in audits.values()),
        },
        "races": races,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", required=True, help="YYYY-MM-DD within existing rich-history")
    parser.add_argument("--output", required=True, help="Research-only JSON path, no production paths")
    args = parser.parse_args()
    out = Path(args.output).resolve()
    blocked = [ROOT / p for p in ("live", "venues", "baseline", "daily-lab", "rich-history-24")]
    if out == ROOT / "index.html" or any(out == p or p in out.parents for p in blocked):
        parser.error("OUTPUT_MUST_NOT_TOUCH_PRODUCTION_OR_EXISTING_HISTORY")
    if out.exists():
        parser.error("IMMUTABLE_OUTPUT_ALREADY_EXISTS")
    report = build_day(ROOT, args.date)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("RESEARCH_INVERSE_JOIN", json.dumps({
        "date": args.date, "summary": report["summary"],
        "output": str(out)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
