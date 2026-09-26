#!/usr/bin/env python3
"""Offline regression suite for third-party inverse research boundaries."""
import csv
import datetime as dt
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "boatracecsv-inverse-join-v1.py"
spec = importlib.util.spec_from_file_location("boatracecsv_inverse_join_v1", SCRIPT)
research = importlib.util.module_from_spec(spec)
spec.loader.exec_module(research)
DATE = "2026-09-01"
RC = research.compact_code(DATE, "21", 1)
NAMES = ["甲", "乙", "丙", "丁", "戊", "己"]


def make_csv(row):
    out = io.StringIO()
    writer = csv.DictWriter(out, fieldnames=list(row))
    writer.writeheader()
    writer.writerow(row)
    return out.getvalue().encode("utf-8")


def source_rows(exhibition_time="2026-09-01T08:22:00+09:00",
                payout_order="6-2-3", legacy_mismatch=False):
    head = {"レースコード": RC, "レース日": DATE}
    card = dict(head)
    for i in range(1, 7):
        card[f"艇{i}_登録番号"] = str(3000 + i)
        card[f"艇{i}_級別"] = "B1"
        card[f"艇{i}_モーター2連対率"] = "40"
        card[f"艇{i}_節D1走1_着順"] = "1"  # NEVER include in saved pre fields.
    pre = dict(head, **{"締切時刻": "08:32", "取得日時": exhibition_time})
    tkz = dict(pre)
    stt = dict(pre)
    for i in range(1, 7):
        tkz[f"艇{i}_展示タイム"] = str(6.7 + i / 100)
        stt[f"艇{i}_コース"] = str(i)
        stt[f"艇{i}_スタート展示"] = "0.05"
    sui = dict(pre, **{"風速(m)": "2", "波の高さ(cm)": "1", "風向": "3"})
    result = dict(pre, **{
        "1着_艇番": "6", "2着_艇番": "2", "3着_艇番": "3",
        "決まり手": "まくり差し",
    })
    for i in range(1, 7):
        result[f"{i}コース_艇番"] = str(i)
        result[f"{i}コース_スタートタイミング"] = "0.1"
    payout = dict(pre, **{"3連単_組番": payout_order, "3連単_払戻金": "152730"})
    return {k: make_csv(v) for k, v in {
        "card": card, "tkz": tkz, "stt": stt,
        "sui": sui, "result": result, "payout": payout,
    }.items()}


def fake_root(base, original="6-2-3", payout=152730, bad_id=False):
    rich = base / "rich-history-24"
    rich.mkdir(parents=True)
    boats = [{"lane": i, "registration": 3000 + i, "class": "B1"}
             for i in range(1, 7)]
    if bad_id:
        boats[-1]["registration"] = 9999
    file = rich / "ashiya-rich-history-v1.json"
    doc = {"venueCode": "21", "races": [
        {"d": DATE, "r": 1, "boats": boats, "o": original, "p": payout},
        {"d": "2026-09-02", "r": 1, "boats": boats, "o": "1-2-3", "p": 2000},
    ]}
    file.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
    return base


def fake_fetch(data):
    def download(url):
        section = next((s for s, sub in research.SOURCES.items() if "/" + sub + "/" in url), None)
        if section is None:
            raise AssertionError(url)
        return data[section]
    return download


class InverseJoinV1Tests(unittest.TestCase):
    def test_complete_join_and_prepost_boundary(self):
        with tempfile.TemporaryDirectory() as temp:
            report = research.build_day(fake_root(Path(temp)), DATE, fake_fetch(source_rows()))
        self.assertTrue(report["researchOnly"])
        self.assertFalse(report["productionChanged"])
        self.assertTrue(report["prePostSeparated"])
        self.assertEqual(report["summary"]["accepted"], 1)
        row = report["races"][0]
        self.assertEqual(row["raceCode"], RC)
        self.assertEqual(row["post"]["actual"], "6-2-3")
        self.assertEqual(row["post"]["payout100"], 152730)
        self.assertEqual(row["post"]["decisionRaw"], "まくり差し")
        self.assertEqual(len(row["post"]["actualCourseStart"]), 6)
        self.assertEqual(row["pre"]["tkz"]["status"], "ELIGIBLE_T_MINUS_3")
        self.assertEqual(row["pre"]["sui"]["value"]["windSpeedMps"], "2")
        self.assertEqual(row["pre"]["cardTiming"], "UNKNOWN_UNVERIFIED_FOR_STRICT_MODEL")
        self.assertNotIn("actual", json.dumps(row["pre"], ensure_ascii=False))
        self.assertNotIn("節D", json.dumps(row["pre"], ensure_ascii=False))
        self.assertNotIn("決まり手", json.dumps(row["pre"], ensure_ascii=False))

    def test_late_preview_cannot_enter_pre_features(self):
        late = "2026-09-01T08:31:00+09:00"
        with tempfile.TemporaryDirectory() as temp:
            report = research.build_day(fake_root(Path(temp)), DATE,
                                        fake_fetch(source_rows(exhibition_time=late)))
        row = report["races"][0]
        for name in ("tkz", "stt", "sui"):
            self.assertEqual(row["pre"][name]["status"], "AFTER_T_MINUS_3")
            self.assertIsNone(row["pre"][name]["value"])
        self.assertEqual(report["summary"]["accepted"], 1)

    def test_identity_gate_rejects_source(self):
        with tempfile.TemporaryDirectory() as temp:
            report = research.build_day(fake_root(Path(temp), bad_id=True), DATE,
                                        fake_fetch(source_rows()))
        self.assertEqual(report["summary"]["accepted"], 0)
        self.assertEqual(report["races"][0]["status"], "SIX_RACER_IDENTITY_REJECTED")

    def test_third_party_internal_payout_conflict_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            report = research.build_day(fake_root(Path(temp)), DATE,
                                        fake_fetch(source_rows(payout_order="1-2-3")))
        row = report["races"][0]
        self.assertEqual(row["status"], "LABEL_CONFLICT")
        self.assertIsNone(row["post"])
        self.assertIn("THIRD_PARTY_RESULT_VS_PAYOUT_ORDER", row["conflicts"])

    def test_legacy_label_conflict_quarantined(self):
        with tempfile.TemporaryDirectory() as temp:
            report = research.build_day(fake_root(Path(temp), original="2-1-3"), DATE,
                                        fake_fetch(source_rows()))
        row = report["races"][0]
        self.assertEqual(row["status"], "LABEL_CONFLICT")
        self.assertIn("ORIGINAL_VS_THIRD_PARTY_ORDER", row["conflicts"])

    def test_invalid_race_order(self):
        self.assertIsNone(research.normalize_order("1-1-2"))
        self.assertIsNone(research.normalize_order("返還"))
        self.assertEqual(research.normalize_order([6, 2, 3]), "6-2-3")
        self.assertIsNone(research.normalize_money("中止"))

    def test_no_targets_makes_no_remote_requests(self):
        with tempfile.TemporaryDirectory() as temp:
            base = Path(temp)
            (base / "rich-history-24").mkdir()
            result = research.build_day(base, DATE, lambda _: self.fail("network called"))
        self.assertEqual(result["status"], "NO_EXISTING_TARGETS")
        self.assertEqual(result["summary"]["accepted"], 0)

    def test_missing_source_is_incomplete_not_success(self):
        rows = source_rows()
        def missing_payout(url):
            section = next(s for s, sub in research.SOURCES.items() if "/" + sub + "/" in url)
            if section == "payout":
                raise FileNotFoundError()
            return rows[section]
        with tempfile.TemporaryDirectory() as temp:
            report = research.build_day(fake_root(Path(temp)), DATE, missing_payout)
        self.assertEqual(report["races"][0]["status"], "LABEL_INCOMPLETE")
        self.assertEqual(report["summary"]["sourceFileCountOK"], 5)


if __name__ == "__main__":
    unittest.main()
